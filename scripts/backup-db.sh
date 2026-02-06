#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="$ROOT_DIR/db/dev.db"
BACKUP_DIR="$ROOT_DIR/backups"

if [[ ! -f "$DB_FILE" ]]; then
  echo "Database file not found: $DB_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/dev.db.$TIMESTAMP.bak"

cp "$DB_FILE" "$BACKUP_FILE"

echo "Backup created at $BACKUP_FILE"
