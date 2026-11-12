'use strict';
// Assemblage d'un thème compatible Anemone3DS (zip : body_LZ.bin, info.smdh, preview.png, bgm.bcstm)
// © heivoli-network.fr
const { buildBody } = require('./body');
const { buildSmdh } = require('./smdh');
const { createZip } = require('./zip');

// Limites de la console (taille des caches de thème du menu HOME) et de l'appli
const LIMITS = {
  body: 0x150000,          // body_LZ.bin compressé : 1 344 Ko (BodyCache)
  bgm: 0x337000,           // bgm.bcstm : 3 292 Ko (BgmCache)
  preview: 512 * 1024,     // preview.png : 512 Ko
  total: 5 * 1024 * 1024,  // archive complète : 5 Mo
};

class ThemeTooLargeError extends Error {}
const ko = (n) => `${Math.ceil(n / 1024).toLocaleString('fr-FR')} Ko`;

/** Vérifie chaque fichier et l'archive complète ; lève une erreur lisible si une limite est dépassée. */
function checkSizes(sizes) {
  const labels = { body: 'Les images du thème (body_LZ.bin)', bgm: 'La musique (bgm.bcstm)', preview: "L'aperçu (preview.png)", total: 'Le thème complet' };
  for (const k of Object.keys(LIMITS)) {
    if (sizes[k] > LIMITS[k]) throw new ThemeTooLargeError(`${labels[k]} pèse ${ko(sizes[k])}, la limite est de ${ko(LIMITS[k])}.`);
  }
}

/**
 * @param {object} t
 * @param {Uint8Array} t.top      RGBA 412x240
 * @param {Uint8Array} t.bottom   RGBA 320x240
 * @param {Uint8Array} t.icon48   RGBA 48x48
 * @param {Uint8Array} t.icon24   RGBA 24x24
 * @param {Uint8Array} t.preview  PNG 412x480
 * @param {Uint8Array} [t.bgm]    fichier .bcstm
 * @param {string} t.title @param {string} t.description @param {string} t.author
 */
function buildThemeZip(t) {
  return buildTheme(t).zip;
}

/** Construit le thème et retourne { zip, sizes } après vérification des limites. */
function buildTheme(t) {
  if (t.bgm && t.bgm.length > LIMITS.bgm) checkSizes({ bgm: t.bgm.length });
  const { lz } = buildBody({ top: t.top, bottom: t.bottom, bgm: !!t.bgm });
  const smdh = buildSmdh(t);
  const files = [
    { name: 'body_LZ.bin', data: lz },
    { name: 'info.smdh', data: smdh },
    { name: 'preview.png', data: t.preview },
  ];
  if (t.bgm) files.push({ name: 'bgm.bcstm', data: t.bgm });
  const zip = createZip(files);
  const sizes = { body: lz.length, bgm: t.bgm ? t.bgm.length : 0, preview: t.preview.length, smdh: smdh.length, total: zip.length };
  checkSizes(sizes);
  return { zip, sizes };
}

function safeFileName(name) {
  const ascii = String(name || 'Theme').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (ascii.replace(/[^\w\- ]+/g, '').trim() || 'Theme').slice(0, 48);
}

module.exports = { buildTheme, buildThemeZip, safeFileName, checkSizes, LIMITS, ThemeTooLargeError };
