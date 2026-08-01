<div align="center">

# 🚀 Aria-AriaNg Server

### **Self-Hosted Download Station with Multi-Cloud Sync**

[![MIT License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](docker-compose.yml)
[![Aria2](https://img.shields.io/badge/Aria2-Pro-FF6600?style=for-the-badge&logo=aria2&logoColor=white)](https://aria2.github.io/)
[![Nginx](https://img.shields.io/badge/Nginx-Reverse%20Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white)](aria2-nginx.conf)
[![Oracle Cloud](https://img.shields.io/badge/Oracle-Cloud%20VPS-F80000?style=for-the-badge&logo=oracle&logoColor=white)](#-deploy-on-oracle-cloud-vps)

<br/>

> **⚡ A production-ready, fully automated download server** that fetches files via HTTP/FTP/BitTorrent,
> syncs them to 70+ cloud providers, and gives you a beautiful real-time dashboard — all behind
> SSL-secured Nginx with HTTP basic auth.

<br/>

![Docker](https://img.shields.io/badge/Platform-Docker-informational?style=flat-square&color=0db7ed)
![Node.js](https://img.shields.io/badge/Dashboard-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Rclone](https://img.shields.io/badge/Cloud_Sync-Rclone-3b82f6?style=flat-square)
![SSL](https://img.shields.io/badge/SSL-Let's%20Encrypt-FFD700?style=flat-square&logo=letsencrypt&logoColor=black)
![Status](https://img.shields.io/badge/Status-Production%20Ready-22c55e?style=flat-square)

</div>

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🧩 Stack Components](#-stack-components)
- [🌐 Services & Access](#-services--access)
- [📋 Prerequisites](#-prerequisites)
- [⚡ Quick Start](#-quick-start)
- [☁️ Deploy on Oracle Cloud VPS](#️-deploy-on-oracle-cloud-vps)
- [☁️ Multi-Cloud Upload](#️-multi-cloud-upload)
- [⚙️ Configuration Reference](#️-configuration-reference)
- [🤖 Automated Features](#-automated-features)
- [🔧 Maintenance & Commands](#-maintenance--commands)
- [🛡️ Security](#️-security)
- [🗂️ Project Structure](#️-project-structure)
- [📜 License](#-license)

---

## ✨ Features

<table>
<tr>
<td>

🔽 **Multi-Protocol Downloads**
> HTTP, HTTPS, FTP, SFTP, BitTorrent, Magnet Links — all managed through a single elegant web UI

</td>
<td>

☁️ **Multi-Cloud Sync**
> Auto-upload completed downloads to OneDrive, Google Drive, Dropbox, MEGA, S3, and 70+ providers

</td>
</tr>
<tr>
<td>

📊 **Real-Time Dashboard**
> Live monitoring of downloads, uploads, server health, disk usage, and cloud capacity via WebSocket

</td>
<td>

🔒 **SSL + Auth**
> Auto-renewing Let's Encrypt certificates with HTTP basic authentication on all routes

</td>
</tr>
<tr>
<td>

🐳 **Fully Dockerized**
> One-command deployment with Docker Compose — 7 services, zero manual setup

</td>
<td>

🧹 **Auto-Cleanup**
> Removes `.aria2`, `.torrent`, empty directories, and temporary files after successful uploads

</td>
</tr>
<tr>
<td>

📡 **Auto BT Trackers**
> BitTorrent tracker list refreshed daily from community-maintained sources

</td>
<td>

💾 **Auto-Backup**
> Config files backed up to cloud storage daily at 3 AM automatically

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NGINX REVERSE PROXY                          │
│                  (SSL termination + Basic Auth)                      │
│       :80 (HTTP→HTTPS)         :443 (HTTPS)                        │
├─────────┬──────────┬──────────┬───────────┬─────────────────────────┤
│    /    │ /jsonrpc  │/download │/portainer │  /live     /rclone     │
│         │          │          │           │                         │
│ AriaNg  │ Aria2    │ File     │ Portainer │  Nexly     Rclone      │
│  (SPA)  │   RPC    │ Browser  │    UI     │ Dashboard  Web GUI     │
└────┬────┴────┬─────┴────┬─────┴─────┬─────┴─────┬───────┬──────────┘
     │         │          │           │           │       │
     │    ┌────▼────┐  ┌──▼────┐  ┌───▼───┐  ┌───▼───┐   │
     │    │ Aria2   │  │ File  │  │Portai-│  │ Nexly │   │
     │    │  Pro    │  │Browser│  │ner CE │  │  Dash │   │
     │    │ :6800   │  │  :80  │  │ :9000 │  │ :3000 │   │
     │    └────┬────┘  └───────┘  └───────┘  └───┬───┘   │
     │         │                                  │       │
     │         │  ┌─────────────┐                 │       │
     │         └──►  Downloads  ◄─────────────────┘       │
     │            │   Volume    │                          │
     │            └──────┬──────┘                          │
     │                   │                                 │
     │            ┌──────▼──────┐                          │
     │            │   Rclone    ◄──────────────────────────┘
     │            │   :5572     │
     │            └──────┬──────┘
     │                   │
     │     ┌─────────────▼─────────────┐
     │     │     Cloud Providers       │
     │     │  OneDrive │ Google Drive  │
     │     │  Dropbox  │ MEGA │ S3    │
     │     │     + 70 more via Rclone  │
     │     └───────────────────────────┘
     │
     │            ┌────────────┐
     └────────────► Certbot    │
                  │ (SSL Auto) │
                  └────────────┘
```

---

## 🧩 Stack Components

| Component | Image | Purpose |
| :--- | :--- | :--- |
| 🔽 **Aria2 Pro** | `p3terx/aria2-pro` (custom build) | High-performance download engine (HTTP/FTP/BT/Magnet) |
| 🎨 **AriaNg** | Nginx static | Beautiful web frontend for Aria2 RPC control |
| ☁️ **Rclone** | `rclone/rclone` | Multi-cloud sync engine for 70+ providers |
| 📁 **FileBrowser** | `filebrowser/filebrowser` | Web-based file manager for downloads |
| 🐳 **Portainer** | `portainer/portainer-ce:lts` | Docker container management UI |
| 🌐 **Nginx** | `nginx:alpine` | Reverse proxy with SSL termination + auth |
| 📊 **Nexly Dashboard** | Custom Node.js build | Real-time monitoring with cloud management |
| 🔐 **Certbot** | `certbot/certbot` | Automatic Let's Encrypt SSL certificate renewal |

---

## 🌐 Services & Access

> [!NOTE]
> All routes are protected by HTTP basic auth (`.htpasswd`). HTTP automatically redirects to HTTPS.

| Service | Route | Port | Description |
| :--- | :--- | :---: | :--- |
| 🎨 **AriaNg** | `/` | 443 | Download management web UI |
| ⚡ **Aria2 RPC** | `/jsonrpc` | 443 | WebSocket RPC endpoint (uses RPC secret, no basic auth) |
| 📊 **Nexly Dashboard** | `/live/` | 443 | Real-time server & cloud monitoring |
| 📁 **FileBrowser** | `/download/` | 443 | Web-based file manager |
| 🐳 **Portainer** | `/portainer/` | 443 | Docker management UI |
| ☁️ **Rclone Web GUI** | `/rclone/` | 443 | Cloud sync management |

---

## 📋 Prerequisites

Before installation, ensure you have:

| Requirement | Minimum | Recommended |
| :--- | :--- | :--- |
| **OS** | Ubuntu 20.04 / Debian 11 | Ubuntu 22.04+ / Oracle Linux 8+ |
| **RAM** | 1 GB | 2 GB+ |
| **Storage** | 20 GB | 50 GB+ SSD |
| **Docker** | v20.10+ | Latest stable |
| **Docker Compose** | v2.0+ | Latest stable |
| **Domain** | Any domain with A record | DDNS supported |
| **Ports** | 80, 443 open | — |

---

## ⚡ Quick Start

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Akai-Abd/Aria-Ariang-Server.git
cd Aria-Ariang-Server
```

### 2️⃣ Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in your secrets:

```env
RPC_SECRET=your_secure_rpc_secret       # Aria2 RPC authentication token
RCLONE_USER=admin                        # Rclone Web GUI username
RCLONE_PASS=your_secure_password         # Rclone Web GUI password
FB_USER=admin                            # FileBrowser username
FB_PASS=your_secure_password             # FileBrowser password
TZ=Asia/Kolkata                          # Your timezone
PUID=1001                                # User ID for file permissions
PGID=1001                                # Group ID for file permissions
DOMAIN=your.domain.com                   # Your domain name
```

### 3️⃣ Set Up HTTP Basic Auth

```bash
# Install htpasswd utility
sudo apt install apache2-utils -y

# Generate password file (replace 'admin' and 'yourpassword')
htpasswd -cb .htpasswd admin yourpassword
```

### 4️⃣ Generate Self-Signed SSL (Initial Setup)

```bash
mkdir -p certs
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout certs/aria2.key \
  -out certs/aria2.pem \
  -subj "/CN=your.domain.com"
```

### 5️⃣ Build & Launch

```bash
docker compose up -d --build
```

### 6️⃣ Set Up Let's Encrypt SSL (Production)

```bash
# Obtain real SSL certificate
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d your.domain.com \
  --email your@email.com \
  --agree-tos --no-eff-email

# Update nginx config to use Let's Encrypt certs
# Change ssl_certificate paths in aria2-nginx.conf to:
#   ssl_certificate /etc/letsencrypt/live/your.domain.com/fullchain.pem;
#   ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;

# Restart nginx to apply
docker compose restart nginx-proxy
```

### 7️⃣ Configure Cloud Sync

```bash
# Set up Rclone remote (interactive wizard)
docker exec -it rclone rclone config

# Edit cloud destinations
nano cloud-destinations.json
```

### ✅ Verify Installation

```bash
# Check all services are running
docker compose ps

# Run the health check dashboard
bash check.sh
```

---

## ☁️ Deploy on Oracle Cloud VPS

> [!IMPORTANT]
> Oracle Cloud offers an **Always Free** tier with ARM-based VMs (4 OCPU, 24 GB RAM) — perfect for running this entire stack.

### Step 1 — Create an Oracle Cloud Instance

1. Sign up at [cloud.oracle.com](https://cloud.oracle.com/)
2. Navigate to **Compute → Instances → Create Instance**
3. Choose the following settings:

   | Setting | Value |
   | :--- | :--- |
   | **Image** | Ubuntu 22.04 (or Oracle Linux 8) |
   | **Shape** | `VM.Standard.A1.Flex` (ARM — Always Free) |
   | **OCPUs** | 2–4 |
   | **Memory** | 6–24 GB |
   | **Boot Volume** | 50 GB+ |

4. Download your SSH key pair during creation
5. Note down the **Public IP** of the instance

### Step 2 — Configure Oracle Cloud Networking

> [!WARNING]
> Oracle Cloud uses **Security Lists** (not just iptables). You must open ports in **both** the VCN Security List and OS firewall.

#### 2a. Open Ports in VCN Security List

1. Go to **Networking → Virtual Cloud Networks → Your VCN**
2. Click **Security Lists → Default Security List**
3. **Add Ingress Rules:**

   | Source CIDR | Protocol | Dest Port | Description |
   | :--- | :--- | :--- | :--- |
   | `0.0.0.0/0` | TCP | 80 | HTTP |
   | `0.0.0.0/0` | TCP | 443 | HTTPS |

#### 2b. Open OS Firewall (iptables)

```bash
# SSH into your instance
ssh -i your-key.pem ubuntu@<PUBLIC_IP>

# Open ports 80 and 443
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Save iptables rules permanently
sudo netfilter-persistent save
sudo netfilter-persistent reload
```

### Step 3 — Install Docker

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Apply group changes (or log out and back in)
newgrp docker

# Verify installation
docker --version
docker compose version
```

### Step 4 — Clone & Configure

```bash
# Clone the repository
git clone https://github.com/Akai-Abd/Aria-Ariang-Server.git
cd Aria-Ariang-Server

# Configure environment
cp .env.example .env
nano .env

# Set up HTTP basic auth
sudo apt install apache2-utils -y
htpasswd -cb .htpasswd admin yourpassword

# Generate initial self-signed SSL
mkdir -p certs
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout certs/aria2.key \
  -out certs/aria2.pem \
  -subj "/CN=your.domain.com"
```

### Step 5 — Point Your Domain

Set up a DNS **A record** pointing your domain to the Oracle Cloud instance's **Public IP**:

| Type | Host | Value | TTL |
| :--- | :--- | :--- | :--- |
| A | `@` or `nexly` | `YOUR_PUBLIC_IP` | 300 |

> [!TIP]
> If you use a free DDNS service (e.g., DuckDNS, dpdns.org), update the IP accordingly.

### Step 6 — Deploy & Get SSL

```bash
# Build and start all services
docker compose up -d --build

# Wait for nginx to start, then get Let's Encrypt SSL
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d your.domain.com \
  --email your@email.com \
  --agree-tos --no-eff-email

# Update nginx config to use Let's Encrypt certs
# Edit aria2-nginx.conf — change ssl_certificate lines to:
#   ssl_certificate /etc/letsencrypt/live/your.domain.com/fullchain.pem;
#   ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;
nano aria2-nginx.conf

# Restart nginx to load new certs
docker compose restart nginx-proxy
```

### Step 7 — Set Up Rclone Cloud Sync

```bash
# Configure Rclone for your cloud provider
docker exec -it rclone rclone config

# Verify the remote works
docker exec rclone rclone lsd onedrive:
```

### Step 8 — Verify Deployment

```bash
# Check all containers are healthy
docker compose ps

# Run the health check dashboard
bash check.sh

# Test HTTPS access
curl -Ik https://your.domain.com
```

> [!TIP]
> **Oracle Cloud Free Tier limits**: The Always Free ARM instance is more than enough for personal use. For heavy BitTorrent workloads, consider the paid `VM.Standard.E4.Flex` shape.

---

## ☁️ Multi-Cloud Upload

Downloads are **automatically uploaded** to all enabled cloud destinations on completion.

### Managing Cloud Destinations

**Via Dashboard:** Open the Nexly Live Dashboard → Click the **☁️ CLOUD** button → Add/Remove destinations

**Via Config File:** Edit `cloud-destinations.json` directly:

```json
{
  "destinations": [
    {
      "id": "onedrive-main",
      "name": "OneDrive (Main)",
      "remote": "onedrive",
      "path": "Aria2Downloads",
      "enabled": true,
      "icon": "💎"
    },
    {
      "id": "gdrive-backup",
      "name": "Google Drive (Backup)",
      "remote": "gdrive",
      "path": "Downloads",
      "enabled": true,
      "icon": "📁"
    }
  ]
}
```

### Adding a New Cloud Provider

```bash
# 1. Configure the remote in Rclone
docker exec -it rclone rclone config

# 2. Add destination via Dashboard → ☁️ CLOUD → Add Destination
#    Or add manually to cloud-destinations.json

# 3. Test the remote
docker exec rclone rclone lsd <remote-name>:
```

### Supported Providers

> OneDrive · Google Drive · Dropbox · MEGA · Amazon S3 · Backblaze B2 · Wasabi · Azure Blob · Google Cloud Storage · DigitalOcean Spaces · MinIO · FTP/SFTP · WebDAV · Box · pCloud · Yandex Disk · and [70+ more via Rclone](https://rclone.org/overview/)

---

## ⚙️ Configuration Reference

| File | Purpose | Sensitive |
| :--- | :--- | :---: |
| `.env` | All secrets (RPC, passwords, credentials) | ✅ |
| `docker-compose.yml` | Service orchestration & volumes | ❌ |
| `aria2-nginx.conf` | Reverse proxy, SSL, auth routing | ❌ |
| `aria2/aria2.conf` | Download engine tuning (speeds, limits, BT) | ❌ |
| `cloud-destinations.json` | Multi-cloud upload targets | ❌ |
| `script.conf` | Upload/cleanup behavior settings | ❌ |
| `settings.json` | FileBrowser configuration | ❌ |
| `rclone/rclone.conf` | Cloud provider OAuth tokens | ✅ |
| `.htpasswd` | HTTP basic auth credentials | ✅ |
| `Dockerfile.aria2` | Custom Aria2 image with cron | ❌ |
| `check.sh` | System health check dashboard script | ❌ |

### Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `RPC_SECRET` | Aria2 RPC authentication token | `changeme` |
| `RCLONE_USER` | Rclone Web GUI username | `admin` |
| `RCLONE_PASS` | Rclone Web GUI password | `changeme` |
| `FB_USER` | FileBrowser username | `admin` |
| `FB_PASS` | FileBrowser password | `changeme` |
| `TZ` | Server timezone | `Asia/Kolkata` |
| `PUID` | User ID for file permissions | `1001` |
| `PGID` | Group ID for file permissions | `1001` |
| `DOMAIN` | Your server domain name | `nexly.dpdns.org` |

---

## 🤖 Automated Features

| Feature | Schedule | Description |
| :--- | :--- | :--- |
| 🔼 **Auto-Upload** | On download complete | Completed downloads → all enabled cloud destinations |
| 🧹 **Auto-Cleanup** | On upload complete | Removes `.aria2`, `.torrent`, empty dirs after upload |
| 📡 **Auto-Tracker** | Daily at 4:00 AM | BT tracker list refreshed from community sources |
| 💾 **Auto-Backup** | Daily at 3:00 AM | Config files backed up to OneDrive |
| 📜 **Log Rotation** | On 1 MB threshold | Upload logs rotate, keeps 3 archives |
| ❤️ **Health Checks** | Every 30 seconds | All containers monitored, auto-restart on failure |
| 🔐 **SSL Renewal** | Every 12 hours | Certbot checks & renews Let's Encrypt certs |

---

## 🔧 Maintenance & Commands

### Container Management

```bash
# Start all services
docker compose up -d --build

# Stop all services
docker compose down

# Restart a specific service
docker compose restart aria2-pro

# View logs for a service
docker compose logs -f aria2-pro

# View all container statuses
docker compose ps
```

### Rclone Operations

```bash
# Check cloud storage usage
docker exec rclone rclone about onedrive:

# List files on cloud
docker exec rclone rclone ls onedrive:/aria2-downloads

# Manual upload
docker exec rclone rclone copy /downloads/myfile onedrive:/aria2-downloads

# Re-configure a remote
docker exec -it rclone rclone config
```

### SSL Certificate

```bash
# Force SSL renewal
docker compose run --rm certbot renew --force-renewal

# Check certificate expiry
docker compose run --rm certbot certificates
```

### Health Check

```bash
# Run the system health dashboard
bash check.sh
```

---

## 🛡️ Security

- 🔐 **HTTP Basic Auth** — All web routes protected via `.htpasswd`
- 🔒 **HTTPS Only** — HTTP auto-redirects to HTTPS (port 80 → 443)
- 🛡️ **SSL/TLS** — Auto-renewing Let's Encrypt certificates via Certbot
- 🔑 **RPC Secret** — Aria2 RPC uses its own token-based authentication
- 🚫 **No Exposed Ports** — Only ports 80 and 443 are published; all internal services communicate over a Docker bridge network
- 📦 **Secrets in `.env`** — All credentials stored in `.env` (git-ignored)
- 🔐 **OAuth Tokens** — Rclone config with OAuth tokens is git-ignored

---

## 🗂️ Project Structure

```
Aria-Ariang-Server/
├── aria2/                      # Aria2 config & runtime
│   ├── aria2.conf              # Download engine configuration
│   └── script/                 # Aria2 event scripts
├── ariang/                     # AriaNg web frontend (static files)
├── certs/                      # SSL certificates (git-ignored)
├── dashboard/                  # Nexly Live Dashboard (Node.js)
│   ├── Dockerfile              # Dashboard container build
│   ├── server.js               # Express + Socket.io backend
│   ├── public/                 # Frontend assets
│   └── package.json            # Node.js dependencies
├── downloads/                  # Download directory (git-ignored)
├── rclone/                     # Rclone config (git-ignored)
├── script/                     # Upload, cleanup, tracker & backup scripts
│   ├── upload.sh               # Multi-cloud upload handler
│   ├── clean.sh                # Post-upload cleanup
│   ├── delete.sh               # Task deletion handler
│   ├── tracker.sh              # BT tracker auto-updater
│   ├── backup.sh               # Config backup to cloud
│   └── core                    # Shared utility functions
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── .htpasswd                   # HTTP basic auth (git-ignored in practice)
├── aria2-nginx.conf            # Nginx reverse proxy config
├── check.sh                    # System health check dashboard
├── cloud-destinations.json     # Multi-cloud upload targets
├── docker-compose.yml          # Service orchestration
├── Dockerfile.aria2            # Custom Aria2 image with cron jobs
├── script.conf                 # Upload/cleanup behavior config
├── settings.json               # FileBrowser configuration
├── LICENSE                     # MIT License
└── README.md                   # This file
```

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License • Copyright (c) 2015-2026 Akai
```

---

<div align="center">

**Built with ❤️ by [Akai](https://github.com/Akai-Abd)**

⭐ **Star this repo** if you find it useful!

</div>
