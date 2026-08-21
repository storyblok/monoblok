#!/usr/bin/env bash
#
# One matrix job: install a staged playground from tarballs with one package
# manager, build it, assert the install looks like a real consumer's, and serve
# it so the host can drive a browser against it.
#
# Phase markers go to stdout. The orchestrator uses them to attribute a failure
# to install / build / verify / serve rather than reporting "the container
# exited".
set -uo pipefail

PM="${MATRIX_PM:?MATRIX_PM is required}"
PM_VERSION="${MATRIX_PM_VERSION:?MATRIX_PM_VERSION is required}"
LINKER="${MATRIX_LINKER:-default}"
APP_SUBDIR="${MATRIX_APP_DIR:-.}"
BUILD_SCRIPT="${MATRIX_BUILD_SCRIPT:-build}"
SERVE_TYPE="${MATRIX_SERVE_TYPE:-none}"
PORT="${MATRIX_PORT:-3000}"

phase() { printf '\n__MATRIX_PHASE__%s__\n' "$1"; }
fail()  { printf '\n__MATRIX_FAIL__%s__\n' "$1"; exit 1; }

phase "setup"
cp -a /stage/. /work/
APP_DIR="/work/${APP_SUBDIR}"
cd "$APP_DIR" || fail "setup"
echo "app dir: $APP_DIR"

case "$PM" in
  npm)
    npm install -g "npm@${PM_VERSION}" >/dev/null 2>&1 || fail "setup"
    ;;
  pnpm)
    # Installed from npm rather than through corepack: corepack pins to the
    # `packageManager` field, and the staged manifest deliberately has none.
    npm install -g "pnpm@${PM_VERSION}" >/dev/null 2>&1 || fail "setup"
    ;;
  yarn)
    # Yarn Berry only ships through corepack; the `yarn` package on npm is
    # still the 1.x line.
    corepack enable >/dev/null 2>&1
    corepack prepare "yarn@${PM_VERSION}" --activate >/dev/null 2>&1 || fail "setup"
    ;;
  *)
    fail "setup"
    ;;
esac

echo "package manager: $($PM --version) (${PM}@${PM_VERSION}, linker=${LINKER})"
echo "node: $(node --version)"

phase "install"
case "$PM" in
  npm)
    npm install --no-audit --no-fund --loglevel=warn || fail "install"
    ;;
  pnpm)
    # `--no-frozen-lockfile` because the staged app has no lockfile at all:
    # resolving from scratch is the point. `dangerouslyAllowAllBuilds` because
    # pnpm 11 fails the install outright on unapproved build scripts, and a
    # consumer would approve esbuild rather than abandon the install.
    pnpm install --no-frozen-lockfile \
      --config.confirmModulesPurge=false \
      --config.dangerouslyAllowAllBuilds=true || fail "install"
    ;;
  yarn)
    if [ "$LINKER" = "pnp" ]; then
      yarn config set nodeLinker pnp
      yarn config set pnpFallbackMode none
    else
      yarn config set nodeLinker node-modules
    fi
    yarn config set enableGlobalCache true
    yarn config set enableTelemetry false
    yarn install --no-immutable || fail "install"
    ;;
esac

# A playground whose sources reach into a sibling directory (the Astro ones
# share `../shared`) installs in its own subdirectory, so nothing above it can
# resolve a dependency. One symlink at the staged root fixes resolution for the
# siblings without a second install.
if [ "$APP_SUBDIR" != "." ] && [ ! -e /work/node_modules ]; then
  ln -s "$APP_DIR/node_modules" /work/node_modules
fi

phase "build"
BUILD_STARTED=$(date +%s%3N)
if ! "$PM" run "$BUILD_SCRIPT"; then
  fail "build"
fi
printf '\n__MATRIX_BUILD_MS__%s__\n' "$(( $(date +%s%3N) - BUILD_STARTED ))"

phase "measure"
cp /opt/matrix/measure.mjs "$APP_DIR/.matrix-measure.mjs"
MEASURE_CMD=(node ./.matrix-measure.mjs)
if [ "$PM" = "yarn" ] && [ "$LINKER" = "pnp" ]; then
  MEASURE_CMD=(yarn node ./.matrix-measure.mjs)
fi
"${MEASURE_CMD[@]}" || echo "measurement failed; continuing"

phase "verify"
# The verifier has to live inside the app, not in /opt: a bare `import("pkg")`
# resolves relative to the importing file, so running it from outside the app
# would report every package as missing.
cp /opt/matrix/verify-install.mjs "$APP_DIR/.matrix-verify.mjs"

VERIFY_CMD=(node ./.matrix-verify.mjs)
# Under PnP there is no node_modules, so the verifier has to run inside Yarn's
# resolver or every `require` in it would fail for the wrong reason.
if [ "$PM" = "yarn" ] && [ "$LINKER" = "pnp" ]; then
  VERIFY_CMD=(yarn node ./.matrix-verify.mjs)
fi

if ! "${VERIFY_CMD[@]}"; then
  VERIFY_FAILED=1
else
  VERIFY_FAILED=0
fi

if [ "$SERVE_TYPE" = "none" ]; then
  [ "$VERIFY_FAILED" = "1" ] && fail "verify"
  phase "done"
  exit 0
fi

[ "$VERIFY_FAILED" = "1" ] && fail "verify"

phase "serve"
export NODE_ENV=production
export PORT="$PORT"
export HOST=0.0.0.0
export HOSTNAME=0.0.0.0
export MATRIX_PORT="$PORT"

case "$SERVE_TYPE" in
  static)
    exec node /opt/matrix/static-server.mjs "${MATRIX_SERVE_DIR:?MATRIX_SERVE_DIR is required}"
    ;;
  node)
    exec node "${MATRIX_SERVE_ENTRY:?MATRIX_SERVE_ENTRY is required}"
    ;;
  script)
    SCRIPT="${MATRIX_SERVE_SCRIPT:?MATRIX_SERVE_SCRIPT is required}"
    # Only npm needs `--` to separate its own flags from the script's. pnpm and
    # yarn forward it verbatim, and the script then sees a literal `--`.
    if [ "$PM" = "npm" ]; then
      exec npm run "$SCRIPT" -- --port "$PORT" --hostname 0.0.0.0
    fi
    exec "$PM" run "$SCRIPT" --port "$PORT" --hostname 0.0.0.0
    ;;
  *)
    fail "serve"
    ;;
esac
