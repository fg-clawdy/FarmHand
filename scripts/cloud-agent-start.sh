#!/usr/bin/env bash
#
# Cloud Agent start phase: per-boot runtime initialization.
# Brings up PostgreSQL, ensures the application role/database exist, and applies
# database migrations. All steps are idempotent so the script is safe to re-run.
# The API and Vite dev servers run as long-lived processes in `terminals`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_USER="${POSTGRES_USER:-farmhand}"
DB_PASS="${POSTGRES_PASSWORD:-farmhand}"
DB_NAME="${POSTGRES_DB:-farmhand}"
export DATABASE_URL="${DATABASE_URL:-postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}}"

# Detect the installed PostgreSQL cluster version (e.g. "16 main").
CLUSTER_LINE="$(pg_lsclusters -h 2>/dev/null | head -n1 || true)"
PG_VER="$(echo "$CLUSTER_LINE" | awk '{print $1}')"
PG_CLUSTER="$(echo "$CLUSTER_LINE" | awk '{print $2}')"
PG_VER="${PG_VER:-16}"
PG_CLUSTER="${PG_CLUSTER:-main}"

echo "[start] Starting PostgreSQL cluster ${PG_VER}/${PG_CLUSTER}..."
sudo pg_ctlcluster "$PG_VER" "$PG_CLUSTER" start 2>/dev/null || true

echo "[start] Waiting for PostgreSQL to accept connections..."
for _ in $(seq 1 30); do
  if pg_isready -h localhost -p 5432 -q; then break; fi
  sleep 1
done
pg_isready -h localhost -p 5432 -q || { echo "[start] PostgreSQL did not become ready"; exit 1; }

echo "[start] Ensuring role '${DB_USER}' and database '${DB_NAME}' exist..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

echo "[start] Applying Prisma migrations..."
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

echo "[start] Database ready at ${DATABASE_URL}"
