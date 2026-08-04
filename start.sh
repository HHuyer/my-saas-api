#!/bin/bash
set -e

echo "Starting my-saas-api..."

# Backend dependencies — only install if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "Installing backend dependencies..."
  npm install --omit=dev
else
  echo "Backend node_modules already exists, skipping install."
fi

# Frontend build — only build if dist/ is missing
if [ ! -d "frontend/dist" ]; then
  echo "Building frontend..."
  cd frontend
  if [ ! -d "node_modules" ]; then
    npm install
  fi
  npm run build
  cd ..
else
  echo "Frontend dist/ already exists, skipping build."
fi

# Generate Prisma Client
npx prisma generate

# Deploy database migrations (production-safe, idempotent)
npx prisma migrate deploy

# Start server
echo "Starting Node.js server..."
node src/index.js
