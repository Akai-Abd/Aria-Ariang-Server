# 🛠️ Server & Local Maintenance Cheat Sheet (`Aria-Ariang-Server`)

Comprehensive reference guide for Git synchronization, Docker operations, container management, and server administration.

---

## 📑 Table of Contents
1. [🔄 Git Synchronization Workflows](#-git-synchronization-workflows)
2. [🐳 Docker Stack Management](#-docker-stack-management)
3. [📦 Container-Specific Operational Commands](#-container-specific-operational-commands)
4. [📜 Maintenance Scripts & Automation](#-maintenance-scripts--automation)
5. [🖥️ Linux & Server Administration](#-linux--server-administration)

---

## 🔄 Git Synchronization Workflows

### Workflow 1: Local Edits → Deploy to Server
```bash
# === 1. LOCAL TERMINAL ===
cd "/media/akai/NFORCE/Aria-Ariang Server"
git status
git add -A
git commit -m "feat: description of changes"
git push

# === 2. SERVER TERMINAL ===
ssh ubuntu@YOUR_SERVER_IP
cd ~/Aria-Ariang-Server
git pull
docker compose restart                      # Quick restart
docker compose up -d --build                # Rebuild if Dockerfiles/compose changed
```

### Workflow 2: Server Edits → Sync Back to Local
```bash
# === 1. SERVER TERMINAL ===
cd ~/Aria-Ariang-Server
git add -A
git commit -m "fix: changes made on server"

# === 2. LOCAL TERMINAL ===
cd "/media/akai/NFORCE/Aria-Ariang Server"
git fetch ubuntu@YOUR_SERVER_IP:~/Aria-Ariang-Server main
git merge FETCH_HEAD
git push

# === 3. SERVER TERMINAL ===
cd ~/Aria-Ariang-Server
git fetch origin
```

### Workflow 3: Conflict Resolution (Stash Method)
```bash
# On Server: Stash local edits
ssh ubuntu@YOUR_SERVER_IP 'cd ~/Aria-Ariang-Server && git stash'

# On Local: Push your changes
cd "/media/akai/NFORCE/Aria-Ariang Server" && git push

# On Server: Pull & pop stash
ssh ubuntu@YOUR_SERVER_IP 'cd ~/Aria-Ariang-Server && git pull && git stash pop'
```

---

## 🐳 Docker Stack Management

All commands below assume you are inside `~/Aria-Ariang-Server` on the **Server Terminal**.

| Task | Command |
| :--- | :--- |
| **Start Stack (Background)** | `docker compose up -d` |
| **Stop All Containers** | `docker compose down` |
| **Restart All Containers** | `docker compose restart` |
| **Rebuild All Containers** | `docker compose up -d --build` |
| **View Live Status & Ports** | `docker compose ps` |
| **View All Container Stats (RAM/CPU)** | `docker stats` |
| **View Tail Logs (All Services)** | `docker compose logs -f --tail=50` |
| **View Logs (Single Service)** | `docker compose logs -f --tail=50 <service_name>` |
| **Restart Single Service** | `docker compose restart <service_name>` |

> **Available Services:** `aria2-pro`, `nginx-proxy`, `rclone`, `filebrowser`, `portainer`, `dashboard`, `certbot`

---

## 📦 Container-Specific Operational Commands

### 1. 🚀 Aria2 Download Engine (`aria2-pro`)
```bash
# View live Aria2 download logs
docker compose logs -f --tail=50 aria2-pro

# View upload activity log
tail -f ~/Aria-Ariang-Server/aria2/upload.log

# Force trigger BT tracker list update
docker exec -it aria2-pro /config/script/tracker.sh

# Force trigger manual cloud upload scan
docker exec -it aria2-pro /config/script/upload.sh
```

### 2. ☁️ Rclone Cloud Sync (`rclone`)
```bash
# View live Rclone transfers & daemon logs
docker compose logs -f --tail=50 rclone

# List all configured cloud remotes
docker exec -it rclone rclone listremotes --config="/config/rclone/rclone.conf"

# View active upload queue stats & speed via Rclone API
docker exec -it rclone rclone rc core/stats --rc-user="${RCLONE_USER}" --rc-pass="${RCLONE_PASS}"

# --- 🔍 STORAGE QUOTA CHECK BY CLOUD PROVIDER ---
docker exec -it rclone rclone about gdrive: --config="/config/rclone/rclone.conf"     # Google Drive
docker exec -it rclone rclone about onedrive: --config="/config/rclone/rclone.conf"   # Microsoft OneDrive
docker exec -it rclone rclone about mega: --config="/config/rclone/rclone.conf"       # MEGA Cloud
docker exec -it rclone rclone about dropbox: --config="/config/rclone/rclone.conf"    # Dropbox
docker exec -it rclone rclone about pcloud: --config="/config/rclone/rclone.conf"     # pCloud
docker exec -it rclone rclone about box: --config="/config/rclone/rclone.conf"        # Box.com
docker exec -it rclone rclone about s3: --config="/config/rclone/rclone.conf"         # Amazon S3 / MinIO

# --- 📁 LIST REMOTE DIRECTORIES & FILES ---
docker exec -it rclone rclone lsd gdrive: --config="/config/rclone/rclone.conf"       # List Google Drive folders
docker exec -it rclone rclone lsd onedrive: --config="/config/rclone/rclone.conf"     # List OneDrive folders
docker exec -it rclone rclone ls mega: --config="/config/rclone/rclone.conf"          # List MEGA files
docker exec -it rclone rclone lsd webdav: --config="/config/rclone/rclone.conf"       # List WebDAV / Nextcloud folders

# --- 🧪 MANUAL TEST TRANSFER TO CLOUD ---
# Copy a test file to a remote folder with progress bar (-P)
docker exec -it rclone rclone copy /downloads/test.txt gdrive:/Uploads -P --config="/config/rclone/rclone.conf"
docker exec -it rclone rclone copy /downloads/test.txt onedrive:/Uploads -P --config="/config/rclone/rclone.conf"

# Run interactive Rclone setup CLI inside container
docker exec -it rclone rclone config --config="/config/rclone/rclone.conf"
```

### 3. 🌐 Nginx Proxy & SSL (`nginx-proxy` / `certbot`)
```bash
# Test Nginx configuration syntax
docker exec -it nginx-proxy nginx -t

# Reload Nginx config without downtime
docker exec -it nginx-proxy nginx -s reload

# Manually trigger Let's Encrypt SSL renewal
docker compose run --rm certbot renew
```

### 4. 📊 Dashboard (`nexly-dashboard`)
```bash
# View dashboard backend logs
docker compose logs -f --tail=50 dashboard

# Restart dashboard backend
docker compose restart dashboard
```

---

## 📜 Maintenance Scripts & Automation

Run these directly on the **Server Terminal**:

```bash
# 🏥 System Health Dashboard
bash ~/Aria-Ariang-Server/check.sh

# 📡 Manual BT Tracker List Update
bash ~/Aria-Ariang-Server/script/tracker.sh

# 🔄 Backup Configs to Cloud
bash ~/Aria-Ariang-Server/script/backup.sh

# 🧹 Clean Completed Downloads / Orphaning Files
bash ~/Aria-Ariang-Server/script/clean.sh

# 🗑️ Delete Specific File or Directory safely
bash ~/Aria-Ariang-Server/script/delete.sh "/downloads/file_or_folder_name"
```

---

## 🖥️ Linux & Server Administration

### 💾 Disk & Storage Management
```bash
# Check overall disk usage (Root & Mounts)
df -h /

# Check size of downloads folder
du -sh ~/Aria-Ariang-Server/downloads/

# Clean unused Docker images & build cache (Frees SSD space)
docker system prune -af --volumes
```

### 🏎️ CPU & Memory Monitoring
```bash
# Real-time resource monitor
htop

# Quick RAM memory usage summary
free -h
```

### 🔌 Network & Port Inspection
```bash
# Check listening ports on server
sudo ss -tulpn | grep -E '80|443|6800|5572|3000'

# Check server public IP address
curl -4 ifconfig.me
```
