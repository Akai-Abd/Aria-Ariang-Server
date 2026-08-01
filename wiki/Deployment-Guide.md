# 📘 Comprehensive Deployment Guide

This guide covers deploying the **Aria-AriaNg Server** stack on any Linux VPS, with specific instructions for Oracle Cloud Infrastructure (OCI) ARM Always Free instances.

---

## 📋 System Requirements

| Specification | Minimum | Recommended |
| :--- | :--- | :--- |
| **OS** | Ubuntu 20.04 LTS / Debian 11 | Ubuntu 22.04 LTS |
| **Architecture** | `x86_64` (amd64) or `aarch64` (arm64) | `aarch64` (Oracle ARM) |
| **RAM** | 1 GB | 2 GB+ |
| **Disk** | 20 GB free space | High-speed SSD/NVMe |
| **Ports** | `80` (HTTP) and `443` (HTTPS) | `80`, `443` open inbound |

---

## ☁️ Deployment on Oracle Cloud VPS (Always Free)

Oracle Cloud Infrastructure (OCI) offers an **Always Free** ARM instance (`VM.Standard.A1.Flex`) with 4 OCPUs, 24 GB RAM, and up to 200 GB volume.

### Step 1: Provision the Instance
1. Log into [Oracle Cloud Console](https://cloud.oracle.com/).
2. Go to **Compute** -> **Instances** -> **Create Instance**.
3. Select **Ubuntu 22.04 Minimal** image.
4. Select **Shape**: `VM.Standard.A1.Flex` (ARM) with 2–4 OCPUs and 6–24 GB RAM.
5. Save your SSH Private Key.

### Step 2: Open Ingress Ports
Oracle Cloud requires opening ports in **VCN Security Lists** AND local **iptables**.

#### A. VCN Ingress Rules (Web Console)
In **Networking** -> **Virtual Cloud Networks** -> **Security Lists** -> **Default Security List**:

| Source | Protocol | Destination Port | Purpose |
| :--- | :---: | :---: | :--- |
| `0.0.0.0/0` | TCP | `80` | HTTP / Certbot SSL Validation |
| `0.0.0.0/0` | TCP | `443` | HTTPS Traffic |

#### B. Instance Firewall Rules (Terminal)
SSH into your server and run:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
sudo netfilter-persistent reload
```

---

## 🚀 Standard Linux VPS Installation

### Step 1: Install Docker & Docker Compose
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone the Project
```bash
git clone https://github.com/Akai-Abd/Aria-Ariang-Server.git
cd Aria-Ariang-Server
```

### Step 3: Configure `.env` File
```bash
cp .env.example .env
nano .env
```

Update your configuration parameters:
```env
RPC_SECRET=my_ultra_secure_token
RCLONE_USER=admin
RCLONE_PASS=my_password
FB_USER=admin
FB_PASS=my_password
TZ=Asia/Kolkata
PUID=1000
PGID=1000
DOMAIN=downloads.my-domain.com
```

### Step 4: Create Basic Authentication File
```bash
sudo apt install apache2-utils -y
htpasswd -cb .htpasswd admin my_password
```

### Step 5: Generate Initial SSL Certificate
```bash
mkdir -p certs
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout certs/aria2.key \
  -out certs/aria2.pem \
  -subj "/CN=downloads.my-domain.com"
```

### Step 6: Launch Stack
```bash
docker compose up -d
```

### Step 7: Issue Official Let's Encrypt SSL
```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d downloads.my-domain.com \
  --email admin@my-domain.com \
  --agree-tos --no-eff-email
```

Update `aria2-nginx.conf`:
```nginx
ssl_certificate /etc/letsencrypt/live/downloads.my-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/downloads.my-domain.com/privkey.pem;
```

Reload Nginx:
```bash
docker compose restart nginx-proxy
```
