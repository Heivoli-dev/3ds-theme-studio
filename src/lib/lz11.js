'use strict';
// Compression / décompression LZ11 (format utilisé par body_LZ.bin des thèmes 3DS)
// © heivoli-network.fr

function compress(input) {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const n = src.length;
  const out = [];
  out.push(0x11, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff);

  const HASH_SIZE = 1 << 15;
  const MAX_CHAIN = 96;
  const WINDOW = 0x1000;
  const MAX_LEN = 0x10110;
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const hash = (i) => ((src[i] << 10) ^ (src[i + 1] << 5) ^ src[i + 2]) & (HASH_SIZE - 1);
  const insert = (i) => {
    if (i + 2 >= n) return;
    const h = hash(i);
    prev[i] = head[h];
    head[h] = i;
  };

  let pos = 0;
  while (pos < n) {
    const flagIndex = out.length;
    out.push(0);
    let flags = 0;
    for (let b = 0; b < 8 && pos < n; b++) {
      let bestLen = 0, bestDisp = 0;
      if (pos + 2 < n) {
        let cand = head[hash(pos)];
        let chain = 0;
        const maxLen = Math.min(MAX_LEN, n - pos);
        while (cand >= 0 && pos - cand <= WINDOW && chain++ < MAX_CHAIN) {
          if (src[cand] === src[pos] && src[cand + 1] === src[pos + 1]) {
            let l = 2;
            while (l < maxLen && src[cand + l] === src[pos + l]) l++;
            if (l > bestLen) { bestLen = l; bestDisp = pos - cand; if (l === maxLen) break; }
          }
          cand = prev[cand];
        }
      }
      if (bestLen >= 3) {
        flags |= 0x80 >> b;
        const d = bestDisp - 1;
        if (bestLen <= 0x10) {
          out.push(((bestLen - 1) << 4) | (d >> 8), d & 0xff);
        } else if (bestLen <= 0x110) {
          const l = bestLen - 0x11;
          out.push(l >> 4, ((l & 0xf) << 4) | (d >> 8), d & 0xff);
        } else {
          const l = bestLen - 0x111;
          out.push(0x10 | (l >> 12), (l >> 4) & 0xff, ((l & 0xf) << 4) | (d >> 8), d & 0xff);
        }
        for (let k = 0; k < bestLen; k++) insert(pos + k);
        pos += bestLen;
      } else {
        out.push(src[pos]);
        insert(pos);
        pos++;
      }
    }
    out[flagIndex] = flags;
  }
  while (out.length % 4) out.push(0);
  return Uint8Array.from(out);
}

function decompress(input) {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (src[0] !== 0x11) throw new Error('Pas un flux LZ11');
  const size = src[1] | (src[2] << 8) | (src[3] << 16);
  const out = new Uint8Array(size);
  let ip = 4, op = 0;
  while (op < size) {
    const flags = src[ip++];
    for (let b = 0; b < 8 && op < size; b++) {
      if (flags & (0x80 >> b)) {
        const b0 = src[ip++];
        let len, disp;
        const ind = b0 >> 4;
        if (ind === 0) {
          const b1 = src[ip++], b2 = src[ip++];
          len = (((b0 & 0xf) << 4) | (b1 >> 4)) + 0x11;
          disp = (((b1 & 0xf) << 8) | b2) + 1;
        } else if (ind === 1) {
          const b1 = src[ip++], b2 = src[ip++], b3 = src[ip++];
          len = (((b0 & 0xf) << 12) | (b1 << 4) | (b2 >> 4)) + 0x111;
          disp = (((b2 & 0xf) << 8) | b3) + 1;
        } else {
          const b1 = src[ip++];
          len = ind + 1;
          disp = (((b0 & 0xf) << 8) | b1) + 1;
        }
        for (let k = 0; k < len; k++, op++) out[op] = out[op - disp];
      } else {
        out[op++] = src[ip++];
      }
    }
  }
  return out;
}

module.exports = { compress, decompress };
