# 🚀 Welcome to Aria-AriaNg Server Wiki

Welcome to the official documentation for **Aria-AriaNg Server**, a production-ready, fully automated self-hosted download station with real-time monitoring and multi-cloud sync capabilities.

---

## 📑 Wiki Navigation

* **[Home](Home)** — Project overview & architecture
* **[Deployment Guide](Deployment-Guide)** — Full VPS & Oracle Cloud ARM setup
* **[Docker Hub Guide](Docker-Hub-Guide)** — Quick start with pre-built images (`baba2580/*`)
* **[Multi-Cloud Setup](Multi-Cloud-Setup)** — Rclone OAuth guide for 70+ cloud providers
* **[Maintenance & CLI](Maintenance-&-CLI)** — Operations, log viewing & system health checks
* **[Security & SSL](Security-&-SSL)** — Nginx reverse proxy, Basic Auth & SSL renewal

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NGINX REVERSE PROXY                          │
│                  (SSL Termination + Basic Auth)                      │
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
     │            │   Rclone    ◄──────────────────────┘
     │            │   :5572     │
     │            └──────┬──────┘
     │                   │
     │     ┌─────────────▼─────────────┐
     │     │     Cloud Providers       │
     │     │  OneDrive │ Google Drive  │
     │     │  Dropbox  │ MEGA │ S3    │
     │     │     + 70 more via Rclone  │
     │     └───────────────────────────┘
```

---

## 🧩 Stack Overview

| Container | Image | Purpose |
| :--- | :--- | :--- |
| `aria2-pro` | `baba2580/aria2-pro` | Download Engine (HTTP, FTP, BT, Magnet) |
| `nexly-dashboard` | `baba2580/nexly-dashboard` | Live Monitoring & Cloud Remote Manager |
| `nginx-proxy` | `nginx:alpine` | SSL Termination, Routing & Basic Authentication |
| `rclone` | `rclone/rclone` | Cloud Sync Engine (70+ Providers) |
| `filebrowser` | `filebrowser/filebrowser` | Web File Manager & Media Player |
| `portainer` | `portainer/portainer-ce:lts` | Visual Container Management |
| `certbot` | `certbot/certbot` | Automatic SSL Certificate Renewal |

---

## ⚡ Quick Links

* [GitHub Repository](https://github.com/Akai-Abd/Aria-Ariang-Server)
* [Docker Hub Profile](https://hub.docker.com/u/baba2580)
