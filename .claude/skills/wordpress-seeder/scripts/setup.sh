#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
skill_root="$(cd "${script_dir}/.." && pwd)"
repo_root="$(cd "${skill_root}/../../.." && pwd)"
default_target="${repo_root}/packages/migrations/playground/wordpress-astro/wordpress"
target_dir="${1:-$default_target}"

if [[ ! -d "$target_dir" ]]; then
  echo "Target directory not found: ${target_dir}" >&2
  exit 1
fi

cd "$target_dir"

if [[ ! -f compose.yaml ]]; then
  echo "Target directory must contain compose.yaml: ${target_dir}" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  if [[ ! -f .env.template ]]; then
    echo "No .env or .env.template found in target: ${target_dir}" >&2
    exit 1
  fi
  echo "No .env found; copying from .env.template"
  cp .env.template .env
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Starting db + wordpress"
docker compose up -d db wordpress

echo "==> Waiting for database"
for i in {1..40}; do
  if docker compose exec -T db healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [[ $i -eq 40 ]]; then
    echo "Database did not become healthy in time" >&2
    exit 1
  fi
done

echo "==> Waiting for wordpress container"
for i in {1..30}; do
  if docker compose exec -T wordpress php -r 'exit(0);' >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo "WordPress container did not become ready in time" >&2
    exit 1
  fi
done

echo "==> Checking if WordPress is already installed"
if docker compose run --rm wp-cli wp core is-installed >/dev/null 2>&1; then
  echo "WordPress is already installed; skipping core install"
else
  echo "==> Installing WordPress core"
  docker compose run --rm wp-cli wp core install \
    --url="${WP_URL}" \
    --title="${WP_TITLE}" \
    --admin_user="${WP_ADMIN_USER}" \
    --admin_password="${WP_ADMIN_PASSWORD}" \
    --admin_email="${WP_ADMIN_EMAIL}" \
    --skip-email
fi

echo "==> Configuring permalinks"
docker compose run --rm wp-cli wp rewrite structure '/%postname%/' --hard

echo "==> Flushing rewrite rules (picks up landing_page CPT)"
docker compose run --rm wp-cli wp rewrite flush --hard

echo
echo "Setup complete. WordPress is running at ${WP_URL}"
echo "Admin: ${WP_ADMIN_USER} / ${WP_ADMIN_PASSWORD}"
echo "Next: bash ${script_dir}/seed.sh ${target_dir}"
