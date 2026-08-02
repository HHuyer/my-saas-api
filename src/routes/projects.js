/**
 * Projects Routes
 * Handles CRUD operations for projects
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Create a new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await req.db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        userId: req.user.id
      },
      select: {
        id: true,
        name: true,
        description: true,
        userId: true,
        createdAt: true
      }
    });

    logger.info(`Project created: ${project.id} by user ${req.user.id}`);
    res.status(201).json(project);
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all projects for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await req.db.project.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single project
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await req.db.project.findFirst({
      where: {
        id,
        userId: req.user.id
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    res.json(project);
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if project exists and belongs to user
    const project = await req.db.project.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const updatedProject = await req.db.project.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() })
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    logger.info(`Project updated: ${id}`);
    res.json(updatedProject);
  } catch (error) {
    logger.error('Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if project exists and belongs to user
    const project = await req.db.project.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    await req.db.project.delete({
      where: { id }
    });

    logger.info(`Project deleted: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
