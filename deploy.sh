#!/usr/bin/env bash
# ==============================================================================
# Aria-AriaNg Server — Automated Turnkey Deployment Script (deploy.sh)
#
# Designed for fresh Linux VPS (Oracle Cloud, Hetzner, DigitalOcean, etc.)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Akai-Abd/Aria-Ariang-Server/main/deploy.sh | bash
# ==============================================================================
set -euo pipefail

REPO_URL="https://github.com/Akai-Abd/Aria-Ariang-Server.git"
INSTALL_DIR="${HOME}/Aria-Ariang-Server"

echo "========================================================"
echo "  🚀 Aria-AriaNg Server — Automated Fresh Deployment"
echo "========================================================"

# --- 1. System packages ---
echo "📦 [1/5] Updating packages and installing prerequisites..."
sudo apt update -qq
sudo apt install -y -qq git curl apache2-utils iptables-persistent 2>/dev/null || sudo apt install -y git curl apache2-utils

# --- 2. Firewall configuration ---
echo "🛡️ [2/5] Configuring firewall (Opening ports 80 & 443)..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

# --- 3. Docker installation ---
echo "🐳 [3/5] Checking Docker & Docker Compose..."
if ! command -v docker &>/dev/null; then
    echo "  → Installing Docker Engine..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    echo "  → Docker installed successfully."
else
    echo "  → Docker already installed."
fi

# --- 4. Clone or Update Repository ---
echo "📥 [4/5] Setting up project directory..."
if [ -d "$INSTALL_DIR" ]; then
    echo "  → Directory exists. Pulling latest code..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "  → Cloning repository to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# --- 5. Pre-flight Setup & Launch ---
echo "⚙️ [5/5] Running pre-flight setup & launching containers..."
chmod +x setup.sh check.sh
./setup.sh

echo "🚀 Starting Docker Compose stack..."
if groups "$USER" | grep -q docker; then
    docker compose pull
    docker compose up -d
else
    sg docker -c "docker compose pull && docker compose up -d"
fi

echo ""
echo "========================================================"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "========================================================"
echo "  All services are up and running behind Nginx."
echo "  Run health check anytime: cd ~/Aria-Ariang-Server && ./check.sh"
echo "========================================================"
