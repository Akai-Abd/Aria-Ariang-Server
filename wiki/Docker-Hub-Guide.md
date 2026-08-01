# 🐳 Docker Hub Pre-Built Images Guide

To eliminate compilation overhead and make deployment instantaneous, custom services in **Aria-AriaNg Server** are published directly to Docker Hub as multi-architecture (`amd64` / `arm64`) images.

---

## 📦 Published Repositories

| Component | Docker Hub Repository | Architectures |
| :--- | :--- | :---: |
| 🔽 **Aria2 Pro Engine** | [`baba2580/aria2-pro`](https://hub.docker.com/r/baba2580/aria2-pro) | `amd64`, `arm64` |
| 📊 **Nexly Live Dashboard** | [`baba2580/nexly-dashboard`](https://hub.docker.com/r/baba2580/nexly-dashboard) | `amd64`, `arm64` |

---

## ⚙️ How docker-compose.yml Pulls Images

In `docker-compose.yml`, the default image references point to Docker Hub tags:

```yaml
services:
  aria2-pro:
    image: baba2580/aria2-pro:latest
    container_name: aria2-pro
    # ...

  dashboard:
    image: baba2580/nexly-dashboard:latest
    container_name: nexly-dashboard
    # ...
```

When you run `docker compose up -d`, Docker engine automatically detects your host CPU architecture (x86_64 vs ARM64) and pulls the matching multi-arch image layer.

---

## 🏷️ Version Tag Pinning

By default, the stack pulls `:latest`. For production stability, you can pin specific releases in `docker-compose.yml`:

```yaml
services:
  aria2-pro:
    image: baba2580/aria2-pro:1.0.0

  dashboard:
    image: baba2580/nexly-dashboard:1.0.0
```

Available semver tags can be inspected on [Docker Hub](https://hub.docker.com/u/baba2580).

---

## 🛠️ Local Development (Building from Source)

If you modify `Dockerfile.aria2` or dashboard source code locally, you can use `docker-compose.override.yml` to build locally without editing `docker-compose.yml`:

```yaml
# docker-compose.override.yml
services:
  aria2-pro:
    build:
      context: .
      dockerfile: Dockerfile.aria2

  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
```

Build and launch with:
```bash
docker compose up -d --build
```

---

## 🔄 Updating Pre-Built Images

When a new version is released:

```bash
git pull
docker compose pull
docker compose up -d
```

Your persistent downloads, rclone tokens, and database files remain 100% intact during updates because all data resides on mounted host volumes.
