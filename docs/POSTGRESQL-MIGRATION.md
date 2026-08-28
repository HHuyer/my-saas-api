# Migration Guide: SQLite → PostgreSQL

This guide explains how to migrate from SQLite to PostgreSQL for production use.

## Why Migrate to PostgreSQL?

Consider migrating when:
- **High traffic**: Multiple users accessing concurrently
- **Concurrent writes**: Many workflow executions at the same time
- **Volume persistence concerns**: HidenCloud may not persist SQLite across restarts
- **Scaling**: Need horizontal scaling (multiple app instances)
- **Complex queries**: Need advanced SQL features

SQLite is great for:
- Development
- Small applications
- Single-server deployments
- Simple use cases

PostgreSQL is better for:
- Production workloads
- High availability
- Concurrent access
- Advanced features

## Prerequisites

1. PostgreSQL server running (local or cloud)
2. Database credentials
3. Application downtime allowed (1-5 minutes for migration)
4. Backup of SQLite database (in case of issues)

## Step 1: Update Prisma Schema

### 1.1 Change provider

Open `prisma/schema.prisma` and change the provider:

```prisma
// BEFORE (SQLite)
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// AFTER (PostgreSQL)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 1.2 Update environment variable

Update `.env.production.example`:

```env
# BEFORE (SQLite)
DATABASE_URL=file:./prisma/prod.db

# AFTER (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/my-saas-api
```

## Step 2: Generate Prisma Client

```bash
npx prisma generate
```

## Step 3: Create PostgreSQL Database

### Option A: Local PostgreSQL

```bash
# Create database
psql -U postgres
CREATE DATABASE my_saas_api;
\q

# OR using psql commands
createdb my_saas_api
```

### Option B: Cloud PostgreSQL (e.g., Supabase, Neon, RDS)

1. Create database via cloud provider
2. Copy connection string (format: `postgresql://user:password@host:port/database`)

## Step 4: Migrate Database

### 4.1 Push initial schema

```bash
npx prisma db push
```

This creates all tables in PostgreSQL based on your schema.

### 4.2 Verify migration

```bash
# List all tables
npx prisma db execute --stdin <<EOF
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
