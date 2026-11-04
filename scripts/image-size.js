// Read pixel dimensions from PNG / JPEG / WebP headers (no dependencies) so <img> tags get width/height.
import fs from "node:fs";
const cache = new Map();
export function imageSize(file) {
  if (cache.has(file)) return cache.get(file);
  const b = fs.readFileSync(file);
  let w = 0, h = 0;
  if (b.toString("ascii", 1, 4) === "PNG") { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
  else if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const t = b.toString("ascii", 12, 16);
    if (t === "VP8 ") { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; }
    else if (t === "VP8L") { const n = b.readUInt32LE(21); w = (n & 0x3fff) + 1; h = ((n >> 14) & 0x3fff) + 1; }
    else if (t === "VP8X") { w = 1 + b.readUIntLE(24, 3); h = 1 + b.readUIntLE(27, 3); }
  } else if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
      i += 2 + len;
    }
  }
  const r = { w, h };
  cache.set(file, r);
  return r;
}
