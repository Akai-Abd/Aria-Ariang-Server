# 🛡️ Security & SSL Architecture Guide

Security is engineered directly into **Aria-AriaNg Server** at every layer.

---

## 🔒 Security Layers Overview

```
                      INTERNET
                         │
                         ▼
             [ Port 80 ]   [ Port 443 ]
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  Nginx Reverse Proxy             │
        │  • Mandatory HTTPS               │
        │  • HTTP Basic Auth (.htpasswd)   │
        └────────────────┬─────────────────┘
                         │
                         ▼ (Internal Docker Bridge Network `aria2-net`)
    ┌────────────┬───────┴────────┬─────────────┐
    │            │                │             │
┌───▼───┐    ┌───▼───┐        ┌───▼───┐     ┌───▼───┐
│ Aria2 │    │ Nexly │        │ File  │     │ Rclone│
│  RPC  │    │ Dash  │        │Browser│     │  GUI  │
└───────┘    └───────┘        └───────┘     └───────┘
 (Token)      (Auth)           (Auth)        (Auth)
```

---

## 🔑 Key Security Measures

### 1. HTTP Basic Authentication
All public web routes (`/`, `/live/`, `/download/`, `/portainer/`, `/rclone/`) are guarded by Nginx Basic Auth backed by `.htpasswd`.

Generate credentials:
```bash
htpasswd -cb .htpasswd username password
```

### 2. Token Authentication for Aria2 RPC
Aria2 RPC endpoint (`/jsonrpc`) is protected using a dedicated secret key defined in `.env`:
```env
RPC_SECRET=your_ultra_secure_secret_token
```

### 3. Network Isolation
Only ports `80` and `443` are exposed on the host interface. All internal communications between services occur across `aria2-net` (an isolated Docker bridge network).

### 4. Zero Secrets in Source Control
Target secrets (`.env`, `.htpasswd`, `certs/`, `rclone.conf`) are explicitly listed in `.gitignore` to prevent sensitive key leakage.

---

## 🔐 Let's Encrypt SSL Lifecycle

Official SSL certificate issuance and automatic renewal are managed by the `certbot` container.

### Certificate Renewal Command
Certbot runs in the background and checks certificate expiry every 12 hours automatically. To force manual renewal:

```bash
docker compose run --rm certbot renew --force-renewal
docker compose restart nginx-proxy
```
