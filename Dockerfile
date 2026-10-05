FROM node:24-bookworm-slim AS build
ENV ASTRO_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY tools/ensure-native.mjs ./tools/ensure-native.mjs
RUN npm ci --no-audit --no-fund
COPY . .
ARG SITE_URL=http://localhost:3001
ENV SITE_URL=${SITE_URL}
RUN npm run build

# Astro is required at runtime for publishing content from the management UI.
FROM node:24-bookworm-slim
ENV NODE_ENV=production ASTRO_TELEMETRY_DISABLED=1 HOST=0.0.0.0 PORT=3001 DB_PATH=/data/data.db
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data /app/.releases && chown node:node /data /app/.releases
USER node
WORKDIR /app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "tools/serve.mjs"]
