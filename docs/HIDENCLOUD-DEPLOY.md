# HidenCloud Deployment Guide

**Overview**: Deploy my-saas-api to HidenCloud App Hosting (Node.js 23 container) with GitHub auto-deploy via `GIT_ADDRESS` + `AUTO_UPDATE=1`.

---

## Prerequisites

- GitHub repository (public or private)
- HidenCloud account
- GitHub Personal Access Token (PAT) if repo is private
- Domain or subdomain (optional, for production)

---

## Step 1: Set Environment Variables in HidenCloud Panel

Log in to your HidenCloud panel and configure the following variables.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GIT_ADDRESS` | GitHub repository URL | `https://github.com/yourusername/my-saas-api.git` |
| `BRANCH` | Git branch to deploy | `main` |
| `AUTO_UPDATE` | Enable auto git pull on restart | `1` |

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database file path | `file:./prisma/prod.db` |

**⚠️ CRITICAL**: HidenCloud filesystem may be wiped on container restart/rebuild. Verify volume persistence before trusting production data.

### Security

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Strong random secret for JWT tokens | Use `openssl rand -base64 32` to generate |

### CORS

| Variable | Description | Example |
|----------|-------------|---------|
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | `https://your-app.is-a.dev,https://your-app.hidenfree.com` |
| `FRONTEND_URL` | Frontend URL for OAuth callbacks | `https://your-app.is-a.dev` |

### OAuth Callback URLs

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CALLBACK_URL` | Google OAuth callback | `https://your-app.is-a.dev/api/auth/google/callback` |
| `GITHUB_CALLBACK_URL` | GitHub OAuth callback | `https://your-app.is-a.dev/api/auth/github/callback` |

---

## Step 2: Create GitHub PAT (for Private Repositories)

**If your repository is PUBLIC**: Skip this step (no authentication needed).

### Create PAT with Minimal Scope

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. **IMPORTANT**: Select **repo:read** scope ONLY (do NOT use full repo access)
4. Token name: `HidenCloud Auto-Deploy`
5. Generate token
6. **Copy the token immediately** (you won't see it again)

### Store PAT in HidenCloud Panel

1. Navigate to Environment Variables in HidenCloud
2. Add `USERNAME` (your GitHub username)
3. Add `ACCESS_TOKEN` (paste the PAT you just created)

⚠️ **Security Warning**: The PAT is stored **plaintext** in HidenCloud panel. If the panel is compromised, the token will be exposed. Use PAT with minimal scope (`repo:read`) to limit damage.

---

## Step 3: Set Up Repository on HidenCloud

1. **For PUBLIC repos**: Done (just set `GIT_ADDRESS` and `BRANCH`)
2. **For PRIVATE repos**: Set `USERNAME` and `ACCESS_TOKEN` environment variables

---

## Step 4: Set Production Environment Variables

Create `.env` file locally (or set variables directly in HidenCloud panel):

```bash
# Copy from .env.production.example
cp .env.production.example .env.production

# Edit and replace placeholders
nano .env.production
```

Set these values:
- `JWT_SECRET`: Strong random secret
- `DATABASE_URL=file:./prisma/prod.db`
- `ALLOWED_ORIGINS=https://your-app.is-a.dev,https://your-app.hidenfree.com`
- `FRONTEND_URL=https://your-app.is-a.dev`
- `GOOGLE_CALLBACK_URL=https://your-app.is-a.dev/api/auth/google/callback`
- `GITHUB_CALLBACK_URL=https://your-app.is-a.dev/api/auth/github/callback`

**Then set these in HidenCloud panel** (do not commit `.env.production` to git):
- `NODE_ENV=production`
- `PORT=3000`
- OAuth keys (if using Google/GitHub auth)

---

## Step 5: Verify Volume Persistence (CRITICAL)

**Before trusting production data, verify HidenCloud persists files on restart.**

### Test Procedure

1. Deploy the app with a sample database entry
2. Restart the container
3. Check if the data still exists

**Ask HidenCloud Support:**
- "Which directory persists across container restarts?"
- "Does HidenCloud provide volume mounts or persistent storage?"
- "Is the filesystem wiped on rebuild?"

### If Volume Does NOT Persist

You **must migrate to PostgreSQL immediately**. See `POSTGRESQL-MIGRATION.md` for instructions.

---

## Step 6: Restart Server

1. Go to your app on HidenCloud panel
2. Click "Restart"
3. Wait 1-2 minutes for:
   - Git pull (if `AUTO_UPDATE=1`)
   - `npm install` (if `node_modules` is missing)
   - Frontend build (if `frontend/dist/` is missing)
   - Prisma migrate deploy

### Auto-Update Flow

With `AUTO_UPDATE=1`:
1. You push code to GitHub (or merge PR)
2. HidenCloud detects changes
3. **Restart server** → auto git pull
4. `start.sh` runs:
   - `npm install --omit=dev` (skip if `node_modules` exists)
   - Frontend build (skip if `frontend/dist` exists)
   - `prisma migrate deploy`
   - `node src/index.js`

### Manual Restart (after code changes)

If you want to manually trigger a restart:
1. Push changes to GitHub
2. Restart HidenCloud app
3. Git pull will happen automatically

---

## Step 7: Verify Deployment

### Check Health Endpoint

```bash
curl https://your-app.hidenfree.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-XX-XXTXX:XX:XX.Z",
  "uptime": 123.456
}
```

### Check Frontend & Backend

1. Visit `https://your-app.hidenfree.com`
2. Verify you can log in
3. Verify you can create projects, workflows, etc.

---

## Deployment Workflow After Changes

1. **Code changes** → Push to GitHub
2. **CI runs tests** (`.github/workflows/ci.yml`):
   ```yaml
   name: CI
   on: push/PR to main
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - npm ci
         - npx prisma generate
         - npm test
   ```
3. **Manual deploy**:
   - Go to HidenCloud panel
   - Click "Restart"
   - Git pull code
   - Rebuild if needed
   - Restart server

**⚠️ Note**: CI does NOT deploy automatically. You must restart HidenCloud manually after CI passes.

---

## Troubleshooting

### Container Fails to Start

**Error**: `Error: ENOENT: no such file or directory, open 'prisma/prod.db'`

**Solution**:
1. Check `DATABASE_URL` is set correctly
2. Run `prisma migrate deploy` manually:
   ```bash
   npx prisma migrate deploy
   ```
3. Verify `prisma/migrations/` folder exists

### Frontend 404

**Error**: `https://your-app.hidenfree.com` returns 404

**Solution**:
1. Check `NODE_ENV=production` is set
2. Verify `frontend/dist/` folder exists
3. Check `src/index.js` has static serving logic
4. Restart server

### Prisma Migration Fails

**Error**: `Prisma Client was generated with a different schema`

**Solution**:
1. Run `npx prisma generate` locally
2. Commit `node_modules/@prisma/client/` if needed
3. Or regenerate on HidenCloud: `npx prisma generate`

### OAuth Callback 404

**Error**: `https://your-app.is-a.dev/api/auth/google/callback` returns 404

**Solution**:
1. Check `GITHUB_CALLBACK_URL` / `GOOGLE_CALLBACK_URL` matches production URL
2. Verify OAuth app redirect URIs in Google/GitHub developer console
3. Restart server to reload routes

---

## Security Checklist

- [ ] `JWT_SECRET` is strong random string
- [ ] `ALLOWED_ORIGINS` includes production URLs only
- [ ] OAuth keys are stored in HidenCloud panel (not in git)
- [ ] PAT scope is `repo:read` (not full access)
- [ ] `.env.production` is **NOT** committed to git
- [ ] Volume persistence verified

---

## Next Steps

- Configure domain via `docs/IS-A-DEV-DNS.md`
- Migrate to PostgreSQL if volume persistence is not guaranteed
- Set up backup/monitoring (optional)
