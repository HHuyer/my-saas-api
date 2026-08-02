/**
 * Workflow Execution Tests
 * Verifies that runs move through PENDING -> RUNNING -> COMPLETED (or FAILED),
 * that nodes execute for real with per-node logs, and that the AI (llm) node
 * works via mock when no API key is configured.
 */

const request = require('supertest');
const app = require('../src/index');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getUniqueName(base) {
  return `${base}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Local cleanup in dependency order (same as api.test.js)
async function cleanupTestData(userId) {
  try {
    await prisma.workflowNodeLog.deleteMany({ where: { workflowRun: { workflow: { project: { userId } } } } });
    await prisma.workflowRun.deleteMany({ where: { workflow: { project: { userId } } } });
    await prisma.scheduledWorkflowLog.deleteMany({ where: { scheduledWorkflow: { userId } } });
    await prisma.scheduledWorkflow.deleteMany({ where: { userId } });
    await prisma.sharedWorkflow.deleteMany({ where: { OR: [{ userId }, { sharedWithId: userId }] } });
    await prisma.workflow.deleteMany({ where: { project: { userId } } });
    await prisma.project.deleteMany({ where: { userId } });
  } catch (err) {
    // ignore
  }
}

const TEST_EMAIL = 'wf-exec-test@example.com';

// Poll GET /api/runs/:id until it reaches a terminal status or times out
async function waitForRun(token, runId, timeoutMs = 15000) {
  const start = Date.now();
  const terminal = new Set(['COMPLETED', 'FAILED', 'STOPPED']);
  let last;
  while (Date.now() - start < timeoutMs) {
    const res = await request(app)
      .get(`/api/runs/${runId}`)
      .set('Authorization', `Bearer ${token}`);
    last = res.body;
    if (terminal.has(res.body.status)) {
      return res.body;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Run ${runId} did not reach terminal status (last: ${last?.status})`);
}

describe('Workflow Execution', () => {
  let authToken;
  let userId;
  let projectId;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/test-login')
      .send({ email: TEST_EMAIL, password: 'password123' });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    await cleanupTestData(userId);

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: getUniqueName('WF Exec Project'),
        description: 'workflow execution test project'
      });
    projectId = projectRes.body.id;
  });

  afterAll(async () => {
    await cleanupTestData(userId);
  });

  async function createWorkflow(def, name) {
    const res = await request(app)
      .post(`/api/projects/${projectId}/workflows`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name, description: 'wf exec test', definition: def });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  describe('Happy path execution', () => {
    it('should run nodes and reach COMPLETED with analytics fields', async () => {
      const workflowId = await createWorkflow({
        nodes: [
          { id: 'start', type: 'start' },
          { id: 'llm', type: 'llm', config: { prompt: 'Summarize the key ideas' } },
          { id: 'transform', type: 'transform', config: { value: '{{llm.text}}', transform: 'uppercase' } },
          { id: 'delay', type: 'delay', config: { ms: 5 } },
          { id: 'condition', type: 'condition', config: { condition: "'{{transform.result}}'.length > 0" } },
          { id: 'action', type: 'sendEmail', config: { to: TEST_EMAIL, subject: 'Done', body: '{{transform.result}}' } }
        ],
        connections: [
          { from: 'start', to: 'llm' },
          { from: 'llm', to: 'transform' },
          { from: 'transform', to: 'delay' },
          { from: 'delay', to: 'condition' },
          { from: 'condition', to: 'action', label: 'true' }
        ]
      }, getUniqueName('WF Happy'));

      const runRes = await request(app)
        .post(`/api/workflows/${workflowId}/runs`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(runRes.status).toBe(201);
      expect(runRes.body).toHaveProperty('id');
      const runId = runRes.body.id;

      const run = await waitForRun(authToken, runId);

      expect(run.status).toBe('COMPLETED');
      expect(run.startedAt).toBeDefined();
      expect(run.completedAt).toBeDefined();
      expect(run.output).toBeDefined();
      // The llm node result should be recorded in run output
      const output = JSON.parse(run.output);
      expect(output).toHaveProperty('llm');
      expect(output.llm).toHaveProperty('text');
      expect(output.llm.text).toMatch(/mock/i);
    });

    it('should record a SUCCESS node log for every executed node', async () => {
      const workflowId = await createWorkflow({
        nodes: [
          { id: 'start2', type: 'start' },
          { id: 'llm2', type: 'llm', config: { prompt: 'Hello world' } },
          { id: 'transform2', type: 'transform', config: { value: '{{llm2.text}}', transform: 'lowercase' } }
        ],
        connections: [
          { from: 'start2', to: 'llm2' },
          { from: 'llm2', to: 'transform2' }
        ]
      }, getUniqueName('WF Logs'));

      const runRes = await request(app)
        .post(`/api/workflows/${workflowId}/runs`)
        .set('Authorization', `Bearer ${authToken}`);
      const runId = runRes.body.id;

      const run = await waitForRun(authToken, runId);
      expect(run.status).toBe('COMPLETED');

      const nodesRes = await request(app)
        .get(`/api/runs/${runId}/nodes`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(nodesRes.status).toBe(200);

      // /api/runs/:id/nodes returns the raw array of node logs
      const logs = nodesRes.body;
      expect(Array.isArray(logs)).toBe(true);
      // start2 + llm2 + transform2 all ran successfully
      expect(logs.length).toBe(3);
      for (const log of logs) {
        expect(log.status).toBe('SUCCESS');
      }
    });
  });

  describe('Failure path execution', () => {
    it('should mark run FAILED when a node throws', async () => {
      // http_request to a port that refuses connections -> axios throws
      const workflowId = await createWorkflow({
        nodes: [
          { id: 'failStart', type: 'start' },
          { id: 'failHttp', type: 'http_request', config: { url: 'http://127.0.0.1:1/', method: 'GET', timeout: 2000 } }
        ],
        connections: [
          { from: 'failStart', to: 'failHttp' }
        ]
      }, getUniqueName('WF Fail'));

      const runRes = await request(app)
        .post(`/api/workflows/${workflowId}/runs`)
        .set('Authorization', `Bearer ${authToken}`);
      const runId = runRes.body.id;

      const run = await waitForRun(authToken, runId);

      expect(run.status).toBe('FAILED');
      expect(run.errorMessage).toBeTruthy();

      const nodesRes = await request(app)
        .get(`/api/runs/${runId}/nodes`)
        .set('Authorization', `Bearer ${authToken}`);
      const failedLog = (Array.isArray(nodesRes.body) ? nodesRes.body : []).find(l => l.nodeId === 'failHttp');
      expect(failedLog).toBeDefined();
      expect(failedLog.status).toBe('FAILED');
    });
  });
});
