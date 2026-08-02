/**
 * Workflows Routes
 * Handles CRUD operations for workflows
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const runner = require('../workers/workflowRunner');

// Create a new workflow
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Get projectId from baseUrl since Express doesn't auto-pass parent route params to mounted routers
    const pathParts = req.baseUrl.split('/').filter(Boolean);
    const projectId = pathParts[pathParts.length - 2]; // Get the second-to-last segment

    const { name, description, definition } = req.body;

    console.log('[DEBUG] Workflow POST - baseUrl:', req.baseUrl);
    console.log('[DEBUG] Workflow POST - pathParts:', pathParts);
    console.log('[DEBUG] Workflow POST - projectId:', projectId);
    console.log('[DEBUG] Workflow POST - name:', name);

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

    // Validate project belongs to user
    const project = await req.db.project.findFirst({
      where: {
        id: projectId,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const workflow = await req.db.workflow.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        definition: typeof definition === 'string' ? definition : JSON.stringify(definition),
        projectId
      },
      select: {
        id: true,
        name: true,
        description: true,
        definition: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    logger.info(`Workflow created: ${workflow.id} in project ${projectId}`);
    res.status(201).json(workflow);
  } catch (error) {
    logger.error('Error creating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all workflows for a project
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate project belongs to user
    const project = await req.db.project.findFirst({
      where: {
        id: projectId,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const workflows = await req.db.workflow.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        description: true,
        definition: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Parse JSON strings for definition
    res.json(workflows.map(w => ({
      ...w,
      definition: typeof w.definition === 'string' ? JSON.parse(w.definition) : w.definition
    })));
  } catch (error) {
    logger.error('Error fetching workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single workflow
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await req.db.workflow.findFirst({
      where: { id },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      ...workflow,
      definition: typeof workflow.definition === 'string' ? JSON.parse(workflow.definition) : workflow.definition
    });
  } catch (error) {
    logger.error('Error fetching workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a workflow
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, definition, status } = req.body;

    const workflow = await req.db.workflow.findFirst({
      where: { id },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedWorkflow = await req.db.workflow.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(definition !== undefined && {
          definition: typeof definition === 'string' ? definition : JSON.stringify(definition)
        }),
        ...(status && { status })
      },
      select: {
        id: true,
        name: true,
        description: true,
        definition: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    logger.info(`Workflow updated: ${id}`);
    res.json(updatedWorkflow);
  } catch (error) {
    logger.error('Error updating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a workflow
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await req.db.workflow.findFirst({
      where: { id },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await req.db.workflow.delete({
      where: { id }
    });

    logger.info(`Workflow deleted: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all runs for a workflow
router.get('/:workflowId/runs', authenticateToken, async (req, res) => {
  try {
    const { workflowId } = req.params;

    const workflow = await req.db.workflow.findFirst({
      where: { id: workflowId },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const runs = await req.db.workflowRun.findMany({
      where: { workflowId },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        isScheduled: true,
        scheduledWorkflowId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clone a workflow
router.post('/:id/clone', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, projectId } = req.body;

    const workflow = await req.db.workflow.findFirst({
      where: { id },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const clonedWorkflow = await req.db.workflow.create({
      data: {
        name: name || `${workflow.name} (copy)`,
        description: workflow.description,
        definition: JSON.parse(JSON.stringify(workflow.definition)),
        projectId: projectId || workflow.projectId,
        status: workflow.status
      },
      select: {
        id: true,
        name: true,
        description: true,
        definition: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    logger.info(`Workflow cloned: ${id} -> ${clonedWorkflow.id}`);
    res.status(201).json(clonedWorkflow);
  } catch (error) {
    logger.error('Error cloning workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a workflow run (with workflowId in path)
router.post('/:workflowId/runs', async (req, res) => {
  try {
    const { workflowId } = req.params;

    console.log('[DEBUG] Create workflow run - workflowId:', workflowId);

    // Validate workflow belongs to user
    const workflow = await req.db.workflow.findFirst({
      where: { id: workflowId },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create workflow run
    const run = await req.db.workflowRun.create({
      data: {
        workflowId,
        status: 'PENDING'
      }
    });

    // Kick off execution asynchronously (fire-and-forget in-process runner)
    const body = req.body || {};
    runner.runWorkflow({
      workflow,
      runId: run.id,
      userId: req.user.id,
      context: body.input || {}
    }).catch(err =>
      logger.error(`Background workflow run ${run.id} crashed:`, err)
    );

    res.status(201).json(run);
  } catch (error) {
    console.error('[DEBUG] Error creating workflow run:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
