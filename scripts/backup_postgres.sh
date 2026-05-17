#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
SERVICE_NAME="${POSTGRES_SERVICE_NAME:-postgres}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB is required}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date +%Y%m%d_%H%M%S)"
output_file="$BACKUP_DIR/${POSTGRES_DB}_${timestamp}.dump"
tmp_file="$output_file.tmp"

if [[ -e "$output_file" ]]; then
  echo "Backup file already exists: $output_file" >&2
  exit 1
fi
trap 'rm -f "$tmp_file"' EXIT

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE_NAME" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$tmp_file"
mv "$tmp_file" "$output_file"

echo "PostgreSQL backup written to $output_file"
