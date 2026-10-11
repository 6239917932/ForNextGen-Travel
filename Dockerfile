# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma's native engine requires OpenSSL at build and runtime. Installing it
# in the shared base keeps migration and application behavior deterministic on
# slim images instead of relying on Prisma's legacy fallback.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
# Compile the SQLite preview adapter explicitly: dependency lifecycle scripts
# remain disabled, and compiler tools stay outside the final runner stage.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci --ignore-scripts \
  && npm rebuild better-sqlite3 --build-from-source

FROM dependencies AS builder
ARG DATABASE_URL=file:/tmp/mandyal-build.db
ENV DATABASE_URL=${DATABASE_URL}
ENV NODE_ENV=production
ENV NEXT_OUTPUT_MODE=standalone
COPY . .
RUN npm run db:generate
RUN npm run build -- --webpack

# This larger target is intentionally separate from the web runtime. It is used
# only for the one-shot, pre-start migration task in the portable preview.
FROM dependencies AS operations
ENV NODE_ENV=production
COPY . .
RUN npm run db:generate \
  && mkdir -p /data \
  && chown -R node:node /data
USER node
CMD ["npm", "run", "db:deploy"]

# Scheduled jobs reuse the same generated clients and source revision as the
# migration task. The default command performs one bounded delivery pass; a
# production scheduler owns cadence, retry, concurrency, and dead-letter policy.
FROM operations AS worker
CMD ["npm", "run", "worker:notifications"]

FROM base AS runner
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data \
  && chown -R nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Keep the release tooling in the web image so portable hosts can run the
# governed migration-and-start launcher before accepting traffic. The
# standalone Next.js output intentionally omits these operational files.
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.postgresql.config.ts ./prisma.postgresql.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "scripts/start-production.mjs"]
