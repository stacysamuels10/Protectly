import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PriCal API',
      version: '1.0.0',
      description: `
## Overview

PriCal is a webhook-based access control system for Calendly that automatically cancels unauthorized booking attempts.

## Authentication

Most API endpoints require authentication via session cookie. To authenticate:

1. Direct users to \`GET /api/auth/calendly\` to start the OAuth flow
2. After successful OAuth, a session cookie is set automatically
3. Include the session cookie with all subsequent requests

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 100 requests per minute for authenticated users
- 10 requests per minute for unauthenticated users

## Errors

All error responses follow this format:

\`\`\`json
{
  "error": "Error message description"
}
\`\`\`

Common HTTP status codes:
- \`400\` - Bad Request (invalid input)
- \`401\` - Unauthorized (not authenticated)
- \`403\` - Forbidden (not authorized for this resource)
- \`404\` - Not Found
- \`429\` - Too Many Requests (rate limited)
- \`500\` - Internal Server Error
      `,
      contact: {
        name: 'PriCal Support',
        email: 'support@prical.io',
        url: 'https://prical.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        description: 'Current Environment',
      },
      {
        url: 'https://app.prical.io',
        description: 'Production',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'OAuth and session management',
      },
      {
        name: 'Allowlists',
        description: 'Manage approved email addresses',
      },
      {
        name: 'Dashboard',
        description: 'Dashboard statistics and activity',
      },
      {
        name: 'Settings',
        description: 'User preferences and configuration',
      },
      {
        name: 'Billing',
        description: 'Subscription and payment management',
      },
      {
        name: 'Webhooks',
        description: 'Webhook endpoints for Calendly and Stripe',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'prical-session',
          description: 'Session cookie set after OAuth authentication',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', format: 'uri', nullable: true },
            subscriptionTier: {
              type: 'string',
              enum: ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'],
            },
            subscriptionStatus: {
              type: 'string',
              enum: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID'],
            },
            guestCheckMode: {
              type: 'string',
              enum: ['STRICT', 'PRIMARY_ONLY', 'ANY_APPROVED', 'NO_GUESTS', 'ALLOW_ALL'],
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Allowlist: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            isGlobal: { type: 'boolean' },
            eventTypeId: { type: 'string', format: 'uuid', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            _count: {
              type: 'object',
              properties: {
                entries: { type: 'integer' },
              },
            },
          },
        },
        AllowlistEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        BookingAttempt: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            inviteeEmail: { type: 'string', format: 'email' },
            inviteeName: { type: 'string', nullable: true },
            status: {
              type: 'string',
              enum: ['APPROVED', 'REJECTED', 'RATE_LIMITED'],
            },
            rejectionReason: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            eventType: {
              type: 'object',
              nullable: true,
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
        DashboardStats: {
          type: 'object',
          properties: {
            totalBookings: { type: 'integer' },
            approvedBookings: { type: 'integer' },
            rejectedBookings: { type: 'integer' },
            allowlistSize: { type: 'integer' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: [
    './src/app/api/**/*.ts',
  ],
}

export const swaggerSpec = swaggerJsdoc(options)

