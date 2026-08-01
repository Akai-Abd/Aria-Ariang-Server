#!/usr/bin/env bash
# Backs up critical config files to OneDrive via Rclone RC API
# Run manually or via cron: 0 3 * * * /config/script/backup.sh
set -euo pipefail

RCLONE_RC_URL="http://rclone:5572"
RCLONE_AUTH="admin:654550"
BACKUP_DIR="/tmp/aria2-backup"
REMOTE_DEST="onedrive:Aria2Backups"
DATE=$(date +%Y%m%d)

log() { echo "$(date) [BACKUP] $1"; }

log "Starting config backup..."

rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Copy config files (skip large/binary/sensitive tokens)
cp /config/aria2.conf "$BACKUP_DIR/" 2>/dev/null || true
cp /config/script.conf "$BACKUP_DIR/" 2>/dev/null || true
cp /config/script/upload.sh "$BACKUP_DIR/" 2>/dev/null || true
cp /config/script/delete.sh "$BACKUP_DIR/" 2>/dev/null || true
cp /config/script/clean.sh "$BACKUP_DIR/" 2>/dev/null || true
cp /config/script/tracker.sh "$BACKUP_DIR/" 2>/dev/null || true

log "Files collected. Uploading to $REMOTE_DEST/$DATE ..."

RESPONSE=$(curl -fsS -u "$RCLONE_AUTH" \
    -H "Content-Type: application/json" \
    -d "{\"srcFs\":\"$BACKUP_DIR\",\"dstFs\":\"$REMOTE_DEST/$DATE\"}" \
    "$RCLONE_RC_URL/sync/copy" || true)

if echo "$RESPONSE" | jq -e '.jobid' >/dev/null 2>&1; then
    log "Backup uploaded successfully to $REMOTE_DEST/$DATE"
else
    log "ERROR: Backup upload failed: $RESPONSE"
fi

rm -rf "$BACKUP_DIR"
log "Backup complete."
