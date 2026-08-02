/**
 * Workflow Sharing Routes
 * Handles workflow sharing between users
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Share workflow with another user
router.post('/share', authenticateToken, async (req, res) => {
  try {
    const { workflowId, sharedWithId, permission } = req.body;

    if (!workflowId || !sharedWithId) {
      return res.status(400).json({ error: 'workflowId and sharedWithId are required' });
    }

    if (!permission || !['VIEW', 'EDIT', 'ADMIN'].includes(permission)) {
      return res.status(400).json({ error: 'Permission must be VIEW, EDIT, or ADMIN' });
    }

    // Check if workflow belongs to user
    const workflow = await req.db.workflow.findFirst({
      where: {
        id: workflowId,
        projectId: {
          userId: req.user.id
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found or access denied' });
    }

    // Check if sharedWithId is different from user's own ID
    if (sharedWithId === req.user.id) {
      return res.status(400).json({ error: 'Cannot share workflow with yourself' });
    }

    // Check if sharing already exists
    const existing = await req.db.sharedWorkflow.findFirst({
      where: {
        workflowId,
        sharedWithId
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Workflow already shared with this user' });
    }

    const sharedWorkflow = await req.db.sharedWorkflow.create({
      data: {
        workflowId,
        sharedWithId,
        permission
      }
    });

    logger.info(`Workflow ${workflowId} shared with user ${sharedWithId}`);
    res.status(201).json(sharedWorkflow);
  } catch (error) {
    logger.error('Error sharing workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get shared workflows for user
router.get('/shared-with-me', authenticateToken, async (req, res) => {
  try {
    const sharedWorkflows = await req.db.sharedWorkflow.findMany({
      where: {
        sharedWithId: req.user.id
      },
      include: {
        workflow: {
          include: {
            project: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(sharedWorkflows);
  } catch (error) {
    logger.error('Error fetching shared workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get workflows shared by user
router.get('/shared-by-me', authenticateToken, async (req, res) => {
  try {
    const sharedWorkflows = await req.db.sharedWorkflow.findMany({
      where: {
        userId: req.user.id
      },
      include: {
        workflow: {
          include: {
            project: true
          }
        },
        sharedWith: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(sharedWorkflows);
  } catch (error) {
    logger.error('Error fetching shared workflows by me:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get shared workflow details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const sharedWorkflow = await req.db.sharedWorkflow.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            project: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!sharedWorkflow) {
      return res.status(404).json({ error: 'Shared workflow not found' });
    }

    // Check if user has access
    if (sharedWorkflow.userId !== req.user.id && sharedWorkflow.sharedWithId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(sharedWorkflow);
  } catch (error) {
    logger.error('Error fetching shared workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update shared workflow permission
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { permission } = req.body;

    if (!permission || !['VIEW', 'EDIT', 'ADMIN'].includes(permission)) {
      return res.status(400).json({ error: 'Permission must be VIEW, EDIT, or ADMIN' });
    }

    // Check if user owns this sharing
    const sharedWorkflow = await req.db.sharedWorkflow.findUnique({
      where: { id }
    });

    if (!sharedWorkflow) {
      return res.status(404).json({ error: 'Shared workflow not found' });
    }

    if (sharedWorkflow.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await req.db.sharedWorkflow.update({
      where: { id },
      data: { permission }
    });

    logger.info(`Shared workflow ${id} permission updated to ${permission}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error updating shared workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete shared workflow
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user owns this sharing
    const sharedWorkflow = await req.db.sharedWorkflow.findUnique({
      where: { id }
    });

    if (!sharedWorkflow) {
      return res.status(404).json({ error: 'Shared workflow not found' });
    }

    if (sharedWorkflow.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await req.db.sharedWorkflow.delete({
      where: { id }
    });

    logger.info(`Shared workflow ${id} deleted`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting shared workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
