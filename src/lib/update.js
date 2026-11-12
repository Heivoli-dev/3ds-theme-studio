'use strict';
// Détection des nouvelles versions publiées sur GitHub
// © heivoli-network.fr

const REPO = 'Heivoli-dev/3ds-theme-studio';
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

/** Compare deux versions "1.2.3" (le "v" initial est ignoré). Retourne -1, 0 ou 1. */
function compareVersions(a, b) {
  const parse = (v) => String(v || '0').replace(/^v/i, '').split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) > (y[i] || 0)) return 1;
    if ((x[i] || 0) < (y[i] || 0)) return -1;
  }
  return 0;
}

/** Nom du fichier à télécharger pour ce système. */
function assetNameFor(platform, arch, portable) {
  if (platform === 'darwin') return arch === 'arm64' ? '3DS-Theme-Studio-Mac-Apple-Silicon.dmg' : '3DS-Theme-Studio-Mac-Intel.dmg';
  if (platform === 'win32') return portable ? '3DS-Theme-Studio-Windows-Portable.exe' : '3DS-Theme-Studio-Windows-Setup.exe';
  return null;
}

/**
 * Analyse la réponse de l'API GitHub.
 * @returns {{current, latest, newer, url, page, notes, publishedAt}}
 */
function parseRelease(release, current, { platform, arch, portable } = {}) {
  const latest = String(release.tag_name || '').replace(/^v/i, '');
  const wanted = assetNameFor(platform, arch, portable);
  const asset = (release.assets || []).find((a) => a.name === wanted);
  return {
    current,
    latest,
    newer: !!latest && compareVersions(latest, current) > 0,
    url: asset ? asset.browser_download_url : release.html_url || RELEASES_URL,
    page: release.html_url || RELEASES_URL,
    notes: String(release.body || '').slice(0, 2000),
    publishedAt: release.published_at || null,
  };
}

/** Interroge GitHub (fetch global de Node / Electron). */
async function checkForUpdate(current, env, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(API_URL, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `3DS-Theme-Studio/${current}` },
    signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status}`);
  return parseRelease(await res.json(), current, env);
}

module.exports = { compareVersions, assetNameFor, parseRelease, checkForUpdate, API_URL, RELEASES_URL };
