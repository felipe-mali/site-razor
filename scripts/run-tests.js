'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) {
    console.error(`Falha ao executar ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

function runNpm(args, cwd) {
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args], cwd);
    return;
  }
  const result = spawnSync(npmCommand, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32'
  });
  if (result.error) {
    console.error(`Falha ao executar npm: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

run(process.execPath, ['scripts/verify-portability.js'], ROOT);
run(process.execPath, ['scripts/test-gateway.js'], ROOT);
runNpm(['test'], path.join(ROOT, 'funcionarios'));

console.log('\nValidação completa da plataforma concluída.');
