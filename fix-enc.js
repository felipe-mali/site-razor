const fs = require('fs');
const f = process.argv[2];
let c = fs.readFileSync(f, 'utf8');

// Fix double-encoded em dash
c = c.replace(/\u00c3\u00a2\u20ac\u009d/g, '\u2014');
c = c.replace(/\u00e2\u20ac\u0094/g, '\u2014');

// Fix double-encoded accented chars
const accentMap = {
  '\u00c3\u00a7': '\u00e7', '\u00c3\u00a3': '\u00e3',
  '\u00c3\u00a1': '\u00e1', '\u00c3\u00b3': '\u00f3',
  '\u00c3\u00b5': '\u00f5', '\u00c3\u00aa': '\u00ea',
  '\u00c3\u00b4': '\u00f4', '\u00c3\u00a0': '\u00e0',
  '\u00c3\u0095': '\u00d5', '\u00c3\u0089': '\u00c9',
  '\u00c3\u0081': '\u00c1', '\u00c3\u0083': '\u00c3',
  '\u00c3\u00ae': '\u00ee', '\u00c3\u00a8': '\u00e8',
  '\u00c3\u00a4': '\u00e4', '\u00c3\u00b6': '\u00f6',
  '\u00c3\u00bc': '\u00fc', '\u00c3\u009c': '\u00dc',
  '\u00c3\u00b2': '\u00f2', '\u00c3\u00ac': '\u00ec',
};
for (const [bad, good] of Object.entries(accentMap)) {
  while (c.includes(bad)) c = c.replace(bad, good);
}

// Fix double-encoded emojis -> HTML entities
c = c.replace(/\u00e2\u009d\u0097\u00e2\u0080\u008d/g, '&#128100;');
c = c.replace(/\u00e2\u009c\u0082\u00ef\u00b8\u008f/g, '&#128444;&#65039;');
c = c.replace(/\u00e2\u009c\u0082/g, '&#128193;');
c = c.replace(/\u00e2\u009c\u008f/g, '&#128247;');
c = c.replace(/\u00e2\u009a\u00a0\u00ef\u00b8\u008f/g, '&#9888;&#65039;');

// Also fix any remaining single-byte mojibake
c = c.replace(/\u00c3\u00b2/g, '\u00f2');

fs.writeFileSync(f, c, 'utf8');
console.log('Encoding fixed successfully');