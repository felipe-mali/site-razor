'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TARGET = path.join(DIST, 'razor-deploy');
const ROOT_ENTRIES = [
  '.dockerignore',
  '.env.example',
  '.gitignore',
  'Dockerfile',
  'README.md',
  'compose.yaml',
  'gateway.js',
  'package-lock.json',
  'package.json',
  'scripts',
  'clientes',
  'funcionarios'
];
const EXCLUDED_NAMES = new Set([
  '.agents',
  '.codex',
  '.git',
  '.mimocode',
  '_backup_reorganizacao',
  'dist',
  'legacy-funcionario',
  'node_modules'
]);

function isIncluded(source) {
  const relative = path.relative(ROOT, source);
  const parts = relative.split(path.sep);
  const name = path.basename(source);
  if (parts.some(part => EXCLUDED_NAMES.has(part))) return false;
  if (
    name === '.env' ||
    name.endsWith('.log') ||
    name.endsWith('.bak') ||
    name.endsWith('.tmp') ||
    name.startsWith('.razor-write-test-')
  ) {
    return false;
  }
  return true;
}

function filesUnder(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(fullPath));
    else if (entry.isFile()) result.push(fullPath);
  }
  return result;
}

function assertSafeTarget() {
  if (path.dirname(DIST) !== ROOT || path.dirname(TARGET) !== DIST) {
    throw new Error('Destino de empacotamento fora da pasta dist.');
  }
}

assertSafeTarget();
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(TARGET, { recursive: true });

for (const entry of ROOT_ENTRIES) {
  const source = path.join(ROOT, entry);
  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo obrigatório ausente: ${entry}`);
  }
  fs.cpSync(source, path.join(TARGET, entry), {
    recursive: true,
    filter: isIncluded,
    preserveTimestamps: true
  });
}

const files = filesUnder(TARGET)
  .sort((left, right) => left.localeCompare(right))
  .map(file => {
    const content = fs.readFileSync(file);
    return {
      path: path.relative(TARGET, file).split(path.sep).join('/'),
      bytes: content.length,
      sha256: crypto.createHash('sha256').update(content).digest('hex')
    };
  });

const manifest = {
  format: 1,
  generatedAt: new Date().toISOString(),
  node: process.version,
  files
};
fs.writeFileSync(
  path.join(TARGET, 'MANIFEST.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);

const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
console.log(`Pacote criado em ${TARGET}`);
console.log(`${files.length} arquivos, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB.`);
console.log('node_modules, .git, .env, backups e artefatos locais foram excluídos.');
