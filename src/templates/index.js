/**
 * Workflow Templates
 * Predefined workflow templates for common use cases
 */

const templates = {
  // Email Automation Template
  emailAutomation: {
    name: "Email Automation",
    description: "Automate email workflows with conditional logic and multiple actions",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        label: "Webhook Trigger",
        x: 100,
        y: 100,
        properties: {
          triggerType: "webhook",
          endpoint: "/webhook/email",
          method: "POST"
        }
      },
      {
        id: "condition-1",
        type: "condition",
        label: "Check User Type",
        x: 350,
        y: 100,
        properties: {
          condition: "userType === 'premium'",
          trueAction: "sendEmail",
          falseAction: "sendWelcomeEmail"
        }
      },
      {
        id: "action-1",
        type: "action",
        label: "Send Email",
        x: 600,
        y: 50,
        properties: {
          actionType: "sendEmail",
          subject: "Welcome to Our Service!",
          body: "Thank you for signing up!",
          recipient: "{{email}}"
        }
      },
      {
        id: "action-2",
        type: "action",
        label: "Send Welcome Email",
        x: 600,
        y: 150,
        properties: {
          actionType: "sendEmail",
          subject: "Welcome to Our Service!",
          body: "Thank you for signing up!",
          recipient: "{{email}}"
        }
      }
    ],
    connections: [
      { from: "trigger-1", to: "condition-1" },
      { from: "condition-1", to: "action-1", label: "true" },
      { from: "condition-1", to: "action-2", label: "false" }
    ]
  },

  // Data Processing Template
  dataProcessing: {
    name: "Data Processing Pipeline",
    description: "Process and transform data with validation and multiple outputs",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        label: "API Trigger",
        x: 100,
        y: 100,
        properties: {
          triggerType: "api",
          endpoint: "/api/process-data",
          method: "POST"
        }
      },
      {
        id: "action-1",
        type: "action",
        label: "Validate Data",
        x: 350,
        y: 100,
        properties: {
          actionType: "validate",
          rules: ["required", "type:object", "hasFields:email,name"]
        }
      },
      {
        id: "action-2",
        type: "action",
        label: "Transform Data",
        x: 600,
        y: 100,
        properties: {
          actionType: "transform",
          transformations: ["uppercase:name", "format:email"]
        }
      },
      {
        id: "action-3",
        type: "action",
        label: "Save to Database",
        x: 850,
        y: 100,
        properties: {
          actionType: "database",
          table: "users",
          operation: "insert"
        }
      },
      {
        id: "action-4",
        type: "action",
        label: "Send Notification",
        x: 850,
        y: 250,
        properties: {
          actionType: "notification",
          channel: "slack",
          message: "New user created: {{name}}"
        }
      }
    ],
    connections: [
      { from: "trigger-1", to: "action-1" },
      { from: "action-1", to: "action-2" },
      { from: "action-2", to: "action-3" },
      { from: "action-2", to: "action-4" }
    ]
  },

  // Social Media Post Template
  socialMedia: {
    name: "Social Media Auto-Poster",
    description: "Automatically post content across multiple social platforms",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        label: "Schedule Trigger",
        x: 100,
        y: 100,
        properties: {
          triggerType: "schedule",
          cron: "0 9 * * *",
          timezone: "UTC"
        }
      },
      {
        id: "action-1",
        type: "action",
        label: "Fetch Content",
        x: 350,
        y: 100,
        properties: {
          actionType: "http",
          method: "GET",
          url: "https://api.content.com/post",
          headers: { Authorization: "Bearer {{token}}" }
        }
      },
      {
        id: "action-2",
        type: "action",
        label: "Post to Twitter",
        x: 600,
        y: 50,
        properties: {
          actionType: "social",
          platform: "twitter",
          status: "POST",
          body: "{{content}}"
        }
      },
      {
        id: "action-3",
        type: "action",
        label: "Post to LinkedIn",
        x: 600,
        y: 150,
        properties: {
          actionType: "social",
          platform: "linkedin",
          status: "POST",
          body: "{{content}}"
        }
      },
      {
        id: "action-4",
        type: "action",
        label: "Post to Facebook",
        x: 600,
        y: 250,
        properties: {
          actionType: "social",
          platform: "facebook",
          status: "POST",
          body: "{{content}}"
        }
      },
      {
        id: "action-5",
        type: "action",
        label: "Log Success",
        x: 850,
        y: 150,
        properties: {
          actionType: "logging",
          level: "info",
          message: "Content posted successfully to all platforms"
        }
      }
    ],
    connections: [
      { from: "trigger-1", to: "action-1" },
      { from: "action-1", to: "action-2" },
      { from: "action-1", to: "action-3" },
      { from: "action-1", to: "action-4" },
      { from: "action-2", to: "action-5" },
      { from: "action-3", to: "action-5" },
      { from: "action-4", to: "action-5" }
    ]
  },

  // Invoice Generation Template
  invoiceGeneration: {
    name: "Invoice Generation",
    description: "Generate invoices based on customer data and send via email",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        label: "Order Complete Trigger",
        x: 100,
        y: 100,
        properties: {
          triggerType: "webhook",
          endpoint: "/webhook/order-complete",
          method: "POST"
        }
      },
      {
        id: "action-1",
        type: "action",
        label: "Fetch Order Data",
        x: 350,
        y: 100,
        properties: {
          actionType: "http",
          method: "GET",
          url: "https://api.orders.com/{{orderId}}",
          headers: { Authorization: "Bearer {{token}}" }
        }
      },
      {
        id: "action-2",
        type: "action",
        label: "Generate PDF",
        x: 600,
        y: 100,
        properties: {
          actionType: "generate-pdf",
          template: "invoice-template",
          data: "{{orderData}}"
        }
      },
      {
        id: "action-3",
        type: "action",
        label: "Send Email Invoice",
        x: 850,
        y: 50,
        properties: {
          actionType: "sendEmail",
          subject: "Invoice #{{invoiceNumber}}",
          body: "Please find your invoice attached.",
          attachments: ["invoice.pdf"]
        }
      },
      {
        id: "action-4",
        type: "action",
        label: "Update Status",
        x: 850,
        y: 150,
        properties: {
          actionType: "database",
          table: "orders",
          operation: "update",
          fields: { status: "invoiced" },
          where: { id: "{{orderId}}" }
        }
      },
      {
        id: "action-5",
        type: "action",
        label: "Archive Order",
        x: 850,
        y: 250,
        properties: {
          actionType: "database",
          table: "orders_archive",
          operation: "insert",
          data: "{{orderData}}"
        }
      }
    ],
    connections: [
      { from: "trigger-1", to: "action-1" },
      { from: "action-1", to: "action-2" },
      { from: "action-2", to: "action-3" },
      { from: "action-2", to: "action-4" },
      { from: "action-4", to: "action-5" }
    ]
  },

  // Notification Template
  notificationSystem: {
    name: "Notification System",
    description: "Multi-channel notification system for various events",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        label: "Event Trigger",
        x: 100,
        y: 100,
        properties: {
          triggerType: "event",
          event: "user.action",
          data: { action: "signup" }
        }
      },
      {
        id: "condition-1",
        type: "condition",
        label: "Critical Alert?",
        x: 350,
        y: 100,
        properties: {
          condition: "event.data.level === 'critical'",
          trueAction: "sms",
          falseAction: "email"
        }
      },
      {
        id: "action-1",
        type: "action",
        label: "Send SMS",
        x: 600,
        y: 50,
        properties: {
          actionType: "sms",
          service: "twilio",
          template: "urgent-alert",
          params: "{{eventData}}"
        }
      },
      {
        id: "action-2",
        type: "action",
        label: "Send Email",
        x: 600,
        y: 150,
        properties: {
          actionType: "email",
          service: "sendgrid",
          template: "standard-notification",
          params: "{{eventData}}"
        }
      },
      {
        id: "action-3",
        type: "action",
        label: "Log Notification",
        x: 850,
        y: 100,
        properties: {
          actionType: "logging",
          level: "info",
          message: "Notification sent via {{channel}}",
          data: "{{eventData}}"
        }
      }
    ],
    connections: [
      { from: "trigger-1", to: "condition-1" },
      { from: "condition-1", to: "action-1", label: "true" },
      { from: "condition-1", to: "action-2", label: "false" },
      { from: "action-1", to: "action-3" },
      { from: "action-2", to: "action-3" }
    ]
  },

  // Backup Template
  automatedBackup: {
    name: "Automated Backup",
    description: "Regular database backups with compression and remote storage",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        label: "Schedule Trigger",
        x: 100,
        y: 100,
        properties: {
          triggerType: "schedule",
          cron: "0 2 * * *",
          timezone: "UTC"
        }
      },
      {
        id: "action-1",
        type: "action",
        label: "Create Backup",
        x: 350,
        y: 100,
        properties: {
          actionType: "database",
          operation: "backup",
          database: "mydb",
          format: "sql"
        }
      },
      {
        id: "action-2",
        type: "action",
        label: "Compress Backup",
        x: 600,
        y: 100,
        properties: {
          actionType: "compress",
          format: "gzip",
          input: "backup.sql"
        }
      },
      {
        id: "action-3",
        type: "action",
        label: "Upload to S3",
        x: 850,
        y: 100,
        properties: {
          actionType: "s3",
          bucket: "backups",
          key: "daily/backup-{{timestamp}}.sql.gz",
          operation: "upload"
        }
      },
      {
        id: "action-4",
        type: "action",
        label: "Cleanup Old Backups",
        x: 1100,
        y: 100,
        properties: {
          actionType: "cleanup",
          type: "s3",
          bucket: "backups",
          retention: "30",
          pattern: "daily/backup-*.sql.gz"
        }
      },
      {
        id: "action-5",
        type: "action",
        label: "Send Alert",
        x: 1100,
        y: 250,
        properties: {
          actionType: "notification",
          channel: "slack",
          message: "Backup completed successfully. Size: {{size}}"
        }
      }
    ],
    connections: [
      { from: "trigger-1", to: "action-1" },
      { from: "action-1", to: "action-2" },
      { from: "action-2", to: "action-3" },
      { from: "action-3", to: "action-4" },
      { from: "action-4", to: "action-5" }
    ]
  }
};

/**
 * Get all available templates
 */
function getAllTemplates() {
  return Object.values(templates);
}

/**
 * Get template by ID
 */
function getTemplateById(id) {
  return templates[id];
}

/**
 * Get template categories
 */
function getTemplateCategories() {
  return {
    automation: {
      name: "Automation",
      templates: ["emailAutomation", "dataProcessing", "socialMedia", "invoiceGeneration"]
    },
    notifications: {
      name: "Notifications",
      templates: ["notificationSystem"]
    },
    backups: {
      name: "Backups & Maintenance",
      templates: ["automatedBackup"]
    }
  };
}

module.exports = {
  templates,
  getAllTemplates,
  getTemplateById,
  getTemplateCategories
};
