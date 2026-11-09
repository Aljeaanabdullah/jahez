// Converts the IBM Plex Sans Arabic WOFF files from @fontsource into TTF files
// for the PDF export (pdf-lib reads TTF). Run: node scripts/woff-to-ttf.mjs
// The font is licensed under the SIL Open Font License 1.1 (see src/fonts/OFL.txt).
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const src = 'node_modules/@fontsource/ibm-plex-sans-arabic/files/';
const out = 'src/fonts/';

function woffToTtf(woff) {
  const numTables = woff.readUInt16BE(12);
  const flavor = woff.readUInt32BE(4);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const tag = woff.readUInt32BE(o);
    const offset = woff.readUInt32BE(o + 4);
    const compLength = woff.readUInt32BE(o + 8);
    const origLength = woff.readUInt32BE(o + 12);
    const checksum = woff.readUInt32BE(o + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? inflateSync(raw) : Buffer.from(raw);
    tables.push({ tag, checksum, data });
  }
  let searchRange = 1, entrySelector = 0;
  while (searchRange * 2 <= numTables) { searchRange *= 2; entrySelector++; }
  searchRange *= 16;
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange, 10);
  let offset = header.length;
  const bodies = [];
  tables.forEach((t, i) => {
    const o = 12 + i * 16;
    header.writeUInt32BE(t.tag, o);
    header.writeUInt32BE(t.checksum, o + 4);
    header.writeUInt32BE(offset, o + 8);
    header.writeUInt32BE(t.data.length, o + 12);
    const padded = Buffer.alloc((t.data.length + 3) & ~3);
    t.data.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  });
  return Buffer.concat([header, ...bodies]);
}

for (const subset of ['arabic', 'latin']) {
  for (const weight of ['400', '700']) {
    const name = `ibm-plex-sans-arabic-${subset}-${weight}-normal`;
    writeFileSync(`${out}${name}.ttf`, woffToTtf(readFileSync(`${src}${name}.woff`)));
    console.log(`${out}${name}.ttf`);
  }
}
copyFileSync('node_modules/@fontsource/ibm-plex-sans-arabic/LICENSE', `${out}OFL.txt`);
