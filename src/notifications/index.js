/**
 * Notification Service
 * Handles sending notifications to users
 */

const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class NotificationService {
  constructor() {
    this.smtpTransporter = null;
    this.initTransporter();
  }

  /**
   * Initialize email transporter
   */
  async initTransporter() {
    if (process.env.SMTP_HOST) {
      this.smtpTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });
    }
  }

  /**
   * Create a notification
   */
  async createNotification(userId, type, title, message, metadata = null) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to user (in-app and email)
   */
  async sendNotification(userId, type, title, message, metadata = null) {
    try {
      // Create notification record
      const notification = await this.createNotification(userId, type, title, message, metadata);

      // Send email if transporter is configured
      if (this.smtpTransporter) {
        await this.sendEmailNotification(userId, type, title, message);
      }

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(userId, type, title, message, metadata = null) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      });

      if (!user || !user.email) {
        console.log('No email address found for user:', userId);
        return;
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@my-saas.com',
        to: user.email,
        subject: `[My SaaS] ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #2563eb; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">My SaaS</h1>
            </div>
            <div style="padding: 20px;">
              <h2>${title}</h2>
              <p>${message}</p>
              ${metadata ? `<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(metadata, null, 2)}</pre>` : ''}
              <div style="margin-top: 30px; text-align: center;">
                <a href="${process.env.FRONTEND_URL}/notifications" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Notifications</a>
              </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
              © ${new Date().getFullYear()} My SaaS. All rights reserved.
            </div>
          </div>
        `
      };

      await this.smtpTransporter.sendMail(mailOptions);
      console.log(`Email sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending email notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(userId, limit = 50) {
    try {
      return await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    try {
      return await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      return await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: { isRead: true }
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId) {
    try {
      return await prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Send notification for workflow run
   */
  async sendWorkflowRunNotification(userId, runId, status, errorMessage = null) {
    try {
      const title = `Workflow Run ${status}`;
      const message = status === 'COMPLETED'
        ? 'Your workflow has completed successfully.'
        : `Your workflow has failed. Run ID: ${runId}`;

      return await this.sendNotification(userId, 'WORKFLOW_RUN', title, message, {
        runId,
        status,
        errorMessage,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending workflow run notification:', error);
      throw error;
    }
  }

  /**
   * Send notification for scheduled workflow
   */
  async sendScheduledWorkflowNotification(userId, status, workflowName, runId) {
    try {
      const title = `Scheduled Workflow ${status}`;
      const message = status === 'COMPLETED'
        ? `Scheduled workflow "${workflowName}" has completed successfully.`
        : `Scheduled workflow "${workflowName}" has failed. Run ID: ${runId}`;

      return await this.sendNotification(userId, 'SCHEDULED_WORKFLOW', title, message, {
        workflowName,
        runId,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending scheduled workflow notification:', error);
      throw error;
    }
  }

  /**
   * Send notification for shared workflow
   */
  async sendWorkflowSharedNotification(sharedWithId, workflowName, sharedByName) {
    try {
      const title = 'Workflow Shared With You';
      const message = `${sharedByName} has shared a workflow "${workflowName}" with you.`;

      return await this.sendNotification(sharedWithId, 'WORKFLOW_SHARED', title, message, {
        workflowName,
        sharedByName,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending workflow shared notification:', error);
      throw error;
    }
  }

  /**
   * Send notification for new follower
   */
  async sendNewFollowerNotification(followerId, followedId, userName, followedName) {
    try {
      const title = 'New Follower';
      const message = `${userName} is now following you.`;

      return await this.sendNotification(followedId, 'NEW_FOLLOWER', title, message, {
        followerId,
        userName,
        followedName,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending new follower notification:', error);
      throw error;
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;
