# is-a.dev Domain Setup Guide

**Overview**: `is-a.dev` offers free domains via GitHub contribution. The domain registration requires you to make a public contribution to the `is-a-dev/register` repository.

## ⚠️ SECURITY WARNING

**CRITICAL**: All records in `is-a-dev/register` are **publicly visible** in GitHub:
- Your GitHub username will be visible
- Your email address in the owner field will be **permanently public**

**DO NOT use your primary email address.** Create an email alias/subordinate email for this purpose.

---

## Step 1: Fork `is-a-dev/register`

1. Navigate to https://github.com/is-a-dev/register
2. Click "Fork" → Fork to your own GitHub account
3. Wait for the fork to complete

---

## Step 2: Create Domain Record

1. In your forked repository, navigate to the `domains/` folder
2. Create a new file named `<your-name>.json` (replace `<your-name>` with your desired domain, e.g., `myapp.is-a.dev`)
3. Add the following JSON structure:

```json
{
  "owner": {
    "username": "your-github-username",
    "email": "your-email@example.com"
  },
  "record": {
    "CNAME": "your-app.hidenfree.com"
  }
}
```

**Required values**:
- `username`: Your GitHub username (visible publicly)
- `email`: **Use email alias only** — will be visible on GitHub permanently
- `record.CNAME`: Your HidenCloud app URL (format: `your-app.hidenfree.com`)

---

## Step 3: Create Pull Request

1. Commit the file:
   ```bash
   git add domains/<your-name>.json
   git commit -m "Register <your-name>.is-a.dev domain"
   git push origin main
   ```

2. Go to your fork on GitHub → Click "Compare & pull request"
3. Title: `Register <your-name>.is-a.dev domain`
4. Leave PR description blank (no changes needed)
5. Click "Create pull request"

---

## Step 4: Merge PR

1. Wait for the PR review (automated by the is-a-dev bot)
2. Once approved, click "Merge pull request"
3. Wait 1-2 minutes for DNS propagation

---

## Step 5: Verify Domain

After merge, verify your domain is working:

```bash
# Check DNS resolution
nslookup your-name.is-a.dev

# Check HTTP response
curl https://your-name.is-a.dev
```

Your domain should redirect to your HidenCloud app at `https://your-app.hidenfree.com`

---

## Troubleshooting

### DNS Not Propagating

- Wait 5-10 minutes after merge
- Check DNS propagation with: https://whatsmydns.net
- Ensure your CNAME points to the correct HidenCloud app URL

### Already Registered

If the domain is already registered:
- Change the filename (e.g., `myapp-beta.is-a.dev`)
- Create new PR

### 404 Error

- Ensure `record.CNAME` matches your HidenCloud app URL exactly
- Restart your HidenCloud app after domain is registered
- Check Cloudflare DNS settings (is-a.dev uses Cloudflare)

---

## Future Changes

To update your domain record later:
1. Open `domains/<your-name>.json`
2. Modify the `record.CNAME` value
3. Commit and push → Create new PR → Merge
4. Restart HidenCloud app

⚠️ **Note**: The GitHub username and email in the `owner` field cannot be changed after the PR is merged.
