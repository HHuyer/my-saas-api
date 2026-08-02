FROM node:20-alpine

WORKDIR /app

# Copy package files first (leverage layer caching)
COPY package*.json ./

# Install dependencies including devDependencies (required for @prisma/client generate)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client (SQLite, no migration needed at build time)
RUN npx prisma generate

# Expose the API port
EXPOSE 3000

# Start the server (CommonJS, runs directly from src)
CMD ["node", "src/index.js"]
