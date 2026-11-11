"""Test de l'interface dans Chrome headless avec un faux pont Electron.
Capture la charge utile envoyée au processus principal et des captures d'écran."""
import json, os, base64
from playwright.sync_api import sync_playwright

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'test', 'out')
os.makedirs(out, exist_ok=True)

STUB = """
window.__payload = null;
const enc = (u) => { if (!u) return null; let s=''; for (let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); };
window.studio = {
  buildTheme: async (t) => { window.__payload = Object.fromEntries(Object.entries(t).map(([k,v]) => [k, v instanceof Uint8Array ? enc(v) : v])); return {name:'Test', size: 123456}; },
  saveTheme: async () => ({ok:true}),
  startQr: async () => ({ url:'http://192.168.1.20:8383/theme/Test.zip', svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>', ips:[{address:'192.168.1.20', ifname:'en0'}], ip:'192.168.1.20' }),
  fetchImage: async (u) => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  stopQr: async () => true, saveProject: async () => true, openProject: async () => null, onDownloaded: () => {},
};
"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
    pg = b.new_page(viewport={'width': 1320, 'height': 860})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.add_init_script(STUB)
    pg.goto('file://' + os.path.join(root, 'src/renderer/index.html'))
    pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(out, 'ui_default.png'))

    # Image sur l'écran du haut + motif sur le bas
    pg.set_input_files('#fileImage', os.path.join(out, 'sample.png'))
    pg.wait_for_timeout(400)
    pg.click('#tabs button[data-tab=bottom]')
    pg.select_option('#screenEditor select[data-k=pattern]', 'dots')
    pg.click('details:has(input[data-k=text]) > summary')
    pg.fill('#screenEditor input[data-k=text]', 'Bonjour !')
    pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(out, 'ui_edit.png'))

    pg.click('#btnQr')
    pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(out, 'ui_qr.png'))
    payload = pg.evaluate('window.__payload')
    json.dump(payload, open(os.path.join(out, 'payload.json'), 'w'))
    b.close()

print('erreurs JS:', errors or 'aucune')
print('payload:', {k: (len(v) if isinstance(v, str) else v) for k, v in payload.items()})
