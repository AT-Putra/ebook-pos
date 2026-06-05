FROM node:20-alpine AS base
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

# Production runner — uses Next.js standalone output
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma CLI + schema + seed needed for migrate deploy and db seed at deploy time.
# node_modules/.bin/prisma is a symlink; Docker dereferences it, breaking __dirname.
# Invoke node_modules/prisma/build/index.js directly so __dirname stays correct
# and the WASM files in prisma/build/ are found.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
CMD ["node", "server.js"]
