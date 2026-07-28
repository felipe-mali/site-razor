'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];
let checkedReferences = 0;

const REQUIRED_FILES = [
  'package.json',
  'package-lock.json',
  'gateway.js',
  'scripts/smoke-deployment.js',
  '.env.example',
  'clientes/package.json',
  'clientes/package-lock.json',
  'clientes/.env.example',
  'clientes/server.js',
  'funcionarios/package.json',
  'funcionarios/package-lock.json',
  'funcionarios/.env.example',
  'funcionarios/server.js',
  'funcionarios/public/dados/producao.csv',
  'funcionarios/public/fotos/logo-comprovante.png',
  'funcionarios/public/js/dados-brasileiros.js',
  'funcionarios/test-crm.js',
  'funcionarios/data/usuarios.json'
];
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.mimocode',
  '_backup_reorganizacao',
  'dist',
  'legacy-funcionario',
  'node_modules'
]);
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.txt',
  '.yaml',
  '.yml'
]);

function walk(directory, options = {}) {
  const result = [];
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(fullPath, options));
    else if (!options.extension || path.extname(entry.name).toLowerCase() === options.extension) {
      result.push(fullPath);
    }
  }
  return result;
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function exactPathExists(absolutePath) {
  const normalized = path.resolve(absolutePath);
  const relativeToRoot = path.relative(ROOT, normalized);
  if (relativeToRoot === '..' || relativeToRoot.startsWith(`..${path.sep}`)) return false;

  let current = ROOT;
  const parts = relativeToRoot.split(path.sep).filter(Boolean);
  for (const part of parts) {
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) return false;
    const entries = fs.readdirSync(current);
    if (!entries.includes(part)) return false;
    current = path.join(current, part);
  }
  return fs.existsSync(current);
}

function localReferenceCandidates(base, reference) {
  const clean = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  const absolute = path.resolve(base, clean);
  return [absolute, `${absolute}.js`, `${absolute}.json`, path.join(absolute, 'index.js')];
}

function checkLocalReference(source, reference, requireStyle = false) {
  if (
    !reference ||
    reference.startsWith('#') ||
    reference.startsWith('%23') ||
    /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(reference)
  ) {
    return;
  }

  if (reference.startsWith('/')) {
    const pathname = reference.split(/[?#]/, 1)[0];
    const gatewayRoutes = [
      '/api',
      '/area-colaborador',
      '/funcionarios',
      '/site-clientes',
      '/vendor'
    ];
    if (gatewayRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
      return;
    }
  }

  checkedReferences += 1;
  const candidates = requireStyle
    ? localReferenceCandidates(path.dirname(source), reference)
    : [path.resolve(path.dirname(source), decodeURIComponent(reference.split(/[?#]/, 1)[0]))];
  if (!candidates.some(exactPathExists)) {
    errors.push(`Referência ausente ou com caixa incorreta: ${relative(source)} -> ${reference}`);
  }
}

function stableObject(value) {
  return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)));
}

function validateManifest(directory) {
  const packageFile = path.join(ROOT, directory, 'package.json');
  const lockFile = path.join(ROOT, directory, 'package-lock.json');
  const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const lockJson = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  const lockedRoot = lockJson.packages && lockJson.packages[''];

  if (lockJson.lockfileVersion !== 3) {
    warnings.push(`${directory}/package-lock.json não usa lockfileVersion 3.`);
  }
  if (
    JSON.stringify(stableObject(packageJson.dependencies)) !==
    JSON.stringify(stableObject(lockedRoot && lockedRoot.dependencies))
  ) {
    errors.push(`Dependências divergentes entre ${directory}/package.json e package-lock.json.`);
  }
}

if (Number(process.versions.node.split('.')[0]) < 20) {
  errors.push(`Node ${process.version} detectado; use Node 20 ou superior.`);
}

for (const file of REQUIRED_FILES) {
  if (!exactPathExists(path.join(ROOT, file))) errors.push(`Arquivo obrigatório ausente: ${file}`);
}

for (const directory of ['.', 'clientes', 'funcionarios']) {
  try {
    validateManifest(directory);
  } catch (error) {
    errors.push(`Manifesto inválido em ${directory}: ${error.message}`);
  }
}

for (const file of [
  ...walk(path.join(ROOT, 'clientes', 'public'), { extension: '.html' }),
  ...walk(path.join(ROOT, 'funcionarios', 'public'), { extension: '.html' })
]) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    checkLocalReference(file, match[1]);
  }
}

for (const file of [
  ...walk(path.join(ROOT, 'clientes', 'public'), { extension: '.css' }),
  ...walk(path.join(ROOT, 'funcionarios', 'public'), { extension: '.css' })
]) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    checkLocalReference(file, match[1]);
  }
}

for (const file of [
  ...walk(path.join(ROOT, 'clientes'), { extension: '.js' }),
  ...walk(path.join(ROOT, 'funcionarios'), { extension: '.js' }),
  path.join(ROOT, 'gateway.js')
]) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) {
    checkLocalReference(file, match[1], true);
  }
}

for (const dataFile of walk(path.join(ROOT, 'funcionarios', 'data'), { extension: '.json' })) {
  try {
    JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (error) {
    errors.push(`JSON inválido em ${relative(dataFile)}: ${error.message}`);
  }
}

const machinePathPattern =
  /(^|["'=\s(])(?:[A-Za-z]:[\\/]|file:\/\/|\/Users\/|\/home\/|\\\\[^\\\s]+\\)/im;
for (const base of [ROOT]) {
  for (const file of walk(base)) {
    if (path.resolve(file) === __filename) continue;
    const extension = path.extname(file).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension) && path.basename(file) !== 'Dockerfile') continue;
    const source = fs.readFileSync(file, 'utf8');
    if (
      machinePathPattern.test(source) ||
      /OneDrive|Área de Trabalho|\.codex[\\/]/i.test(source)
    ) {
      errors.push(`Referência a caminho de máquina local em ${relative(file)}.`);
    }
  }
}

for (const directory of ['clientes', 'funcionarios']) {
  if (fs.existsSync(path.join(ROOT, directory, '.env'))) {
    warnings.push(`${directory}/.env existe localmente; ele não entra no pacote de implantação.`);
  }
  if (fs.existsSync(path.join(ROOT, directory, 'node_modules'))) {
    warnings.push(`${directory}/node_modules existe localmente; use npm ci no servidor.`);
  }
}
if (fs.existsSync(path.join(ROOT, 'funcionarios', '_backup_reorganizacao'))) {
  warnings.push('O backup histórico existe no workspace, mas é excluído do pacote.');
}

if (warnings.length) {
  console.log('Avisos de empacotamento:');
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log('');
}

if (errors.length) {
  console.error('Falhas de portabilidade:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Portabilidade aprovada: ${REQUIRED_FILES.length} arquivos essenciais e ` +
      `${checkedReferences} referências locais verificadas.`
  );
}
