# Cấu hình Domain is-a.dev

This guide explains how to configure a free `.is-a.dev` domain for your application.

## Why is-a.dev?

- **Free**: No cost to register and use
- **Easy**: Automatic DNS setup via GitHub
- **Professional**: Looks like a real domain (e.g., `yourapp.is-a.dev`)

## Prerequisites

1. GitHub account
2. Your app already deployed (HidenCloud)
3. Willing to use an **email alias** (see security warning below)

## Security Warning

**IMPORTANT**: The email you provide in the `domains/<name>.json` file will be **permanently public on GitHub**. Do NOT use your personal email address. Use an email alias or throwaway email.

## Step-by-Step Instructions

### 1. Fork is-a-dev/register

1. Go to: https://github.com/is-a-dev/register
2. Click "Fork" button in top right
3. Wait for fork to complete

### 2. Create domains file

1. Navigate to your forked repository
2. Create a new file at `domains/<your-name>.json`
3. Paste the following template:

```json
{
  "owner": {
    "username": "your-github-username",
    "email": "your-alias-email@example.com"
  },
  "record": {
    "CNAME": "your-app-name.hidenfree.com"
  }
}
```

### 3. Configure the file

Replace the placeholders with your actual values:

- `your-github-username`: Your GitHub username
- `your-alias-email@example.com`: **ALWAYS use an email alias**, never your personal email
- `your-app-name`: Your application name

### 4. Open Pull Request

1. Click "Pull requests" tab
2. Click "New pull request"
3. Click "compare across forks"
4. Select: base repository `is-a-dev/register`, head repository `your-username/register`
5. Title: `Add domain: myapp.is-a.dev`
6. Click "Create pull request"

### 5. Wait for Merge

- A maintainer will review your PR
- **Typically merged within 24 hours**
- Once merged, DNS records will be automatically created

### 6. Verify

- Wait 5-30 minutes for DNS propagation
- Visit `https://<your-name>.is-a.dev`
- Should redirect to your HidenCloud app

## Example

```bash
# 1. Fork is-a-dev/register
# 2. Create domains/myapp.json:
{
  "owner": {
    "username": "HHuyer",
    "email": "saas@trashmail.com"  # Using alias
  },
  "record": {
    "CNAME": "my-saas-api.hidenfree.com"
  }
}

# 3. Open PR → wait for merge (24h)
# 4. Wait 5-30 minutes for DNS
# 5. Visit https://myapp.is-a.dev
```

## Troubleshooting

**Domain not working:**
- Wait longer (DNS propagation can take up to 1 hour)
- Check DNS records: `nslookup <your-name>.is-a.dev`
- Verify your CNAME points to the correct HidenCloud app

**PR not merged:**
- Wait longer (maintainers may be busy)
- Consider adding a comment to your PR

## References

- [is-a.dev](https://is-a.dev/)
- [GitHub is-a-dev/register repo](https://github.com/is-a-dev/register)
