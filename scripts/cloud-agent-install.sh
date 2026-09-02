#!/usr/bin/env bash
#
# Cloud Agent install phase: durable, idempotent repository bootstrap.
# Runs after the source tree is checked out. Installs Node dependencies for
# every workspace and generates the Prisma client (via the root postinstall).
# Long-running services (Postgres, dev servers) are handled in start / terminals.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Ensure PostgreSQL is available (the default Cloud Agent base image does not
# ship it). Skipped when already present, so this stays idempotent.
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "[install] PostgreSQL not found; installing via apt..."
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
else
  echo "[install] PostgreSQL already installed."
fi

echo "[install] Installing workspace dependencies with npm..."
npm install

echo "[install] Dependencies installed and Prisma client generated."
