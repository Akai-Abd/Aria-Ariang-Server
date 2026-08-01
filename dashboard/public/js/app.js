const socket = io();

// Elements
const elConn = document.getElementById('conn-status');
const elDown = document.getElementById('down-speed');
const elUp = document.getElementById('up-speed');
const elRing = document.getElementById('speed-ring');
const elList = document.getElementById('transfer-list');
const elCount = document.getElementById('job-count');
const elLogs = document.getElementById('log-container');

// Session Stats
const elSessDown = document.getElementById('sess-down');
const elSessUp = document.getElementById('sess-up');

// Graph Elements
const canvas = document.getElementById('trafficChart');
const ctx = canvas.getContext('2d');

let graphData = [];
const MAX_POINTS = 60;

// Resize canvas handling
function resizeCanvas() {
    // Set internal resolution to match display size
    // Using parent container dimensions to ensure it fills
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);
// Call once on init
setTimeout(resizeCanvas, 100);

// Vitals
const elOs = document.getElementById('os-name');
const elCpuModel = document.getElementById('cpu-model');
const elCpuText = document.getElementById('cpu-load-text');
const elCpuBar = document.getElementById('cpu-bar');
const elRamText = document.getElementById('ram-text');
const elRamPercent = document.getElementById('ram-percent');
const elRamBar = document.getElementById('ram-bar');
const elDiskText = document.getElementById('disk-text');
const elDiskTotal = document.getElementById('disk-total');
const elDiskBar = document.getElementById('disk-bar');


// Helpers
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec) {
    const mb = bytesPerSec / 1024 / 1024;
    return mb.toFixed(1);
}

function drawGraph() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (graphData.length < 2) return;

    // Determine Y Scale (Min 1MB/s visual range)
    const maxVal = Math.max(...graphData.map(p => Math.max(p.d, p.u)), 1024 * 1024) * 1.1;
    const padding = 5;
    const height = canvas.height - padding * 2;
    const width = canvas.width;

    const scaleY = height / maxVal;

    // Step width
    const stepX = width / (MAX_POINTS - 1);

    // Helper to draw a line
    const drawLine = (key, color, fill) => {
        ctx.beginPath();

        // Start point
        // Y coordinate is inverted (0 is top), so height - (value * scale)
        let firstY = canvas.height - padding - (graphData[0][key] * scaleY);
        ctx.moveTo(0, firstY);

        graphData.forEach((p, i) => {
            const x = i * stepX;
            const y = canvas.height - padding - (p[key] * scaleY);
            ctx.lineTo(x, y);
        });

        // Stroke
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Fill area
        ctx.lineTo((graphData.length - 1) * stepX, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    };

    // Draw Upload (Pink)
    drawLine('u', '#bc13fe', 'rgba(188, 19, 254, 0.1)');
    // Draw Download (Cyan)
    drawLine('d', '#00f3ff', 'rgba(0, 243, 255, 0.1)');
}

function renderTransfers(list) {
    elCount.textContent = `${list.length} ACTIVE`;
    if (list.length === 0) {
        elList.innerHTML = '<div style="text-align:center; color:var(--text-dim); padding-top:20px; font-style:italic;">No active transfers</div>';
    } else {
        elList.innerHTML = '';
        list.forEach(t => {
            const item = document.createElement('div');
            item.className = 'transfer-item';
            const isUp = t.status === 'Uploading';
            const color = isUp ? 'var(--neon-pink)' : 'var(--neon-blue)';

            // Build Controls
            let controlsHtml = '';
            if (t.source === 'Aria2' && t.gid) {
                // If status is 'Paused' (aria2 might report 'active' but paused? no usually paused is separate list)
                // Actually tellActive only returns active stats. 
                // Getting paused items requires tellWaiting/tellStopped.
                // Assuming active items here.
                controlsHtml = `
                    <div class="controls">
                        <button class="btn-ctrl" data-action="pause" data-gid="${t.gid}" title="Pause">⏸</button>
                        <button class="btn-ctrl remove" data-action="remove" data-gid="${t.gid}" title="Remove">✕</button>
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="transfer-name">
                        <span class="icon">[${t.source}]</span> ${t.name}
                        ${controlsHtml}
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${t.progress}%; background-color: ${color}; box-shadow: 0 0 10px ${color};"></div>
                </div>
                <div class="transfer-meta">
                    <span>${t.status}...</span>
                    <span>${formatBytes(t.speed)}/s</span>
                </div>
            `;
            elList.appendChild(item);
        });
    }
}

// --- Event Listeners ---

socket.on('connect', () => {
    elConn.textContent = '● SYSTEM ONLINE';
    elConn.style.color = '#00ff9d';
    elConn.classList.remove('offline');
});

socket.on('disconnect', () => {
    elConn.textContent = '● DISCONNECTED';
    elConn.classList.add('offline');
});

socket.on('log', (line) => {
    const div = document.createElement('div');
    div.className = 'log-line';
    if (line.includes('ERROR') || line.includes('Failed')) div.style.color = '#ff0055';
    else if (line.includes('INFO') || line.includes('Success')) div.style.color = '#00ff9d';
    else if (line.includes('WARN')) div.style.color = '#f1c40f';
    else if (line.includes('Uploading')) div.style.color = '#00f3ff';

    div.textContent = `> ${line}`;
    elLogs.appendChild(div);
    elLogs.scrollTop = elLogs.scrollHeight;
    if (elLogs.childElementCount > 50) elLogs.removeChild(elLogs.firstChild);
});

socket.on('update', (data) => {
    // Speed
    elDown.textContent = formatSpeed(data.network.down);
    elUp.textContent = formatSpeed(data.network.up);
    elRing.style.transform = `rotate(${Date.now() / 20}deg)`;
    elRing.style.borderTopColor = data.network.down > 0 ? '#00f3ff' : '#333';
    elRing.style.borderRightColor = data.network.up > 0 ? '#bc13fe' : '#333';

    // Session Stats
    if (data.session) {
        if (elSessDown) elSessDown.textContent = formatBytes(data.session.totalDown);
        if (elSessUp) elSessUp.textContent = formatBytes(data.session.totalUp);
    }

    // Graph Data Push
    graphData.push({ d: data.network.down, u: data.network.up });
    if (graphData.length > MAX_POINTS) graphData.shift();

    // Draw Graph
    // Ensure canvas is sized (sometimes init fails)
    if (canvas.width === 0) resizeCanvas();
    drawGraph();

    // Transfers
    if (data.activeTransfers) renderTransfers(data.activeTransfers);

    // --- VITALS UPDATE ---

    // OS
    elOs.textContent = data.system.os || 'Linux';

    // CPU
    if (data.system.cpu) {
        elCpuModel.textContent = data.system.cpu.model || 'Unknown';
        elCpuText.textContent = `${data.system.cpu.load}% Load`;
        elCpuBar.style.width = `${data.system.cpu.load}%`;
        // Alert Color
        elCpuBar.style.background = data.system.cpu.load > 80 ? '#ff0055' : '#f1c40f';
    }

    // RAM
    if (data.system.ram) {
        elRamText.textContent = `${data.system.ram.used} / ${data.system.ram.total}`;
        elRamPercent.textContent = `${data.system.ram.usedPercent}% Used`;
        elRamBar.style.width = `${data.system.ram.usedPercent}%`;
    }

    // Disk
    if (data.system.disk) {
        elDiskText.textContent = `${data.system.disk.free} Free`;
        elDiskTotal.textContent = `Total: ${data.system.disk.total}`;
        elDiskBar.style.width = `${data.system.disk.usedPercent}%`;
        // Alert Color
        elDiskBar.style.background = data.system.disk.usedPercent > 80 ? '#ff0055' : 'var(--neon-pink)';
    }
});

// Control Events
elList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-ctrl');
    if (!btn) return;

    e.stopPropagation(); // Prevent other clicks
    const action = btn.dataset.action;
    const gid = btn.dataset.gid;

    if (!gid) return;

    console.log(`User requested ${action} for ${gid}`);

    // Emit to server
    socket.emit(`control:${action}`, gid);
});
