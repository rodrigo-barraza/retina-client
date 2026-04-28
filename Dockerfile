# ============================================================
# Retina — Multi-stage Docker Build
# ============================================================
# AI chat interface built with Next.js. Uses standalone output
# mode for minimal image size. Secrets are resolved from Vault
# at build time via next.config.mjs.
# ============================================================

# --- Base ---
FROM node:22-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
WORKDIR /app

# Vault credentials — needed at build time for next.config.mjs
# to resolve PRISM_SERVICE_URL, TOOLS_SERVICE_URL, etc.
ARG VAULT_SERVICE_URL=http://192.168.86.2:5599
ARG VAULT_SERVICE_TOKEN
ENV VAULT_SERVICE_URL=$VAULT_SERVICE_URL
ENV VAULT_SERVICE_TOKEN=$VAULT_SERVICE_TOKEN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Production ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3333
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone server and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 -O /dev/null http://127.0.0.1:3333/ || exit 1

CMD ["node", "server.js"]
