'use strict';
// Assemblage d'un thème compatible Anemone3DS (zip : body_LZ.bin, info.smdh, preview.png, bgm.bcstm)
// © heivoli-network.fr
const { buildBody } = require('./body');
const { buildSmdh } = require('./smdh');
const { createZip } = require('./zip');

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
  const { lz } = buildBody({ top: t.top, bottom: t.bottom, bgm: !!t.bgm });
  const smdh = buildSmdh(t);
  const files = [
    { name: 'body_LZ.bin', data: lz },
    { name: 'info.smdh', data: smdh },
    { name: 'preview.png', data: t.preview },
  ];
  if (t.bgm) files.push({ name: 'bgm.bcstm', data: t.bgm });
  return createZip(files);
}

function safeFileName(name) {
  const ascii = String(name || 'Theme').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (ascii.replace(/[^\w\- ]+/g, '').trim() || 'Theme').slice(0, 48);
}

module.exports = { buildThemeZip, safeFileName };
