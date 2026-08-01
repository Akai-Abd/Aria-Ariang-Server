# Aria-Ariang Server — Production Requirements Document (PRD)

> **Project**: Aria-Ariang Server  
> **Author**: ABDURRAHMAN  
> **Version**: 2.0.0  
> **Created**: 2026-06-23  
> **Last Updated**: 2026-07-31  
> **License**: MIT (Copyright © 2015–2026 ABDURRAHMAN)  
> **Status**: ✅ Production — Live

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Infrastructure & Hardware](#2-infrastructure--hardware)
3. [Operating System & Base Environment](#3-operating-system--base-environment)
4. [Network Architecture](#4-network-architecture)
5. [Domain & DNS](#5-domain--dns)
6. [SSL / TLS Certificates](#6-ssl--tls-certificates)
7. [Docker Container Stack](#7-docker-container-stack)
8. [Service Definitions](#8-service-definitions)
   - 8.1 [Aria2 Pro — Download Engine](#81-aria2-pro--download-engine)
   - 8.2 [Nginx — Reverse Proxy](#82-nginx--reverse-proxy)
   - 8.3 [Rclone — Cloud Sync](#83-rclone--cloud-sync)
   - 8.4 [FileBrowser — File Manager](#84-filebrowser--file-manager)
   - 8.5 [Portainer — Docker Management](#85-portainer--docker-management)
   - 8.6 [Nexly Dashboard — Real-time Monitor](#86-nexly-dashboard--real-time-monitor)
9. [Automation & Scripts](#9-automation--scripts)
10. [Data Flow & Pipeline](#10-data-flow--pipeline)
11. [Authentication & Security](#11-authentication--security)
12. [Monitoring & Health Checks](#12-monitoring--health-checks)
13. [Backup & Disaster Recovery](#13-backup--disaster-recovery)
14. [Cron Jobs & Scheduled Tasks](#14-cron-jobs--scheduled-tasks)
15. [Configuration Files Inventory](#15-configuration-files-inventory)
16. [Environment Variables](#16-environment-variables)
17. [Port Mapping](#17-port-mapping)
18. [Volume Mounts & Data Persistence](#18-volume-mounts--data-persistence)
19. [Performance Tuning](#19-performance-tuning)
20. [Known Issues & Limitations](#20-known-issues--limitations)
21. [Maintenance Procedures](#21-maintenance-procedures)
22. [Deployment Guide](#22-deployment-guide)
23. [Troubleshooting Runbook](#23-troubleshooting-runbook)
24. [Future Roadmap](#24-future-roadmap)
25. [Appendix](#25-appendix)

---

## 1. Executive Summary

**Nexly Download Station** is a self-hosted, fully automated download-and-cloud-sync platform running on an **Oracle Cloud Always Free** tier VM. It provides:

- **High-performance downloads** via Aria2 (HTTP/FTP/BitTorrent/Magnet)
- **Multi-cloud upload** to OneDrive, Google Drive, Dropbox, and 70+ providers via Rclone
- **Configurable cloud destinations** via `cloud-destinations.json` with dashboard UI management
- **Web-based file management** via FileBrowser
- **Real-time monitoring dashboard** (Nexly Live Dashboard) with Socket.IO
- **Docker container orchestration** via Portainer
- **Reverse-proxied HTTPS access** through Nginx with Cloudflare Origin CA + Let's Encrypt (Certbot)
- **Automated config backups** to OneDrive daily
- **HTTP Basic Auth** enforced globally on all routes via Nginx

The system is designed for **zero-touch operation** — files are downloaded, automatically uploaded to all enabled cloud destinations, and local copies are cleaned up, all without manual intervention.

### Key Metrics
| Metric | Value |
|:---|:---|
| Server uptime target | 99.5%+ (Oracle Free Tier) |
| Max concurrent downloads | 5 |
| Max connections per server | 32 |
| Split count | 64 |
| Upload destinations | Multi-cloud (configurable via `cloud-destinations.json`) |
| Default upload target | `onedrive:Aria2Downloads` |
| Total containers | 7 (including Certbot) |
| Total Docker image footprint | ~650 MB |
| Centralized secrets | `.env` file (not committed to VCS) |

---

## 2. Infrastructure & Hardware

### Oracle Cloud Instance

| Property | Value |
|:---|:---|
| **Cloud Provider** | Oracle Cloud Infrastructure (OCI) |
| **Tier** | Always Free |
| **Shape** | `VM.Standard.E2.1.Micro` |
| **CPU** | AMD EPYC 7551 (1 OCPU / 2 threads) |
| **RAM** | 1 GB |
| **Boot Volume** | ~46.5 GB (ext4) |
| **Region** | `eu-zurich-1` (Zurich, Switzerland) |
| **Availability Domain** | `xoaM:EU-ZURICH-1-AD-1` |
| **Instance Display Name** | `Ariang` |
| **Public IP** | `152.67.89.254` (static) |
| **Private IP** | `10.0.0.89/24` |
| **VCN Subnet** | Default subnet, `10.0.0.0/24` |

### Compute Constraints (Free Tier)
- **1 OCPU** (2 vCPU threads) — AMD EPYC 7551 @ ~2 GHz
- **1 GB RAM** — tight; requires swap
- **~46.5 GB boot volume** — no attached block volumes
- **Egress**: 10 TB/month (Oracle Always Free)
- **No GPU, no burstable credits**

### Swap Configuration
| Property | Value |
|:---|:---|
| Swap size | 2.0 GiB |
| Swap used | ~95 MiB (typical) |
| Swap free | ~1.9 GiB |

> **Note**: Swap is essential on this 1 GB RAM instance to prevent OOM kills during multi-container operation + active downloads + uploads.

---

## 3. Operating System & Base Environment

| Property | Value |
|:---|:---|
| **OS** | Ubuntu 24.04.4 LTS (Noble Numbat) |
| **Kernel** | Linux (aarch64/x86_64) |
| **Shell** | bash |
| **Docker** | Docker Engine (latest) |
| **Docker Compose** | v2.40.3+ds1 (plugin mode) |
| **System user** | `ubuntu` (UID 1000) |
| **Application user** | UID/GID `1001` (for Aria2/FileBrowser volume permissions) |
| **Project directory** | `/home/ubuntu/aria2-config/` |

### System Packages Required
- `docker.io` (or Docker CE)
- `docker-compose-v2` (plugin)
- `curl`, `jq`, `openssl`
- `htpasswd` (apache2-utils)
- `bc` (for check.sh calculations)

---

## 4. Network Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         INTERNET                                     │
│                                                                      │
│  User Browser ──── Cloudflare (DNS Proxy) ──── Oracle Cloud VCN     │
│                                                                      │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Oracle Security List │
              │  TCP 80, 443, 8080   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   iptables (host)    │
              │  ACCEPT: 80, 443,   │
              │          8080       │
              └──────────┬───────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────────┐
    │           Docker Network: aria2-net            │
    │           Bridge: 172.18.0.0/16                │
    │                                                │
    │  ┌───────────────┐    ┌─────────────────────┐  │
    │  │  nginx-proxy  │    │    aria2-pro        │  │
    │  │  172.18.0.3   │◄──►│    172.18.0.2       │  │
    │  │  :80, :443    │    │    :6800 (RPC)      │  │
    │  └───────┬───────┘    └─────────────────────┘  │
    │          │                                      │
    │          ├──────────► ┌─────────────────────┐  │
    │          │            │    filebrowser       │  │
    │          │            │    172.18.0.6        │  │
    │          │            │    :80               │  │
    │          │            └─────────────────────┘  │
    │          │                                      │
    │          ├──────────► ┌─────────────────────┐  │
    │          │            │    portainer         │  │
    │          │            │    172.18.0.4        │  │
    │          │            │    :9000             │  │
    │          │            └─────────────────────┘  │
    │          │                                      │
    │          ├──────────► ┌─────────────────────┐  │
    │          │            │    rclone            │  │
    │          │            │    172.18.0.5        │  │
    │          │            │    :5572             │  │
    │          │            └─────────────────────┘  │
    │          │                                      │
    │          └──────────► ┌─────────────────────┐  │
    │                       │  nexly-dashboard    │  │
    │                       │  172.18.0.7         │  │
    │                       │  :3000              │  │
    │                       └─────────────────────┘  │
    └────────────────────────────────────────────────┘
```

### Docker Network
| Property | Value |
|:---|:---|
| Network name | `aria2-net` |
| Driver | `bridge` |
| Subnet | `172.18.0.0/16` |
| Gateway | `172.18.0.1` |

### Firewall Rules (iptables INPUT chain)
| Port | Protocol | Purpose |
|:---|:---|:---|
| `80` | TCP | HTTP (Nginx) |
| `443` | TCP | HTTPS (Nginx + Cloudflare Origin CA) |
| `8080` | TCP | Reserved (additional services) |

> **Note**: Oracle Cloud **Security Lists** (VCN-level firewall) must also have ingress rules for ports 80 and 443. The `iptables` rules on the host are duplicated multiple times — cosmetic but functional.

---

## 5. Domain & DNS

| Property | Value |
|:---|:---|
| **Primary domain** | `nexly.dpdns.org` |
| **DNS provider** | Cloudflare (proxied) |
| **DNS record type** | A record → `152.67.89.254` |
| **Cloudflare proxy** | Enabled (orange cloud) |
| **Fallback access** | `http://152.67.89.254` (direct IP) |

### Cloudflare Configuration
- **SSL/TLS mode**: Full (Strict) — using Cloudflare Origin CA
- **Minimum TLS version**: 1.2 (recommended)
- **Automatic HTTPS Rewrites**: Enabled
- **Always Use HTTPS**: Enabled

---

## 6. SSL / TLS Certificates

| Property | Value |
|:---|:---|
| **Certificate type** | Cloudflare Origin CA |
| **Issuer** | `CloudFlare, Inc.` (OU: CloudFlare Origin CA) |
| **CN** | `CloudFlare Origin Certificate` |
| **Valid from** | January 4, 2026 |
| **Valid until** | December 31, 2040 |
| **Certificate file** | `certs/aria2.pem` |
| **Private key file** | `certs/aria2.key` |
| **Key size** | 2048-bit RSA |

### Certificate Renewal
- Cloudflare Origin CA certificates are valid for **15 years** (until 2040)
- `certbot.timer` systemd timer is active on the host but is **not** used for this certificate — it may be leftover from a previous Let's Encrypt setup
- **No renewal action required** before 2040

### Certificate Files Location
```
certs/
├── aria2.key     (1,704 bytes — RSA private key)
└── aria2.pem     (1,679 bytes — X.509 certificate)
```

---

## 7. Docker Container Stack

### Overview — `docker-compose.yml`

7 services are defined in the compose stack:

| # | Service Name | Container Name | Image | Build? | Restart Policy |
|:--|:---|:---|:---|:---|:---|
| 1 | `aria2-pro` | `aria2-pro` | Custom (FROM `p3terx/aria2-pro`) | ✅ Dockerfile.aria2 | `always` |
| 2 | `nginx-proxy` | `nginx-proxy` | `nginx:alpine` | ❌ | `always` |
| 3 | `rclone` | `rclone` | `rclone/rclone` | ❌ | `always` |
| 4 | `filebrowser` | `filebrowser` | `filebrowser/filebrowser` | ❌ | `always` |
| 5 | `portainer` | `portainer` | `portainer/portainer-ce:lts` | ❌ | `always` |
| 6 | `dashboard` | `nexly-dashboard` | Custom (FROM `node:18-alpine`) | ✅ dashboard/Dockerfile | `unless-stopped` |
| 7 | `certbot` | `certbot` | `certbot/certbot` | ❌ | `unless-stopped` |

### Docker Images (Disk Usage)
| Repository | Tag | Size |
|:---|:---|:---|
| `aria2-config-dashboard` | latest | 150 MB |
| `aria2-config-aria2-pro` | latest | 92.6 MB |
| `nginx` | alpine | 61.9 MB |
| `rclone/rclone` | latest | 88.6 MB |
| `filebrowser/filebrowser` | latest | 38.2 MB |
| `portainer/portainer-ce` | lts | 182 MB |
| `certbot/certbot` | latest | ~40 MB |
| **Total** | | **~650 MB** |

### Named Volumes
| Volume | Used By | Purpose |
|:---|:---|:---|
| `portainer_data` | Portainer | Persistent Portainer state |
| `certbot-webroot` | Nginx, Certbot | ACME challenge webroot |
| `certbot-certs` | Nginx, Certbot | Let's Encrypt certificates |

---

## 8. Service Definitions

---

### 8.1 Aria2 Pro — Download Engine

**Role**: Core download engine supporting HTTP/HTTPS, FTP, SFTP, BitTorrent, and Magnet links.

| Property | Value |
|:---|:---|
| **Base image** | `p3terx/aria2-pro` |
| **Custom build** | `Dockerfile.aria2` — adds `docker-cli` (Alpine) |
| **Container name** | `aria2-pro` |
| **User** | `0:0` (root inside container) |
| **Internal port** | `6800` (JSON-RPC), `6888` (TCP+UDP, BT listen) |
| **External ports** | None (accessed via Nginx reverse proxy) |
| **RPC Secret** | `654550` |
| **Timezone** | `Asia/Kolkata` |

#### Dockerfile.aria2
```dockerfile
FROM p3terx/aria2-pro
RUN apk add --no-cache docker-cli
# Auto-update BT trackers daily at 4 AM and backup configs at 3 AM
RUN echo '0 4 * * * /config/script/tracker.sh /config/aria2.conf RPC >> /config/tracker.log 2>&1' > /etc/crontabs/root && \
    echo '0 3 * * * /config/script/backup.sh >> /config/backup.log 2>&1' >> /etc/crontabs/root
CMD ["sh", "-c", "crond && /init"]
```
> Docker CLI is installed inside Aria2 so the upload script can interact with other containers via `docker exec`. Cron is started before the Aria2 init process to enable scheduled tracker updates (daily 4 AM) and config backups (daily 3 AM).

#### Key Aria2 Configuration (`aria2/aria2.conf` — 411 lines)

| Setting | Value | Notes |
|:---|:---|:---|
| `dir` | `/downloads` | Download directory |
| `disk-cache` | `64M` | In-memory disk cache |
| `file-allocation` | `falloc` | Fast preallocation |
| `max-concurrent-downloads` | `5` | Parallel download tasks |
| `max-connection-per-server` | `32` | Connections per HTTP source |
| `split` | `64` | Segments per download |
| `continue` | `true` | Resume support |
| `enable-dht` | `true` | DHT for BitTorrent |
| `enable-dht6` | `false` | IPv6 DHT disabled |
| `enable-peer-exchange` | `true` | PEX enabled |
| `seed-time` | `0` | No seeding after completion |
| `listen-port` | `6888` | BT listen port |
| `dht-listen-port` | `6888` | DHT listen port |
| `rpc-listen-port` | `6800` | JSON-RPC port |
| `rpc-secret` | `654550` | RPC authentication token |
| `rpc-allow-origin-all` | `true` | CORS for AriaNg |
| `rpc-listen-all` | `true` | Listen on all interfaces |
| `rpc-max-request-size` | `10M` | Max RPC payload |

#### Aria2 Event Hooks
| Event | Script | Purpose |
|:---|:---|:---|
| `on-download-complete` | `/config/script/upload.sh` | Triggers cloud upload on completion |
| `on-download-stop` | `/config/script/delete.sh` | Cleans up on error/removal |
| `on-download-error` | _(undefined, falls back to on-download-stop)_ | Uses delete.sh |
| `on-bt-download-complete` | _(undefined, falls back to on-download-complete)_ | Uses upload.sh |

#### Volume Mounts
| Host Path | Container Path | Mode |
|:---|:---|:---|
| `./aria2` | `/config` | rw |
| `./script` | `/config/script` | rw |
| `/var/run/docker.sock` | `/var/run/docker.sock` | rw |
| `./downloads` | `/downloads` | rw |
| `./cloud-destinations.json` | `/config/cloud-destinations.json` | ro |

---

### 8.2 Nginx — Reverse Proxy

**Role**: SSL termination, HTTP→HTTPS redirect, reverse proxy for all services under a single domain.

| Property | Value |
|:---|:---|
| **Image** | `nginx:alpine` |
| **Container name** | `nginx-proxy` |
| **External ports** | `80:80`, `443:443` |
| **Server name** | `nexly.dpdns.org` |

#### Routing Table (`aria2-nginx.conf`)

| Location | Upstream | Service | Auth |
|:---|:---|:---|:---|
| `/.well-known/acme-challenge/` | `root /var/www/certbot` | Let's Encrypt ACME | None |
| `/` | `root /usr/share/nginx/html` | AriaNg static files | Basic Auth |
| `/download/` | `http://filebrowser:80` | FileBrowser web UI | Basic Auth |
| `/portainer/` | `http://portainer:9000/` | Portainer web UI | Basic Auth |
| `/rclone/` | `http://rclone:5572/` | Rclone web GUI | Basic Auth |
| `/jsonrpc` | `http://aria2-pro:6800/jsonrpc` | Aria2 RPC endpoint | Off (uses RPC secret) |
| `/live/` | `http://nexly-dashboard:3000/` | Nexly Live Dashboard | Basic Auth |
| `/socket.io/` | `http://nexly-dashboard:3000/socket.io/` | WebSocket for Dashboard | Basic Auth |

#### Nginx Features
- **Global Basic Auth**: `auth_basic "Nexly Server"` enforced on all routes (except `/jsonrpc`)
- **SSL**: Cloudflare Origin CA (`certs/aria2.pem` + `certs/aria2.key`), with Let's Encrypt fallback path
- **ACME Challenge**: `/.well-known/acme-challenge/` served from certbot webroot
- **WebSocket support**: `Upgrade` + `Connection: upgrade` headers on all proxy locations
- **HTTP/1.1**: `proxy_http_version 1.1` for keep-alive and WebSocket
- **Real IP forwarding**: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`
- **HTTP→HTTPS redirect**: All port 80 traffic redirected to 443

#### Volume Mounts
| Host Path | Container Path | Mode |
|:---|:---|:---|
| `./aria2-nginx.conf` | `/etc/nginx/conf.d/default.conf` | ro |
| `./ariang` | `/usr/share/nginx/html` | rw |
| `./certs` | `/etc/nginx/certs` | ro |
| `./.htpasswd` | `/etc/nginx/.htpasswd` | ro |
| `certbot-webroot` (volume) | `/var/www/certbot` | ro |
| `certbot-certs` (volume) | `/etc/letsencrypt` | ro |

> **Note**: Basic Auth is globally enforced in the Nginx config with `auth_basic "Nexly Server"`. The `/jsonrpc` endpoint has `auth_basic off` since Aria2 uses its own RPC token authentication.

---

### 8.3 Rclone — Cloud Sync

**Role**: Uploads completed downloads to Microsoft OneDrive Business. Provides a web GUI and RC API for remote control.

| Property | Value |
|:---|:---|
| **Image** | `rclone/rclone` |
| **Container name** | `rclone` |
| **External port** | None (internal only via Docker network) |
| **RC Web GUI** | Enabled |
| **RC Auth** | `${RCLONE_USER}` / `${RCLONE_PASS}` (from `.env`) |
| **Checksum** | Disabled (`RCLONE_IGNORE_CHECKSUM=true`) |

#### Rclone Command
```bash
rcd --rc-web-gui --rc-addr :5572 \
    --rc-user ${RCLONE_USER} --rc-pass ${RCLONE_PASS} \
    --rc-serve --rc-no-auth \
    --timeout 10m --contimeout 10m \
    --drive-chunk-size 128M \
    --transfers 4 \
    --buffer-size 64M \
    --checkers 8 \
    --low-level-retries 10
```

> **Note**: The Rclone port (`5572`) is no longer exposed to the host. It is accessible only within the `aria2-net` Docker network, improving security. Access Rclone via the Nginx reverse proxy at `/rclone/`.

#### Rclone Remote Configuration
| Property | Value |
|:---|:---|
| **Remote name** | `onedrive` |
| **Type** | `onedrive` |
| **Drive type** | `business` |
| **Upload destination** | `onedrive:Aria2Downloads` (as per upload.sh) |
| **Config in script.conf** | `drive-name=onedrive`, `drive-dir=/aria2-downloads` |

#### Key Parameters
| Parameter | Value | Notes |
|:---|:---|:---|
| `--transfers` | `4` | Concurrent upload streams |
| `--drive-chunk-size` | `128M` | OneDrive chunk size (increased from 64M) |
| `--buffer-size` | `64M` | In-memory buffer per transfer |
| `--checkers` | `8` | Concurrent integrity checkers |
| `--timeout` | `10m` | HTTP request timeout |
| `--contimeout` | `10m` | Connection timeout |
| `--low-level-retries` | `10` | Retries on transient failures |
| `--rc-no-auth` | _(flag)_ | No auth for `--rc-serve` file serving |

#### Volume Mounts
| Host Path | Container Path | Mode |
|:---|:---|:---|
| `./rclone` | `/config/rclone` | rw |
| `./downloads` | `/downloads` | rw |

---

### 8.4 FileBrowser — File Manager

**Role**: Web-based file manager to browse, download, upload, and manage files in the downloads directory.

| Property | Value |
|:---|:---|
| **Image** | `filebrowser/filebrowser` |
| **Container name** | `filebrowser` |
| **User** | `${PUID}:${PGID}` (from `.env`) |
| **Base URL** | `/download` |
| **Internal port** | `80` |
| **Default credentials** | `admin` / `${FB_PASS}` (from `.env`) |

#### Settings (`settings.json`)
```json
{
  "port": 80,
  "baseURL": "/download",
  "address": "",
  "log": "stdout",
  "database": "/database/filebrowser.db",
  "root": "/srv"
}
```

#### Volume Mounts
| Host Path | Container Path | Mode |
|:---|:---|:---|
| `./filebrowser.db` | `/database/filebrowser.db` | rw |
| `./settings.json` | `/config/settings.json` | rw |
| `./downloads` | `/srv` | rw |

---

### 8.5 Portainer — Docker Management

**Role**: Web-based Docker management UI for managing containers, images, volumes, and networks.

| Property | Value |
|:---|:---|
| **Image** | `portainer/portainer-ce:lts` |
| **Container name** | `portainer` |
| **Internal ports** | `8000`, `9000`, `9443` |
| **Access URL** | `https://nexly.dpdns.org/portainer/` |
| **Credentials** | Admin user created on first login |

#### Volume Mounts
| Host Path | Container Path | Mode |
|:---|:---|:---|
| `/var/run/docker.sock` | `/var/run/docker.sock` | rw |
| `portainer_data` (named volume) | `/data` | rw |

---

### 8.6 Nexly Dashboard — Real-time Monitor

**Role**: Custom-built real-time monitoring dashboard providing live stats for downloads, uploads, system resources, and service health.

| Property | Value |
|:---|:---|
| **Image** | Custom (FROM `node:18-alpine`) |
| **Container name** | `nexly-dashboard` |
| **Framework** | Express.js + Socket.IO |
| **Internal port** | `3000` |
| **Access URL** | `https://nexly.dpdns.org/live/` |
| **Restart policy** | `unless-stopped` |

#### Package Dependencies
| Package | Version | Purpose |
|:---|:---|:---|
| `express` | ^4.18.2 | HTTP server |
| `socket.io` | ^4.7.2 | Real-time WebSocket |
| `axios` | ^1.6.0 | HTTP client (Aria2/Rclone API calls) |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing |

#### Dashboard Features
1. **System Stats** (polled every 2 seconds):
   - CPU load (from `/host/proc/loadavg`)
   - RAM usage (from `/host/proc/meminfo`)
   - Disk usage (from `df -h`, cached 10 seconds)
   - OS info (from `/host/os-release`)
   - Hostname

2. **Download Monitoring**:
   - Active downloads (name, progress, speed, size)
   - Global download/upload speed
   - BitTorrent tracker count

3. **Upload Monitoring**:
   - Active Rclone transfers (name, progress, speed, size)
   - Real-time upload speed

4. **Service Health**:
   - Aria2 (JSON-RPC ping)
   - Rclone (API version check)
   - FileBrowser (HTTP HEAD)
   - Portainer (HTTP HEAD)

5. **Tracker Management**:
   - Top tracker recommendations (from NewTrackon API)
   - Dead tracker cleanup
   - Auto-enhance downloads with top trackers
   - 5-minute tracker cache duration

6. **Live Log Streaming**:
   - Watches `upload.log` via `fs.watch()`
   - Streams new log entries to connected clients via Socket.IO

#### API Endpoints
| Method | Endpoint | Purpose |
|:---|:---|:---|
| GET | `/api/top-trackers` | Get top 15 recommended trackers |
| POST | `/api/add-trackers` | Add trackers to a specific download |
| POST | `/api/enhance-all` | Add top trackers to all active downloads |
| GET | `/api/tracker-cleanup` | Remove dead trackers from downloads |
| GET | `/api/tracker-health` | Get global tracker health stats |
| GET | `/api/cloud/destinations` | List configured cloud upload destinations |
| POST | `/api/cloud/destinations` | Add a new cloud destination |
| PUT | `/api/cloud/destinations/:id` | Update a cloud destination |
| DELETE | `/api/cloud/destinations/:id` | Delete a cloud destination |
| GET | `/api/cloud/remotes` | List available Rclone remotes |
| POST | `/api/cloud/test` | Test connectivity to a cloud destination |

#### Volume Mounts
| Host Path | Container Path | Mode |
|:---|:---|:---|
| `/proc` | `/host/proc` | ro |
| `./aria2/upload.log` | `/logs/upload.log` | ro |
| `./downloads` | `/data` | ro |
| `/etc/os-release` | `/host/os-release` | ro |
| `./cloud-destinations.json` | `/config/cloud-destinations.json` | rw |

#### Environment Variables
| Variable | Value | Purpose |
|:---|:---|:---|
| `ARIA2_URL` | `http://aria2-pro:6800/jsonrpc` | Aria2 RPC endpoint |
| `ARIA2_SECRET` | `${RPC_SECRET}` (from `.env`) | Aria2 RPC token |
| `RCLONE_URL` | `http://rclone:5572` | Rclone RC endpoint |
| `RCLONE_USER` | `${RCLONE_USER}` (from `.env`) | Rclone RC username |
| `RCLONE_PASS` | `${RCLONE_PASS}` (from `.env`) | Rclone RC password |

---

### 8.7 Certbot — SSL Certificate Auto-Renewal

**Role**: Automated Let's Encrypt SSL certificate issuance and renewal via ACME HTTP-01 challenge.

| Property | Value |
|:---|:---|
| **Image** | `certbot/certbot` |
| **Container name** | `certbot` |
| **Restart policy** | `unless-stopped` |
| **Renewal interval** | Every 12 hours (checks and renews if needed) |
| **ACME method** | Webroot (`/var/www/certbot`) |

#### Entrypoint
```bash
/bin/sh -c 'trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot --quiet; sleep 12h & wait ${!}; done'
```

#### Volume Mounts
| Host Path | Container Path | Mode |
|:---|:---|:---|
| `certbot-webroot` (volume) | `/var/www/certbot` | rw |
| `certbot-certs` (volume) | `/etc/letsencrypt` | rw |

> **Note**: Certbot runs as a sidecar that checks for renewal every 12 hours. Currently, the active SSL certificate is a Cloudflare Origin CA (valid until 2040). Certbot is pre-configured as a migration path to Let's Encrypt if needed.

---

## 9. Automation & Scripts

### 9.1 Upload Script (`script/upload.sh`)

**Trigger**: Called by Aria2 `on-download-complete` event.

**Purpose**: Uploads completed downloads to **all enabled cloud destinations** via Rclone RC API, with locking, validation, retry logic, polling, log rotation, and ANSI code stripping.

**Dependencies**: `curl`, `jq`, `flock`

#### Flow
```
Download Complete
       │
       ▼
  Log Rotation (rotate at 1MB, keep 3 archives)
       │
       ▼
  Acquire File Lock (/config/upload.lock)
  └── Wait up to 2 hours (5s intervals)
       │
       ▼
  Validate Input
  ├── Skip if empty/invalid folder name
  ├── Skip if target doesn't exist
  └── Skip if .aria2 control files present (torrent still downloading)
       │
       ▼
  Wait 15s (file stability)
       │
       ▼
  Load Cloud Destinations
  ├── Read from /config/cloud-destinations.json (enabled only)
  └── Fallback: onedrive:Aria2Downloads
       │
       ▼
  For Each Destination:
  ├── Determine Operation
  │   ├── Directory → `sync/copy`
  │   └── File → `operations/copyfile`
  ├── Start Rclone Job (with backoff retry)
  │   ├── Max 5 start retries
  │   ├── Base delay: 5s, doubles each retry
  │   └── Max delay: 120s
  ├── Poll Job Status (every 2s)
  │   └── Max poll time: 14400s (4 hours)
  └── Full Upload Retry (max 3 attempts per destination)
       │
       ▼
  Cleanup (only if ALL destinations succeeded)
  ├── Delete local files (rm -rf)
  └── Clean .aria2 control files
```

> **Note**: Uses `sync/copy` + `operations/copyfile` (not move) to support multi-cloud. Local files are deleted only after all destinations succeed. If any destination fails, local files are kept.

#### Configuration Constants
| Constant | Value |
|:---|:---|
| `RCLONE_RC_URL` | `http://rclone:5572` |
| `RCLONE_AUTH` | `admin:654550` |
| `CLOUD_DEST_FILE` | `/config/cloud-destinations.json` |
| `FALLBACK_DEST` | `onedrive:Aria2Downloads` |
| `LOG_FILE` | `/config/upload.log` |
| `LOCK_FILE` | `/config/upload.lock` |
| `LOG_MAX_BYTES` | `1048576` (1 MB — triggers log rotation) |
| `STABILITY_WAIT` | `15` seconds |
| `POLL_INTERVAL` | `2` seconds |
| `MAX_POLL_TIME` | `14400` seconds (4 hours) |
| `MAX_START_RETRIES` | `5` |
| `BASE_DELAY` | `5` seconds |
| `MAX_DELAY` | `120` seconds |
| `MAX_UPLOAD_RETRIES` | `3` (full upload retry per destination) |

#### Log Rotation
The upload script includes built-in log rotation:
- Rotates when `upload.log` exceeds 1 MB
- Keeps 3 archived files: `upload.log.1`, `upload.log.2`, `upload.log.3`
- ANSI escape codes are stripped from all log entries

#### Multi-Cloud Destinations
The script reads enabled destinations from `cloud-destinations.json`:
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
    }
  ]
}
```
Destinations can be managed via the Nexly Dashboard UI (☁️ CLOUD button) or by editing the JSON file directly.

---

### 9.2 Delete Script (`script/delete.sh`)

**Trigger**: Called by Aria2 `on-download-stop` event (error or task removal).

**Purpose**: Cleans up files when downloads fail or are manually removed.

**Actions**:
1. Check Aria2 RPC for task status
2. Delete files if status is `error` (with `delete-on-error=true`) or `removed` (with `delete-on-removed=true`)
3. Delete orphaned `.torrent` files
4. Delete empty directories
5. Handle force-removed tasks (unknown status) via `delete-on-unknown`

---

### 9.3 Clean Script (`script/clean.sh`)

**Trigger**: Can be called manually or integrated into the pipeline.

**Purpose**: Removes redundant files after download completion:
- `.aria2` control files
- `.torrent` files (normal/enhanced mode)
- Excluded file types (by extension or regex)
- Files smaller than minimum size
- Empty directories

---

### 9.4 Tracker Script (`script/tracker.sh`)

**Trigger**: Called by cron job every 6 hours.

**Purpose**: Fetches latest BitTorrent trackers from public tracker lists and updates Aria2 configuration.

**Tracker Sources** (fallback chain):
1. `https://trackerslist.com/all_aria2.txt`
2. `https://cdn.statically.io/gh/XIU2/TrackersListCollection/master/all_aria2.txt`
3. `https://trackers.p3terx.com/all_aria2.txt`

**Modes**:
- Default: Update `aria2.conf` file
- `RPC`: Update via JSON-RPC (remote)
- `cat`: Print trackers only

---

### 9.5 Core Library (`script/core`)

**Purpose**: Shared bash functions used by `delete.sh`, `clean.sh`, and `upload.sh`.

**Key Functions**:
| Function | Purpose |
|:---|:---|
| `CHECK_PARAMETER` | Validate script was called with Aria2 parameters |
| `CHECK_FILE_NUM` | Skip if file count is zero (magnet link resolution) |
| `CHECK_SCRIPT_CONF` | Load script.conf settings |
| `LOAD_SCRIPT_CONF` | Parse configuration key-value pairs |
| `READ_ARIA2_CONF` | Read Aria2 config for RPC settings |
| `RPC_TASK_INFO` | Query Aria2 for task details |
| `GET_TASK_INFO` | Get full task information via RPC |
| `GET_DOWNLOAD_DIR` | Extract download directory from task info |
| `GET_TASK_STATUS` | Get current task status |
| `CONVERSION_PATH` | Convert file paths between absolute and relative |
| `DELETE_DOT_ARIA2` | Remove .aria2 control files |
| `DELETE_DOT_TORRENT` | Remove .torrent files (normal/enhanced) |
| `DELETE_EMPTY_DIR` | Remove empty directories |
| `DELETE_EXCLUDE_FILE` | Remove excluded files by size/type |
| `CLEAN_UP` | Run all cleanup functions |

---

### 9.6 Script Configuration (`script.conf`)

| Setting | Value | Purpose |
|:---|:---|:---|
| `drive-name` | `onedrive` | Rclone remote name |
| `drive-dir` | `/aria2-downloads` | Cloud upload target directory |
| `upload-log` | `/config/upload.log` | Upload log path |
| `dest-dir` | `/downloads/completed` | Local move target (unused by upload.sh) |
| `delete-on-removed` | `true` | Delete files when task is removed |
| `delete-on-error` | `true` | Delete files on download error |
| `delete-on-unknown` | `true` | Delete files on unknown task status |
| `delete-dot-aria2` | `true` | Clean up .aria2 control files |
| `delete-dot-torrent` | `true` | Clean up .torrent files |
| `delete-empty-dir` | `true` | Clean up empty directories |

---

### 9.7 Backup Script (`script/backup.sh`)

**Trigger**: Called by cron job inside Aria2 container daily at 3 AM.

**Purpose**: Backs up critical configuration files to OneDrive via Rclone RC API.

**Files Backed Up**:
- `aria2.conf`
- `script.conf`
- `upload.sh`
- `delete.sh`
- `clean.sh`
- `tracker.sh`

**Backup Destination**: `onedrive:Aria2Backups/<YYYYMMDD>/`

#### Flow
```
1. Create temp directory /tmp/aria2-backup
2. Copy config files (skip large/binary/sensitive tokens)
3. Upload via Rclone RC API (sync/copy)
4. Clean up temp directory
```

> **Note**: The backup script skips the Rclone OAuth token (`rclone.conf`) and large binary files. Backups are organized by date in the `Aria2Backups` folder on OneDrive.

---

### 9.8 Health Check Script (`check.sh`)

**Purpose**: Comprehensive CLI system health dashboard. Run manually via SSH.

**Sections**:
1. 📡 **BitTorrent Trackers** — Count and status from `aria2.conf`
2. 💾 **Disk Storage** — Usage bar chart for root partition
3. 🐳 **Container Status** — Docker container states and uptime
4. ☁️ **Transfer Queue** — Rclone active transfers, speed, local file count
5. 💎 **OneDrive Capacity** — Total/Used/Free via `rclone about`
6. 📜 **Recent Activity** — Last 3 lines of upload log

---

## 10. Data Flow & Pipeline

### Complete Download-to-Cloud Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   User adds     │     │   Aria2 Pro      │     │   Local Disk      │
│   download via  │────►│   downloads      │────►│   /downloads/     │
│   AriaNg UI     │     │   file/torrent   │     │   <filename>      │
└─────────────────┘     └──────────────────┘     └───────┬───────────┘
                                                          │
                                                          │ on-download-complete
                                                          ▼
                                                 ┌───────────────────┐
                                                 │   upload.sh       │
                                                 │   (validates,     │
                                                 │    locks, waits)  │
                                                 │   reads cloud-    │
                                                 │   destinations    │
                                                 └───────┬───────────┘
                                                          │
                                                          │ For each enabled destination:
                                                          │ Rclone RC API
                                                          ▼
                                              ┌──────────────────────┐
                                              │   Rclone             │
                                              │   sync/copy (dirs)   │
                                              │   or operations/     │
                                              │   copyfile (files)   │
                                              └───────┬──────────────┘
                                                      │
                              ┌────────────────────────┼────────────────────────┐
                              │                        │                        │
                              ▼                        ▼                        ▼
                    ┌──────────────┐          ┌──────────────┐        ┌──────────────┐
                    │  OneDrive    │          │ Google Drive  │        │  Dropbox     │
                    │  Business    │          │  (if enabled) │        │ (if enabled) │
                    └──────────────┘          └──────────────┘        └──────────────┘
                                                      │
                                                      │ All destinations succeeded?
                                                      ▼
                                              ┌───────────────────┐
                                              │   Local file      │
                                              │   DELETED after   │
                                              │   ALL uploads OK  │
                                              └───────────────────┘
```

### Key Data Flow Notes
1. **Downloads land in** → `/downloads/` (shared volume between Aria2, Rclone, FileBrowser)
2. **Upload uses `sync/copy`** (directories) or **`operations/copyfile`** (single files) — **files are copied** to support multi-cloud
3. **After all destinations succeed** → local files are deleted (`rm -rf`)
4. **If any destination fails** → local files are **kept** for retry
5. **On download error** → `delete.sh` removes partial files
6. **Torrent multi-file downloads** → upload waits until all `.aria2` control files disappear
7. **File lock** → Only one upload process runs at a time (`/config/upload.lock`)
8. **Cloud destinations** → Configured in `cloud-destinations.json`, manageable via Dashboard UI

---

## 11. Authentication & Security

### Service Credentials

| Service | Username | Password/Secret | Auth Method |
|:---|:---|:---|:---|
| **Aria2 RPC** | _(none)_ | `${RPC_SECRET}` (from `.env`) | Token-based (`token:<secret>`) |
| **AriaNg** | _(none)_ | _(uses Aria2 RPC secret)_ | RPC Secret in UI settings |
| **FileBrowser** | `admin` | `${FB_PASS}` (from `.env`) | Built-in auth (session-based) |
| **Rclone Web GUI** | `${RCLONE_USER}` | `${RCLONE_PASS}` (from `.env`) | HTTP Basic Auth |
| **Portainer** | _(admin set on first login)_ | _(user-defined)_ | Built-in auth |
| **Nginx (htpasswd)** | `admin` | _(hashed: apr1)_ | HTTP Basic Auth (**enforced globally**) |

> All secrets are centralized in the `.env` file (not committed to VCS). See `.env.example` for the template.

### SSH Access

| Property | Value |
|:---|:---|
| **SSH command** | `ssh -i ~/.ssh/ssh-key-2025-12-18.key ubuntu@152.67.89.254` |
| **Key file** | `~/.ssh/ssh-key-2025-12-18.key` |
| **User** | `ubuntu` |
| **Port** | `22` (default) |
| **Key type** | SSH key pair (Oracle Cloud generated) |
| **Password auth** | Disabled (key-only) |

### Security Considerations

| Area | Status | Notes |
|:---|:---|:---|
| SSH key-only auth | ✅ Enabled | Password authentication disabled |
| Cloudflare proxy | ✅ Enabled | Hides origin IP, DDoS protection |
| SSL/TLS | ✅ Enabled | Cloudflare Origin CA (valid until 2040) |
| Firewall (iptables) | ✅ Configured | Ports 80, 443, 8080 only |
| Oracle Security Lists | ✅ Configured | VCN-level firewall |
| Nginx Basic Auth | ✅ Enforced | Global `auth_basic` on all routes (except `/jsonrpc`) |
| Rclone port restricted | ✅ Fixed | Port `5572` no longer exposed to host |
| Centralized secrets | ✅ Implemented | `.env` file, `.gitignore`d |
| Health checks | ✅ Enabled | All containers have Docker health checks |
| UFW | ❌ Not active | Not installed/configured |
| Rclone RC no-auth | ⚠️ Warning | `--rc-no-auth` flag for file serving |
| Docker socket exposure | ⚠️ Warning | Mounted in Aria2 and Portainer containers |
| Shared password | ⚠️ Warning | Same default password used across services in `.env` |

### Security Recommendations

1. **Rotate the shared password** in `.env` — use unique passwords per service
2. **Remove `--rc-no-auth`** from Rclone if not needed
3. **Enable UFW** or clean up duplicate iptables rules
4. **Restrict Docker socket** access — consider using a Docker socket proxy
5. **Use strong htpasswd password** — regenerate with `htpasswd -B`

---

## 12. Monitoring & Health Checks

### Built-in Monitoring

| Tool | Type | Access |
|:---|:---|:---|
| **Nexly Dashboard** | Web UI (real-time) | `https://nexly.dpdns.org/live/` |
| **check.sh** | CLI (manual SSH) | `bash ~/aria2-config/check.sh` |
| **upload.log** | Log file | `~/aria2-config/aria2/upload.log` |
| **tracker.log** | Log file | `~/aria2-config/aria2/tracker.log` |
| **auto_reboot.log** | Log file | `~/aria2-config/auto_reboot.log` |
| **Portainer** | Web UI | `https://nexly.dpdns.org/portainer/` |

### Health Check Flow (Dashboard — every 2 seconds)

```
┌────────────────────────────────────────────────────────┐
│                  fetchStats() — 2s interval            │
│                                                        │
│  1. Aria2 getGlobalStat → network speed                │
│  2. Aria2 tellActive → active download list            │
│  3. Aria2 getGlobalOption → tracker count              │
│  4. Rclone core/stats → upload transfers & speed       │
│  5. getSystemStats() → CPU, RAM, Disk, OS              │
│  6. checkServiceHealth() → ping all 4 services         │
│                                                        │
│  Emit via Socket.IO → connected browsers               │
└────────────────────────────────────────────────────────┘
```

### Service Health Checks (Dashboard)

| Service | Method | Timeout |
|:---|:---|:---|
| Aria2 | `aria2.getVersion` JSON-RPC | 1000ms |
| Rclone | `core/version` POST | 1000ms |
| FileBrowser | HTTP HEAD | 1000ms |
| Portainer | HTTP HEAD | 1000ms |

### System Metrics Collection

| Metric | Source | Cache |
|:---|:---|:---|
| CPU load | `/host/proc/loadavg` | Real-time |
| RAM usage | `/host/proc/meminfo` | Real-time |
| Disk usage | `df -h /logs` | 10-second cache |
| OS info | `/host/os-release` | Cached permanently |
| CPU model | `/host/proc/cpuinfo` | Cached permanently |
| Hostname | `/host/etc/hostname` | Cached permanently |

---

## 13. Backup & Disaster Recovery

### Current Backup State

| Item | Backed Up? | Location |
|:---|:---|:---|
| Docker Compose + configs | ✅ | Local dev machine (`~/Desktop/oracle server/`) |
| Rclone OAuth token | ⚠️ | Only in container volume (`./rclone/rclone.conf`) |
| Aria2 config | ✅ | `./aria2/aria2.conf` |
| FileBrowser database | ⚠️ | Only on server (`./filebrowser.db`) |
| SSL certificates | ✅ | `./certs/` |
| Upload scripts | ✅ | `./script/` |
| Portainer data | ❌ | Named volume only |
| Downloads | ➡️ | Uploaded to OneDrive, then deleted locally |
| Upload history | ✅ | `./aria2/upload.log` (48 KB) |

### Backup Directory
```
.backups/
└── upload-sh-cleanup-20260204/
    └── (backup of upload.sh before Feb 4, 2026 cleanup)
```

### Disaster Recovery Procedure

1. **Provision new Oracle VM** (same shape: VM.Standard.E2.1.Micro)
2. **Clone project** from local dev machine to server:
   ```bash
   scp -r "~/Desktop/oracle server/" ubuntu@<NEW_IP>:~/aria2-config/
   ```
3. **Configure swap** (2 GB):
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
4. **Install Docker** and Docker Compose
5. **Configure iptables** for ports 80, 443
6. **Configure Oracle Security Lists** for ingress 80, 443
7. **Update DNS** in Cloudflare → point to new IP
8. **Re-authorize Rclone** for OneDrive (if token expired):
   ```bash
   docker exec -it rclone rclone config reconnect onedrive:
   ```
9. **Deploy stack**:
   ```bash
   cd ~/aria2-config && docker compose up -d --build
   ```
10. **Restore crontab**:
    ```bash
    crontab -e
    # Add reboot job and tracker update job
    ```
11. **Verify all services** via `bash check.sh`

---

## 14. Cron Jobs & Scheduled Tasks

### User Crontab (`ubuntu`)

| Schedule | Command | Purpose |
|:---|:---|:---|
| `@reboot` | `sleep 30 && sudo chmod 666 /var/run/docker.sock && sudo chmod -R 755 ~/aria2-config/rclone && sudo chmod 664 ~/aria2-config/rclone/rclone.conf` | Post-boot: fix Docker socket and Rclone config permissions |

> **Note**: The `docker-cli` installation and tracker update cron job are no longer needed in the host crontab — they are now baked into `Dockerfile.aria2`.

### Container-Internal Cron (Aria2 Container)

| Schedule | Command | Purpose |
|:---|:---|:---|
| `0 4 * * *` | `/config/script/tracker.sh /config/aria2.conf RPC >> /config/tracker.log 2>&1` | Update BitTorrent trackers daily at 4 AM |
| `0 3 * * *` | `/config/script/backup.sh >> /config/backup.log 2>&1` | Backup config files to OneDrive daily at 3 AM |

> These cron jobs run inside the Aria2 container via Alpine's `crond`, started by the custom `CMD` in `Dockerfile.aria2`.

### Systemd Timers (OS-level)

| Timer | Service | Schedule | Purpose |
|:---|:---|:---|:---|
| `certbot.timer` | `certbot.service` | ~Daily | _(Legacy)_ Let's Encrypt renewal — not used with Cloudflare Origin CA |
| `apt-daily.timer` | `apt-daily.service` | Daily | Package list update |
| `apt-daily-upgrade.timer` | `apt-daily-upgrade.service` | Daily | Automatic security updates |
| `fwupd-refresh.timer` | `fwupd-refresh.service` | ~Hourly | Firmware update check |
| `fstrim.timer` | `fstrim.service` | Weekly | SSD TRIM |
| `dpkg-db-backup.timer` | `dpkg-db-backup.service` | Daily | dpkg database backup |
| `systemd-tmpfiles-clean.timer` | `systemd-tmpfiles-clean.service` | Daily | Temp file cleanup |
| `e2scrub_all.timer` | `e2scrub_all.service` | Weekly | Filesystem scrub |

---

## 15. Configuration Files Inventory

| File | Location (Server) | Purpose | Size |
|:---|:---|:---|:---|
| `.env` | `~/aria2-config/` | Centralized secrets (not committed) | 463 B |
| `.env.example` | `~/aria2-config/` | Environment template | 250 B |
| `.gitignore` | `~/aria2-config/` | VCS exclusion rules | 347 B |
| `docker-compose.yml` | `~/aria2-config/` | Docker stack definition (7 services) | 4,396 B |
| `Dockerfile.aria2` | `~/aria2-config/` | Aria2 custom image (+ cron) | 377 B |
| `aria2-nginx.conf` | `~/aria2-config/` | Nginx reverse proxy config | 3,431 B |
| `cloud-destinations.json` | `~/aria2-config/` | Multi-cloud upload destinations | 206 B |
| `aria2.conf` | `~/aria2-config/aria2/` | Aria2 main configuration | 18,506 B (411 lines) |
| `aria2.session` | `~/aria2-config/aria2/` | Aria2 session (active downloads) | Dynamic |
| `script.conf` | `~/aria2-config/` | Script behavior settings | 2,645 B |
| `settings.json` | `~/aria2-config/` | FileBrowser settings | 139 B |
| `rclone.conf` | `~/aria2-config/rclone/` | Rclone remote configuration | 4,382 B |
| `.htpasswd` | `~/aria2-config/` | Nginx Basic Auth credentials | 44 B |
| `upload.sh` | `~/aria2-config/script/` | Multi-cloud upload automation | 8,016 B |
| `backup.sh` | `~/aria2-config/script/` | Config backup to OneDrive | 1,336 B |
| `delete.sh` | `~/aria2-config/script/` | File deletion script | 3,602 B |
| `clean.sh` | `~/aria2-config/script/` | Redundant file cleanup | 1,623 B |
| `tracker.sh` | `~/aria2-config/script/` | BT tracker updater | 5,508 B |
| `core` | `~/aria2-config/script/` | Shared script functions | 9,845 B |
| `rclone.env` | `~/aria2-config/script/` | Rclone environment (empty) | 1 B |
| `check.sh` | `~/aria2-config/` | System health check CLI | 7,368 B |
| `LICENSE` | `~/aria2-config/` | MIT license | 1,066 B |
| `README.md` | `~/aria2-config/` | Project documentation | 2,939 B |
| `filebrowser.db` | `~/aria2-config/` | FileBrowser SQLite database | 65,536 B |
| `upload.log` | `~/aria2-config/aria2/` | Upload activity log (auto-rotated) | ~48 KB |
| `tracker.log` | `~/aria2-config/aria2/` | Tracker update log | ~6 KB |
| `dht.dat` | `~/aria2-config/aria2/` | DHT routing table (IPv4) | 10,528 B |
| `dht6.dat` | `~/aria2-config/aria2/` | DHT routing table (IPv6) | 8,064 B |
| `upload.lock` | `~/aria2-config/aria2/` | Upload mutex lock file | 0 B |

---

## 16. Environment Variables

> All variables below are defined in the `.env` file (see `.env.example` for template). Values shown are defaults.

### Aria2 Pro Container
| Variable | Value | Purpose |
|:---|:---|:---|
| `RPC_SECRET` | `${RPC_SECRET}` | Aria2 RPC authentication |
| `PUID` | `${PUID}` (default: `1001`) | Process user ID |
| `PGID` | `${PGID}` (default: `1001`) | Process group ID |
| `TZ` | `${TZ}` (default: `Asia/Kolkata`) | Timezone (IST, UTC+5:30) |

### Rclone Container
| Variable | Value | Purpose |
|:---|:---|:---|
| `RCLONE_IGNORE_CHECKSUM` | `true` | Skip checksum verification |
| `RCLONE_CHECKSUM` | `false` | Disable checksum |

### FileBrowser Container
| Variable | Value | Purpose |
|:---|:---|:---|
| `FB_BASEURL` | `/download` | URL base path |

### Nexly Dashboard Container
| Variable | Value | Purpose |
|:---|:---|:---|
| `ARIA2_URL` | `http://aria2-pro:6800/jsonrpc` | Aria2 RPC endpoint |
| `ARIA2_SECRET` | `${RPC_SECRET}` | Aria2 RPC token |
| `RCLONE_URL` | `http://rclone:5572` | Rclone RC endpoint |
| `RCLONE_USER` | `${RCLONE_USER}` | Rclone RC username |
| `RCLONE_PASS` | `${RCLONE_PASS}` | Rclone RC password |

### `.env` File Reference
| Variable | Default | Used By |
|:---|:---|:---|
| `RPC_SECRET` | `changeme` | Aria2, Dashboard |
| `RCLONE_USER` | `admin` | Rclone, Dashboard |
| `RCLONE_PASS` | `changeme` | Rclone, Dashboard |
| `FB_USER` | `admin` | FileBrowser |
| `FB_PASS` | `changeme` | FileBrowser |
| `TZ` | `Asia/Kolkata` | Aria2 |
| `PUID` | `1001` | Aria2, FileBrowser |
| `PGID` | `1001` | Aria2, FileBrowser |
| `DOMAIN` | `nexly.dpdns.org` | Reference (used by Nginx/Certbot) |

---

## 17. Port Mapping

### Host → Container Port Mappings

| Host Port | Container | Container Port | Protocol | Purpose |
|:---|:---|:---|:---|:---|
| `80` | `nginx-proxy` | `80` | TCP | HTTP (→ HTTPS redirect) |
| `443` | `nginx-proxy` | `443` | TCP | HTTPS |

### Internal-Only Ports (Not Exposed to Host)

| Container | Port | Protocol | Purpose |
|:---|:---|:---|:---|
| `aria2-pro` | `6800` | TCP | Aria2 JSON-RPC |
| `aria2-pro` | `6888` | TCP+UDP | BitTorrent listen |
| `rclone` | `5572` | TCP | Rclone RC API + Web GUI |
| `filebrowser` | `80` | TCP | FileBrowser web UI |
| `portainer` | `9000` | TCP | Portainer web UI |
| `portainer` | `8000` | TCP | Portainer Edge Agent |
| `portainer` | `9443` | TCP | Portainer HTTPS |
| `nexly-dashboard` | `3000` | TCP | Dashboard web UI |

---

## 18. Volume Mounts & Data Persistence

### Shared Volumes (Multiple Containers)

| Host Path | Containers | Purpose |
|:---|:---|:---|
| `./downloads` | Aria2, Rclone, FileBrowser, Dashboard | Download storage |
| `./aria2` | Aria2 | Aria2 config + runtime data |
| `./rclone` | Rclone | Rclone config + OAuth tokens |
| `./cloud-destinations.json` | Aria2, Dashboard | Multi-cloud upload destinations |
| `/var/run/docker.sock` | Aria2, Portainer | Docker daemon access |
| `certbot-webroot` (named) | Nginx, Certbot | ACME challenge files |
| `certbot-certs` (named) | Nginx, Certbot | Let's Encrypt certificates |

### Data Persistence Matrix

| Data Type | Persisted? | Method | Notes |
|:---|:---|:---|:---|
| Downloaded files | ⏳ Temporary | Host bind mount | Copied to cloud destinations, then deleted |
| Aria2 configuration | ✅ Yes | Host bind mount | `./aria2/` |
| Aria2 session | ✅ Yes | Host bind mount | `aria2.session` |
| DHT routing tables | ✅ Yes | Host bind mount | `dht.dat`, `dht6.dat` |
| Upload log | ✅ Yes | Host bind mount | `upload.log` (auto-rotated at 1 MB) |
| Rclone config/token | ✅ Yes | Host bind mount | `./rclone/rclone.conf` |
| FileBrowser DB | ✅ Yes | Host bind mount | `filebrowser.db` |
| Portainer data | ✅ Yes | Named volume | `portainer_data` |
| Nginx config | ✅ Yes | Host bind mount (ro) | `aria2-nginx.conf` |
| SSL certs | ✅ Yes | Host bind mount (ro) | `./certs/` |
| AriaNg static files | ✅ Yes | Host bind mount | `./ariang/` |
| Cloud destinations | ✅ Yes | Host bind mount | `cloud-destinations.json` |
| Certbot certificates | ✅ Yes | Named volume | `certbot-certs` |

---

## 19. Performance Tuning

### Current Optimization Settings

| Component | Setting | Value | Rationale |
|:---|:---|:---|:---|
| **Aria2** | `disk-cache` | `64M` | Reduce disk I/O on limited RAM |
| **Aria2** | `file-allocation` | `falloc` | Fast preallocation |
| **Aria2** | `no-file-allocation-limit` | `64M` | Skip prealloc for small files |
| **Aria2** | `max-concurrent-downloads` | `5` | Balance with 1 GB RAM |
| **Aria2** | `split` | `64` | Aggressive segmentation |
| **Aria2** | `max-connection-per-server` | `32` | Maximize single-source speed |
| **Aria2** | `seed-time` | `0` | No seeding (save bandwidth/disk) |
| **Rclone** | `--transfers` | `4` | Concurrent upload streams |
| **Rclone** | `--drive-chunk-size` | `128M` | Optimal for OneDrive Business |
| **Rclone** | `--buffer-size` | `64M` | In-memory buffer per transfer |
| **Rclone** | `--checkers` | `8` | Concurrent integrity checkers |
| **Rclone** | `--low-level-retries` | `10` | Handle transient API failures |
| **Rclone** | `--timeout` | `10m` | Allow large file uploads |
| **Upload.sh** | `MAX_POLL_TIME` | `14400s` (4h) | Increased from 1h for large files |
| **Upload.sh** | `MAX_UPLOAD_RETRIES` | `3` | Full retry per destination |
| **Upload.sh** | `LOG_MAX_BYTES` | `1MB` | Auto-rotate logs |
| **Dashboard** | Poll interval | `2000ms` | Reduce CPU overhead vs 1s |
| **Dashboard** | Disk cache | `10s` | Throttle `df` calls |
| **Dashboard** | Tracker cache | `5min` | Cache NewTrackon API results |
| **Dashboard** | Static info cache | Permanent | Cache CPU/OS/hostname |

### Memory Budget (1 GB Total)

| Component | Estimated Usage |
|:---|:---|
| OS + kernel | ~200 MB |
| Aria2 Pro (+ disk cache) | ~150-200 MB |
| Rclone (idle) | ~30-50 MB |
| Rclone (uploading) | ~200-350 MB (128M chunks, 4 transfers, 64M buffer) |
| Nginx | ~10-15 MB |
| FileBrowser | ~15-20 MB |
| Portainer | ~50-80 MB |
| Certbot | ~5-10 MB |
| Nexly Dashboard (Node.js) | ~40-60 MB |
| **Total (idle)** | **~500-650 MB** |
| **Total (active upload + download)** | **~800-1000 MB** |
| **Swap available** | **2 GB** |

---

## 20. Known Issues & Limitations

### Active Issues

| # | Issue | Severity | Description |
|:--|:---|:---|:---|
| 1 | ~~Missing update_trackers.sh~~ | Resolved | Tracker updates now handled by container-internal cron in Dockerfile.aria2 |
| 2 | ~~Upload timeout on large files~~ | Resolved | MAX_POLL_TIME increased to 14400s (4h) with full retry logic |
| 3 | Duplicate iptables rules | Low | Multiple identical ACCEPT rules for ports 80/443 |
| 4 | Shared password in .env | Medium | Same default password used across services (centralized in .env) |
| 5 | ~~ANSI escape codes in log~~ | Resolved | upload.sh now strips ANSI codes via sed before writing to log |
| 6 | DHT6 disabled | Low | IPv6 DHT is disabled, limits IPv6 torrent connectivity |
| 7 | ~~No Nginx Basic Auth enforced~~ | Resolved | Global auth_basic now enforced on all routes |
| 8 | ~~Rclone port 5572 exposed~~ | Resolved | Port removed from docker-compose.yml, internal only |
| 9 | ~~Legacy certbot timer~~ | Resolved | Certbot container now actively manages Let's Encrypt certificates |
| 10 | ~~Reboot cron installs docker-cli~~ | Resolved | Removed from host crontab, baked into Dockerfile.aria2 |
| 11 | Rclone --rc-no-auth | Low | File serving endpoint has no auth; mitigated by internal-only network |
| 12 | Increased memory from Rclone tuning | Low | 128M chunks, 4 transfers, 64M buffer may push memory higher; swap covers it |

### Limitations

| Limitation | Impact | Mitigation |
|:---|:---|:---|
| 1 GB RAM | Can't run many concurrent operations | 2 GB swap configured |
| 1 OCPU | CPU-bound operations are slow | Low priority workloads |
| ~46.5 GB disk | Limited local storage | Auto-upload + delete pipeline |
| Oracle Free Tier | Instance may be reclaimed if idle | Keep services running |
| No IPv6 | Some torrent peers unreachable | enable-dht6=false |
| No redundancy | Single VM, no HA | Manual DR procedure; daily config backups to OneDrive |
| OneDrive token expiry | Rclone OAuth tokens expire | Manual re-auth required |

---

## 21. Maintenance Procedures

### Routine Maintenance (Weekly)

1. **Check disk usage**:
   ```bash
   ssh -i ~/.ssh/ssh-key-2025-12-18.key ubuntu@152.67.89.254
   bash ~/aria2-config/check.sh
   ```

2. **Check container health**:
   ```bash
   docker ps
   docker stats --no-stream
   ```

3. **Review upload log**:
   ```bash
   tail -50 ~/aria2-config/aria2/upload.log
   ```

4. **Check for stuck downloads**:
   ```bash
   ls -la ~/aria2-config/downloads/
   ```

### Container Management

| Action | Command |
|:---|:---|
| Start all services | `cd ~/aria2-config && docker compose up -d` |
| Stop all services | `cd ~/aria2-config && docker compose down` |
| Restart a service | `docker compose restart <service>` |
| Rebuild custom images | `docker compose up -d --build` |
| View logs | `docker logs -f <container_name>` |
| Prune unused images | `docker image prune -f` |
| Prune everything | `docker system prune -af` |

### Updating Docker Images

```bash
cd ~/aria2-config

# Pull latest images
docker compose pull

# Rebuild custom images
docker compose up -d --build

# Remove old images
docker image prune -f
```

### Rclone Token Refresh

OneDrive OAuth tokens expire periodically. If uploads fail with auth errors:

```bash
# Method 1: Interactive (requires browser)
docker exec -it rclone rclone config reconnect onedrive:

# Method 2: Copy token from another machine
# Edit rclone.conf directly with new token
nano ~/aria2-config/rclone/rclone.conf
docker restart rclone
```

### Aria2 Tracker Update (Manual)

```bash
docker exec -it aria2-pro bash /config/script/tracker.sh /config/aria2.conf RPC
```

---

## 22. Deployment Guide

### Prerequisites

- Oracle Cloud account with Always Free tier VM
- SSH key pair
- Domain name with Cloudflare DNS
- OneDrive Business account

### Fresh Deployment Steps

```bash
# 1. SSH into the new instance
ssh -i ~/.ssh/ssh-key-2025-12-18.key ubuntu@<SERVER_IP>

# 2. Update system
sudo apt update && sudo apt upgrade -y

# 3. Install Docker
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu
# Log out and back in for group changes

# 4. Create swap (essential for 1GB RAM)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 5. Configure firewall (iptables)
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# 6. Clone project files to server
# (From local machine)
scp -i ~/.ssh/ssh-key-2025-12-18.key -r "~/Desktop/oracle server/" ubuntu@<SERVER_IP>:~/aria2-config/

# 7. Set permissions
sudo chmod 666 /var/run/docker.sock
sudo chmod -R 755 ~/aria2-config/rclone
sudo chmod 664 ~/aria2-config/rclone/rclone.conf

# 8. Configure Rclone for OneDrive
docker run --rm -it -v ~/aria2-config/rclone:/config/rclone rclone/rclone config

# 9. Deploy the stack
cd ~/aria2-config
docker compose up -d --build

# 10. Configure Cloudflare
# - Add A record: nexly.dpdns.org → <SERVER_IP>
# - Set SSL mode: Full (Strict)
# - Upload Origin CA cert to certs/ directory

# 11. Set up crontab
crontab -e
# Add:
# @reboot sleep 30 && sudo chmod 666 /var/run/docker.sock && ...
# 0 */6 * * * /home/ubuntu/update_trackers.sh

# 12. Verify
bash ~/aria2-config/check.sh
curl -I https://nexly.dpdns.org
```

### Post-Deployment Verification Checklist

- [ ] All 6 containers are running (`docker ps`)
- [ ] AriaNg loads at `https://nexly.dpdns.org/`
- [ ] FileBrowser loads at `https://nexly.dpdns.org/download/`
- [ ] Portainer loads at `https://nexly.dpdns.org/portainer/`
- [ ] Rclone GUI loads at `https://nexly.dpdns.org/rclone/`
- [ ] Nexly Dashboard loads at `https://nexly.dpdns.org/live/`
- [ ] Aria2 RPC responds (test via AriaNg)
- [ ] Test download completes and auto-uploads to OneDrive
- [ ] `check.sh` shows all systems green
- [ ] Upload log is being written
- [ ] Tracker cron job works

---

## 23. Troubleshooting Runbook

### Container Won't Start

```bash
# Check logs
docker logs <container_name>

# Check if port is in use
sudo ss -tlnp | grep <port>

# Rebuild
docker compose up -d --build <service_name>
```

### Downloads Not Starting

```bash
# Check Aria2 is running
docker exec aria2-pro aria2c --version

# Check RPC connectivity
curl -s http://localhost:6800/jsonrpc -d '{"jsonrpc":"2.0","method":"aria2.getVersion","id":"1","params":["token:654550"]}'

# Check config
docker exec aria2-pro cat /config/aria2.conf | grep -E '^(dir|rpc-|max-)'
```

### Uploads Failing

```bash
# Check upload log
tail -50 ~/aria2-config/aria2/upload.log

# Check Rclone health
docker exec rclone rclone about onedrive: --config=/config/rclone/rclone.conf

# Test Rclone manually
docker exec rclone rclone ls onedrive:Aria2Downloads --config=/config/rclone/rclone.conf

# Check lock file (stuck lock)
ls -la ~/aria2-config/aria2/upload.lock
# If stuck, restart aria2-pro container
docker restart aria2-pro
```

### OneDrive Auth Expired

```bash
# Check error
docker exec rclone rclone about onedrive: --config=/config/rclone/rclone.conf 2>&1

# Re-authenticate
docker exec -it rclone rclone config reconnect onedrive: --config=/config/rclone/rclone.conf
```

### High Memory / OOM

```bash
# Check memory usage
free -h
docker stats --no-stream

# Check if swap is active
swapon --show

# Restart memory-heavy containers
docker restart rclone nexly-dashboard

# Emergency: stop non-essential services
docker stop portainer nexly-dashboard
```

### SSL Certificate Issues

```bash
# Check certificate
openssl x509 -in ~/aria2-config/certs/aria2.pem -noout -subject -dates

# Check Cloudflare SSL mode matches (must be Full/Strict for Origin CA)
# Check Nginx config
docker exec nginx-proxy nginx -t
docker logs nginx-proxy
```

### Disk Full

```bash
# Check disk
df -h /

# Find large files
du -h ~/aria2-config/downloads/ | sort -rh | head -20

# Manual cleanup
rm -rf ~/aria2-config/downloads/<stuck_file>

# Docker cleanup
docker system prune -af
```

### Dashboard Not Loading

```bash
# Check container
docker logs nexly-dashboard

# Check Socket.IO connection
curl -s http://localhost:3000/ | head -5

# Rebuild dashboard
cd ~/aria2-config && docker compose up -d --build dashboard
```

---

## 24. Future Roadmap

### Recommended Improvements

| Priority | Item | Description |
|:---|:---|:---|
| Medium | Unique passwords | Use different passwords per service in .env |
| Medium | Add Telegram/Discord notifications | Alert on upload success/failure |
| Medium | Auto-restart on OOM | Configure Docker memory limits |
| Low | Clean up iptables duplicates | Consolidate firewall rules |
| Low | Add Watchtower | Auto-update Docker images |

### Feature Ideas

- **Download queue management** -- Priority-based download scheduling
- **Bandwidth scheduling** -- Time-based speed limits
- **Mobile-responsive dashboard** -- Improve Nexly Dashboard for mobile
- **API key authentication** -- JWT-based auth for dashboard API
- **Prometheus + Grafana** -- Professional metrics stack (may not fit in 1 GB RAM)

---

## 25. Appendix

### A. Service URLs Quick Reference

| Service | URL |
|:---|:---|
| AriaNg (Download UI) | https://nexly.dpdns.org/ |
| FileBrowser | https://nexly.dpdns.org/download/ |
| Portainer | https://nexly.dpdns.org/portainer/ |
| Rclone Web GUI | https://nexly.dpdns.org/rclone/ |
| Nexly Live Dashboard | https://nexly.dpdns.org/live/ |
| Aria2 JSON-RPC | https://nexly.dpdns.org/jsonrpc |
| Direct IP (fallback) | http://152.67.89.254/ |

### B. File Structure (Project Root)

```
~/aria2-config/
├── .backups/
│   └── upload-sh-cleanup-20260204/
├── .env                               # Centralized secrets (not committed)
├── .env.example                       # Environment template
├── .gitignore                         # VCS exclusion rules
├── .htpasswd                          # Nginx Basic Auth credentials
├── Dockerfile.aria2                   # Custom Aria2 image (+ cron)
├── LICENSE                            # MIT License
├── README.md                          # Project README
├── cloud-destinations.json            # Multi-cloud upload destinations config
├── aria2/
│   ├── LICENSE
│   ├── aria2.conf                     # Main Aria2 config (411 lines)
│   ├── aria2.session                  # Active session state
│   ├── dht.dat                        # DHT routing table (IPv4)
│   ├── dht6.dat                       # DHT routing table (IPv6)
│   ├── rclone                         # Rclone binary (73 MB, embedded)
│   ├── rclone.conf                    # Rclone config (inside aria2 volume)
│   ├── script/                        # Symlink or copy of scripts
│   ├── script.conf                    # Script configuration
│   ├── tracker.log                    # Tracker update history
│   ├── upload.lock                    # Upload mutex lock
│   └── upload.log                     # Upload activity log
├── aria2-nginx.conf                   # Nginx reverse proxy configuration
├── ariang/                            # AriaNg static web UI
│   ├── LICENSE
│   ├── css/
│   ├── favicon.ico
│   ├── favicon.png
│   ├── fonts/
│   ├── index.html
│   ├── js/
│   ├── langs/
│   ├── robots.txt
│   ├── tileicon.png
│   └── touchicon.png
├── auto_reboot.log                    # Boot-time script log
├── certs/
│   ├── aria2.key                      # SSL private key
│   └── aria2.pem                      # SSL certificate
├── check.sh                           # System health dashboard (CLI)
├── dashboard/
│   ├── Dockerfile                     # Dashboard container image
│   ├── node_modules/                  # Node.js dependencies
│   ├── package-lock.json
│   ├── package.json
│   ├── public/
│   │   ├── css/style.css              # Dashboard styles
│   │   ├── index.html                 # Dashboard frontend
│   │   └── js/app.js                  # Dashboard client logic
│   ├── server.js                      # Dashboard backend (679 lines)
│   └── test_rpc.js                    # RPC testing utility
├── docker-compose.yml                 # Docker Compose stack definition
├── downloads/                         # Active downloads directory
├── filebrowser.db                     # FileBrowser SQLite database
├── rclone/
│   └── rclone.conf                    # Rclone remote config + OAuth tokens
├── rclone.conf                        # Root-level rclone.conf (empty)
├── script/
│   ├── backup.sh                      # Config backup to OneDrive
│   ├── clean.sh                       # Post-download cleanup
│   ├── core                           # Shared bash functions library
│   ├── delete.sh                      # Error/removal file cleanup
│   ├── rclone.env                     # Rclone environment (empty)
│   ├── tracker.sh                     # BitTorrent tracker updater
│   └── upload.sh                      # Multi-cloud auto-upload
├── script.conf                        # Root-level script configuration
└── settings.json                      # FileBrowser settings
```

### C. Docker Compose Full Command Reference

```bash
# Start all services (background)
cd ~/aria2-config && docker compose up -d

# Start with rebuild
docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v

# View logs (all services)
docker compose logs -f

# View logs (single service)
docker compose logs -f aria2-pro

# Restart single service
docker compose restart nginx-proxy

# Scale (not applicable for this stack)
# docker compose up -d --scale aria2-pro=2

# Check config validity
docker compose config
```

### D. Network Diagram — Request Flow

```
Browser Request: https://nexly.dpdns.org/live/
    │
    ▼
Cloudflare CDN (DNS Proxy + DDoS Protection)
    │ HTTPS (Cloudflare → Origin)
    ▼
Oracle Cloud VCN (Security List: Allow 443)
    │
    ▼
Host iptables (ACCEPT tcp/443)
    │
    ▼
Docker port mapping (443 → nginx-proxy:443)
    │
    ▼
Nginx (SSL termination with Origin CA)
    │ location /live/ → proxy_pass http://nexly-dashboard:3000/
    ▼
Nexly Dashboard (Express.js on port 3000)
    │ Socket.IO WebSocket upgrade
    ▼
Real-time data via:
    ├── Aria2 JSON-RPC (http://aria2-pro:6800/jsonrpc)
    ├── Rclone RC API (http://rclone:5572/core/stats)
    └── Host /proc (mounted read-only)
```

### E. Credential Summary

> **Warning**: All secrets are now centralized in `.env` (not committed to VCS). See `.env.example` for the template.

| Credential | Source | Used By |
|:---|:---|:---|
| SSH Key | `~/.ssh/ssh-key-2025-12-18.key` | SSH access |
| RPC Secret | `.env` (`RPC_SECRET`) | Aria2, AriaNg, Dashboard |
| FileBrowser password | `.env` (`FB_PASS`) | FileBrowser web UI |
| Rclone RC credentials | `.env` (`RCLONE_USER` / `RCLONE_PASS`) | Rclone Web GUI, Dashboard, upload.sh |
| htpasswd (admin) | `.htpasswd` file | Nginx Basic Auth (enforced globally) |
| OneDrive OAuth token | `rclone/rclone.conf` | Rclone remote access |

---

> **Document generated**: 2026-06-23  
> **Last updated**: 2026-07-31  
> **PRD Version**: 2.0.0  
> **All 7 containers**: Running
