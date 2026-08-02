const express = require('express');
const router = express.Router();
const { getAllTemplates, getTemplateById, getTemplateCategories } = require('../templates');

/**
 * GET /api/templates
 * Get all available workflow templates
 */
router.get('/', async (req, res) => {
  try {
    const templates = getAllTemplates();
    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/categories
 * Get template categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = getTemplateCategories();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/:id
 * Get a specific template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        message: `Template with ID "${id}" does not exist`
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
      message: error.message
    });
  }
});

/**
 * POST /api/templates/:id/clone
 * Clone a template to create a new workflow
 */
router.post('/:id/clone', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, projectId } = req.body;

    const template = getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        message: `Template with ID "${id}" does not exist`
      });
    }

    // Create a new workflow with the template data
    const newWorkflow = {
      name: name || `${template.name} (Clone)`,
      description: description || template.description,
      nodes: template.nodes.map(node => ({
        ...node,
        id: `${node.id}-clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })),
      connections: template.connections.map(conn => ({
        ...conn,
        id: `${conn.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })),
      projectId: projectId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // In a real implementation, you would save this to the database
    // For now, return the cloned workflow
    res.json({
      success: true,
      data: newWorkflow,
      message: 'Template cloned successfully'
    });
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clone template',
      message: error.message
    });
  }
});

module.exports = router;
