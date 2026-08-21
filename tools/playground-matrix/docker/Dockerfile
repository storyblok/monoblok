# Consumer image: a clean machine with one Node version and one package
# manager, and no knowledge of this repo's pnpm workspace.
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim

# `git` and a toolchain are here because some transitive dependencies still
# build from source on install; without them a failure would look like a
# packaging bug when it is not.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_ENABLE_STRICT=0 \
    CI=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    ASTRO_TELEMETRY_DISABLED=1 \
    NUXT_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1

COPY entrypoint.sh /opt/matrix/entrypoint.sh
COPY static-server.mjs /opt/matrix/static-server.mjs
COPY verify-install.mjs /opt/matrix/verify-install.mjs
COPY measure.mjs /opt/matrix/measure.mjs
RUN chmod +x /opt/matrix/entrypoint.sh

WORKDIR /work
ENTRYPOINT ["/opt/matrix/entrypoint.sh"]
