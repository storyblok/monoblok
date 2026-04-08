# Stage 1: Builder
FROM node:24-alpine AS builder
ENV CI=true
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# Skip Cypress binary download — it's a root dependency but not needed here
ENV CYPRESS_INSTALL_BINARY=0

WORKDIR /app

# 1. Fetch all registry packages using only the lockfile + workspace manifest.
#    pnpm skips link: protocols automatically; file: entries need the workspace
#    manifest present so pnpm can resolve the directory paths.
#    This layer is only invalidated when these two files change.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch

# 2. Copy the full monorepo
COPY . .

# 3. Install offline — all registry packages are already in the pnpm store.
#    Strip use-node-version from .npmrc first: Alpine is musl-based and Node.js
#    has no musl prebuilts, so pnpm's node management would fail.
RUN sed -i '/use-node-version/d' .npmrc
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline

# 4. Disable publint/attw — pnpm pack fails with workspace: protocol refs
RUN sed -i 's/publint: true/publint: false/g; s/attw: true/attw: false/g' packages/*/tsdown.config.ts 2>/dev/null || true

# 5. Build the app and all its workspace dependencies via Nx.
#    The cache mount speeds up repeated local builds.
RUN --mount=type=cache,id=nx,target=/app/.nx/cache \
    pnpm exec nx build @storyblok/playground-schema-qwik

# 6. Create a self-contained production deployment (resolves pnpm symlinks).
RUN pnpm --filter=@storyblok/playground-schema-qwik deploy --prod /app/deploy

# Stage 2: Runtime
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

USER node

COPY --from=builder /app/deploy/node_modules/ ./node_modules/
COPY --from=builder /app/packages/schema/playground/qwik/dist/ ./dist/
COPY --from=builder /app/packages/schema/playground/qwik/server/ ./server/

EXPOSE 3000
CMD ["node", "server/entry.node.js"]
