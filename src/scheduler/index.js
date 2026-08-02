/**
 * Workflow Scheduler Service
 * Handles scheduled workflow execution using node-cron
 */

const cron = require('node-cron');
const { logger } = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');
const runner = require('../workers/workflowRunner');

const prisma = new PrismaClient();

class SchedulerService {
  constructor() {
    this.scheduledWorkflows = new Map(); // Store active cron jobs
    this.init();
  }

  /**
   * Initialize scheduler and load existing scheduled workflows
   */
  async init() {
    try {
      logger.info('Initializing workflow scheduler...');

      // Load all active scheduled workflows from database
      const scheduledWorkflows = await prisma.scheduledWorkflow.findMany({
        where: { status: 'ACTIVE' },
        include: {
          workflow: true,
          user: {
            select: { id: true, email: true }
          }
        }
      });

      for (const sf of scheduledWorkflows) {
        await this.scheduleWorkflow(sf);
      }

      logger.info(`Loaded ${scheduledWorkflows.length} scheduled workflows`);
    } catch (error) {
      logger.error('Error initializing scheduler:', error);
    }
  }

  /**
   * Schedule a workflow for automatic execution
   */
  async scheduleWorkflow(scheduledWorkflow) {
    try {
      const { id, workflowId, cronExpression, userId, name } = scheduledWorkflow;

      // Remove existing cron job if present
      if (this.scheduledWorkflows.has(id)) {
        this.scheduledWorkflows.get(id).stop();
        logger.info(`Stopped existing cron job for workflow ${workflowId}`);
      }

      // Create cron job
      const cronJob = cron.schedule(cronExpression, async () => {
        try {
          logger.info(`Executing scheduled workflow: ${name} (ID: ${workflowId})`);

          // Execute the workflow
          const run = await this.executeWorkflow(userId, workflowId, {
            isScheduled: true,
            scheduledWorkflowId: id
          });

          logger.info(`Scheduled workflow execution completed: ${run.id}`);

          // Update scheduled workflow status
          await prisma.scheduledWorkflow.update({
            where: { id },
            data: { lastRunAt: new Date() }
          });
        } catch (error) {
          logger.error(`Error executing scheduled workflow ${workflowId}:`, error);

          // Log failure to run
          await prisma.scheduledWorkflowLog.create({
            data: {
              scheduledWorkflowId: id,
              status: 'FAILED',
              errorMessage: error.message,
              errorStack: error.stack
            }
          });
        }
      });

      // Store cron job
      this.scheduledWorkflows.set(id, cronJob);

      logger.info(`Scheduled workflow: ${name} (ID: ${workflowId}) with cron: ${cronExpression}`);
    } catch (error) {
      logger.error(`Error scheduling workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Unschedule a workflow
   */
  async unscheduleWorkflow(id) {
    try {
      const cronJob = this.scheduledWorkflows.get(id);

      if (cronJob) {
        cronJob.stop();
        this.scheduledWorkflows.delete(id);

        logger.info(`Unscheduled workflow with ID: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error unscheduling workflow ${id}:`, error);
      throw error;
    }
  }

  /**
   * Execute a workflow run
   */
  async executeWorkflow(userId, workflowId, context = {}) {
    let run = null;
    try {
      // Validate workflow exists and belongs to user
      const workflow = await prisma.workflow.findFirst({
        where: {
          id: workflowId,
          projectId: {
            userId: userId
          }
        }
      });

      if (!workflow) {
        throw new Error(`Workflow not found or access denied`);
      }

      // Create workflow run
      run = await prisma.workflowRun.create({
        data: {
          workflowId,
          status: 'PENDING',
          isScheduled: context.isScheduled || false,
          scheduledWorkflowId: context.scheduledWorkflowId || null
        }
      });

      logger.info(`Created workflow run: ${run.id} for workflow ${workflowId}`);

      // Execute via the shared workflow runner (real node execution engine)
      await runner.runWorkflow({
        workflow,
        runId: run.id,
        userId,
        context
      });

      logger.info(`Workflow run completed: ${run.id}`);

      return run;
    } catch (error) {
      logger.error(`Error executing workflow ${workflowId}:`, error);

      // Update run status to failed
      if (run) {
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: { status: 'FAILED', errorMessage: error.message }
        });
      }

      throw error;
    }
  }

  /**
   * Get all scheduled workflows
   */
  async getScheduledWorkflows() {
    try {
      return await prisma.scheduledWorkflow.findMany({
        include: {
          workflow: true,
          user: {
            select: { id: true, email: true, name: true }
          }
        },
        orderBy: { nextRunAt: 'asc' }
      });
    } catch (error) {
      logger.error('Error getting scheduled workflows:', error);
      throw error;
    }
  }

  /**
   * Get scheduled workflow by ID
   */
  async getScheduledWorkflowById(id) {
    try {
      return await prisma.scheduledWorkflow.findUnique({
        where: { id },
        include: {
          workflow: true,
          user: {
            select: { id: true, email: true, name: true }
          }
        }
      });
    } catch (error) {
      logger.error(`Error getting scheduled workflow ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new scheduled workflow
   */
  async createScheduledWorkflow(data) {
    try {
      const scheduledWorkflow = await prisma.scheduledWorkflow.create({
        data: {
          name: data.name,
          cronExpression: data.cronExpression,
          status: 'ACTIVE',
          nextRunAt: this.calculateNextRun(data.cronExpression),
          workflowId: data.workflowId,
          userId: data.userId,
          description: data.description
        }
      });

      // Schedule the workflow
      await this.scheduleWorkflow(scheduledWorkflow);

      return scheduledWorkflow;
    } catch (error) {
      logger.error('Error creating scheduled workflow:', error);
      throw error;
    }
  }

  /**
   * Update a scheduled workflow
   */
  async updateScheduledWorkflow(id, data) {
    try {
      // Unschedule if changing cron expression
      if (data.cronExpression) {
        await this.unscheduleWorkflow(id);
      }

      // Update the scheduled workflow
      const scheduledWorkflow = await prisma.scheduledWorkflow.update({
        where: { id },
        data: {
          name: data.name,
          cronExpression: data.cronExpression,
          description: data.description,
          status: data.status
        }
      });

      // Reschedule if active and has new cron expression
      if (data.status === 'ACTIVE' && data.cronExpression) {
        await this.scheduleWorkflow(scheduledWorkflow);
      }

      return scheduledWorkflow;
    } catch (error) {
      logger.error(`Error updating scheduled workflow ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a scheduled workflow
   */
  async deleteScheduledWorkflow(id) {
    try {
      // Get scheduled workflow
      const scheduledWorkflow = await prisma.scheduledWorkflow.findUnique({
        where: { id }
      });

      if (!scheduledWorkflow) {
        throw new Error('Scheduled workflow not found');
      }

      // Unschedule the workflow
      await this.unscheduleWorkflow(id);

      // Delete from database
      await prisma.scheduledWorkflow.delete({
        where: { id }
      });

      return { success: true };
    } catch (error) {
      logger.error(`Error deleting scheduled workflow ${id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate next run time from cron expression
   */
  calculateNextRun(cronExpression) {
    const now = new Date();

    // For simplicity, return current time + 1 minute
    // In production, use cron parser to calculate actual next run
    return new Date(now.getTime() + 60 * 1000);
  }

  /**
   * Get logs for a scheduled workflow
   */
  async getScheduledWorkflowLogs(id, limit = 100) {
    try {
      return await prisma.scheduledWorkflowLog.findMany({
        where: { scheduledWorkflowId: id },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error(`Error getting logs for scheduled workflow ${id}:`, error);
      throw error;
    }
  }

  /**
   * Stop all scheduled workflows
   */
  async stopAll() {
    try {
      const ids = Array.from(this.scheduledWorkflows.keys());

      for (const id of ids) {
        await this.unscheduleWorkflow(id);
      }

      logger.info('Stopped all scheduled workflows');
      return { success: true, stopped: ids.length };
    } catch (error) {
      logger.error('Error stopping all scheduled workflows:', error);
      throw error;
    }
  }

  /**
   * Start all scheduled workflows
   */
  async startAll() {
    try {
      const scheduledWorkflows = await prisma.scheduledWorkflow.findMany({
        where: { status: 'ACTIVE' }
      });

      for (const sf of scheduledWorkflows) {
        await this.scheduleWorkflow(sf);
      }

      logger.info(`Started ${scheduledWorkflows.length} scheduled workflows`);
      return { success: true, started: scheduledWorkflows.length };
    } catch (error) {
      logger.error('Error starting all scheduled workflows:', error);
      throw error;
    }
  }
}

// Export singleton instance
const scheduler = new SchedulerService();
module.exports = scheduler;
