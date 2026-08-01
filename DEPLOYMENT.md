# 🚀 Deployment Guide

> **Goal**: Get Aria-AriaNg Server running on a VPS in under 15 minutes.
> No prior Docker experience needed — just follow each step in order.

---

## 📑 Table of Contents

- [What You Need Before Starting](#what-you-need-before-starting)
- [Step 1 — Get a Server](#step-1--get-a-server)
- [Step 2 — Connect to Your Server](#step-2--connect-to-your-server)
- [Step 3 — Install Docker](#step-3--install-docker)
- [Step 4 — Clone the Project](#step-4--clone-the-project)
- [Step 5 — Configure Environment Variables](#step-5--configure-environment-variables)
- [Step 6 — Create Login Credentials](#step-6--create-login-credentials)
- [Step 7 — Generate SSL Certificate](#step-7--generate-ssl-certificate)
- [Step 8 — Update Nginx Domain](#step-8--update-nginx-domain)
- [Step 9 — Launch Everything](#step-9--launch-everything)
- [Step 10 — Verify Deployment](#step-10--verify-deployment)
- [Step 11 — Get Free Let's Encrypt SSL (Optional)](#step-11--get-free-lets-encrypt-ssl-optional)
- [Step 12 — Set Up Cloud Uploads (Optional)](#step-12--set-up-cloud-uploads-optional)
- [Oracle Cloud Specific Instructions](#oracle-cloud-specific-instructions)
- [Troubleshooting](#troubleshooting)
- [What's Running After Deployment](#whats-running-after-deployment)

---

<a id="what-you-need-before-starting"></a>
## What You Need Before Starting

| Requirement | Details |
|:---|:---|
| **A VPS (Virtual Private Server)** | Any Linux server with root/sudo access. Minimum 1 GB RAM, 20 GB disk. |
| **A Domain Name** | Any domain (e.g., `download.yourdomain.com`). Free options: [DuckDNS](https://www.duckdns.org/), [FreeDNS](https://freedns.afraid.org/), [DDNS](https://www.noip.com/). |
| **DNS Configured** | Point your domain's **A record** to your server's public IP address. |
| **Ports 80 & 443 Open** | Your server's firewall must allow incoming HTTP (80) and HTTPS (443) traffic. |

### Recommended Server Specs

| Resource | Minimum | Comfortable |
|:---|:---|:---|
| **RAM** | 1 GB | 2 GB+ |
| **CPU** | 1 vCPU | 2+ vCPU |
| **Disk** | 20 GB | 50 GB+ |
| **OS** | Ubuntu 20.04+ / Debian 11+ | Ubuntu 22.04 LTS |

### Best Platform Recommendation

**[Oracle Cloud Always Free Tier](https://cloud.oracle.com/)** — permanently free, 4 ARM OCPUs, 24 GB RAM, 200 GB disk. More than enough for this entire stack. See [Oracle Cloud Specific Instructions](#oracle-cloud-specific-instructions) below.

Other good options: **Hetzner Cloud** (~€4.5/mo), **AWS Lightsail** ($5-10/mo), **DigitalOcean** ($6/mo).

> ⚠️ **Not compatible with**: Vercel, Netlify, Railway, Render, Fly.io, or any serverless/PaaS platform. This project needs a full VPS with Docker and root access.

---

<a id="step-1--get-a-server"></a>
## Step 1 — Get a Server

Sign up for a VPS provider and create a Linux instance (Ubuntu 22.04 LTS recommended).

Once your server is ready, you'll receive:
- A **public IP address** (e.g., `152.67.89.254`)
- An **SSH key file** (`.pem` or `.key`) or a **root password**

**Point your domain to this IP now**. Go to your domain registrar's DNS settings and create an **A record**:

```
Type: A
Name: @ (or subdomain like "download")
Value: YOUR_SERVER_IP
TTL: 300
```

> 💡 DNS propagation can take 5-30 minutes. You can check if it's ready with:
> ```bash
> ping your.domain.com
> ```
> It should resolve to your server's IP.

---

<a id="step-2--connect-to-your-server"></a>
## Step 2 — Connect to Your Server

Open a terminal on your local computer and SSH into your server:

```bash
# If using SSH key file:
ssh -i /path/to/your-key.pem ubuntu@YOUR_SERVER_IP

# If using password:
ssh root@YOUR_SERVER_IP
```

> 💡 Replace `ubuntu` with your server's username (could be `root`, `debian`, `opc` for Oracle Linux, etc.)

You should now see a terminal prompt on your server. All remaining steps happen here.

---

<a id="step-3--install-docker"></a>
## Step 3 — Install Docker

Run these commands to install Docker and Docker Compose:

```bash
# Download and install Docker
curl -fsSL https://get.docker.com | sudo sh

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER

# Activate the new group (so you don't need to log out and back in)
newgrp docker

# Verify Docker is working
docker --version
docker compose version
```

**Expected output** (versions may vary):
```
Docker version 27.x.x
Docker Compose version v2.x.x
```

> ❌ If `docker compose version` fails, your Docker is too old. Re-run the install script above.

---

<a id="step-4--clone-the-project"></a>
## Step 4 — Clone the Project

```bash
# Download the project
git clone https://github.com/Akai-Abd/Aria-Ariang-Server.git

# Enter the project folder
cd Aria-Ariang-Server
```

> 💡 If `git` is not installed: `sudo apt install git -y`

---

<a id="step-5--configure-environment-variables"></a>
## Step 5 — Configure Environment Variables

```bash
# Create your config file from the template
cp .env.example .env

# Open it for editing
nano .env
```

You'll see this file. **Change every value marked with ← below**:

```env
RPC_SECRET=changeme              ← Set a strong random password (Aria2 RPC token)
RCLONE_USER=admin                ← Rclone Web GUI username (keep or change)
RCLONE_PASS=changeme             ← Set a strong password for Rclone
FB_USER=admin                    ← FileBrowser username (keep or change)
FB_PASS=changeme                 ← Set a strong password for FileBrowser
TZ=Asia/Kolkata                  ← Your timezone (e.g., America/New_York, Europe/London)
PUID=1001                        ← Usually fine as-is. Run `id` to check your user's UID
PGID=1001                        ← Usually fine as-is. Run `id` to check your user's GID
DOMAIN=your.domain.com           ← YOUR actual domain name
```

**Save and exit**: Press `Ctrl+X`, then `Y`, then `Enter`.

> 💡 **Generate strong passwords easily:**
> ```bash
> openssl rand -base64 16
> ```

---

<a id="step-6--create-login-credentials"></a>
## Step 6 — Create Login Credentials

This creates the HTTP Basic Auth password that protects all web interfaces:

```bash
# Install the password utility
sudo apt install apache2-utils -y

# Create the password file
# Replace "admin" with your desired username
# Replace "YOUR_PASSWORD" with your desired password
htpasswd -cb .htpasswd admin YOUR_PASSWORD
```

> 🔒 This username/password is what you'll enter when opening any web page on your server. Keep it strong — it's the front door to everything.

---

<a id="step-7--generate-ssl-certificate"></a>
## Step 7 — Generate SSL Certificate

Nginx requires an SSL certificate to start. We'll create a temporary self-signed one first (you can get a free Let's Encrypt certificate later in [Step 11](#step-11--get-free-lets-encrypt-ssl-optional)):

```bash
# Create the certs directory
mkdir -p certs

# Generate a self-signed certificate (valid for 1 year)
# Replace "your.domain.com" with your actual domain
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout certs/aria2.key \
  -out certs/aria2.pem \
  -subj "/CN=your.domain.com"
```

> 💡 Your browser will show a security warning with self-signed certs. That's normal — you can click "Advanced" → "Proceed" to continue. Step 11 fixes this permanently.

---

<a id="step-8--update-nginx-domain"></a>
## Step 8 — Update Nginx Domain

The Nginx config file has a default domain that needs to match yours:

```bash
# Replace the default domain with your actual domain
sed -i 's/nexly.dpdns.org/your.domain.com/g' aria2-nginx.conf
```

> ⚠️ Replace `your.domain.com` in the command above with your **actual domain**.

To verify it worked:
```bash
grep server_name aria2-nginx.conf
```
Both lines should show your domain.

---

<a id="step-9--launch-everything"></a>
## Step 9 — Launch Everything

```bash
docker compose up -d --build
```

**What this does**:
- Downloads all required Docker images (~1 GB total)
- Builds the custom Aria2 and Dashboard containers
- Starts all 7 services in the background

**First run takes 3-5 minutes** (downloading images). Subsequent starts take seconds.

**Expected output** — you should see lines like:
```
✔ Container aria2-pro        Started
✔ Container nginx-proxy       Started
✔ Container rclone            Started
✔ Container filebrowser       Started
✔ Container portainer         Started
✔ Container nexly-dashboard   Started
✔ Container certbot           Started
```

---

<a id="step-10--verify-deployment"></a>
## Step 10 — Verify Deployment

### Check all containers are running

```bash
docker compose ps
```

All 7 containers should show `Up` status (certbot may show `Restarting` — that's normal, it runs periodically):

```
NAME              STATUS
aria2-pro         Up
nginx-proxy       Up
rclone            Up
filebrowser       Up
portainer         Up
nexly-dashboard   Up
certbot           Up (or Restarting)
```

### Run the health check

```bash
bash check.sh
```

This shows a full diagnostic dashboard with tracker status, disk usage, Docker status, and cloud sync info.

### Open in your browser

| Service | URL | What It Does |
|:---|:---|:---|
| **AriaNg** (Download UI) | `https://your.domain.com/` | Add and manage downloads |
| **Nexly Dashboard** | `https://your.domain.com/live/` | Real-time server monitoring |
| **FileBrowser** | `https://your.domain.com/download/` | Browse and download files |
| **Portainer** | `https://your.domain.com/portainer/` | Docker container management |
| **Rclone Web GUI** | `https://your.domain.com/rclone/` | Cloud storage management |

> 🔒 All pages will ask for the username/password you set in Step 6.

---

<a id="step-11--get-free-lets-encrypt-ssl-optional"></a>
## Step 11 — Get Free Let's Encrypt SSL (Optional)

Replace the self-signed certificate with a trusted, free SSL certificate:

```bash
# Request a certificate from Let's Encrypt
# Replace "your.domain.com" and "your@email.com" with your actual values
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d your.domain.com \
  --email your@email.com \
  --agree-tos --no-eff-email
```

If successful, update Nginx to use the new certificate:

```bash
# Update the SSL paths in Nginx config
# Replace "your.domain.com" with your actual domain
sed -i 's|ssl_certificate /etc/nginx/certs/aria2.pem;|ssl_certificate /etc/letsencrypt/live/your.domain.com/fullchain.pem;|' aria2-nginx.conf
sed -i 's|ssl_certificate_key /etc/nginx/certs/aria2.key;|ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;|' aria2-nginx.conf

# Restart Nginx to apply
docker compose restart nginx-proxy
```

> ✅ The certbot container automatically renews your certificate every 12 hours. No maintenance needed.

---

<a id="step-12--set-up-cloud-uploads-optional"></a>
## Step 12 — Set Up Cloud Uploads (Optional)

To automatically upload completed downloads to cloud storage (Google Drive, OneDrive, Dropbox, etc.):

### Configure Rclone Remotes

```bash
# Open the interactive Rclone configuration
docker exec -it rclone rclone config
```

Follow the prompts to add your cloud provider. For most providers, you'll need to:
1. Choose `n` for new remote
2. Pick your provider from the list (e.g., `onedrive`, `drive` for Google Drive)
3. Follow the auth flow (Rclone will give you a URL to visit)

### Manage Upload Destinations

Open `https://your.domain.com/live/` → click **☁️ CLOUD** in the top navigation to add, enable, or disable upload destinations through the UI.

---

<a id="oracle-cloud-specific-instructions"></a>
## Oracle Cloud Specific Instructions

Oracle Cloud has a **double firewall** — you must open ports in **both** places or nothing gets through.

### 1. Create the Instance

1. Log into [cloud.oracle.com](https://cloud.oracle.com/)
2. Go to **Compute → Instances → Create Instance**
3. Set these values:
   - **Image**: Ubuntu 22.04 Minimal (or Oracle Linux 8)
   - **Shape**: `VM.Standard.A1.Flex` (ARM — Always Free)
   - **OCPUs**: 2-4
   - **Memory**: 6-24 GB
   - **Boot Volume**: 50 GB+
4. Download your SSH key

### 2. Open Ports in VCN Security List (Web Console)

1. Go to **Networking → Virtual Cloud Networks** → click your VCN
2. Click **Security Lists** → **Default Security List**
3. Click **Add Ingress Rules** and add these two rules:

| Source CIDR | Protocol | Destination Port | Description |
|:---|:---|:---|:---|
| `0.0.0.0/0` | TCP | `80` | HTTP |
| `0.0.0.0/0` | TCP | `443` | HTTPS |

### 3. Open Ports in OS Firewall (SSH Terminal)

```bash
# SSH into your Oracle Cloud instance
ssh -i your-key.pem ubuntu@YOUR_ORACLE_IP

# Open ports 80 and 443
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Save the rules permanently
sudo netfilter-persistent save
sudo netfilter-persistent reload
```

### 4. Continue with Step 3

Now follow [Step 3 — Install Docker](#step-3--install-docker) and all steps after it.

---

<a id="troubleshooting"></a>
## Troubleshooting

### Container won't start

```bash
# View logs for the failing container
docker compose logs -f --tail=50 CONTAINER_NAME

# Available names: aria2-pro, nginx-proxy, rclone, filebrowser, portainer, dashboard, certbot
```

### "502 Bad Gateway" in browser

The backend container isn't ready yet. Wait 30 seconds and refresh. If it persists:
```bash
docker compose restart
```

### Can't reach the site at all

1. **Check DNS**: `ping your.domain.com` — should resolve to your server IP
2. **Check ports**: `sudo ss -tulpn | grep -E '80|443'` — should show Nginx listening
3. **Check firewall**: For Oracle Cloud, verify both VCN rules AND iptables (see above)
4. **Check containers**: `docker compose ps` — all should show `Up`

### Let's Encrypt certificate fails

- Your domain must resolve to this server's public IP **before** running certbot
- Port 80 must be open and reachable from the internet
- Wait for DNS propagation if you just created the A record

### Downloads not uploading to cloud

1. Verify Rclone remotes: `docker exec -it rclone rclone listremotes`
2. Check upload logs: `tail -f aria2/upload.log`
3. Test manually: `docker exec -it rclone rclone ls YOUR_REMOTE: --config="/config/rclone/rclone.conf"`

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

All services are exposed through Nginx on ports **80** (redirects to 443) and **443** (HTTPS). No other ports are exposed to the internet.

---

> 📖 For day-to-day management commands, see [MAINTENANCE_CHEAT_SHEET.md](MAINTENANCE_CHEAT_SHEET.md).
