# 🚀 Deployment Guide

> **Goal**: Get Aria-AriaNg Server running on a VPS in under 5 minutes.
> Follow the **Automated Quick Deploy** (1 command) or the detailed step-by-step guide below.

---

## 📑 Table of Contents

- [⚡ Option A: 1-Command Automated Deployment (Recommended)](#-option-a-1-command-automated-deployment-recommended)
- [📘 Option B: Step-by-Step Manual Deployment](#-option-b-step-by-step-manual-deployment)
  - [Step 1 — Get a Server](#step-1--get-a-server)
  - [Step 2 — Connect to Your Server](#step-2--connect-to-your-server)
  - [Step 3 — Clone & Run Pre-Flight Setup](#step-3--clone--run-pre-flight-setup)
  - [Step 4 — Configure Environment (.env)](#step-4--configure-environment-env)
  - [Step 5 — Launch Everything](#step-5--launch-everything)
  - [Step 6 — Verify Deployment](#step-6--verify-deployment)
  - [Step 7 — Free Let's Encrypt SSL (Optional)](#step-7--free-lets-encrypt-ssl-optional)
  - [Step 8 — Cloud Storage Sync (Rclone)](#step-8--cloud-storage-sync-rclone)
- [Oracle Cloud Specific Instructions](#oracle-cloud-specific-instructions)
- [Troubleshooting & Common Fixes](#troubleshooting--common-fixes)
- [What's Running After Deployment](#whats-running-after-deployment)

---

<a id="-option-a-1-command-automated-deployment-recommended"></a>
## ⚡ Option A: 1-Command Automated Deployment (Recommended)

On any fresh Ubuntu or Debian VPS, paste this single command into your SSH terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/Akai-Abd/Aria-Ariang-Server/main/deploy.sh | bash
```

### What this script automates:
1. Installs system dependencies (`git`, `curl`, `apache2-utils`, `iptables-persistent`)
2. Opens firewall ports `80` and `443` in iptables and saves them permanently
3. Installs the latest Docker Engine & Docker Compose
4. Clones the repository to `~/Aria-Ariang-Server`
5. Runs `setup.sh` (pre-creates database files, fixes permissions, creates `.htpasswd` & self-signed SSL)
6. Pulls Docker images and starts all 7 microservices

---

<a id="-option-b-step-by-step-manual-deployment"></a>
## 📘 Option B: Step-by-Step Manual Deployment

<a id="step-1--get-a-server"></a>
### Step 1 — Get a Server & Point DNS

1. Get an instance (e.g. **Oracle Cloud Always Free ARM**, Hetzner, or DigitalOcean).
2. Point your domain's **A record** (e.g., `nexly.dpdns.org`) to your server's public IP address.

---

<a id="step-2--connect-to-your-server"></a>
### Step 2 — Connect to Your Server & Install Docker

```bash
# Connect via SSH
ssh -i your-key.pem ubuntu@YOUR_SERVER_IP

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

---

<a id="step-3--clone--run-pre-flight-setup"></a>
### Step 3 — Clone & Run Pre-Flight Setup

```bash
# Clone the repository
git clone https://github.com/Akai-Abd/Aria-Ariang-Server.git
cd Aria-Ariang-Server

# Run the automated pre-flight setup script
chmod +x setup.sh check.sh deploy.sh
./setup.sh
```

> 💡 **Why `setup.sh` is essential:**
> It creates required database and log files before Docker runs, sets proper user/group permissions on `/downloads` so Aria2 can write files without permission errors, and initializes FileBrowser credentials.

---

<a id="step-4--configure-environment-env"></a>
### Step 4 — Configure Environment (.env)

Edit `.env` if you want to customize your domain or passwords:

```bash
nano .env
```

```env
RPC_SECRET=654550              # Aria2 RPC authentication secret
RCLONE_USER=admin              # Rclone Web GUI username
RCLONE_PASS=654550             # Rclone Web GUI password
FB_USER=admin                  # FileBrowser username
FB_PASS=654550                 # FileBrowser password
TZ=Asia/Kolkata                # Your timezone
PUID=1001                      # Current user UID (run `id -u`)
PGID=1001                      # Current user GID (run `id -g`)
DOMAIN=nexly.dpdns.org         # Your domain name
```

---

<a id="step-5--launch-everything"></a>
### Step 5 — Launch Everything

```bash
# Remove dev override if present (uses local builds instead of Docker Hub)
rm -f docker-compose.override.yml

docker compose pull
docker compose up -d
```

> [!IMPORTANT]
> If `docker-compose.override.yml` exists, it overrides Docker Hub image pulls with local builds — which will fail on a production server. The command above removes it before deploying.

---

<a id="step-6--verify-deployment"></a>
### Step 6 — Verify Deployment

```bash
# Check container status
docker compose ps

# Run interactive system health dashboard
./check.sh
```

#### Access Your Services:
| Service | URL | Default Login |
|:---|:---|:---|
| **AriaNg** | `https://your.domain.com/` | `.htpasswd` credentials |
| **Nexly Dashboard** | `https://your.domain.com/live/` | `.htpasswd` credentials |
| **FileBrowser** | `https://your.domain.com/download/` | `FB_USER` / `FB_PASS` |
| **Portainer** | `https://your.domain.com/portainer/` | Initial admin setup |
| **Rclone Web UI** | `https://your.domain.com/rclone/` | `RCLONE_USER` / `RCLONE_PASS` |

---

<a id="step-7--free-lets-encrypt-ssl-optional"></a>
### Step 7 — Free Let's Encrypt SSL (Optional)

```bash
# Request Let's Encrypt certificate
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d your.domain.com \
  --email your@email.com \
  --agree-tos --no-eff-email

# Switch Nginx to production certs
sed -i 's|ssl_certificate /etc/nginx/certs/aria2.pem;|ssl_certificate /etc/letsencrypt/live/your.domain.com/fullchain.pem;|' aria2-nginx.conf
sed -i 's|ssl_certificate_key /etc/nginx/certs/aria2.key;|ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;|' aria2-nginx.conf

docker compose restart nginx-proxy
```

---

<a id="step-8--cloud-storage-sync-rclone"></a>
### Step 8 — Cloud Storage Sync (Rclone)

For headless VPS, authenticate Rclone on your local machine and transfer the config:

```bash
# 1. On your local machine (with browser access):
rclone config
# (Add your Google Drive / OneDrive remote named "gdrive" or "onedrive")

# 2. Copy the authorized token to the server:
scp ~/.config/rclone/rclone.conf ubuntu@YOUR_SERVER_IP:~/Aria-Ariang-Server/rclone/

# 3. Restart Rclone on the server:
docker compose restart rclone dashboard
```

---

<a id="oracle-cloud-specific-instructions"></a>
## Oracle Cloud Specific Instructions

Oracle Cloud requires opening ports in **both** the Web Console and the OS firewall:

### 1. Web Console (VCN Security List)
1. Go to **Networking → Virtual Cloud Networks → Default Security List**.
2. Add Ingress Rules for `0.0.0.0/0`:
   - Port `80` (TCP)
   - Port `443` (TCP)

### 2. OS Firewall (iptables)
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

<a id="troubleshooting--common-fixes"></a>
## Troubleshooting & Common Fixes

### 1. Aria2 Download Fails (`errorCode=16: Permission denied`)
* **Cause**: `downloads/` folder owned by root instead of the non-root container user.
* **Fix**:
  ```bash
  sudo chown -R $USER:$USER ~/Aria-Ariang-Server
  sudo chmod -R 775 downloads script aria2 rclone
  ```

### 2. FileBrowser Fails to Start or Shows "Wrong Credentials"
* **Cause**: Missing `filebrowser.db` mounted as a folder or password length policy.
* **Fix**: Run `./setup.sh` or recreate the database:
  ```bash
  docker compose stop filebrowser
  rm -rf filebrowser.db && touch filebrowser.db
  docker run --rm -v "$(pwd)/filebrowser.db:/database/filebrowser.db" filebrowser/filebrowser config init -d /database/filebrowser.db
  docker run --rm -v "$(pwd)/filebrowser.db:/database/filebrowser.db" filebrowser/filebrowser config set --minimumPasswordLength 6 -d /database/filebrowser.db
  docker compose up -d filebrowser
  ```

### 3. Cloudflare Error 522 ("Host Error")
* Set Cloudflare SSL/TLS encryption mode to **Full** or **Full (strict)** when using Cloudflare Origin Certificates.
* Check that DNS A record points to your VM's public IP address.

---

<a id="whats-running-after-deployment"></a>
## What's Running After Deployment

| Container | Purpose | Internal Port |
|:---|:---|:---:|
| **aria2-pro** | Download engine (HTTP/FTP/BitTorrent) | 6800 |
| **nginx-proxy** | Reverse proxy, SSL, authentication | 80, 443 |
| **rclone** | Cloud storage sync engine | 5572 |
| **filebrowser** | Web file manager | 80 |
| **portainer** | Docker management UI | 9000 |
| **nexly-dashboard** | Real-time monitoring dashboard | 3000 |
| **certbot** | Automatic SSL certificate renewal | — |

---

> 📖 For day-to-day management commands, see [MAINTENANCE_CHEAT_SHEET.md](MAINTENANCE_CHEAT_SHEET.md).
