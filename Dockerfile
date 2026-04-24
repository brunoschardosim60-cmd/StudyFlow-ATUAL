# ============================================================
# Build stage - Install dependencies and build application
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies with optimizations
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Build application with optimizations
RUN npm run build && \
    # Remove development dependencies and cache
    rm -rf node_modules .npm && \
    npm ci --omit=dev

# ============================================================
# Production stage - Serve built application
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Install lightweight HTTP server
RUN npm install -g serve@14 && \
    npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check - verify server is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)}).on('error', () => process.exit(1))"

# Start application
CMD ["serve", "-s", "dist", "-l", "3000"]
