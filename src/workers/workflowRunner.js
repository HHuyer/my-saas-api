/**
 * Workflow Runner
 * Executes a workflow run through its nodes (in-process engine).
 *
 * The workflow `definition` is stored as a JSON string in the DB. This runner
 * parses it, walks the nodes (following connections/edges), executes each node
 * for real, records per-node logs, passes data through a shared context and
 * finally marks the run COMPLETED or FAILED.
 *
 * Node shapes from different sources are normalized so templates, test fixtures
 * and executor-style definitions all work:
 *   - executor:  { type, config, inputs }
 *   - template:  { id, type, label, x, y, properties } (actions carry actionType)
 *   - fixture:   { id, type, position } + connections [{from, to}]
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const ai = require('../ai');

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

/**
 * Interpolate a template string, resolving {{path}} references against context.
 */
function interpolate(value, context) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([^{}]+)\s*\}\}/g, (match, path) => {
    const resolved = getPath(context, path.trim());
    if (resolved === undefined || resolved === null) return match;
    return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
  });
}

/**
 * Resolve a dot/bracket path (e.g. "result.text") from an object.
 */
function getPath(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (part === '') continue;
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Safe condition evaluator - supports comparisons, logical operators and
 * context variables. Never uses eval(). Context keys are injected as named
 * function parameters so bare identifiers (e.g. "userType === 'premium'") work.
 */
function evaluateCondition(expression, context) {
  if (expression === undefined || expression === null) return false;
  if (typeof expression === 'boolean') return expression;

  const interpolated = String(expression).replace(
    /\{\{\s*([^{}]+)\s*\}\}/g,
    (match, path) => {
      const resolved = getPath(context, path.trim());
      if (resolved === undefined || resolved === null) return '""';
      if (typeof resolved === 'number') return String(resolved);
      return JSON.stringify(typeof resolved === 'string' ? resolved : JSON.stringify(resolved));
    }
  );

  const unsafe = /(eval|function|=>|;|import|require|\bnew\b|\bawait\b|\breturn\b)/i;
  if (unsafe.test(interpolated)) {
    throw new Error(`Unsafe condition expression: ${expression}`);
  }

  const keys = Object.keys(context || {});
  // eslint-disable-next-line no-new-func
  const fn = new Function(...keys, `return Boolean(${interpolated});`);
  return Boolean(fn(...keys.map(k => context[k])));
}

// ---------------------------------------------------------------------------
// Node normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a node into { type, config, inputs } regardless of source shape.
 */
function normalizeNode(node) {
  if (!node || typeof node !== 'object') {
    return { type: 'noop', config: {}, inputs: {} };
  }

  let type = node.type || 'noop';

  // Template actions store their real action under properties.actionType
  if (type === 'action' && node.properties && node.properties.actionType) {
    type = node.properties.actionType;
  }

  const config = node.config ?? node.properties ?? node.data ?? {};
  const inputs = node.inputs ?? {};

  return { id: node.id, type, config, inputs, label: node.label };
}

// ---------------------------------------------------------------------------
// Executor dispatch
// ---------------------------------------------------------------------------

class WorkflowRunner {
  /**
   * Execute a workflow run.
   * @param {object} params - { workflow, runId, userId, context }
   */
  async runWorkflow({ workflow, runId, userId, context = {} }) {
    let definition;
    try {
      definition = typeof workflow.definition === 'string'
        ? JSON.parse(workflow.definition)
        : workflow.definition;
    } catch (e) {
      await this.markRun(runId, 'FAILED', { errorMessage: `Invalid workflow definition: ${e.message}` });
      return;
    }

    try {
      // Mark running
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'RUNNING', startedAt: new Date() }
      });

      const nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
      if (nodes.length === 0) {
        await this.markRun(runId, 'COMPLETED', { context });
        return;
      }

      const edges = definition.connections ?? definition.edges ?? [];
      const result = await this.executeNodes(nodes, edges, context, runId, userId);

      await this.markRun(runId, 'COMPLETED', { context: result.context, output: result.context });
    } catch (error) {
      logger.error(`Workflow run ${runId} failed:`, error);
      await this.markRun(runId, 'FAILED', { errorMessage: error.message });
    }
  }

  /**
   * Execute nodes in dependency order, honoring condition branches.
   */
  async executeNodes(nodes, edges, context, runId, userId) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const normalized = new Map(nodes.map(n => [n.id, normalizeNode(n)]));

    // Build adjacency: from -> to[]
    const adjacency = new Map();
    for (const edge of edges) {
      const from = edge.from || edge.source;
      const to = edge.to || edge.target;
      if (!from || !to) continue;
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ to, label: edge.label });
    }

    // Identify start nodes: nodes not referenced as a target
    const targets = new Set(edges.map(e => e.to || e.target));
    const startNodes = nodes.filter(n => !targets.has(n.id)).map(n => n.id);
    const executionOrder = startNodes.length > 0 ? startNodes : nodes.map(n => n.id);

    const visited = new Set();
    const collected = { context };

    const visit = async (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = normalized.get(nodeId);
      if (!node) return;

      const output = await this.executeNode(node, { ...collected.context }, runId, userId);
      if (output !== undefined && output !== null) {
        collected.context[node.id || nodeId] = output;
      }

      const next = adjacency.get(nodeId) || [];
      for (const neighbor of next) {
        // Condition nodes branch on their result
        if (node.type === 'condition' || node.type === 'conditional') {
          const result = Boolean(output && output.result !== undefined ? output.result : collected.context[node.id || nodeId]);
          const branch = result ? 'true' : 'false';
          const match = next.find(e => !e.label || e.label === branch) || next[0];
          if (match && !visited.has(match.to)) {
            await visit(match.to);
          }
          continue;
        }
        await visit(neighbor.to);
      }
    };

    for (const nodeId of executionOrder) {
      await visit(nodeId);
    }

    return { context: collected.context };
  }

  /**
   * Execute a single node and record its log.
   */
  async executeNode(node, context, runId, userId) {
    const started = Date.now();
    try {
      const output = await this.dispatch(node, context, userId);
      const duration = Date.now() - started;

      await prisma.workflowNodeLog.create({
        data: {
          workflowRunId: runId,
          nodeId: node.id || node.label || node.type,
          status: 'SUCCESS',
          errorMessage: null
        }
      });

      logger.info(`Node ${node.type} (${node.id || node.label}) done in ${duration}ms`);
      return output;
    } catch (error) {
      const duration = Date.now() - started;

      await prisma.workflowNodeLog.create({
        data: {
          workflowRunId: runId,
          nodeId: node.id || node.label || node.type,
          status: 'FAILED',
          errorMessage: error.message
        }
      });

      logger.error(`Node ${node.type} failed after ${duration}ms:`, error.message);
      throw error;
    }
  }

  /**
   * Dispatch a node to the right handler.
   */
  async dispatch(node, context, userId) {
    const { type, config, inputs } = node;

    switch (type) {
      case 'llm':
      case 'ai':
      case 'openai':
      case 'text':
        return this.executeLLM(config, inputs, context);

      case 'http_request':
      case 'http':
        return this.executeHttp(config, context);

      case 'webhook':
        return this.executeWebhook(config, context);

      case 'email':
      case 'sendEmail':
      case 'send_email':
        return this.executeEmail(config, context, userId);

      case 'database_query':
      case 'database':
        return this.executeDatabaseQuery(config, context, userId);

      case 'condition':
      case 'conditional':
        return this.executeCondition(config, inputs, context);

      case 'transform':
        return this.executeTransform(config, context);

      case 'delay':
        return this.executeDelay(config);

      case 'noop':
      case 'start':
      case 'trigger':
      case 'process':
      case 'output':
      default:
        // Pass-through: nothing to execute (visual/structural nodes)
        return null;
    }
  }

  /**
   * Replace {{var}} references in all string fields of a config object.
   */
  interpolateConfig(config, context) {
    if (!config || typeof config !== 'object') return config;
    const out = Array.isArray(config) ? [] : {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        out[key] = interpolate(value, context);
      } else if (typeof value === 'object' && value !== null) {
        out[key] = this.interpolateConfig(value, context);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  async executeLLM(config, inputs, context) {
    const resolved = this.interpolateConfig(config, context);
    const prompt = resolved.prompt ?? resolved.message ?? inputs.prompt ?? '';

    const result = await ai.complete({
      provider: resolved.provider,
      model: resolved.model,
      prompt,
      temperature: resolved.temperature
    });

    return { text: result.text, provider: result.provider, model: result.model, usage: 'n/a' };
  }

  async executeHttp(config, context) {
    const resolved = this.interpolateConfig(config, context);
    const method = (resolved.method || 'GET').toUpperCase();
    const url = resolved.url || resolved.endpoint;

    if (!url) throw new Error('http_request node requires a url');

    const response = await axios({
      method,
      url,
      headers: resolved.headers || {},
      params: resolved.params || {},
      data: resolved.body || (resolved.jsonPayload ? JSON.parse(JSON.stringify(resolved.jsonPayload)) : undefined),
      timeout: resolved.timeout || 15000,
      validateStatus: () => true
    });

    return {
      statusCode: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    };
  }

  async executeWebhook(config, context) {
    // A webhook node is essentially an authenticated POST
    const resolved = this.interpolateConfig(config, context);
    const url = resolved.url || resolved.endpoint;
    if (!url) throw new Error('webhook node requires a url');

    const response = await axios({
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
        ...(resolved.headers || {}),
        ...(resolved.secret ? { 'X-Webhook-Secret': resolved.secret } : {})
      },
      data: resolved.payload || resolved.body || {},
      timeout: 15000,
      validateStatus: () => true
    });

    return { statusCode: response.status, data: response.data };
  }

  async executeEmail(config, context, userId) {
    const resolved = this.interpolateConfig(config, context);
    if (!process.env.SMTP_HOST) {
      return { success: true, skipped: true, reason: 'SMTP not configured' };
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    });

    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    const info = await transporter.sendMail({
      from: resolved.from || process.env.SMTP_FROM || 'no-reply@example.com',
      to: resolved.to || resolved.recipient || (user && user.email) || '',
      subject: resolved.subject || 'Workflow notification',
      text: resolved.body || resolved.message || ''
    });

    return { success: true, messageId: info.messageId, to: resolved.to || (user && user.email) };
  }

  async executeDatabaseQuery(config, context, userId) {
    const resolved = this.interpolateConfig(config, context);
    const query = (resolved.query || resolved.sql || '').trim();

    if (!query) throw new Error('database_query node requires a query');

    // Safety: only allow read-only SELECT statements
    if (!/^SELECT\b/i.test(query)) {
      throw new Error('database_query node only supports SELECT statements');
    }
    if (query.includes(';')) {
      throw new Error('database_query node does not allow multiple statements');
    }

    let rows;
    try {
      rows = await prisma.$queryRawUnsafe(query);
    } catch (e) {
      throw new Error(`database_query failed: ${e.message}`);
    }

    return { success: true, rowCount: Array.isArray(rows) ? rows.length : 0, rows };
  }

  async executeCondition(config, inputs, context) {
    const expression = config.condition ?? config.expression ?? inputs.condition ?? '';
    const result = evaluateCondition(expression, context);
    return { result };
  }

  async executeTransform(config, context) {
    const resolved = this.interpolateConfig(config, context);
    const value = interpolate(resolved.value ?? resolved.input ?? '', context);
    const transform = (resolved.transform || resolved.operation || 'uppercase').toLowerCase();

    switch (transform) {
      case 'uppercase':
        return { result: String(value).toUpperCase() };
      case 'lowercase':
        return { result: String(value).toLowerCase() };
      case 'trim':
        return { result: String(value).trim() };
      case 'replace': {
        const search = resolved.search ?? '';
        const replace = resolved.replacement ?? '';
        return { result: String(value).split(search).join(replace) };
      }
      case 'json_parse':
        return { result: JSON.parse(String(value)) };
      case 'json_stringify':
        return { result: JSON.stringify(value) };
      case 'length':
        return { result: String(value).length };
      default:
        return { result: String(value) };
    }
  }

  async executeDelay(config) {
    const ms = parseInt(config.seconds ? config.seconds * 1000 : config.ms) || 0;
    if (ms > 0) {
      await new Promise(resolve => setTimeout(resolve, ms));
    }
    return { waitedMs: ms };
  }

  async markRun(runId, status, extras = {}) {
    const data = {
      status,
      completedAt: new Date()
    };
    if (extras.errorMessage) data.errorMessage = extras.errorMessage;
    if (extras.output) data.output = JSON.stringify(extras.output);

    await prisma.workflowRun.update({ where: { id: runId }, data });
  }
}

module.exports = new WorkflowRunner();
