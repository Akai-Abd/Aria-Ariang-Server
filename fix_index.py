import os
import re

script_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(script_dir, 'dashboard', 'public', 'index.html')
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix HTML layout
bad_divs = '''                </div>
                </div>
            </div>
        </div>

        <div class="panel speed-panel">'''

good_divs = '''                </div>
            </div>
        </div>

        <div class="panel speed-panel">'''

if bad_divs in content:
    content = content.replace(bad_divs, good_divs)
    print('Fixed layout divs!')

# 2. Add JS handlers
js_target = "openBtn.addEventListener('click', () => { panel.style.display = 'block'; loadDestinations(); loadRemotes(); });"

js_code = '''openBtn.addEventListener('click', () => { panel.style.display = 'block'; loadDestinations(); loadRemotes(); });

            const toggleConfBtn = document.getElementById('toggleRcloneConfBtn');
            const confSection = document.getElementById('rcloneConfSection');
            const confText = document.getElementById('rcloneConfText');
            const saveConfBtn = document.getElementById('saveRcloneConfBtn');
            const confStatus = document.getElementById('rcloneConfStatus');

            if (toggleConfBtn && confSection) {
                toggleConfBtn.addEventListener('click', async () => {
                    if (confSection.style.display === 'none' || !confSection.style.display) {
                        confSection.style.display = 'block';
                        await loadRcloneConfig();
                    } else {
                        confSection.style.display = 'none';
                    }
                });
            }

            async function loadRcloneConfig() {
                try {
                    const res = await fetch('./api/cloud/rclone-config');
                    const data = await res.json();
                    if (confText) confText.value = data.config || '';
                } catch(e) {
                    if (confText) confText.value = '# Error loading rclone.conf';
                }
            }

            if (saveConfBtn) {
                saveConfBtn.addEventListener('click', async () => {
                    try {
                        saveConfBtn.disabled = true;
                        saveConfBtn.innerText = 'SAVING...';
                        const res = await fetch('./api/cloud/rclone-config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ config: confText.value })
                        });
                        const data = await res.json();
                        if (data.success) {
                            if (confStatus) {
                                confStatus.innerText = 'Saved & Remotes Updated!';
                                setTimeout(() => confStatus.innerText = '', 3000);
                            }
                            await loadRemotes();
                        } else {
                            alert('Error: ' + (data.error || 'Failed to save config'));
                        }
                    } catch(e) {
                        alert('Failed to save rclone config');
                    } finally {
                        saveConfBtn.disabled = false;
                        saveConfBtn.innerText = 'SAVE RCLONE CONFIG';
                    }
                });
            }'''

if js_target in content and 'toggleConfBtn' not in content:
    content = content.replace(js_target, js_code, 1)
    print('Added JS handlers!')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done fixing index.html!')
