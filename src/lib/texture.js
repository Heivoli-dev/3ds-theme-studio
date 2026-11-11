'use strict';
// Encodage de textures 3DS : RGB565, tuiles 8x8 en ordre de Morton (Z-order)
// © heivoli-network.fr

function mortonXY(i) {
  // bits pairs -> x, bits impairs -> y
  const x = (i & 1) | ((i >> 1) & 2) | ((i >> 2) & 4);
  const y = ((i >> 1) & 1) | ((i >> 2) & 2) | ((i >> 3) & 4);
  return [x, y];
}
const MORTON = Array.from({ length: 64 }, (_, i) => mortonXY(i));

function rgb565(r, g, b) {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

/**
 * Encode une image RGBA (srcW x srcH) dans une texture texW x texH (puissances de 2),
 * placée en haut à gauche. Le reste est noir.
 */
function encodeRGB565Tiled(rgba, srcW, srcH, texW, texH) {
  const out = new Uint8Array(texW * texH * 2);
  let o = 0;
  for (let ty = 0; ty < texH; ty += 8) {
    for (let tx = 0; tx < texW; tx += 8) {
      for (let k = 0; k < 64; k++) {
        const x = tx + MORTON[k][0];
        const y = ty + MORTON[k][1];
        let v = 0;
        if (x < srcW && y < srcH) {
          const p = (y * srcW + x) * 4;
          v = rgb565(rgba[p], rgba[p + 1], rgba[p + 2]);
        }
        out[o++] = v & 0xff;
        out[o++] = v >> 8;
      }
    }
  }
  return out;
}

/** Décodage inverse (utilisé pour les tests) -> RGBA */
function decodeRGB565Tiled(buf, texW, texH) {
  const out = new Uint8Array(texW * texH * 4);
  let o = 0;
  for (let ty = 0; ty < texH; ty += 8) {
    for (let tx = 0; tx < texW; tx += 8) {
      for (let k = 0; k < 64; k++) {
        const v = buf[o] | (buf[o + 1] << 8); o += 2;
        const x = tx + MORTON[k][0], y = ty + MORTON[k][1];
        const p = (y * texW + x) * 4;
        out[p] = ((v >> 11) & 0x1f) * 255 / 31;
        out[p + 1] = ((v >> 5) & 0x3f) * 255 / 63;
        out[p + 2] = (v & 0x1f) * 255 / 31;
        out[p + 3] = 255;
      }
    }
  }
  return out;
}

module.exports = { encodeRGB565Tiled, decodeRGB565Tiled, rgb565 };
