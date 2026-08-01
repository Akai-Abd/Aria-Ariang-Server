#!/usr/bin/env bash
# Advanced Config Check Script
# Fixed: Absolute paths for Oracle Cloud deployment

# Project directory
PROJECT_DIR="$HOME/aria2-config"

# --- Colors & Styles ---
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Neon Palette
GREEN='\033[38;5;46m'
BLUE='\033[38;5;39m'
CYAN='\033[38;5;51m'
MAGENTA='\033[38;5;201m'
YELLOW='\033[38;5;226m'
RED='\033[38;5;196m'
ORANGE='\033[38;5;208m'
WHITE='\033[38;5;255m'
GRAY='\033[38;5;240m'

# Icons
ICON_TRACKER="📡"
ICON_DISK="💾"
ICON_DOCKER="🐳"
ICON_CLOUD="☁️"
ICON_ONEDRIVE="💎"
ICON_LOG="📜"
ICON_CHECK="✅"
ICON_X="❌"
ICON_WARN="⚠️"
ICON_SPEED="🚀"
ICON_FILE="📁"

# Header
clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BLUE}║          ${BOLD}${WHITE}SYSTEM HEALTH DASHBOARD${RESET}${BLUE}  |  ${CYAN}$(date '+%H:%M:%S %d-%b') ${BLUE}       ║${RESET}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${RESET}"

# --- 1. TRACKERS ---
echo -e "\n${MAGENTA}${ICON_TRACKER}  BITTORRENT TRACKERS${RESET}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────────${RESET}"
if grep -q "^bt-tracker=" "$PROJECT_DIR/aria2/aria2.conf" 2>/dev/null; then
    COUNT=$(grep "bt-tracker=" "$PROJECT_DIR/aria2/aria2.conf" | awk -F= '{print $2}' | awk -F, '{print NF}')
    echo -e "   ${GREEN}${ICON_CHECK}  Status   :${RESET} ${BOLD}Active${RESET}"
    echo -e "   ${CYAN}ℹ️   Count    :${RESET} ${WHITE}${COUNT} Trackers Loaded${RESET}"
else
    echo -e "   ${RED}${ICON_X}  Status   : Missing Trackers${RESET}"
fi

# --- 2. DISK USAGE ---
echo -e "\n${YELLOW}${ICON_DISK}  DISK STORAGE${RESET}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────────${RESET}"
# Parse df output
DF_OUT=$(df -h / | tail -n 1)
SIZE=$(echo "$DF_OUT" | awk '{print $2}')
USED=$(echo "$DF_OUT" | awk '{print $3}')
AVAIL=$(echo "$DF_OUT" | awk '{print $4}')
PCT=$(echo "$DF_OUT" | awk '{print $5}')
echo -e "   ${BOLD}Root (/) ${RESET}"
echo -e "   Used: ${RED}$USED${RESET} / ${GREEN}$SIZE${RESET}  (Free: ${BLUE}$AVAIL${RESET})"
# Draw bar
PERCENT=${PCT%\%}
BAR_LEN=40
FILLED=$(($PERCENT * $BAR_LEN / 100))
EMPTY=$(($BAR_LEN - $FILLED))
printf "   ["
printf "%0.s${GREEN}█${RESET}" $(seq 1 $FILLED)
printf "%0.s${GRAY}░${RESET}" $(seq 1 $EMPTY)
printf "] ${BOLD}%s${RESET}\n" "$PCT"

# --- 3. DOCKER SERVICES ---
echo -e "\n${BLUE}${ICON_DOCKER}  CONTAINER STATUS${RESET}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────────${RESET}"
printf "   ${BOLD}%-15s %-30s %-10s${RESET}\n" "SERVICE" "STATUS" "UPTIME"
docker ps --format "{{.Names}}|{{.Status}}" | while IFS='|' read -r NAME STATUS; do
    if [[ "$STATUS" == *"Up"* ]]; then
        STATE="${GREEN}● Online${RESET}"
        UPTIME=$(echo "$STATUS" | sed 's/Up //;s/ (.*)//')
    else
        STATE="${RED}● Offline${RESET}"
        UPTIME="-"
    fi
    printf "   %-15s %-40b %-10s\n" "$NAME" "$STATE" "$UPTIME"
done

# --- 4. CLOUD TRANSFER ---
echo -e "\n${CYAN}${ICON_CLOUD}  TRANSFER QUEUE${RESET}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────────${RESET}"
STATS=$(docker exec rclone rclone rc core/stats --rc-user="admin" --rc-pass="654550" 2>/dev/null)
if [ -z "$STATS" ]; then
    echo -e "   ${RED}Unable to fetch stats (Rclone API unreachable)${RESET}"
else
    TRANSFERS=$(echo "$STATS" | jq '.transferring | length')
    SPEED_BPS=$(echo "$STATS" | jq -r '.speed')
    
    if [[ "$SPEED_BPS" != "null" ]] && [[ -n "$SPEED_BPS" ]]; then
       SPEED_MBPS=$(echo "scale=2; $SPEED_BPS / 1048576" | bc)
    else
       SPEED_MBPS="0.00"
    fi

    LOCAL_FILES=$(find "$PROJECT_DIR/downloads" -mindepth 1 -maxdepth 1 -not -path '*/.*' 2>/dev/null | wc -l)

    echo -e "   ${ORANGE}${ICON_FILE}  Local Files  :${RESET} ${WHITE}$LOCAL_FILES items${RESET} (Waiting on SSD)"
    echo -e "   ${CYAN}${ICON_SPEED}  Upload Speed :${RESET} ${BOLD}${GREEN}$SPEED_MBPS MB/s${RESET}"
    
    if [ "$TRANSFERS" -gt 0 ]; then
        echo -e "   ${MAGENTA}🔄  Active Jobs  :${RESET} ${BOLD}$TRANSFERS uploading now${RESET}"
    else
        echo -e "   ${GRAY}💤  Active Jobs  : Idle${RESET}"
    fi
fi

# --- 5. ONEDRIVE ---
echo -e "\n${WHITE}${ICON_ONEDRIVE}  ONEDRIVE CAPACITY${RESET}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────────${RESET}"
# Retry loop for stability (3 attempts)
ERR_LOG=$(mktemp)
for i in {1..3}; do
    ABOUT=$(docker exec rclone rclone about onedrive: --config="/config/rclone/rclone.conf" --json 2>"$ERR_LOG")
    if [ -n "$ABOUT" ]; then break; fi
    sleep 1
done
if [ -n "$ABOUT" ]; then
    rm -f "$ERR_LOG"
    O_TOTAL=$(echo "$ABOUT" | jq -r '.total | if . then (. / 1099511627776 * 100 | round / 100) | tostring + " TiB" else "Unknown" end')
    O_USED=$(echo "$ABOUT" | jq -r '.used | if . then (. / 1099511627776 * 100 | round / 100) | tostring + " TiB" else "Unknown" end')
    O_FREE=$(echo "$ABOUT" | jq -r '.free | if . then (. / 1099511627776 * 100 | round / 100) | tostring + " TiB" else "Unknown" end')
    
    echo -e "   ${GREEN}Total : $O_TOTAL${RESET}   |   ${RED}Used : $O_USED${RESET}   |   ${BLUE}Free : $O_FREE${RESET}"
else
    echo -e "   ${RED}${ICON_WARN}  Connection Failed${RESET}"
    echo "--- Container /config/rclone ---" >> "$ERR_LOG"
    docker exec rclone ls -la /config/rclone >> "$ERR_LOG" 2>&1
    echo "--- Host rclone.conf ---" >> "$ERR_LOG"
    ls -l "$PROJECT_DIR/rclone/rclone.conf" >> "$ERR_LOG" 2>&1
    echo -e "   ${GRAY}Error Log: $(cat "$ERR_LOG")${RESET}"
    rm -f "$ERR_LOG"
fi

# --- 6. LOGS ---
echo -e "\n${GRAY}${ICON_LOG}  RECENT ACTIVITY${RESET}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────────${RESET}"
if [ -f "$PROJECT_DIR/aria2/upload.log" ]; then
    tail -n 3 "$PROJECT_DIR/aria2/upload.log" 2>/dev/null | while read -r line; do
        line=${line//\[SUCCESS\]/${GREEN}${ICON_CHECK} [SUCCESS]${RESET}}
        line=${line//\[INFO\]/${BLUE}ℹ️  [INFO]${RESET}}
        line=${line//\[ERROR\]/${RED}${ICON_X} [ERROR]${RESET}}
        line=${line//HANDED TO DASHBOARD/${MAGENTA}HANDOFF${RESET}}
        echo -e "$line"
    done
else
    echo -e "   ${GRAY}No recent activity${RESET}"
fi

echo -e "\n"
