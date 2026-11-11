'use strict';
// Génération de body_LZ.bin (données du thème du menu HOME de la 3DS)
// Structure : en-tête 0xD0 octets, puis textures RGB565 tuilées.
// © heivoli-network.fr
const { encodeRGB565Tiled } = require('./texture');
const lz11 = require('./lz11');

const HEADER_SIZE = 0xd0;
// Écran du haut : image statique 412x240 dans une texture 512x256
const TOP_W = 412, TOP_H = 240, TOP_TEX_W = 512, TOP_TEX_H = 256;
// Écran du bas : image statique 320x240 dans une texture 512x256
const BOT_W = 320, BOT_H = 240, BOT_TEX_W = 512, BOT_TEX_H = 256;

const DRAW_TEXTURE = 3;
const FRAME_STATIC = 1;

/**
 * @param {{top:Uint8Array, bottom:Uint8Array, bgm:boolean}} o  (RGBA 412x240 et 320x240)
 * @returns {{raw:Uint8Array, lz:Uint8Array}}
 */
function buildBody(o) {
  const topTex = encodeRGB565Tiled(o.top, TOP_W, TOP_H, TOP_TEX_W, TOP_TEX_H);
  const botTex = encodeRGB565Tiled(o.bottom, BOT_W, BOT_H, BOT_TEX_W, BOT_TEX_H);
  const topOff = HEADER_SIZE;
  const botOff = topOff + topTex.length;
  const raw = new Uint8Array(botOff + botTex.length);
  const dv = new DataView(raw.buffer);

  dv.setUint32(0x00, 1, true);            // version
  raw[0x05] = o.bgm ? 1 : 0;              // musique (bgm.bcstm)
  dv.setUint32(0x0c, DRAW_TEXTURE, true); // haut : texture
  dv.setUint32(0x10, FRAME_STATIC, true); // haut : statique
  dv.setUint32(0x18, topOff, true);       // haut : offset texture
  dv.setUint32(0x20, DRAW_TEXTURE, true); // bas : texture
  dv.setUint32(0x24, FRAME_STATIC, true); // bas : statique
  dv.setUint32(0x28, botOff, true);       // bas : offset texture

  raw.set(topTex, topOff);
  raw.set(botTex, botOff);
  return { raw, lz: lz11.compress(raw) };
}

module.exports = { buildBody, TOP_W, TOP_H, BOT_W, BOT_H, HEADER_SIZE };
