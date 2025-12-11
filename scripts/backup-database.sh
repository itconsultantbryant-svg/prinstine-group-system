#!/bin/bash
# Database backup script for Prinstine Management System
BACKUP_DIR="./database/backups"
DB_FILE="./database/pms.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pms_backup_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup
if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$BACKUP_FILE"
  echo "✓ Database backed up to: $BACKUP_FILE"
  
  # Keep only last 10 backups
  ls -t "$BACKUP_DIR"/pms_backup_*.db | tail -n +11 | xargs rm -f 2>/dev/null
  echo "✓ Old backups cleaned (keeping last 10)"
else
  echo "✗ Database file not found: $DB_FILE"
  exit 1
fi
