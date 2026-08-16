# Aria2 Pro (`baba2580/aria2-pro`)

A high-performance **Aria2** downloader image with integrated automated **Rclone multi-cloud upload pipeline**, BitTorrent acceleration, tracker updater, and multi-architecture support (`linux/amd64`, `linux/arm64`).

Part of the [Aria-AriaNg Server](https://github.com/Akai-Abd/Aria-Ariang-Server) turnkey stack.

---

## ⚡ Features

- 🚀 **High-Speed Downloads**: Multi-connection segmented downloads with optimized chunk sizing and disk caching.
- ☁️ **Automated Rclone Cloud Uploads**: Automatically triggers upload scripts upon download completion to OneDrive, Google Drive, Mega, S3, WebDAV, or local targets.
- 📡 **Built-in Tracker Auto-Update**: Fetches stable BitTorrent trackers automatically to maximize peer discovery and torrent speeds.
- 🛡️ **Secure JSON-RPC**: Token-protected remote procedure call interface ready for AriaNg, web UIs, and extensions.
- 🐳 **Multi-Arch**: Native builds for `amd64` (Intel/AMD) and `arm64` (Oracle Cloud Ampere A1, Raspberry Pi, AWS Graviton, Apple Silicon).

---

## 🚀 Quick Start

### Docker Compose (Recommended)

```yaml
services:
  aria2-pro:
    image: baba2580/aria2-pro:latest
    container_name: aria2-pro
    restart: always
    user: "0:0"
    ports:
      - "6800:6800"
    environment:
      - RPC_SECRET=your_secret_token
      - PUID=1000
      - PGID=1000
      - TZ=UTC
    volumes:
      - ./aria2:/config
      - ./script:/config/script
      - /var/run/docker.sock:/var/run/docker.sock
      - ./downloads:/downloads
      - ./cloud-destinations.json:/config/cloud-destinations.json:ro
```

### Docker CLI

```bash
docker run -d \
  --name aria2-pro \
  -p 6800:6800 \
  -e RPC_SECRET=your_secret_token \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=UTC \
  -v $(pwd)/aria2:/config \
  -v $(pwd)/script:/config/script \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/downloads:/downloads \
  -v $(pwd)/cloud-destinations.json:/config/cloud-destinations.json:ro \
  baba2580/aria2-pro:latest
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `RPC_SECRET` | *(empty)* | Secret authorization token for JSON-RPC connections |
| `PUID` | `1000` | User ID for file permissions |
| `PGID` | `1000` | Group ID for file permissions |
| `TZ` | `UTC` | Server timezone (e.g., `Asia/Kolkata`, `America/New_York`) |

---

## 🔗 Repository & Documentation

For complete server setup, automated installation script, and architecture details:
👉 [https://github.com/Akai-Abd/Aria-Ariang-Server](https://github.com/Akai-Abd/Aria-Ariang-Server)
