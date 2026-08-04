# SQLite to PostgreSQL Migration Guide

**Overview**: Migrate database from SQLite to PostgreSQL for production deployment. Use this if HidenCloud does not persist SQLite files on container restart, or if you need PostgreSQL for performance/scalability.

---

## When to Migrate

Migrate to PostgreSQL if:
- HidenCloud filesystem is wiped on container restart/rebuild
- You need PostgreSQL for:
  - Better concurrent write performance
  - Connection pooling
  - Advanced features (full-text search, JSONB, arrays)
  - Scaling to multiple containers

---

## Step 1: Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Changes**:
- Change `provider` from `sqlite` to `postgresql`
- Keep `DATABASE_URL` environment variable

---

## Step 2: Create PostgreSQL Database

### Option A: Use HidenCloud Managed PostgreSQL (Recommended)

1. Create PostgreSQL database in HidenCloud panel (if available)
2. Note connection string:
   ```
   postgresql://username:password@host:5432/dbname
   ```

### Option B: Use External PostgreSQL (e.g., Supabase, Neon)

1. Sign up for PostgreSQL provider
2. Create database and note connection string
3. Get connection details from provider dashboard

---

## Step 3: Update DATABASE_URL

Set `DATABASE_URL` in `.env.production`:

```bash
# SQLite (old)
DATABASE_URL=file:./prisma/prod.db

# PostgreSQL (new)
DATABASE_URL=postgresql://username:password@host:5432/dbname
```

**Examples**:
- Local PostgreSQL: `postgresql://postgres:password@localhost:5432/my_saas_db`
- Supabase: `postgresql://postgres:postgres:x...@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
- Neon: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb`

---

## Step 4: Install PostgreSQL Driver (If Not Already)

If not installed, add `pg` package:

```bash
npm install pg --save
```

---

## Step 5: Run Prisma Migrate

### Generate Prisma Client (PostgreSQL)

```bash
npx prisma generate
```

### Migrate to Production Database

```bash
npx prisma migrate deploy
```

This will:
- Apply all pending migrations to PostgreSQL
- Create all tables in the new database
- Verify schema matches migrations

---

## Step 6: Verify Database Connection

Test connection locally:

```bash
npx prisma db pull  # Pull schema from PostgreSQL
npx prisma studio   # Open Prisma Studio to view data
```

Check if tables and data appear in Prisma Studio.

---

## Step 7: Export SQLite Data (Optional)

If you need to migrate existing SQLite data to PostgreSQL:

### Option A: Use Prisma Migrate (Recommended)

1. Check current migrations in `prisma/migrations/`
2. Run `npx prisma migrate dev --name add_workflow_run_analytics` (example)
3. Apply all migrations to PostgreSQL
4. Data will be preserved by migrations

### Option B: Export SQLite → Import PostgreSQL

#### Export SQLite

```bash
# Using sqlite3
sqlite3 prisma/prod.db .dump > export.sql

# Or using Prisma
npx prisma db pull  # Pull current schema
npx prisma db seed  # If you have a seed script
```

#### Import to PostgreSQL

```bash
psql postgresql://username:password@host:5432/dbname < export.sql
```

Or use Prisma:

```bash
npx prisma db push --force-reset  # WARNING: Clears PostgreSQL database
npx prisma db seed  # Import seed data
```

⚠️ **Warning**: `db push --force-reset` will **delete all data** in PostgreSQL. Use only for testing or if you have no important data.

---

## Step 8: Test Locally

1. Set `DATABASE_URL=postgresql://...`
2. Run `npx prisma migrate deploy`
3. Run `node src/index.js`
4. Test all features:
   - Login
   - Create projects
   - Create workflows
   - Run workflows
   - Verify data persistence

---

## Step 9: Deploy to HidenCloud

1. Set `DATABASE_URL` in HidenCloud panel (not in `.env.production`)
2. Restart HidenCloud app
3. Verify health endpoint returns ok
4. Test all features in browser

---

## Verification Checklist

- [ ] `provider = "postgresql"` in `schema.prisma`
- [ ] `DATABASE_URL` points to PostgreSQL (not SQLite)
- [ ] `pg` package is installed
- [ ] Prisma Client generated successfully
- [ ] `npx prisma migrate deploy` succeeds
- [ ] All tables created in PostgreSQL
- [ ] Data migrated (if applicable)
- [ ] Application works correctly in production

---

## Performance Optimization (Optional)

### Connection Pooling

Use `pg-hstore` for connection pooling in `src/index.js`:

```javascript
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // max 20 connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

Then replace `new PrismaClient()` with:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});
```

### SSL Connection (Recommended for Cloud PostgreSQL)

Add SSL options:

```javascript
const pool = new Pool({
  ssl: {
    rejectUnauthorized: false, // Development only
  },
});
```

**For production**, use proper SSL certificates:

```javascript
const ssl = {
  rejectUnauthorized: true,
  ca: fs.readFileSync('/path/to/ca-certificate.crt').toString(),
};
```

---

## Troubleshooting

### Migration Fails: "connection refused"

**Cause**: PostgreSQL not running or incorrect connection string.

**Solution**:
1. Check PostgreSQL is running:
   ```bash
   pg_isready
   ```
2. Verify connection string format: `postgresql://user:password@host:5432/dbname`
3. Check firewall allows port 5432

### Migration Fails: "relation does not exist"

**Cause**: Tables not created.

**Solution**:
1. Run `npx prisma migrate deploy` (not `migrate dev`)
2. Check migrations folder has entries for all tables
3. Verify `schema.prisma` matches migrations

### Prisma Studio Connection Refused

**Cause**: Wrong `DATABASE_URL` or PostgreSQL not running.

**Solution**:
1. Test connection:
   ```bash
   npx prisma db pull
   ```
2. Check if tables appear
3. Verify `DATABASE_URL` is correct

### Data Lost After Migrate

**Cause**: Used `db push --force-reset` incorrectly.

**Solution**:
1. Use `migrate deploy` instead of `db push --force-reset`
2. Or restore from backup (if available)

---

## Rollback to SQLite

If needed, revert to SQLite:

1. Change `provider` back to `sqlite` in `schema.prisma`
2. Set `DATABASE_URL=file:./prisma/prod.db`
3. Run `npx prisma generate`
4. Run `npx prisma migrate deploy`
5. Restart application

⚠️ **Warning**: Reverting will not restore data lost during migration. Keep PostgreSQL backup before rollback.

---

## Cost Considerations

- **SQLite**: Free, no maintenance, single file
- **PostgreSQL**:
  - HidenCloud managed PostgreSQL: Free tier available, limited
  - External providers (Supabase, Neon): Free tier for dev, paid for production
  - Self-hosted: Requires VPS and maintenance

Choose PostgreSQL only if you need its features and can afford the cost/maintenance.

---

## Additional Resources

- [Prisma PostgreSQL Documentation](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [PostgreSQL vs SQLite Comparison](https://www.prisma.io/docs/guides/performance-and-optimization/choosing-a-database)
- [Supabase Free Tier](https://supabase.com/pricing)
- [Neon Serverless PostgreSQL](https://neon.tech/)
