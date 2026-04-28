#!/bin/bash
# ============================================================
# Retina — Build & Deploy to Synology NAS
#
# Thin wrapper — all logic lives in ../deploy/lib.sh
# Hook: injects VAULT_SERVICE_URL/VAULT_SERVICE_TOKEN as build args for
#       Next.js secret resolution at build time.
# Extra: --network=host for build, 30 tail lines
#
# Usage:
#   npm run deploy              # full deploy
#   npm run deploy -- --dry-run # validate without deploying
#   npm run deploy -- --skip-pull
#   npm run deploy -- --no-cache
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="retina-client"
DISPLAY_NAME="👁️ Retina"
BUILD_EXTRA_FLAGS="--network=host"
BUILD_TAIL_LINES=30

# ── Inject Vault credentials as Docker build args ─────────────
PRE_BUILD() {
  if [ -f "${SCRIPT_DIR}/.env.deploy" ]; then
    set -a; source "${SCRIPT_DIR}/.env.deploy"; set +a
    info "Loaded .env.deploy"
  fi
  if [ -n "${VAULT_SERVICE_URL:-}" ]; then
    BUILD_ARGS="--build-arg VAULT_SERVICE_URL=${VAULT_SERVICE_URL}"
    info "Vault URL: ${VAULT_SERVICE_URL}"
  fi
  if [ -n "${VAULT_SERVICE_TOKEN:-}" ]; then
    BUILD_ARGS="${BUILD_ARGS} --build-arg VAULT_SERVICE_TOKEN=${VAULT_SERVICE_TOKEN}"
    info "Vault token: ****${VAULT_SERVICE_TOKEN: -8}"
  fi
}

source "${SCRIPT_DIR}/../deploy/lib.sh"
