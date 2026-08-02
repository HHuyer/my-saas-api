/**
 * Comprehensive API Test Suite
 * Tests all main endpoints of the workflow automation SaaS API
 */

const request = require('supertest');
const app = require('../src/index');

// Import Prisma client directly
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to get unique project name
function getUniqueProjectName(baseName = 'Test Project') {
  return `${baseName}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Helper function to get unique workflow name
function getUniqueWorkflowName(baseName = 'Test Workflow') {
  return `${baseName}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Helper function to clean up test data
async function cleanupTestData(userId) {
  try {
    // Delete in dependency order (children before parents) to avoid
    // Prisma P2003 foreign key constraint errors (no onDelete: Cascade on most relations)
    const deletedNodeLogs = await prisma.workflowNodeLog.deleteMany({
      where: { workflowRun: { workflow: { project: { userId } } } }
    });
    console.log(`Deleted ${deletedNodeLogs.count} node logs for user ${userId}`);

    const deletedRuns = await prisma.workflowRun.deleteMany({
      where: { workflow: { project: { userId } } }
    });
    console.log(`Deleted ${deletedRuns.count} runs for user ${userId}`);

    const deletedScheduledLogs = await prisma.scheduledWorkflowLog.deleteMany({
      where: { scheduledWorkflow: { userId } }
    });
    console.log(`Deleted ${deletedScheduledLogs.count} scheduled logs for user ${userId}`);

    const deletedScheduled = await prisma.scheduledWorkflow.deleteMany({
      where: { userId }
    });
    console.log(`Deleted ${deletedScheduled.count} scheduled workflows for user ${userId}`);

    const deletedShared = await prisma.sharedWorkflow.deleteMany({
      where: { OR: [{ userId }, { sharedWithId: userId }] }
    });
    console.log(`Deleted ${deletedShared.count} shared workflows for user ${userId}`);

    const deletedWorkflows = await prisma.workflow.deleteMany({
      where: { project: { userId } }
    });
    console.log(`Deleted ${deletedWorkflows.count} workflows for user ${userId}`);

    const deletedProjects = await prisma.project.deleteMany({
      where: { userId }
    });
    console.log(`Deleted ${deletedProjects.count} projects for user ${userId}`);
  } catch (error) {
    console.log('Cleanup partially completed:', error.message);
  }
}

// Test data
const testData = {
  user: {
    email: 'test@example.com',
    name: 'Test User',
  },
  project: {
    name: getUniqueProjectName('Test Project'),
    description: 'A test project',
  },
  workflow: {
    name: getUniqueWorkflowName('Test Workflow'),
    description: 'A test workflow',
    definition: {
      nodes: [
        { id: '1', type: 'start', position: { x: 100, y: 100 } },
        { id: '2', type: 'process', position: { x: 300, y: 100 } },
      ],
      connections: [
        { from: '1', to: '2' },
      ],
    },
  },
  scheduledWorkflow: {
    name: 'Scheduled Test Workflow',
    cronExpression: '0 0 * * *',
  },
};

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/test-login', () => {
    it('should login successfully with dummy auth', async () => {
      const response = await request(app)
        .post('/api/auth/test-login')
        .send({ email: testData.user.email, password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user', async () => {
      const loginRes = await request(app)
        .post('/api/auth/test-login')
        .send({ email: testData.user.email, password: 'password123' });

      const token = loginRes.body.token;

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', testData.user.email);
    });
  });
});

describe('Health Check Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
});

describe('Project Endpoints', () => {
  let authToken;
  let userId;
  let projectName;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/test-login')
      .send({ email: testData.user.email, password: 'password123' });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Clean up any existing test data FIRST
    await cleanupTestData(userId);

    // Then generate unique project name
    projectName = getUniqueProjectName('Test Project');
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: projectName,
          description: testData.project.description
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', projectName);
      expect(response.body).toHaveProperty('description', testData.project.description);
      expect(response.body).toHaveProperty('userId');
    });
  });

  describe('GET /api/projects', () => {
    it('should get all projects for current user', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get a specific project by ID', async () => {
      // Unique name per test to avoid unique constraint (userId, name) conflicts
      const localProjectName = getUniqueProjectName('Test Project');
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: localProjectName,
          description: testData.project.description
        });

      expect(projectRes.status).toBe(201);
      const projectId = projectRes.body.id;

      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', projectId);
      expect(response.body).toHaveProperty('name', localProjectName);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update a project', async () => {
      // Unique name per test to avoid unique constraint (userId, name) conflicts
      const localProjectName = getUniqueProjectName('Test Project');
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: localProjectName,
          description: testData.project.description
        });

      expect(projectRes.status).toBe(201);
      const projectId = projectRes.body.id;

      // Unique updated name to avoid unique constraint conflicts with leftover data
      const updateData = {
        name: getUniqueProjectName('Updated Project'),
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('description', updateData.description);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      // Unique name per test to avoid unique constraint (userId, name) conflicts
      const localProjectName = getUniqueProjectName('Test Project');
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: localProjectName,
          description: testData.project.description
        });

      expect(projectRes.status).toBe(201);
      const projectId = projectRes.body.id;

      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  afterAll(async () => {
    // Clean up all test data for this user
    await cleanupTestData(userId);
  });
});

describe('Workflow Endpoints', () => {
  let authToken;
  let projectId;
  let userId;
  let projectName;
  let workflowName;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/test-login')
      .send({ email: testData.user.email, password: 'password123' });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Clean up any existing test data FIRST
    await cleanupTestData(userId);

    // Generate unique names
    projectName = getUniqueProjectName('Test Project');
    workflowName = getUniqueWorkflowName('Test Workflow');

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: projectName,
        description: testData.project.description
      });

    projectId = projectRes.body.id;
  });

  describe('POST /api/projects/:projectId/workflows', () => {
    it('should create a new workflow', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/workflows`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: workflowName,
          description: testData.workflow.description,
          definition: testData.workflow.definition
        });

      console.log('[TEST DEBUG] Response status:', response.status);
      console.log('[TEST DEBUG] Response body:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', workflowName);
      expect(response.body).toHaveProperty('definition');
    });
  });

  describe('GET /api/projects/:projectId/workflows', () => {
    it('should get all workflows for current user', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/workflows`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get a specific workflow by ID', async () => {
      // First, create a workflow to get its ID
      const workflowRes = await request(app)
        .post(`/api/projects/${projectId}/workflows`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: workflowName,
          description: testData.workflow.description,
          definition: testData.workflow.definition
        });

      const workflowId = workflowRes.body.id;

      const response = await request(app)
        .get(`/api/projects/${projectId}/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', workflowId);
      expect(response.body).toHaveProperty('name', workflowName);
    });
  });

  describe('PUT /api/projects/:projectId/workflows/:id', () => {
    it('should update a workflow', async () => {
      // First, create a workflow to get its ID
      const workflowRes = await request(app)
        .post(`/api/projects/${projectId}/workflows`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: workflowName,
          description: testData.workflow.description,
          definition: testData.workflow.definition
        });

      const workflowId = workflowRes.body.id;

      const updateData = {
        name: 'Updated Workflow',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('description', updateData.description);
    });
  });

  describe('DELETE /api/projects/:projectId/workflows/:id', () => {
    it('should delete a workflow', async () => {
      // First, create a workflow to get its ID
      const workflowRes = await request(app)
        .post(`/api/projects/${projectId}/workflows`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: workflowName,
          description: testData.workflow.description,
          definition: testData.workflow.definition
        });

      const workflowId = workflowRes.body.id;

      const response = await request(app)
        .delete(`/api/projects/${projectId}/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/workflows/:workflowId/runs', () => {
    it('should create a workflow run', async () => {
      // First, create a workflow to get its ID
      const workflowRes = await request(app)
        .post(`/api/projects/${projectId}/workflows`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: workflowName,
          description: testData.workflow.description,
          definition: testData.workflow.definition
        });

      const workflowId = workflowRes.body.id;

      const response = await request(app)
        .post(`/api/workflows/${workflowId}/runs`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('workflowId', workflowId);
    });
  });

  describe('GET /api/workflows/:workflowId/runs', () => {
    it('should get all runs for a workflow', async () => {
      // First, create a workflow to get its ID
      const workflowRes = await request(app)
        .post(`/api/projects/${projectId}/workflows`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: workflowName,
          description: testData.workflow.description,
          definition: testData.workflow.definition
        });

      const workflowId = workflowRes.body.id;

      const response = await request(app)
        .get(`/api/workflows/${workflowId}/runs`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/runs', () => {
    it('should get all runs for current user', async () => {
      const response = await request(app)
        .get('/api/runs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/runs/:id', () => {
    it('should get a specific run by ID', async () => {
      // First, create a workflow and run to get their IDs
      const workflowRes = await request(app)
        .post(`/api/projects/${projectId}/workflows`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: workflowName,
          description: testData.workflow.description,
          definition: testData.workflow.definition
        });

      const workflowId = workflowRes.body.id;

      const runRes = await request(app)
        .post(`/api/workflows/${workflowId}/runs`)
        .set('Authorization', `Bearer ${authToken}`);

      const runId = runRes.body.id;

      const response = await request(app)
        .get(`/api/runs/${runId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', runId);
      expect(response.body).toHaveProperty('status');
    });
  });

  afterAll(async () => {
    await cleanupTestData(userId);
  });
});

describe('Scheduled Workflows Endpoints', () => {
  let authToken;
  let projectId;
  let workflowId;
  let scheduledWorkflowId;
  let userId;
  let projectName;
  let workflowName;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/test-login')
      .send({ email: testData.user.email, password: 'password123' });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Clean up any existing test data FIRST
    await cleanupTestData(userId);

    // Generate unique names
    projectName = getUniqueProjectName('Test Project');
    workflowName = getUniqueWorkflowName('Test Workflow');

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: projectName,
        description: testData.project.description
      });

    projectId = projectRes.body.id;

    const workflowRes = await request(app)
      .post(`/api/projects/${projectId}/workflows`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: workflowName,
        description: testData.workflow.description,
        definition: testData.workflow.definition
      });

    workflowId = workflowRes.body.id;
  });

  describe('POST /api/scheduled-workflows', () => {
    it('should create a scheduled workflow', async () => {
      const scheduledWorkflowName = getUniqueWorkflowName('Scheduled Workflow');

      const response = await request(app)
        .post('/api/scheduled-workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: scheduledWorkflowName,
          workflowId: workflowId,
          cronExpression: testData.scheduledWorkflow.cronExpression,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', scheduledWorkflowName);
      expect(response.body).toHaveProperty('cronExpression', testData.scheduledWorkflow.cronExpression);
      scheduledWorkflowId = response.body.id;
    });
  });

  describe('GET /api/scheduled-workflows', () => {
    it('should get all scheduled workflows for current user', async () => {
      const response = await request(app)
        .get('/api/scheduled-workflows')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('PUT /api/scheduled-workflows/:id', () => {
    it('should update a scheduled workflow', async () => {
      const updateData = {
        cronExpression: '0 */6 * * *', // Every 6 hours
      };

      const response = await request(app)
        .put(`/api/scheduled-workflows/${scheduledWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cronExpression', updateData.cronExpression);
    });
  });

  describe('DELETE /api/scheduled-workflows/:id', () => {
    it('should delete a scheduled workflow', async () => {
      const response = await request(app)
        .delete(`/api/scheduled-workflows/${scheduledWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
});

describe('Notification Endpoints', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/test-login')
      .send({ email: testData.user.email, password: 'password123' });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Clean up any existing test data
    await cleanupTestData(userId);
  });

  describe('GET /api/notifications', () => {
    it('should get all notifications for current user', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/notifications/unread/count', () => {
    it('should get unread notification count', async () => {
      const response = await request(app)
        .get('/api/notifications/unread/count')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count');
    });
  });

  afterAll(async () => {
    await cleanupTestData(userId);
  });
});
