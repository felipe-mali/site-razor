'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const productionOnly = process.argv.includes('--production');

function runNpm(args, cwd) {
  if (process.env.npm_execpath) {
    return spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
      cwd,
      stdio: 'inherit',
      windowsHide: true
    });
  }
  return spawnSync(npmCommand, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32'
  });
}

for (const app of ['clientes', 'funcionarios']) {
  console.log(`\nInstalando dependências de ${app}...`);
  const args = ['ci', '--ignore-scripts'];
  if (productionOnly) args.push('--omit=dev');

  const result = runNpm(args, path.join(ROOT, app));
  if (result.error) {
    console.error(`Não foi possível executar npm em ${app}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log('\nDependências dos dois módulos instaladas com sucesso.');
