# Nexly Live Monitoring Dashboard (`baba2580/nexly-dashboard`)

A lightweight, cyberpunk-inspired, real-time monitoring dashboard and management interface for **Aria2** and **Rclone**.

Part of the [Aria-AriaNg Server](https://github.com/Akai-Abd/Aria-Ariang-Server) turnkey stack.

---

## ⚡ Features

- 📊 **Real-Time Traffic Monitor**: Live download & upload speed visualizer with dynamic multi-mode graphs (Converge, Diverge, Seismic).
- 📜 **Live Upload Stream**: Real-time tailing of active and completed cloud uploads with instant history recall on refresh and one-click log clearing.
- ☁️ **Multi-Cloud Management**: Web interface to add, toggle, test, and manage cloud destinations across OneDrive, Google Drive, Dropbox, S3, WebDAV, etc.
- ⚙️ **Direct Rclone Config Editor**: Live in-browser `rclone.conf` editor with syntax validation.
- 📡 **BitTorrent Tracker Health Engine**: Automatic tracking and one-click cleanup of dead trackers with top recommended tracker injectors.
- 💻 **Hardware Vitals**: Real-time CPU load, memory percentage, disk storage gauges, and service health monitors.
- 🎨 **Multi-Theme Engine**: 4 built-in cyberpunk neon themes (Cyan & Pink, Purple & Magenta, Matrix Green, Tron Blue).
- 📱 **Mobile Optimized**: Full responsive layout for mobile, tablet, and desktop viewports.

---

## 🚀 Quick Start

### Docker Compose (Recommended)

```yaml
services:
  dashboard:
    image: baba2580/nexly-dashboard:latest
    container_name: nexly-dashboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - ARIA2_URL=http://aria2-pro:6800/jsonrpc
      - ARIA2_SECRET=your_rpc_secret
      - RCLONE_URL=http://rclone:5572
      - RCLONE_USER=admin
      - RCLONE_PASS=your_password
    volumes:
      - /proc:/host/proc:ro
      - /etc/os-release:/host/os-release:ro
      - ./aria2/upload.log:/logs/upload.log:rw
      - ./downloads:/data:ro
      - ./cloud-destinations.json:/config/cloud-destinations.json:rw
      - ./rclone:/config/rclone:rw
```

### Docker CLI

```bash
docker run -d \
  --name nexly-dashboard \
  -p 3000:3000 \
  -e ARIA2_URL=http://aria2-pro:6800/jsonrpc \
  -e ARIA2_SECRET=your_rpc_secret \
  -e RCLONE_URL=http://rclone:5572 \
  -e RCLONE_USER=admin \
  -e RCLONE_PASS=your_password \
  -v /proc:/host/proc:ro \
  -v /etc/os-release:/host/os-release:ro \
  -v $(pwd)/aria2/upload.log:/logs/upload.log:rw \
  -v $(pwd)/downloads:/data:ro \
  -v $(pwd)/cloud-destinations.json:/config/cloud-destinations.json:rw \
  -v $(pwd)/rclone:/config/rclone:rw \
  baba2580/nexly-dashboard:latest
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ARIA2_URL` | `http://aria2-pro:6800/jsonrpc` | Aria2 JSON-RPC endpoint |
| `ARIA2_SECRET` | `654550` | Aria2 RPC token / password |
| `RCLONE_URL` | `http://rclone:5572` | Rclone RC API endpoint |
| `RCLONE_USER` | `admin` | Rclone RC authentication username |
| `RCLONE_PASS` | `654550` | Rclone RC authentication password |
| `FILEBROWSER_URL`| `http://filebrowser:80` | FileBrowser healthcheck endpoint |
| `PORTAINER_URL` | `http://portainer:9000` | Portainer healthcheck endpoint |

---

## 🔗 Repository & Documentation

For complete server setup, automated installation script, and architecture details:
👉 [https://github.com/Akai-Abd/Aria-Ariang-Server](https://github.com/Akai-Abd/Aria-Ariang-Server)
