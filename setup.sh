#!/usr/bin/env bash
# ==============================================================================
# Aria-AriaNg Server — Pre-Flight Initialization Script (setup.sh)
# Pre-creates required bind mounts, fixes permissions, and initializes DBs
# to ensure 100% error-free container startup on fresh deployments.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 [1/6] Ensuring directory structure..."
mkdir -p certs downloads aria2 rclone script

echo "📁 [2/6] Fixing Docker bind-mount targets..."
# ponytail: Docker creates missing host mount paths as directories if they don't exist.
# Pre-creating them as regular files prevents filebrowser and aria2 container mount crashes.

# Handle filebrowser.db
if [ -d "filebrowser.db" ]; then
    echo "  ⚠️ Found filebrowser.db as directory (Docker mount artifact). Removing..."
    rm -rf "filebrowser.db"
fi
[ ! -f "filebrowser.db" ] && touch "filebrowser.db"

# Handle upload.log
if [ -d "aria2/upload.log" ]; then
    echo "  ⚠️ Found aria2/upload.log as directory. Removing..."
    rm -rf "aria2/upload.log"
fi
[ ! -f "aria2/upload.log" ] && touch "aria2/upload.log"

# Handle cloud-destinations.json
if [ ! -s "cloud-destinations.json" ]; then
    echo '{"destinations":[]}' > "cloud-destinations.json"
fi

echo "🔐 [3/6] Configuring Environment & Credentials..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "  → Copying .env.example to .env..."
        cp .env.example .env
        # Update PUID/PGID to match current user
        sed -i "s/PUID=.*/PUID=$(id -u)/" .env 2>/dev/null || true
        sed -i "s/PGID=.*/PGID=$(id -g)/" .env 2>/dev/null || true
    fi
fi

# Load variables if .env exists
RPC_SECRET="654550"
FB_USER="admin"
FB_PASS="654550"
DOMAIN="nexly.dpdns.org"

if [ -f ".env" ]; then
    # shellcheck disable=SC1091
    RPC_SECRET=$(grep -E '^RPC_SECRET=' .env | cut -d '=' -f2- | tr -d '"' || echo "654550")
    FB_USER=$(grep -E '^FB_USER=' .env | cut -d '=' -f2- | tr -d '"' || echo "admin")
    FB_PASS=$(grep -E '^FB_PASS=' .env | cut -d '=' -f2- | tr -d '"' || echo "654550")
    DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d '=' -f2- | tr -d '"' || echo "nexly.dpdns.org")
fi

# Create .htpasswd if missing
if [ ! -f ".htpasswd" ]; then
    echo "  → Generating default .htpasswd for user '${FB_USER}'..."
    if command -v htpasswd &>/dev/null; then
        htpasswd -cb .htpasswd "$FB_USER" "$FB_PASS"
    else
        # Fallback using openssl if htpasswd is not installed
        PASS_HASH=$(openssl passwd -apr1 "$FB_PASS")
        echo "${FB_USER}:${PASS_HASH}" > .htpasswd
    fi
fi

# Generate self-signed SSL cert if missing
if [ ! -f "certs/aria2.key" ] || [ ! -f "certs/aria2.pem" ]; then
    echo "  → Generating self-signed SSL certificate for '${DOMAIN}'..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout certs/aria2.key -out certs/aria2.pem \
        -subj "/CN=${DOMAIN}" 2>/dev/null
fi

# Disable development compose override on production
if [ -f "docker-compose.override.yml" ]; then
    echo "  → Disabling local dev override (docker-compose.override.yml -> .bak)..."
    mv docker-compose.override.yml docker-compose.override.yml.bak
fi

echo "🗄️ [4/6] Initializing FileBrowser Database..."
# If filebrowser.db is empty (0 bytes), initialize it with 6-char minimum password policy
if [ ! -s "filebrowser.db" ]; then
    echo "  → Setting FileBrowser min password policy to 6 & seeding admin user..."
    docker run --rm \
        -u "$(id -u):$(id -g)" \
        -v "$(pwd)/filebrowser.db:/database/filebrowser.db" \
        filebrowser/filebrowser config init -d /database/filebrowser.db >/dev/null 2>&1 || true

    docker run --rm \
        -u "$(id -u):$(id -g)" \
        -v "$(pwd)/filebrowser.db:/database/filebrowser.db" \
        filebrowser/filebrowser config set --minimumPasswordLength 6 -d /database/filebrowser.db >/dev/null 2>&1 || true

    docker run --rm \
        -u "$(id -u):$(id -g)" \
        -v "$(pwd)/filebrowser.db:/database/filebrowser.db" \
        filebrowser/filebrowser users add "$FB_USER" "$FB_PASS" --perm.admin -d /database/filebrowser.db >/dev/null 2>&1 || true
fi

echo "🛡️ [5/6] Setting directory and file permissions..."
# Ensure current user owns project files
if command -v sudo &>/dev/null && [ "$(id -u)" -ne 0 ]; then
    sudo chown -R "$(id -u):$(id -g)" "$SCRIPT_DIR" 2>/dev/null || true
    sudo chmod -R 775 downloads script aria2 rclone 2>/dev/null || true
else
    chown -R "$(id -u):$(id -g)" "$SCRIPT_DIR" 2>/dev/null || true
    chmod -R 775 downloads script aria2 rclone 2>/dev/null || true
fi

chmod 666 filebrowser.db aria2/upload.log cloud-destinations.json .htpasswd 2>/dev/null || true

echo "✅ [6/6] Pre-flight initialization complete!"
echo "You can now run: docker compose pull && docker compose up -d"
