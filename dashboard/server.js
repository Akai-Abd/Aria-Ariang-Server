const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');

/* ... Imports ... */

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Globals
global.ticks = 0;

// Configuration
const ARIA2_URL = process.env.ARIA2_URL || 'http://aria2-pro:6800/jsonrpc';
const ARIA2_SECRET = process.env.ARIA2_SECRET || '654550';
const RCLONE_URL = process.env.RCLONE_URL || 'http://rclone:5572';
const RCLONE_USER = process.env.RCLONE_USER || 'admin';
const RCLONE_PASS = process.env.RCLONE_PASS || '654550';

const LOG_FILE = '/logs/upload.log';
const CLOUD_DEST_FILE = '/config/cloud-destinations.json';

console.log(`Starting Dashboard...`);
console.log(`Aria2: ${ARIA2_URL}`);
console.log(`Rclone: ${RCLONE_URL}`);

if (fs.existsSync(LOG_FILE)) {
    console.log(`Watching log file: ${LOG_FILE}`);
    let fsWait = false;
    fs.watch(LOG_FILE, (event, filename) => {
        if (filename && event === 'change') {
            if (fsWait) return;
            fsWait = setTimeout(() => { fsWait = false; }, 100);
            exec(`tail -n 1 ${LOG_FILE}`, (error, stdout, stderr) => {
                if (!error && stdout) io.emit('log', stdout.trim());
            });
        }
    });
} else {
    console.warn(`Log file not found at ${LOG_FILE}`);
}

async function callAria2(method, params = []) {
    try {
        const payload = {
            jsonrpc: '2.0',
            method: `aria2.${method}`,
            id: 'zesty',
            params: [`token:${ARIA2_SECRET}`, ...params]
        };
        const response = await axios.post(ARIA2_URL, payload, { timeout: 2000 });
        return response.data;
    } catch (error) {
        console.error(`[ERROR] Aria2 ${method} failed: ${error.message}`);
        return null;
    }
}

async function callRclone(endpoint, data = {}) {
    try {
        const config = {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            },
            auth: {
                username: RCLONE_USER,
                password: RCLONE_PASS
            }
        };
        // Explicitly send empty object if data is empty, ensuring Axios sends Content-Length: 2 / {}
        const payload = (data && Object.keys(data).length > 0) ? data : {};
        const response = await axios.post(`${RCLONE_URL}/${endpoint}`, payload, config);
        return response.data;
    } catch (error) {
        // Suppress EOF errors which are just empty stats
        if (error.response && error.response.status === 400 && error.response.data && error.response.data.error.includes('EOF')) {
            return null;
        }
        console.error(`[ERROR] Rclone ${endpoint} failed: ${error.message}`);
        return null;
    }
}

// CACHE FOR STATIC INFO
let cachedStaticInfo = null;
let cachedDiskInfo = { usedPercent: 0, free: '0G', total: '0G' };
let lastDiskCheck = 0;

function getStaticSystemInfo() {
    if (cachedStaticInfo) return cachedStaticInfo;

    const info = { os: 'Linux', hostname: 'Unknown', cpuModel: 'Unknown CPU', cores: 2 };

    // 1. OS Info
    try {
        let osData;
        if (fs.existsSync('/host/usr/lib/os-release')) {
            osData = fs.readFileSync('/host/usr/lib/os-release', 'utf8');
        } else if (fs.existsSync('/host/etc/os-release')) {
            osData = fs.readFileSync('/host/etc/os-release', 'utf8');
        }

        if (osData) {
            const match = osData.match(/PRETTY_NAME="([^"]+)"/);
            if (match) info.os = match[1].replace(/"/g, '');
        }
    } catch (e) { }

    // Hostname
    try {
        info.hostname = fs.readFileSync('/host/etc/hostname', 'utf8').trim();
    } catch (e) { }

    // CPU Model & Cores
    try {
        const cpuInfo = fs.readFileSync('/host/proc/cpuinfo', 'utf8');
        const modelMatch = cpuInfo.match(/model name\s+:\s+(.+)/);
        if (modelMatch) info.cpuModel = modelMatch[1];
        info.cores = (cpuInfo.match(/^processor\s+:/gm) || []).length || 2;
    } catch (e) { }

    cachedStaticInfo = info;
    return info;
}

async function getSystemStats() {
    const staticInfo = getStaticSystemInfo();
    const stats = {
        disk: cachedDiskInfo,
        cpu: { load: 0, model: staticInfo.cpuModel, cores: staticInfo.cores },
        ram: { usedPercent: 0, total: '0G', used: '0G' },
        os: staticInfo.os,
        hostname: staticInfo.hostname
    };

    // 2. CPU Load (Dynamic)
    try {
        const loadAvg = fs.readFileSync('/host/proc/loadavg', 'utf8').split(' ')[0];
        stats.cpu.load = Math.min(Math.floor(parseFloat(loadAvg) * 50), 100);
    } catch (e) { }

    // 3. RAM Info
    try {
        const memInfo = fs.readFileSync('/host/proc/meminfo', 'utf8');
        const totalMatch = memInfo.match(/MemTotal:\s+(\d+)/);
        const availMatch = memInfo.match(/MemAvailable:\s+(\d+)/);
        if (totalMatch && availMatch) {
            const totalKb = parseInt(totalMatch[1]);
            const availKb = parseInt(availMatch[1]);
            const usedKb = totalKb - availKb;

            stats.ram.usedPercent = Math.floor((usedKb / totalKb) * 100);
            stats.ram.total = (totalKb / 1024 / 1024).toFixed(1) + ' GB';
            stats.ram.used = (usedKb / 1024 / 1024).toFixed(1) + ' GB';
        }
    } catch (e) { }

    // 4. Disk Info (Throttled - Check every 10 seconds)
    const now = Date.now();
    if (now - lastDiskCheck > 10000) {
        lastDiskCheck = now;
        exec('df -h /logs', (err, stdout) => {
            if (!err) {
                const lines = stdout.trim().split('\n');
                if (lines.length > 1) {
                    const parts = lines[1].replace(/\s+/g, ' ').split(' ');
                    cachedDiskInfo.total = parts[1];
                    cachedDiskInfo.free = parts[3];
                    cachedDiskInfo.usedPercent = parseInt(parts[4].replace('%', ''));
                }
            }
        });
    }

    return stats;
}

const SERVICES = {
    aria2: ARIA2_URL,
    rclone: RCLONE_URL,
    filebrowser: process.env.FILEBROWSER_URL || 'http://filebrowser:80',
    portainer: process.env.PORTAINER_URL || 'http://portainer:9000'
};

async function checkServiceHealth() {
    const health = {};
    const timeout = 1000;

    // Aria2 (JSON-RPC)
    try {
        await axios.post(SERVICES.aria2, { jsonrpc: '2.0', method: 'aria2.getVersion', id: 'health', params: [`token:${ARIA2_SECRET}`] }, { timeout });
        health.aria2 = true;
    } catch (e) { health.aria2 = false; }

    // Rclone (API)
    try {
        await axios.post(`${SERVICES.rclone}/core/version`, {}, { timeout, auth: { username: RCLONE_USER, password: RCLONE_PASS } });
        health.rclone = true;
    } catch (e) { health.rclone = false; }

    // FileBrowser (HTTP Head)
    try {
        await axios.head(SERVICES.filebrowser, { timeout });
        health.filebrowser = true;
    } catch (e) {
        if (e.response) health.filebrowser = true;
        else health.filebrowser = false;
    }

    // Portainer (HTTP Head)
    try {
        await axios.head(SERVICES.portainer, { timeout });
        health.portainer = true;
    } catch (e) {
        if (e.response) health.portainer = true;
        else health.portainer = false;
    }

    return health;
}

async function fetchStats() {
    const stats = {
        timestamp: Date.now(),
        network: { down: 0, up: 0 },
        activeTransfers: { downloads: [], uploads: [] },
        trackers: { active: 0, dead: 0 },
        system: {
            disk: { usedPercent: 0, free: '0G', total: '0G' },
            cpu: { load: 0, model: 'Unknown', cores: 0 },
            ram: { usedPercent: 0, total: '0G', used: '0G' },
            os: 'Linux'
        }
    };

    // Aria2
    const ariaGlobal = await callAria2('getGlobalStat');
    if (ariaGlobal && ariaGlobal.result) {
        stats.network.down += parseInt(ariaGlobal.result.downloadSpeed);
        stats.network.up += parseInt(ariaGlobal.result.uploadSpeed);
    }
    const ariaActive = await callAria2('tellActive', [['gid', 'totalLength', 'completedLength', 'downloadSpeed', 'files']]);
    if (ariaActive && ariaActive.result) {
        ariaActive.result.forEach(task => {
            let name = 'Unknown';
            if (task.files && task.files.length > 0) name = task.files[0].path.split('/').pop();
            // Fallback for metadata/magnet links
            if (!name || name === '') name = task.gid;

            stats.activeTransfers.downloads.push({
                name: name,
                progress: (parseInt(task.completedLength) / parseInt(task.totalLength)) * 100 || 0,
                speed: parseInt(task.downloadSpeed),
                size: (parseInt(task.totalLength) / 1024 / 1024).toFixed(1) + ' MB'
            });
        });
    }

    // Tracker Stats
    const ariaOptions = await callAria2('getGlobalOption');
    if (ariaOptions && ariaOptions.result && ariaOptions.result['bt-tracker']) {
        const trackers = ariaOptions.result['bt-tracker'].split(',');
        // Only log if changed to reduce noise, or first time
        if (stats.trackers.active !== trackers.length) {
            console.log(`[INFO] Trackers updated: ${trackers.length}`);
        }
        stats.trackers.active = trackers.length;
    } else {
        // console.warn('[WARN] No trackers found in global options');
    }

    // Rclone Logic
    const rcloneStats = await callRclone('core/stats');

    if (rcloneStats) {
        const globalSpeed = rcloneStats.speed || 0;
        let explicitTransfersFound = false;

        if (rcloneStats.transferring && rcloneStats.transferring.length > 0) {
            rcloneStats.transferring.forEach(transfer => {
                const Speed = transfer.speed || transfer.speedAvg || 0;
                if (Speed > 0) explicitTransfersFound = true;
                stats.network.up += Speed;
                stats.activeTransfers.uploads.push({
                    name: transfer.name,
                    progress: transfer.percentage || 0,
                    speed: Speed,
                    size: (transfer.size / 1024 / 1024).toFixed(1) + ' MB'
                });
            });
        }

        // Fallback: REMOVED. 
        // Since we disabled stats-reset, globalSpeed persists as average speed. 
        // We cannot trust it to indicate ACTIVE transfer if 'transferring' list is empty.
        /*
        if (!explicitTransfersFound) {
            if (globalSpeed > 0) {
                if (global.ticks % 5 === 0) console.log(`[DEBUG] Using Global Speed (Fallback): ${globalSpeed}`);
                stats.network.up += globalSpeed;
                stats.activeTransfers.uploads.push({
                    name: 'System Upload',
                    progress: -1, // Indeterminate
                    speed: globalSpeed,
                    size: 'N/A'
                });
            }
        }
        */
    }



    stats.system = await getSystemStats();
    stats.services = await checkServiceHealth();
    return stats;
}

// ========== TRACKER HEALTH MONITORING ==========

let cachedWorkingTrackers = [];
let lastTrackerFetch = 0;
const TRACKER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (reduced from 30)

async function getWorkingTrackers() {
    const now = Date.now();
    if (cachedWorkingTrackers.length > 0 && (now - lastTrackerFetch) < TRACKER_CACHE_DURATION) {
        return cachedWorkingTrackers;
    }

    try {
        console.log('[TRACKER] Fetching working trackers from NewTrackon API...');
        const response = await axios.get('https://newtrackon.com/api/stable', { timeout: 10000 });
        cachedWorkingTrackers = response.data.split('\n').filter(t => t.trim() !== '');
        lastTrackerFetch = now;
        console.log(`[TRACKER] Loaded ${cachedWorkingTrackers.length} working trackers`);
        return cachedWorkingTrackers;
    } catch (error) {
        console.error(`[TRACKER] Failed to fetch working trackers: ${error.message}`);
        return cachedWorkingTrackers; // Return cached data even if expired
    }
}

async function getTrackerHealth() {
    const workingTrackers = await getWorkingTrackers();
    const healthMap = { working: [], dead: [], unknown: [] };

    try {
        const active = await callAria2('tellActive', [['gid']]);
        if (!active || !active.result) return healthMap;

        for (const download of active.result) {
            const opts = await callAria2('getOption', [download.gid]);
            if (!opts || !opts.result || !opts.result['bt-tracker']) continue;

            const trackers = opts.result['bt-tracker'].split(',').filter(t => t.trim() !== '');

            trackers.forEach(tracker => {
                const isWorking = workingTrackers.some(wt => tracker.includes(wt) || wt.includes(tracker));

                if (isWorking) {
                    if (!healthMap.working.includes(tracker)) healthMap.working.push(tracker);
                } else {
                    if (!healthMap.dead.includes(tracker)) healthMap.dead.push(tracker);
                }
            });
        }

        console.log(`[TRACKER HEALTH] Working: ${healthMap.working.length}, Dead: ${healthMap.dead.length}`);
    } catch (error) {
        console.error(`[TRACKER] Health check failed: ${error.message}`);
    }

    return healthMap;
}

async function cleanupDeadTrackers(gid = null) {
    const health = await getTrackerHealth();
    const workingSet = new Set(health.working);
    let totalRemoved = 0;

    try {
        const downloads = gid ? [{ gid }] : (await callAria2('tellActive', [['gid']])).result;
        if (!downloads) return 0;

        for (const download of downloads) {
            const opts = await callAria2('getOption', [download.gid]);
            if (!opts || !opts.result || !opts.result['bt-tracker']) continue;

            const currentTrackers = opts.result['bt-tracker'].split(',').filter(t => t.trim() !== '');
            const cleanTrackers = currentTrackers.filter(tracker => {
                return workingSet.size === 0 || Array.from(workingSet).some(wt =>
                    tracker.includes(wt) || wt.includes(tracker)
                );
            });

            if (cleanTrackers.length < currentTrackers.length) {
                const removed = currentTrackers.length - cleanTrackers.length;
                console.log(`[TRACKER] Removing ${removed} dead trackers from ${download.gid}`);

                await callAria2('changeOption', [download.gid, {
                    'bt-tracker': cleanTrackers.join(',')
                }]);

                totalRemoved += removed;
            }
        }

        console.log(`[TRACKER] Cleanup complete. Total removed: ${totalRemoved}`);
    } catch (error) {
        console.error(`[TRACKER] Cleanup failed: ${error.message}`);
    }

    return totalRemoved;
}

// ========== TOP TRACKER RECOMMENDATIONS ==========

async function getTopTrackers() {
    try {
        const workingTrackers = await getWorkingTrackers();

        // Return top 15 trackers with scoring
        return workingTrackers.slice(0, 15).map((url, idx) => ({
            url,
            rank: idx + 1,
            uptime: Math.max(95, 99.8 - (idx * 0.15)), // Estimated uptime %
            score: Math.max(70, 100 - (idx * 2))
        }));
    } catch (error) {
        console.error(`[TRACKER] Failed to get top trackers: ${error.message}`);
        return [];
    }
}

async function addTrackersToDownload(gid, trackerUrls) {
    try {
        const opts = await callAria2('getOption', [gid]);
        if (!opts || !opts.result) {
            console.warn(`[TRACKER] Could not get options for ${gid}`);
            return 0;
        }

        const currentTrackers = opts.result['bt-tracker'] ?
            opts.result['bt-tracker'].split(',').filter(t => t.trim() !== '') :
            [];

        // Merge and deduplicate
        const enhanced = [...new Set([...currentTrackers, ...trackerUrls])];
        const added = enhanced.length - currentTrackers.length;

        if (added > 0) {
            await callAria2('changeOption', [gid, {
                'bt-tracker': enhanced.join(',')
            }]);
            console.log(`[TRACKER] Added ${added} trackers to ${gid}`);
        }

        return added;
    } catch (error) {
        console.error(`[TRACKER] Failed to add trackers to ${gid}: ${error.message}`);
        return 0;
    }
}

async function enhanceAllDownloads() {
    try {
        const topTrackers = await getTopTrackers();
        const topUrls = topTrackers.slice(0, 10).map(t => t.url);

        const active = await callAria2('tellActive', [['gid']]);
        if (!active || !active.result) {
            console.log('[TRACKER] No active downloads to enhance');
            return { enhanced: 0, trackersAdded: 0 };
        }

        let totalAdded = 0;
        let enhanced = 0;

        for (const download of active.result) {
            const added = await addTrackersToDownload(download.gid, topUrls);
            if (added > 0) {
                totalAdded += added;
                enhanced++;
            }
        }

        console.log(`[TRACKER] Enhanced ${enhanced} downloads with ${totalAdded} total trackers`);
        return { enhanced, trackersAdded: totalAdded };
    } catch (error) {
        console.error(`[TRACKER] Enhance all failed: ${error.message}`);
        return { enhanced: 0, trackersAdded: 0 };
    }
}

// API endpoint for top trackers
app.get('/api/top-trackers', async (req, res) => {
    const trackers = await getTopTrackers();
    res.json({ trackers });
});

// API endpoint for adding trackers to downloads
app.post('/api/add-trackers', express.json(), async (req, res) => {
    const { gid, trackerUrls } = req.body;

    if (!trackerUrls || !Array.isArray(trackerUrls)) {
        return res.status(400).json({ error: 'trackerUrls must be an array' });
    }

    // If no gid specified, add to first active download
    let targetGid = gid;
    if (!targetGid) {
        const active = await callAria2('tellActive', [['gid']]);
        if (active && active.result && active.result.length > 0) {
            targetGid = active.result[0].gid;
        } else {
            return res.status(404).json({ error: 'No active downloads found' });
        }
    }

    const added = await addTrackersToDownload(targetGid, trackerUrls);
    res.json({ success: true, added, gid: targetGid });
});

// API endpoint for enhancing all downloads
app.post('/api/enhance-all', async (req, res) => {
    const result = await enhanceAllDownloads();
    res.json({ success: true, ...result });
});

// API endpoint for manual tracker cleanup
app.get('/api/tracker-cleanup', async (req, res) => {
    const removed = await cleanupDeadTrackers();
    res.json({ success: true, removed });
});

// API endpoint for tracker health status (global tracker list)
app.get('/api/tracker-health', async (req, res) => {
    try {
        // Force refresh if requested via query param
        if (req.query.refresh === 'true') {
            lastTrackerFetch = 0; // Invalidate cache
        }

        // Get global working trackers from NewTrackon
        const workingTrackers = await getWorkingTrackers();

        // Calculate dead trackers (total trackers across all downloads minus working)
        const totalTrackers = workingTrackers.length;
        const deadTrackers = 0; // We only track working trackers from NewTrackon

        res.json({
            working: totalTrackers,
            dead: deadTrackers,
            trackers: {
                working: workingTrackers,
                dead: [],
                unknown: []
            }
        });
    } catch (error) {
        console.error('[TRACKER] Health API failed:', error.message);
        res.json({ working: 0, dead: 0, trackers: { working: [], dead: [], unknown: [] } });
    }
});

// ========== END TOP TRACKER RECOMMENDATIONS ==========

// ========== END TRACKER MONITORING ==========

// ========== MULTI-CLOUD STORAGE MANAGEMENT ==========

function readCloudDestinations() {
    try {
        if (fs.existsSync(CLOUD_DEST_FILE)) {
            return JSON.parse(fs.readFileSync(CLOUD_DEST_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[CLOUD] Failed to read destinations:', e.message);
    }
    return { destinations: [] };
}

function writeCloudDestinations(data) {
    fs.writeFileSync(CLOUD_DEST_FILE, JSON.stringify(data, null, 2));
}

// List all configured cloud destinations
app.get('/api/cloud/destinations', (req, res) => {
    res.json(readCloudDestinations());
});

// Add a new cloud destination
app.post('/api/cloud/destinations', (req, res) => {
    const { name, remote, path, icon } = req.body;
    if (!name || !remote) {
        return res.status(400).json({ error: 'name and remote are required' });
    }
    const data = readCloudDestinations();
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
    data.destinations.push({ id, name, remote, path: path || '', enabled: true, icon: icon || '☁️' });
    writeCloudDestinations(data);
    res.json({ success: true, id });
});

// Update a cloud destination
app.put('/api/cloud/destinations/:id', (req, res) => {
    const data = readCloudDestinations();
    const idx = data.destinations.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    Object.assign(data.destinations[idx], req.body);
    writeCloudDestinations(data);
    res.json({ success: true });
});

// Delete a cloud destination
app.delete('/api/cloud/destinations/:id', (req, res) => {
    const data = readCloudDestinations();
    data.destinations = data.destinations.filter(d => d.id !== req.params.id);
    writeCloudDestinations(data);
    res.json({ success: true });
});

// List available rclone remotes (for the "add destination" UI)
app.get('/api/cloud/remotes', async (req, res) => {
    const result = await callRclone('config/listremotes');
    if (result && result.remotes) {
        // Get type info for each remote
        const remotes = [];
        for (const name of result.remotes) {
            const info = await callRclone('config/get', { name });
            remotes.push({ name, type: info?.type || 'unknown' });
        }
        res.json({ remotes });
    } else {
        res.json({ remotes: [] });
    }
});

// Test a cloud destination by listing its root
app.post('/api/cloud/test', async (req, res) => {
    const { remote, path } = req.body;
    const fs_path = path ? `${remote}:${path}` : `${remote}:`;
    const result = await callRclone('operations/list', { fs: fs_path, remote: '' });
    if (result) {
        res.json({ success: true, message: `Connected to ${fs_path}` });
    } else {
        res.json({ success: false, message: `Failed to connect to ${fs_path}` });
    }
});

// ========== END MULTI-CLOUD STORAGE ==========

// OPTIMIZED POLLING INTERVAL (2 seconds instead of 1)
setInterval(async () => {
    global.ticks++;
    const data = await fetchStats();
    io.emit('update', data);
}, 2000);

io.on('connection', (socket) => {
    fetchStats().then(data => socket.emit('update', data));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Zesty Live Dashboard running on port ${PORT}`);
});
