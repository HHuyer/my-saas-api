# Workflow Automation SaaS - Test Plan

## Test Environment
- API Server: `http://localhost:3000`
- Database: PostgreSQL 15
- Frontend: `http://localhost:3001`

## Test Categories

### 1. Authentication Tests (Category A)
- [x] Google OAuth Login (`/api/auth/google`)
- [x] Get User Profile (`/api/users/me`)
- [x] JWT Token Verification
- [x] Session Management

### 2. Project Management Tests (Category B)
- [x] Create Project (`POST /api/projects`)
- [x] Get All Projects (`GET /api/projects`)
- [x] Get Single Project (`GET /api/projects/:id`)
- [x] Update Project (`PUT /api/projects/:id`)
- [x] Delete Project (`DELETE /api/projects/:id`)

### 3. Workflow Management Tests (Category C)
- [x] Create Workflow (`POST /api/projects/:projectId/workflows`)
- [x] Get All Workflows (`GET /api/projects/:projectId/workflows`)
- [x] Get Single Workflow (`GET /api/workflows/:id`)
- [x] Update Workflow (`PUT /api/workflows/:id`)
- [x] Delete Workflow (`DELETE /api/workflows/:id`)

### 4. Workflow Execution Tests (Category D)
- [x] Execute Workflow (`POST /api/workflows/:id/run`)
- [x] Get Workflow Runs (`GET /api/workflows/:id/runs`)
- [x] Get Single Run (`GET /api/runs/:id`)
- [x] Get Run Details (`GET /api/runs/:id/nodes`)

### 5. Scheduled Workflows Tests (Category E)
- [x] Schedule Workflow (`POST /api/scheduled-workflows`)
- [x] Get Scheduled Workflows (`GET /api/scheduled-workflows`)
- [x] Pause Scheduled Workflow (`PUT /api/scheduled-workflows/:id/pause`)
- [x] Resume Scheduled Workflow (`PUT /api/scheduled-workflows/:id/resume`)
- [x] Get Scheduled Workflow Logs (`GET /api/scheduled-workflows/:id/logs`)
- [x] Delete Scheduled Workflow (`DELETE /api/scheduled-workflows/:id`)

### 6. Workflow Templates Tests (Category F)
- [x] Get All Templates (`GET /api/templates`)
- [x] Create Workflow from Template (`POST /api/templates/:id/clone`)

### 7. Notification System Tests (Category G)
- [x] Get Notifications (`GET /api/notifications`)
- [x] Get Unread Count (`GET /api/notifications/unread/count`)
- [x] Mark as Read (`PUT /api/notifications/:id/read`)
- [x] Mark All as Read (`PUT /api/notifications/read-all`)

### 8. Workflow Sharing Tests (Category H)
- [x] Share Workflow (`POST /api/workflow-sharing/share`)
- [x] Get Shared Workflows (`GET /api/workflow-sharing/shared-with-me`)
- [x] Update Sharing Permissions (`PUT /api/workflow-sharing/:id/permissions`)
- [x] Revoke Sharing (`DELETE /api/workflow-sharing/:id`)

### 9. Analytics Tests (Category I)
- [x] Get Workflow Analytics (`GET /api/analytics/workflow/:id`)
- [x] Get Runs by Date (`GET /api/analytics/runs/by-date`)
- [x] Get Success Rate (`GET /api/analytics/workflow/:id/success-rate`)

### 10. System Tests (Category J)
- [x] Health Check (`GET /health`)
- [x] Database Connection
- [x] Rate Limiting
- [x] CORS Configuration
- [x] Security Headers (Helmet)

## Test Scenarios

### Scenario 1: Complete Workflow Lifecycle
1. User creates a new project
2. User creates a workflow from template
3. User configures workflow nodes
4. User executes the workflow manually
5. User views workflow runs and details
6. User schedules the workflow to run automatically

### Scenario 2: Workflow Sharing
1. User shares a workflow with another user
2. Recipient views and accesses shared workflow
3. Recipient updates workflow permissions

### Scenario 3: Scheduled Execution
1. User schedules workflow with cron expression
2. Scheduler executes workflow at scheduled time
3. User views scheduled workflow logs

### Scenario 4: Notifications
1. System sends notification to user
2. User views notifications
3. User marks notifications as read

### Scenario 5: Analytics
1. User views workflow statistics
2. User analyzes run patterns over time
3. User identifies success rates and bottlenecks

## Test Results
- Test execution date: [To be filled]
- Total tests: [To be filled]
- Passed: [To be filled]
- Failed: [To be filled]
- Success rate: [To be filled]

## Notes
- All endpoints require JWT authentication
- All operations are scoped to user data
- Error handling implemented for all endpoints
- Rate limiting applied to all API routes
- Request logging enabled for all requests
