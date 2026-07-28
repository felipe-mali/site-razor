'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = __dirname;
const PANEL_PREFIX = '/funcionarios';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

function loadRootEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function parsePort(value, fallback, name) {
  const port = Number(value || fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} deve ser uma porta entre 1 e 65535.`);
  }
  return port;
}

function parsePositiveInteger(value, fallback, name) {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} deve ser um número inteiro positivo.`);
  }
  return parsed;
}

function routeRequest(requestUrl) {
  const parsed = new URL(requestUrl || '/', 'http://gateway.local');
  const pathname = parsed.pathname;

  if (pathname === '/health') {
    return { health: true };
  }

  if (pathname === PANEL_PREFIX) {
    return { redirect: `${PANEL_PREFIX}/${parsed.search}` };
  }

  if (pathname.startsWith(`${PANEL_PREFIX}/`)) {
    const strippedPath = pathname.slice(PANEL_PREFIX.length) || '/';
    return {
      target: 'funcionarios',
      path: `${strippedPath}${parsed.search}`,
      mountedAt: PANEL_PREFIX
    };
  }

  if (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/vendor' ||
    pathname.startsWith('/vendor/') ||
    pathname === '/site-clientes'
  ) {
    return {
      target: 'funcionarios',
      path: `${pathname}${parsed.search}`,
      mountedAt: ''
    };
  }

  return {
    target: 'clientes',
    path: `${pathname}${parsed.search}`,
    mountedAt: ''
  };
}

function forwardedHeaders(request) {
  const headers = { ...request.headers };
  for (const header of HOP_BY_HOP_HEADERS) delete headers[header];

  const remoteAddress = request.socket.remoteAddress || '';
  headers['x-forwarded-for'] = headers['x-forwarded-for']
    ? `${headers['x-forwarded-for']}, ${remoteAddress}`
    : remoteAddress;
  headers['x-forwarded-host'] = request.headers.host || '';
  headers['x-forwarded-proto'] =
    String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  return headers;
}

function responseHeaders(upstreamHeaders, mountedAt) {
  const headers = { ...upstreamHeaders };
  for (const header of HOP_BY_HOP_HEADERS) delete headers[header];

  if (mountedAt && typeof headers.location === 'string' && headers.location.startsWith('/')) {
    headers.location =
      headers.location === '/'
        ? `${mountedAt}/`
        : `${mountedAt}${headers.location}`;
  }
  return headers;
}

function proxyRequest(request, response, target, requestPath, mountedAt, timeoutMs) {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: target.port,
      method: request.method,
      path: requestPath,
      headers: forwardedHeaders(request)
    },
    upstreamResponse => {
      response.writeHead(
        upstreamResponse.statusCode || 502,
        responseHeaders(upstreamResponse.headers, mountedAt)
      );
      upstreamResponse.pipe(response);
    }
  );

  upstream.setTimeout(timeoutMs, () => {
    upstream.destroy(new Error(`Tempo limite ao acessar o módulo ${target.name}.`));
  });
  upstream.on('error', error => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        error: `Módulo ${target.name} indisponível.`,
        detail: process.env.NODE_ENV === 'production' ? undefined : error.message
      })
    );
  });
  request.pipe(upstream);
}

function startModule(name, cwd, port, extraEnv) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd,
    env: {
      ...process.env,
      ...extraEnv,
      PORT: String(port),
      HOST: '127.0.0.1'
    },
    stdio: 'inherit',
    windowsHide: true
  });
  child.moduleName = name;
  return child;
}

function waitForHttp(port, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      const request = http.get(
        {
          hostname: '127.0.0.1',
          port,
          path: '/',
          timeout: 1000
        },
        response => {
          response.resume();
          resolve();
        }
      );
      request.on('timeout', () => request.destroy());
      request.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`O serviço na porta ${port} não ficou pronto a tempo.`));
          return;
        }
        setTimeout(attempt, 200);
      });
    }
    attempt();
  });
}

function checkModuleHealth(target, timeoutMs) {
  return new Promise(resolve => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port: target.port,
        path: '/health',
        timeout: timeoutMs
      },
      response => {
        response.resume();
        resolve(response.statusCode === 200);
      }
    );
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', () => resolve(false));
  });
}

async function main() {
  loadRootEnv();

  const gatewayPort = parsePort(process.env.PORT, 8080, 'PORT');
  const gatewayHost = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
  const clientesPort = parsePort(
    process.env.CLIENTES_INTERNAL_PORT,
    3000,
    'CLIENTES_INTERNAL_PORT'
  );
  const funcionariosPort = parsePort(
    process.env.FUNCIONARIOS_INTERNAL_PORT,
    3001,
    'FUNCIONARIOS_INTERNAL_PORT'
  );
  const timeoutMs = parsePositiveInteger(
    process.env.PROXY_TIMEOUT_MS,
    30000,
    'PROXY_TIMEOUT_MS'
  );
  const startupTimeoutMs = parsePositiveInteger(
    process.env.STARTUP_TIMEOUT_MS,
    20000,
    'STARTUP_TIMEOUT_MS'
  );
  const healthTimeoutMs = parsePositiveInteger(
    process.env.HEALTH_TIMEOUT_MS,
    3000,
    'HEALTH_TIMEOUT_MS'
  );

  if (new Set([gatewayPort, clientesPort, funcionariosPort]).size !== 3) {
    throw new Error('PORT e as portas internas precisam ser diferentes entre si.');
  }

  const targets = {
    clientes: { name: 'clientes', port: clientesPort },
    funcionarios: { name: 'funcionarios', port: funcionariosPort }
  };
  const children = [
    startModule('clientes', path.join(ROOT, 'clientes'), clientesPort, {
      FUNCIONARIOS_URL: process.env.FUNCIONARIOS_URL || `${PANEL_PREFIX}/`
    }),
    startModule('funcionarios', path.join(ROOT, 'funcionarios'), funcionariosPort, {
      CLIENTES_URL: process.env.CLIENTES_URL || '/'
    })
  ];

  let shuttingDown = false;
  let server;

  function shutdown(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    if (server) server.close();
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    }
    setTimeout(() => process.exit(exitCode), 1500).unref();
  }

  for (const child of children) {
    child.on('exit', (code, signal) => {
      if (shuttingDown) return;
      console.error(
        `O módulo ${child.moduleName} encerrou inesperadamente ` +
          `(código ${code ?? 'n/a'}, sinal ${signal ?? 'n/a'}).`
      );
      shutdown(code || 1);
    });
  }
  process.once('SIGINT', () => shutdown(0));
  process.once('SIGTERM', () => shutdown(0));

  try {
    await Promise.all([
      waitForHttp(clientesPort, startupTimeoutMs),
      waitForHttp(funcionariosPort, startupTimeoutMs)
    ]);
  } catch (error) {
    shutdown(1);
    throw error;
  }

  server = http.createServer(async (request, response) => {
    const route = routeRequest(request.url);
    if (route.health) {
      const checks = await Promise.all(
        Object.values(targets).map(async target => ({
          service: target.name,
          ok: await checkModuleHealth(target, healthTimeoutMs)
        }))
      );
      const healthy = checks.every(check => check.ok);
      response.writeHead(healthy ? 200 : 503, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      });
      response.end(
        JSON.stringify({
          status: healthy ? 'ok' : 'degraded',
          service: 'gateway',
          modules: Object.fromEntries(checks.map(check => [check.service, check.ok]))
        })
      );
      return;
    }
    if (route.redirect) {
      response.writeHead(308, { location: route.redirect });
      response.end();
      return;
    }
    proxyRequest(
      request,
      response,
      targets[route.target],
      route.path,
      route.mountedAt,
      timeoutMs
    );
  });

  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });
  server.listen(gatewayPort, gatewayHost, () => {
    console.log(`Plataforma Razor disponível em ${gatewayHost}:${gatewayPort}.`);
    console.log(`Site público: / | Painel interno: ${PANEL_PREFIX}/`);
  });
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Falha ao iniciar a plataforma: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  PANEL_PREFIX,
  loadRootEnv,
  parsePort,
  parsePositiveInteger,
  responseHeaders,
  routeRequest
};
