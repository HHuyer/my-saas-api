/**
 * Workflow Runs Routes
 * Handles workflow execution runs
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const runner = require('../workers/workflowRunner');

// Get all workflow runs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { workflowId, status } = req.query;

    const where = {};

    // Filter by workflow if provided
    if (workflowId) {
      where.workflowId = workflowId;
    }

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    const runs = await req.db.workflowRun.findMany({
      where,
      include: {
        workflow: {
          select: {
            projectId: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Filter runs by user's projects
    const userProjectIds = await req.db.project.findMany({
      where: {
        userId: req.user.id
      },
      select: {
        id: true
      }
    });

    const filteredRuns = runs.filter(run =>
      userProjectIds.some(p => p.id === run.workflow.projectId)
    );

    res.json(filteredRuns);
  } catch (error) {
    logger.error('Error fetching workflow runs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new workflow run (with workflowId in path)
router.post('/:workflowId/runs', authenticateToken, async (req, res) => {
  try {
    const { workflowId } = req.params;

    if (!workflowId) {
      return res.status(400).json({ error: 'workflowId is required' });
    }

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
    runner.runWorkflow({
      workflow,
      runId: run.id,
      userId: req.user.id,
      context: req.body?.input || {}
    }).catch(err =>
      logger.error(`Background workflow run ${run.id} crashed:`, err)
    );

    res.status(201).json(run);
  } catch (error) {
    logger.error('Error creating workflow run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single workflow run
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const run = await req.db.workflowRun.findFirst({
      where: { id },
      include: {
        workflow: {
          include: {
            project: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    // Check if user has access to this workflow's project
    const project = await req.db.project.findFirst({
      where: {
        id: run.workflow.projectId,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(run);
  } catch (error) {
    logger.error('Error fetching workflow run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get node logs for a run
router.get('/:id/nodes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const run = await req.db.workflowRun.findFirst({
      where: { id },
      include: {
        workflow: {
          include: {
            project: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found or access denied' });
    }

    // Check if user has access to this workflow's project
    const project = await req.db.project.findFirst({
      where: {
        id: run.workflow.projectId,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const nodeLogs = await req.db.workflowNodeLog.findMany({
      where: { workflowRunId: id },
      select: {
        id: true,
        nodeId: true,
        status: true,
        errorMessage: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(nodeLogs);
  } catch (error) {
    logger.error('Error fetching node logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get run details
router.get('/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const run = await req.db.workflowRun.findFirst({
      where: { id },
      include: {
        workflow: {
          include: {
            project: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found or access denied' });
    }

    // Check if user has access to this workflow's project
    const project = await req.db.project.findFirst({
      where: {
        id: run.workflow.projectId,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get node logs
    const nodeLogs = await req.db.workflowNodeLog.findMany({
      where: { workflowRunId: id },
      select: {
        id: true,
        nodeId: true,
        status: true,
        errorMessage: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      run: {
        id: run.id,
        status: run.status,
        errorMessage: run.errorMessage,
        isScheduled: run.isScheduled,
        scheduledWorkflowId: run.scheduledWorkflowId,
        createdAt: run.createdAt
      },
      workflow: {
        id: run.workflow.id,
        name: run.workflow.name
      },
      nodeLogs
    });
  } catch (error) {
    logger.error('Error fetching run details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop a running workflow
router.post('/:id/stop', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const run = await req.db.workflowRun.findFirst({
      where: { id },
      include: {
        workflow: {
          include: {
            project: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found or access denied' });
    }

    // Check if user has access to this workflow's project
    const project = await req.db.project.findFirst({
      where: {
        id: run.workflow.projectId,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (run.status !== 'RUNNING') {
      return res.status(400).json({ error: 'Run is not running' });
    }

    // In production, you would implement actual workflow stopping
    // For now, we'll mark it as stopped
    const updatedRun = await req.db.workflowRun.update({
      where: { id },
      data: { status: 'STOPPED' },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        isScheduled: true,
        createdAt: true
      }
    });

    logger.info(`Workflow run stopped: ${id}`);
    res.json(updatedRun);
  } catch (error) {
    logger.error('Error stopping workflow run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get analytics for a workflow
router.get('/analytics/:workflowId', authenticateToken, async (req, res) => {
  try {
    const { workflowId } = req.params;

    // Check if workflow belongs to user
    const workflow = await req.db.workflow.findFirst({
      where: { id: workflowId },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!workflow || workflow.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Workflow not found or access denied' });
    }

    // Get total runs
    const totalRuns = await req.db.workflowRun.count({
      where: { workflowId }
    });

    // Get successful runs
    const successfulRuns = await req.db.workflowRun.count({
      where: { workflowId, status: 'COMPLETED' }
    });

    // Get failed runs
    const failedRuns = await req.db.workflowRun.count({
      where: { workflowId, status: 'FAILED' }
    });

    // Get running runs
    const runningRuns = await req.db.workflowRun.count({
      where: { workflowId, status: 'RUNNING' }
    });

    // Get average duration
    const runs = await req.db.workflowRun.findMany({
      where: { workflowId },
      select: { createdAt: true, updatedAt: true }
    });

    const durations = runs
      .filter(r => r.status === 'COMPLETED')
      .map(r => r.updatedAt - r.createdAt);

    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Get runs by date
    const runsByDate = await req.db.workflowRun.groupBy({
      by: ['createdAt'],
      where: { workflowId },
      _count: true,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      totalRuns,
      successfulRuns,
      failedRuns,
      runningRuns,
      successRate: totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0,
      avgDuration,
      runsByDate
    });
  } catch (error) {
    logger.error('Error fetching workflow analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
