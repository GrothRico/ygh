# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
# The package includes platform prebuilds; avoid implicit node-gyp/lifecycle execution.
RUN npm ci --ignore-scripts

FROM dependencies AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24.22.1-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/collection.sqlite

RUN mkdir -p /data \
  && chown node:node /data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=dependencies --chown=node:node /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=node:node /app/src/server/db/migrations ./src/server/db/migrations
COPY --chown=node:node scripts/deploy-database.ts ./scripts/deploy-database.ts
COPY --chown=node:node scripts/backup-snapshot.ts ./scripts/backup-snapshot.ts

USER node
EXPOSE 3000
CMD ["node", "server.js"]
