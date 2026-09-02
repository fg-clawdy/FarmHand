#!/usr/bin/env bash
#
# Cloud Agent install phase: durable, idempotent repository bootstrap.
# Runs after the source tree is checked out. Installs Node dependencies for
# every workspace and generates the Prisma client (via the root postinstall).
# Long-running services (Postgres, dev servers) are handled in start / terminals.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[install] Installing workspace dependencies with npm..."
npm install

echo "[install] Dependencies installed and Prisma client generated."
