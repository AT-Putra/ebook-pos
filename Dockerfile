FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies only (cached layer)
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Build the Next.js app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production runner — uses Next.js standalone output for the server,
# full node_modules from builder for Prisma CLI (migrate deploy, db seed).
# Copying the whole node_modules directory preserves symlinks inside it,
# so node_modules/.bin/prisma stays a proper symlink and __dirname resolves
# to node_modules/prisma/build/ where the WASM files live.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "server.js"]
