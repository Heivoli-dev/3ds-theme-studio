'use strict';
// Tests du coeur (node test/core.test.js)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lz11 = require('../src/lib/lz11');
const { buildBody } = require('../src/lib/body');
const { decodeRGB565Tiled } = require('../src/lib/texture');
const { buildSmdh } = require('../src/lib/smdh');
const { buildThemeZip, buildTheme, LIMITS } = require('../src/lib/theme');
const qr = require('../src/lib/qr');

function gradient(w, h) {
  const a = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    a[p] = (x * 255) / w; a[p + 1] = (y * 255) / h; a[p + 2] = ((x ^ y) & 0xff); a[p + 3] = 255;
  }
  return a;
}

// LZ11 aller-retour
for (const sample of [new Uint8Array(0), Uint8Array.from([1, 2, 3]), new Uint8Array(100000).fill(7), Uint8Array.from({ length: 70000 }, () => Math.random() * 256 | 0)]) {
  const d = lz11.decompress(lz11.compress(sample));
  assert.deepStrictEqual(Buffer.from(d), Buffer.from(sample));
}
console.log('LZ11 ok');

// Body
const top = gradient(412, 240), bottom = gradient(320, 240);
const { raw, lz } = buildBody({ top, bottom, bgm: false });
assert.strictEqual(raw.length, 0xd0 + 0x40000 * 2);
assert.deepStrictEqual(Buffer.from(lz11.decompress(lz)), Buffer.from(raw));
const decTop = decodeRGB565Tiled(raw.subarray(0xd0, 0xd0 + 0x40000), 512, 256);
const px = (img, w, x, y) => Array.from(img.subarray((y * w + x) * 4, (y * w + x) * 4 + 3));
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 8);
assert(near(px(decTop, 512, 100, 50), px(top, 412, 100, 50)), 'pixel haut');
console.log('body_LZ.bin ok —', lz.length, 'octets compressés');

// SMDH
const smdh = buildSmdh({ title: 'Test', description: 'Desc', author: 'heivoli-network.fr', icon48: gradient(48, 48), icon24: gradient(24, 24) });
assert.strictEqual(smdh.length, 0x36c0);
assert.strictEqual(Buffer.from(smdh.subarray(0, 4)).toString(), 'SMDH');
console.log('info.smdh ok');

// Zip
const zip = buildThemeZip({ top, bottom, icon48: gradient(48, 48), icon24: gradient(24, 24), preview: Buffer.from('89504e47', 'hex'), title: 'Test', description: 'd', author: 'a' });
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'theme.zip'), zip);

// Limites de taille
{
  const base = { top, bottom, icon48: gradient(48, 48), icon24: gradient(24, 24), preview: Buffer.from('89504e47', 'hex'), title: 'T', description: '', author: '' };
  const { sizes } = buildTheme(base);
  assert(sizes.body < LIMITS.body && sizes.total < LIMITS.total);
  assert.throws(() => buildTheme({ ...base, bgm: new Uint8Array(LIMITS.bgm + 1) }), /musique/);
  assert.throws(() => buildTheme({ ...base, preview: new Uint8Array(LIMITS.preview + 1) }), /aperçu/);
  // bruit aléatoire = pire cas pour la compression des images
  const noise = (w, h) => Uint8Array.from({ length: w * h * 4 }, () => Math.random() * 256 | 0);
  const worst = buildTheme({ ...base, top: noise(412, 240), bottom: noise(320, 240) });
  assert(worst.sizes.body < LIMITS.body, 'pire cas body');
  console.log('limites ok — body pire cas', worst.sizes.body, 'octets /', LIMITS.body);
}

// Mises à jour
{
  const { compareVersions, parseRelease, assetNameFor } = require('../src/lib/update');
  assert.strictEqual(compareVersions('1.0.10', '1.0.9'), 1);
  assert.strictEqual(compareVersions('v1.1.0', '1.1.0'), 0);
  assert.strictEqual(compareVersions('1.0.1', '1.1.0'), -1);
  const rel = { tag_name: 'v1.2.0', html_url: 'https://github.com/Heivoli-dev/3ds-theme-studio/releases/tag/v1.2.0',
    assets: ['Mac-Apple-Silicon.dmg', 'Mac-Intel.dmg', 'Windows-Setup.exe', 'Windows-Portable.exe'].map((n) => ({ name: '3DS-Theme-Studio-' + n, browser_download_url: 'https://dl/' + n })) };
  assert.strictEqual(parseRelease(rel, '1.1.0', { platform: 'darwin', arch: 'arm64' }).url, 'https://dl/Mac-Apple-Silicon.dmg');
  assert.strictEqual(parseRelease(rel, '1.1.0', { platform: 'win32', arch: 'x64', portable: true }).url, 'https://dl/Windows-Portable.exe');
  assert.strictEqual(parseRelease(rel, '1.1.0', { platform: 'win32', arch: 'x64' }).newer, true);
  assert.strictEqual(parseRelease(rel, '1.2.0', { platform: 'darwin', arch: 'x64' }).newer, false);
  assert.strictEqual(assetNameFor('linux'), null);
  console.log('mises à jour ok');
}

// QR
for (const [i, url] of ['http://192.168.1.42:8383/theme/Mon_Theme.zip', 'http://10.0.0.5:8383/theme/' + 'x'.repeat(150) + '.zip'].entries()) {
  const m = qr.encode(url);
  fs.writeFileSync(path.join(out, `qr${i}.txt`), url + '\n' + m.map((r) => r.map((v) => (v ? '1' : '0')).join('')).join('\n'));
}
console.log('QR générés (à vérifier avec test/check_qr.py)');
