/**
 * Webhook Service
 * Handles webhook execution and delivery
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class WebhookService {
  constructor() {
    this.app = express();
    this.app.use(express.json());

    // Webhook routes
    this.setupRoutes();
  }

  /**
   * Setup webhook routes
   */
  setupRoutes() {
    // Receive webhook events from external services
    this.app.post('/api/webhooks/:webhookId', async (req, res) => {
      try {
        const { webhookId } = req.params;
        const signature = req.headers['x-webhook-signature'];
        const payload = JSON.stringify(req.body);

        // Verify signature if webhook has a secret
        const webhook = await prisma.webhook.findUnique({
          where: { id: webhookId }
        });

        if (webhook && webhook.secret) {
          const expectedSignature = this.generateSignature(payload, webhook.secret);
          if (signature !== expectedSignature) {
            return res.status(401).json({ error: 'Invalid signature' });
          }
        }

        // Store webhook event
        const event = await prisma.webhookEvent.create({
          data: {
            webhookId,
            eventType: req.body.eventType || 'WEBHOOK',
            payload: req.body,
            signature
          }
        });

        // Process webhook
        await this.processWebhook(webhook, req.body);

        res.json({ success: true, eventId: event.id });
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Generate webhook signature
   */
  generateSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Process webhook event
   */
  async processWebhook(webhook, payload) {
    try {
      // Prepare webhook payload
      const webhookData = {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        isActive: webhook.isActive,
        events: webhook.events,
        headers: webhook.headers
      };

      // Send webhook to external service
      await axios.post(webhook.url, {
        eventType: payload.eventType || 'WEBHOOK',
        timestamp: new Date().toISOString(),
        data: payload.data || payload
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...webhook.headers
        },
        timeout: 10000 // 10 second timeout
      });

      console.log(`Webhook ${webhook.id} executed successfully`);
    } catch (error) {
      console.error(`Error executing webhook ${webhook.id}:`, error.message);

      // Log webhook execution failure
      await prisma.webhookLog.create({
        data: {
          webhookId: webhook.id,
          status: 'FAILED',
          errorMessage: error.message
        }
      });
    }
  }

  /**
   * Create a new webhook
   */
  async createWebhook(userId, data) {
    try {
      const { name, url, secret, events, headers } = data;

      const webhook = await prisma.webhook.create({
        data: {
          name: name.trim(),
          url,
          secret: secret || crypto.randomBytes(32).toString('hex'),
          events: events || ['WEBHOOK'],
          headers,
          createdBy: userId
        }
      });

      return webhook;
    } catch (error) {
      console.error('Error creating webhook:', error);
      throw error;
    }
  }

  /**
   * Get webhooks for a user
   */
  async getWebhooks(userId) {
    try {
      return await prisma.webhook.findMany({
        where: { createdBy: userId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Error getting webhooks:', error);
      throw error;
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(webhookId, userId) {
    try {
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: webhookId,
          createdBy: userId
        }
      });

      return webhook;
    } catch (error) {
      console.error('Error getting webhook:', error);
      throw error;
    }
  }

  /**
   * Update a webhook
   */
  async updateWebhook(webhookId, userId, data) {
    try {
      const { name, url, isActive, events, headers } = data;

      const webhook = await prisma.webhook.update({
        where: {
          id: webhookId,
          createdBy: userId
        },
        data: {
          ...(name && { name: name.trim() }),
          url,
          ...(isActive !== undefined && { isActive }),
          ...(events && { events }),
          ...(headers && { headers })
        }
      });

      return webhook;
    } catch (error) {
      console.error('Error updating webhook:', error);
      throw error;
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId, userId) {
    try {
      await prisma.webhook.delete({
        where: {
          id: webhookId,
          createdBy: userId
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting webhook:', error);
      throw error;
    }
  }

  /**
   * Get webhook events
   */
  async getWebhookEvents(webhookId, limit = 50) {
    try {
      return await prisma.webhookEvent.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      console.error('Error getting webhook events:', error);
      throw error;
    }
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(webhookId, limit = 50) {
    try {
      return await prisma.webhookLog.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      console.error('Error getting webhook logs:', error);
      throw error;
    }
  }

  /**
   * Start webhook server
   */
  listen(port = 3000) {
    this.app.listen(port, () => {
      console.log(`Webhook server listening on port ${port}`);
    });
  }

  /**
   * Get Express app
   */
  getApp() {
    return this.app;
  }
}

// Create and export webhook service
const webhookService = new WebhookService();

module.exports = webhookService;
