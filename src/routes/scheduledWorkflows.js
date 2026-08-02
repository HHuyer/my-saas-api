/**
 * Scheduled Workflows Routes
 * Handles CRUD operations for scheduled workflows
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const scheduler = require('../scheduler');
const { validateCronExpression } = require('../utils/cronValidator');

// Get all scheduled workflows for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const scheduledWorkflows = await scheduler.getScheduledWorkflows();
    res.json(scheduledWorkflows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scheduled workflow by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const scheduledWorkflow = await scheduler.getScheduledWorkflowById(id);

    if (!scheduledWorkflow) {
      return res.status(404).json({ error: 'Scheduled workflow not found' });
    }

    // Check if user has access to this workflow
    if (scheduledWorkflow.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(scheduledWorkflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new scheduled workflow
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, cronExpression, workflowId, description } = req.body;

    // Validate cron expression
    if (!validateCronExpression(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
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

    if (!workflow || workflow.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Workflow not found or access denied' });
    }

    const scheduledWorkflow = await scheduler.createScheduledWorkflow({
      name,
      cronExpression,
      workflowId,
      userId: req.user.id,
      description
    });

    res.status(201).json(scheduledWorkflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update scheduled workflow
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cronExpression, description, status } = req.body;

    // Check if user has access to this workflow
    const existing = await req.db.scheduledWorkflow.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            project: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Scheduled workflow not found' });
    }

    if (existing.workflow.project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate cron expression if provided
    if (cronExpression && !validateCronExpression(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    const scheduledWorkflow = await scheduler.updateScheduledWorkflow(id, {
      name,
      cronExpression,
      description,
      status
    });

    res.json(scheduledWorkflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete scheduled workflow
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access to this workflow
    const existing = await req.db.scheduledWorkflow.findUnique({
      where: { id },
      include: { workflow: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Scheduled workflow not found' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await scheduler.deleteScheduledWorkflow(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get logs for a scheduled workflow
router.get('/:id/logs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    // Check if user has access to this workflow
    const existing = await req.db.scheduledWorkflow.findUnique({
      where: { id },
      include: { workflow: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Scheduled workflow not found' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logs = await scheduler.getScheduledWorkflowLogs(id, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pause a scheduled workflow
router.post('/:id/pause', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access to this workflow
    const existing = await req.db.scheduledWorkflow.findUnique({
      where: { id },
      include: { workflow: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Scheduled workflow not found' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await scheduler.unscheduleWorkflow(id);
    await req.db.scheduledWorkflow.update({
      where: { id },
      data: { status: 'PAUSED' }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resume a scheduled workflow
router.post('/:id/resume', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access to this workflow
    const existing = await req.db.scheduledWorkflow.findUnique({
      where: { id },
      include: { workflow: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Scheduled workflow not found' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await req.db.scheduledWorkflow.update({
      where: { id },
      data: { status: 'ACTIVE' }
    });

    const updated = await req.db.scheduledWorkflow.findUnique({
      where: { id },
      include: { workflow: true }
    });

    await scheduler.scheduleWorkflow(updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
