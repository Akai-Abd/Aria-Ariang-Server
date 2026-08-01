# ☁️ Multi-Cloud Synchronization Guide

The server supports automatic post-download uploads to over 70 cloud storage providers (Google Drive, OneDrive, MEGA, Dropbox, Amazon S3, Nextcloud, WebDAV, etc.) using **Rclone**.

---

## 🔑 Why Setup Requires Local PC CLI

Cloud providers like Google, Microsoft, and Dropbox require browser-based **OAuth2** authentication. Because your headless VPS does not run a desktop browser, you generate token credentials on your local machine and transfer the configuration to the server.

---

## 🛠️ Step 1: Install Rclone on Local PC

* **Linux / macOS**:
  ```bash
  curl https://rclone.org/install.sh | sudo bash
  ```
* **Windows (PowerShell)**:
  ```powershell
  winget install Rclone.Rclone
  ```

---

## 🛠️ Step 2: Interactive Remote Setup

Run `rclone config` on your local PC:

### 1️⃣ Google Drive
1. Press `n` -> Name: `gdrive` -> Select `drive`.
2. Leave Client ID / Secret blank.
3. Access Scope: Choose `1` (`drive` - full access).
4. Auto-config web browser: Press `y`.
5. Login in browser and click **Allow**.
6. Save remote.

### 2️⃣ Microsoft OneDrive
1. Press `n` -> Name: `onedrive` -> Select `onedrive`.
2. Region: Choose `1` (`global`).
3. Auto-config web browser: Press `y`.
4. Login in browser and authorize Rclone.
5. Select drive type -> `OneDrive Personal or Business`.
6. Save remote.

### 3️⃣ MEGA
1. Press `n` -> Name: `mega` -> Select `mega`.
2. Input MEGA Email & Password.
3. Save remote.

### 4️⃣ Dropbox
1. Press `n` -> Name: `dropbox` -> Select `dropbox`.
2. Auto-config web browser: Press `y`.
3. Authorize in browser.
4. Save remote.

---

## 🛠️ Step 3: Transfer Config to Nexly Live Dashboard

1. View your generated local config file:
   * **Linux/macOS**: `cat ~/.config/rclone/rclone.conf`
   * **Windows**: `type %APPDATA%\rclone\rclone.conf`
2. Open **Nexly Live Dashboard** in browser (`https://your-domain.com/live/`).
3. Click **`☁️ CLOUD`** -> Click **`⚙️ EDIT RCLONE CONF`**.
4. Paste your configuration block into the text editor and click **`💾 SAVE RCLONE CONFIG`**.

---

## 🛠️ Step 4: Add Destination Targets

1. In Nexly Dashboard **Cloud Manager**:
   * **Name**: `Google Drive Backup`
   * **Rclone Remote**: Select `gdrive` from dropdown
   * **Remote Path**: `Downloads`
2. Click **`+ Add Destination`**.
3. Toggle `ON` / `OFF` status or click `TEST` to verify connectivity.

---

## 📄 Config File Structure (`cloud-destinations.json`)

Destinations are stored on disk at `./cloud-destinations.json`:

```json
{
  "destinations": [
    {
      "id": "dest-1718000000000",
      "name": "Google Drive Main",
      "remote": "gdrive",
      "path": "Aria2Downloads",
      "enabled": true,
      "icon": "📁"
    }
  ]
}
```
