# 🔧 Maintenance & CLI Operations Guide

This reference details daily administration commands, health monitoring routines, and log inspection procedures.

---

## 🐳 Docker Stack Control Commands

```bash
# Start all containers in detached mode
docker compose up -d

# Stop all microservices
docker compose down

# Restart a specific service (e.g., Nginx, Aria2)
docker compose restart nginx-proxy
docker compose restart aria2-pro

# View container status and health states
docker compose ps
```

---

## 📜 Log Viewing & Monitoring

```bash
# Stream real-time logs for all services
docker compose logs -f

# Stream logs for download engine
docker compose logs -f aria2-pro

# Stream logs for live monitoring dashboard
docker compose logs -f dashboard

# Inspect upload history log file
tail -f aria2/upload.log
```

---

## 🩺 System Diagnostic Tool (`check.sh`)

The repository includes a health verification script (`check.sh`) that checks container statuses, disk space, and open network ports.

Run diagnostics:
```bash
bash check.sh
```

Sample Output:
```
=========================================
 🚀 ARIA-ARIANG SERVER DIAGNOSTICS
=========================================
[✔] Docker Engine running
[✔] aria2-pro : UP (healthy)
[✔] nginx-proxy : UP
[✔] rclone : UP
[✔] nexly-dashboard : UP (healthy)
[✔] Port 80 / 443 listening
=========================================
```

---

## 🤖 Automated Cron Lifecycle Tasks

| Task | Trigger Frequency | Description |
| :--- | :--- | :--- |
| 🔼 **Cloud Upload** | On download complete | `script/upload.sh` moves files to active remotes |
| 🧹 **Post Cleanup** | Post upload finish | `script/clean.sh` removes `.aria2` & `.torrent` junk |
| 📡 **BT Trackers** | Daily at 4:00 AM | `script/tracker.sh` fetches latest tracker list |
| 💾 **Config Backup**| Daily at 3:00 AM | `script/backup.sh` syncs config files to cloud |
| 🔐 **SSL Renewal** | Every 12 Hours | Certbot container verifies Let's Encrypt validity |

---

## 🆘 Troubleshooting Common Issues

### 1. RPC Connection Failed in AriaNg
* Verify `RPC_SECRET` in `.env` matches your browser settings.
* Ensure port 443 is open and Nginx proxy is running (`docker compose ps`).

### 2. Cloud Upload Fails
* Test remote connection via CLI:
  ```bash
  docker exec -it rclone rclone listremotes
  docker exec -it rclone rclone lsd gdrive:
  ```
* Check `aria2/upload.log` for permission errors or invalid OAuth tokens.
