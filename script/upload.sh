#!/usr/bin/env bash
set -euo pipefail

#################################
# CONFIG
#################################
RCLONE_RC_URL="http://rclone:5572"
RCLONE_AUTH="admin:654550"
CLOUD_DEST_FILE="/config/cloud-destinations.json"
# Fallback if cloud-destinations.json doesn't exist
FALLBACK_DEST="onedrive:Aria2Downloads"
LOG_FILE="/config/upload.log"
LOCK_FILE="/config/upload.lock"
LOG_MAX_BYTES=1048576  # 1MB — rotate when exceeded

STABILITY_WAIT=15
POLL_INTERVAL=2
MAX_POLL_TIME=14400  # 4 hours

# Backoff tuning (OneDrive + Oracle Free Tier)
MAX_START_RETRIES=5
BASE_DELAY=5
MAX_DELAY=120

# Full upload retry (for timeouts/failures)
MAX_UPLOAD_RETRIES=3

#################################
# LOG HELPER (strips ANSI codes)
#################################
log() {
    local msg="$(date) $1"
    echo "$msg" | sed 's/\x1B\[[0-9;]*m//g' >> "$LOG_FILE"
}

#################################
# LOG ROTATION
#################################
rotate_log() {
    if [ -f "$LOG_FILE" ]; then
        local size
        size=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
        if [ "$size" -gt "$LOG_MAX_BYTES" ]; then
            [ -f "${LOG_FILE}.2" ] && mv "${LOG_FILE}.2" "${LOG_FILE}.3"
            [ -f "${LOG_FILE}.1" ] && mv "${LOG_FILE}.1" "${LOG_FILE}.2"
            mv "$LOG_FILE" "${LOG_FILE}.1"
            touch "$LOG_FILE"
        fi
    fi
}

rotate_log

#################################
# LOCK (wait for previous upload to finish)
#################################
exec 9>"$LOCK_FILE"
MAX_WAIT_TIME=7200
WAIT_INTERVAL=5
ELAPSED=0

log "[INFO] Waiting for upload lock..."

while ! flock -n 9; do
    if [ $ELAPSED -ge $MAX_WAIT_TIME ]; then
        log "[ERROR] Failed to acquire lock after ${MAX_WAIT_TIME}s"
        exit 1
    fi
    sleep $WAIT_INTERVAL
    ((ELAPSED += WAIT_INTERVAL))
done

log "[INFO] Lock acquired after ${ELAPSED}s, starting upload..."

#################################
# INPUT
#################################
DOWNLOAD_PATH="${3%/}"
RELATIVE_PATH="${DOWNLOAD_PATH#/downloads/}"
TOP_NAME="$(cut -d/ -f1 <<< "$RELATIVE_PATH")"
FINAL_TARGET="/downloads/$TOP_NAME"

#################################
# VALIDATION
#################################
if [ -z "$TOP_NAME" ] || [ "$TOP_NAME" = "." ] || [ "$TOP_NAME" = ".." ]; then
    log "[INFO] Skipping upload - empty or invalid folder name"
    exit 0
fi

if [ ! -e "$FINAL_TARGET" ]; then
    log "[INFO] Skipping upload - target does not exist: $FINAL_TARGET"
    exit 0
fi

#################################
# TORRENT CHECK (prevent premature upload)
#################################
ARIA2_CONTROL_COUNT=0

if [ -d "$FINAL_TARGET" ]; then
    ARIA2_CONTROL_COUNT=$(find "$FINAL_TARGET" -name "*.aria2" 2>/dev/null | wc -l)
fi

if [ -f "${FINAL_TARGET}.aria2" ]; then
    ((ARIA2_CONTROL_COUNT++))
fi

if [ "$ARIA2_CONTROL_COUNT" -gt 0 ]; then
    log "[INFO] Torrent/batch download in progress ($ARIA2_CONTROL_COUNT control files remaining). Skipping upload for: $TOP_NAME"
    exit 0
fi

#################################
# LOAD CLOUD DESTINATIONS
#################################
get_destinations() {
    if [ -f "$CLOUD_DEST_FILE" ] && command -v jq >/dev/null 2>&1; then
        # Read enabled destinations from JSON
        jq -r '.destinations[] | select(.enabled == true) | .remote + ":" + .path' "$CLOUD_DEST_FILE" 2>/dev/null
    else
        echo "$FALLBACK_DEST"
    fi
}

#################################
# UPLOAD FUNCTION (single destination)
#################################
do_upload() {
    local REMOTE_DEST="$1"
    local ATTEMPT=1
    local DELAY=$BASE_DELAY
    local JOB_ID=""

    # Prepare payload
    local OPERATION JSON_PAYLOAD
    if [ -d "$FINAL_TARGET" ]; then
        OPERATION="sync/copy"
        JSON_PAYLOAD=$(jq -n \
            --arg srcFs "$FINAL_TARGET" \
            --arg dstFs "$REMOTE_DEST/$TOP_NAME" \
            --argjson _async true \
            '{srcFs:$srcFs,dstFs:$dstFs,_async:$_async}')
    else
        OPERATION="operations/copyfile"
        JSON_PAYLOAD=$(jq -n \
            --arg srcFs "/downloads" \
            --arg srcRemote "$TOP_NAME" \
            --arg dstFs "$REMOTE_DEST" \
            --arg dstRemote "$TOP_NAME" \
            --argjson _async true \
            '{srcFs:$srcFs,srcRemote:$srcRemote,dstFs:$dstFs,dstRemote:$dstRemote,_async:$_async}')
    fi

    # Start job with backoff
    while (( ATTEMPT <= MAX_START_RETRIES )); do
        RESPONSE=$(curl -fsS -u "$RCLONE_AUTH" \
            -H "Content-Type: application/json" \
            -d "$JSON_PAYLOAD" \
            "$RCLONE_RC_URL/$OPERATION" || true)

        JOB_ID=$(jq -r '.jobid // empty' <<< "$RESPONSE" 2>/dev/null || true)

        if [ -n "$JOB_ID" ]; then
            log "[INFO] Rclone job started for $REMOTE_DEST (attempt $ATTEMPT): $JOB_ID"
            break
        fi

        log "[WARN] Failed to start upload to $REMOTE_DEST (attempt $ATTEMPT). Retrying in ${DELAY}s..."
        sleep "$DELAY"
        DELAY=$(( DELAY * 2 ))
        (( DELAY > MAX_DELAY )) && DELAY=$MAX_DELAY
        (( ATTEMPT++ ))
    done

    if [ -z "$JOB_ID" ]; then
        log "[ERROR] Could not start upload to $REMOTE_DEST after ${MAX_START_RETRIES} attempts"
        return 1
    fi

    # Poll job status
    local START_TIME
    START_TIME=$(date +%s)

    while true; do
        STATUS=$(curl -fsS -u "$RCLONE_AUTH" \
            -H "Content-Type: application/json" \
            -d "{\"jobid\": $JOB_ID}" \
            "$RCLONE_RC_URL/job/status" || true)

        FINISHED=$(jq -r '.finished // false' <<< "$STATUS" 2>/dev/null || echo false)
        SUCCESS=$(jq -r '.success // false' <<< "$STATUS" 2>/dev/null || echo false)
        ERROR_MSG=$(jq -r '.error // empty' <<< "$STATUS" 2>/dev/null || true)

        if [ "$FINISHED" = "true" ]; then
            if [ "$SUCCESS" = "true" ]; then
                return 0
            else
                log "[ERROR] Upload to $REMOTE_DEST failed: $ERROR_MSG"
                return 1
            fi
        fi

        NOW=$(date +%s)
        if (( NOW - START_TIME > MAX_POLL_TIME )); then
            log "[ERROR] Upload to $REMOTE_DEST timed out after ${MAX_POLL_TIME}s"
            return 1
        fi

        sleep "$POLL_INTERVAL"
    done
}

#################################
# MAIN: Upload to all enabled destinations
#################################
log "[INFO] UPLOAD STARTED: $TOP_NAME"
log "[INFO] Waiting ${STABILITY_WAIT}s for file stability..."
sleep "$STABILITY_WAIT"

DESTINATIONS=$(get_destinations)
DEST_COUNT=$(echo "$DESTINATIONS" | wc -l)
log "[INFO] Uploading to $DEST_COUNT destination(s)"

ALL_SUCCESS=true
FIRST_DEST=true

while IFS= read -r DEST; do
    [ -z "$DEST" ] && continue
    log "[INFO] Uploading to: $DEST"

    UPLOAD_ATTEMPT=1
    DEST_SUCCESS=false
    while (( UPLOAD_ATTEMPT <= MAX_UPLOAD_RETRIES )); do
        if do_upload "$DEST"; then
            log "[SUCCESS] Upload to $DEST finished: $TOP_NAME"
            DEST_SUCCESS=true
            break
        fi

        if (( UPLOAD_ATTEMPT < MAX_UPLOAD_RETRIES )); then
            BACKOFF=$(( UPLOAD_ATTEMPT * 60 ))
            log "[WARN] Upload attempt $UPLOAD_ATTEMPT to $DEST failed. Retrying in ${BACKOFF}s..."
            sleep "$BACKOFF"
        fi
        (( UPLOAD_ATTEMPT++ ))
    done

    if [ "$DEST_SUCCESS" = false ]; then
        log "[ERROR] Upload to $DEST FAILED after $MAX_UPLOAD_RETRIES attempts"
        ALL_SUCCESS=false
    fi
done <<< "$DESTINATIONS"

# ponytail: uses copy (not move) when multi-dest, then deletes locally after all succeed.
# If single dest, the copy+delete is equivalent to move. Upgrade path: per-dest move/copy config.
if [ "$ALL_SUCCESS" = true ]; then
    log "[SUCCESS] All uploads complete for: $TOP_NAME — cleaning up local files"
    rm -rf "$FINAL_TARGET"
    find "/downloads/$TOP_NAME" -name "*.aria2" -delete 2>/dev/null || true
    exit 0
else
    log "[ERROR] Some destinations failed for: $TOP_NAME — local files kept"
    exit 1
fi
