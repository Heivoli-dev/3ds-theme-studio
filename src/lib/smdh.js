'use strict';
// Génération de info.smdh (titre, description, auteur, icônes 48x48 et 24x24)
// © heivoli-network.fr
const { encodeRGB565Tiled } = require('./texture');

const SMDH_SIZE = 0x36c0;

function writeUtf16(buf, offset, str, maxBytes) {
  const maxChars = maxBytes / 2 - 1;
  const s = String(str || '').slice(0, maxChars);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    buf[offset + i * 2] = c & 0xff;
    buf[offset + i * 2 + 1] = c >> 8;
  }
}

/**
 * @param {{title:string, description:string, author:string, icon48:Uint8Array, icon24:Uint8Array}} o
 * icon48 / icon24 : RGBA
 */
function buildSmdh(o) {
  const buf = new Uint8Array(SMDH_SIZE);
  buf.set([0x53, 0x4d, 0x44, 0x48], 0); // "SMDH"
  // version 0, réservé 0
  for (let lang = 0; lang < 16; lang++) {
    const base = 0x8 + lang * 0x200;
    writeUtf16(buf, base, o.title, 0x80);
    writeUtf16(buf, base + 0x80, o.description, 0x100);
    writeUtf16(buf, base + 0x180, o.author, 0x80);
  }
  // Paramètres : région "toutes", visible
  const dv = new DataView(buf.buffer);
  dv.setUint32(0x2018, 0x7fffffff, true); // region lockout : toutes
  dv.setUint32(0x2028, 0x0001, true);     // flags : visible
  if (o.icon24) buf.set(encodeRGB565Tiled(o.icon24, 24, 24, 24, 24), 0x2040);
  if (o.icon48) buf.set(encodeRGB565Tiled(o.icon48, 48, 48, 48, 48), 0x24c0);
  return buf;
}

module.exports = { buildSmdh, SMDH_SIZE };
