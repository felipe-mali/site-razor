'use strict';

const assert = require('node:assert/strict');
const {
  PANEL_PREFIX,
  parsePort,
  parsePositiveInteger,
  responseHeaders,
  routeRequest
} = require('../gateway');

assert.equal(PANEL_PREFIX, '/funcionarios');
assert.deepEqual(routeRequest('/'), {
  target: 'clientes',
  path: '/',
  mountedAt: ''
});
assert.deepEqual(routeRequest('/health'), { health: true });
assert.deepEqual(routeRequest('/area-colaborador?origem=menu'), {
  target: 'clientes',
  path: '/area-colaborador?origem=menu',
  mountedAt: ''
});
assert.deepEqual(routeRequest('/funcionarios'), {
  redirect: '/funcionarios/'
});
assert.deepEqual(routeRequest('/funcionarios/login.html?retorno=1'), {
  target: 'funcionarios',
  path: '/login.html?retorno=1',
  mountedAt: '/funcionarios'
});
assert.deepEqual(routeRequest('/api/login'), {
  target: 'funcionarios',
  path: '/api/login',
  mountedAt: ''
});
assert.deepEqual(routeRequest('/vendor/pdfmake/pdfmake.min.js'), {
  target: 'funcionarios',
  path: '/vendor/pdfmake/pdfmake.min.js',
  mountedAt: ''
});
assert.deepEqual(routeRequest('/site-clientes'), {
  target: 'funcionarios',
  path: '/site-clientes',
  mountedAt: ''
});

assert.equal(responseHeaders({ location: '/login.html' }, PANEL_PREFIX).location, '/funcionarios/login.html');
assert.equal(responseHeaders({ location: '/' }, PANEL_PREFIX).location, '/funcionarios/');
assert.equal(responseHeaders({ location: '/' }, '').location, '/');
assert.equal(parsePort('8080', 3000, 'PORT'), 8080);
assert.throws(() => parsePort('abc', 3000, 'PORT'), /PORT/);
assert.equal(parsePositiveInteger('30000', 1000, 'TIMEOUT'), 30000);
assert.throws(() => parsePositiveInteger('0', 1000, 'TIMEOUT'), /TIMEOUT/);

console.log('Gateway: 15 verificações de roteamento e configuração aprovadas.');
