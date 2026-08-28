# Deploy lên HidenCloud App Hosting

This guide explains how to deploy your my-saas-api application to HidenCloud App Hosting with GitHub auto-deploy.

## Overview

- **Container**: Node.js 23 (yolks:nodejs_23)
- **Auto-deploy**: Via `GIT_ADDRESS` + `AUTO_UPDATE=1` (git pull on restart)
- **Reverse proxy**: Automatic HTTPS (wildcard cert for *.hidenfree.com)
- **Database**: SQLite (file-based)
- **Frontend**: Served from backend as static files

## Prerequisites

1. GitHub repository (public or private)
2. HidenCloud account
3. For private repo: GitHub PAT with minimal scope (repo:read only)

## Step-by-Step Instructions

### Step 1: Configure GitHub Repo

1. Go to your GitHub repository settings
2. Copy the repo URL (e.g., `https://github.com/HHuyer/my-saas-api.git`)
3. **For private repo only**: Generate PAT
   - Go to Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Create new token with scopes: `repo:read` (NOT full access!)
   - Copy the token (save it securely)

### Step 2: Create HidenCloud Server

1. Log in to HidenCloud panel: https://freepanel.hidencloud.com
2. Click "Create Server"
3. Configure:
   - **Name**: `my-saas-api`
   - **Node**: Node.js 23 (yolks:nodejs_23)
   - **Main file**: `src/index.js`
   - **Additional arguments**: (Leave empty)
   - **Git Repo Address**: `https://github.com/HHuyer/my-saas-api.git`
   - **Install Branch**: `main`
   - **Auto Update**: `1` (automatically pull code on restart)
   - **Username**: (Only if private repo) Your GitHub username
   - **Access Token**: (Only if private repo) Your PAT (without scope)

### Step 3: Set Environment Variables

Navigate to **Startup Settings** → **Environment Variables** tab and add:

**Required variables:**
```
NODE_ENV=production
PORT=3000
DATABASE_URL=file:./prisma/prod.db
JWT_SECRET=<your-strong-random-secret>
ALLOWED_ORIGINS=https://<your-name>.is-a.dev,https://<your-name>.hidenfree.com
FRONTEND_URL=https://<your-name>.is-a.dev
```

**OAuth variables** (optional, only if configured):
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://<your-name>.is-a.dev/api/auth/google/callback
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=https://<your-name>.is-a.dev/api/auth/github/callback
```

**AI variables** (optional):
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
```

**SMTP variables** (optional, for email notifications):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

> **Security Note**: JWT_SECRET must be a strong random string (at least 32 characters). Generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Step 4: Start the Server

1. Click **Save** (or **Apply Changes**)
2. Click **Start** button
3. Wait 30-60 seconds for:
   - Server to start
   - npm install (first time only)
   - Frontend build (first time only)
   - Prisma migrations

4. Monitor logs to see progress:
   - Installation logs
   - Build logs
   - Server startup

### Step 5: Verify Deployment

1. Check server status: Should show **ONLINE** (0 Bytes / 15 GiB)
2. Test health endpoint:
   ```bash
   curl https://<your-name>.hidenfree.com/health
   ```
   Should return: `{"status":"ok"}`

3. Visit your app in browser:
   - `https://<your-name>.hidenfree.com`
   - Or `http://<your-name>.hidenfree.com:3000` (if accessible)

4. Test features:
   - Login (test-login: test@example.com)
   - Create project
   - Create workflow
   - Run workflow
   - Check logs

### Step 6: Configure Domain (Optional)

Follow [IS-A-DEV-DNS.md](./IS-A-DEV-DNS.md) to configure a free `.is-a.dev` domain.

## Volume Persistence

**IMPORTANT**: Verify SQLite database persists across restarts before trusting it in production.

### Test Volume Persistence:

1. Create a workflow and run it
2. Check database exists: `ls prisma/prod.db`
3. Restart server via HidenCloud panel
4. Check database still exists: `ls prisma/prod.db`
5. Login and verify your workflow still exists

**If database is lost on restart:**
- Contact HidenCloud support to ask which volume persists
- Consider migrating to PostgreSQL (see [POSTGRESQL-MIGRATION.md](./POSTGRESQL-MIGRATION.md))

## Deployment Workflow

After initial setup:

1. **Development/Changes**:
   - Make changes locally
   - Commit and push to GitHub

2. **CI (Automated)**:
   - GitHub Actions workflow runs tests
   - Check CI status: https://github.com/HHuyer/my-saas-api/actions

3. **Deploy**:
   - Go to HidenCloud panel → **Restart Server**
   - Server pulls latest code (`git pull`)
   - If code changes, may need rebuild (depends on changes)
   - Start button auto-restarts server

4. **Verification**:
   - Check server status
   - Test critical features
   - Monitor logs

## Troubleshooting

**Server stuck at INSTALLING:**

1. Check HidenCloud logs for errors
2. Verify git credentials are correct (if using private repo)
3. Ensure branch name matches (`main`)

**Server shows OFFLINE:**

1. Check environment variables are set correctly
2. Verify server image is `ghcr.io/parkervcp/yolks:nodejs_23`
3. Ensure Main file path is `src/index.js`
4. Check logs for startup errors

**Frontend not loading:**

1. Verify environment variable `FRONTEND_URL` is set
2. Check server logs for errors
3. Try restarting server
4. Check browser console for CORS errors

**Database errors:**

1. Check `DATABASE_URL` is correct (`file:./prisma/prod.db`)
2. Verify Prisma migrations ran successfully (check logs)
3. Check volume persistence (see above)
4. Consider testing with PostgreSQL

**OAuth not working:**

1. Verify callback URLs in env vars match your domain
2. Check OAuth app configuration on Google/GitHub
3. Verify redirect URLs include:
   - `https://<name>.is-a.dev/api/auth/google/callback`
   - `https://<name>.is-a.dev/api/auth/github/callback`

**High CPU/Memory usage:**

1. Check for infinite loops in workflow definitions
2. Review workflow execution logs
3. Consider adding rate limiting
4. Check for memory leaks

## Security Checklist

- [ ] JWT_SECRET is a strong random string
- [ ] Database URL uses SQLite file path (not connection string)
- [ ] OAuth callback URLs match production domain
- [ ] CORS allowed origins only include your domains
- [ ] No sensitive data in logs (check if you're logging secrets)
- [ ] Volume persistence verified
- [ ] HTTPS enabled (automatic via HidenCloud)

## Maintenance

### Backup Database

```bash
# In HidenCloud panel → Terminal
cp prisma/prod.db prisma/prod.db.backup
```

### View Logs

1. Go to HidenCloud panel → Server details
2. Click **Logs** tab
3. Monitor real-time logs or download history

### Update Application

```bash
# 1. Push changes to GitHub
git add .
git commit -m "Update feature"
git push origin main

# 2. Restart server on HidenCloud panel
# Server will auto-pull latest code

# 3. Test changes
```

### Restart Server

- Click **Restart** button in HidenCloud panel
- Or use API: `POST https://freepanel.hidencloud.com/api/servers/{id}/restart`

## References

- [HidenCloud Documentation](https://hidencloud.com/docs)
- [HidenCloud App Hosting Guide](https://hidencloud.com/docs/app-hosting)
- [is-a.dev DNS Guide](./IS-A-DEV-DNS.md)
- [PostgreSQL Migration Guide](./POSTGRESQL-MIGRATION.md)
- [GitHub Actions CI](https://github.com/HHuyer/my-saas-api/actions)

## Support

- HidenCloud support: https://hidencloud.com/support
- HidenCloud Discord: (if available)
