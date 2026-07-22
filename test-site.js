const http = require('http');

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;
let warnings = 0;
const results = [];

function test(name, fn) {
  return fn().then(ok => {
    if (ok) { passed++; results.push('  PASS  ' + name); }
    else { failed++; results.push('  FAIL  ' + name); }
  }).catch(err => { failed++; results.push('  FAIL  ' + name + ' -- ' + err.message); });
}

function warn(name, msg) { warnings++; results.push('  WARN  ' + name + ' -- ' + msg); }

function req(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var url = new URL(path, BASE);
    var options = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: method, headers: Object.assign({}, headers) };
    var r = http.request(options, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        var json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json: json });
      });
    });
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

async function main() {
  console.log('========================================');
  console.log('  TESTE COMPLETO - RAZOR INDUSTRIA');
  console.log('========================================\n');

  // FASE 1: PAGINAS HTML
  console.log('--- FASE 1: Carregamento de Paginas ---');
  var pages = [
    { name: 'index.html (Landing Page)', path: '/index.html' },
    { name: 'login.html', path: '/login.html' },
    { name: 'funcionario.html', path: '/funcionario.html' },
    { name: 'permissoes.html', path: '/permissoes.html' },
  ];
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    await test(p.name, async function() {
      var r = await req('GET', p.path);
      if (r.status !== 200) throw new Error('HTTP ' + r.status);
      if (r.body.length < 100) throw new Error('Pagina muito pequena');
      return true;
    });
  }

  // FASE 2: CSS E JS
  console.log('\n--- FASE 2: Arquivos CSS e JS ---');
  var assets = ['/css/style.css','/css/premium.css','/css/funcionario.css','/css/cancelamentos.css','/css/sidebar.css','/js/app.js','/js/login.js','/js/funcionario.js','/js/crm.js','/js/cancelamentos.js','/js/permissoes.js','/js/sidebar.js'];
  for (var i = 0; i < assets.length; i++) {
    await test('Asset: ' + assets[i], async function() {
      var r = await req('GET', assets[i]);
      if (r.status !== 200) throw new Error('HTTP ' + r.status);
      return true;
    });
  }

  // FASE 3: IMAGENS
  console.log('\n--- FASE 3: Imagens Estaticas ---');
  var images = ['/fotos/logo.jpg','/fotos/concertina.jpg','/fotos/alambrado.jpg','/fotos/redelam.jpg','/fotos/telaele.jpg','/fotos/gradil.jpg','/fotos/lanca.jpg','/fotos/art.jpg'];
  for (var i = 0; i < images.length; i++) {
    await test('Imagem: ' + images[i], async function() {
      var r = await req('GET', images[i]);
      if (r.status !== 200) throw new Error('HTTP ' + r.status);
      return true;
    });
  }

  // FASE 4: DADOS
  console.log('\n--- FASE 4: Dados ---');
  await test('producao.csv', async function() {
    var r = await req('GET', '/dados/producao.csv');
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  // FASE 5: AUTENTICACAO
  console.log('\n--- FASE 5: Autenticacao ---');
  var adminToken = null;
  var vendedorToken = null;

  await test('Login admin - credenciais validas', async function() {
    var r = await req('POST', '/api/login', { usuario: 'admin', senha: 'M@lima1980' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    if (!r.json || !r.json.success) throw new Error('Login falhou');
    adminToken = r.json.token;
    return true;
  });

  await test('Login admin - credenciais invalidas', async function() {
    var r = await req('POST', '/api/login', { usuario: 'admin', senha: 'errada' });
    if (r.status !== 401) throw new Error('Esperado 401, recebeu ' + r.status);
    return true;
  });

  await test('Login vendedor (Miqueias)', async function() {
    var r = await req('POST', '/api/login', { usuario: 'Miqueias', senha: 'M1que1as' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    vendedorToken = r.json.token;
    return true;
  });

  await test('GET /api/me - admin', async function() {
    var r = await req('GET', '/api/me', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    if (r.json.usuario !== 'admin') throw new Error('Usuario incorreto');
    return true;
  });

  await test('GET /api/me - sem token', async function() {
    var r = await req('GET', '/api/me');
    if (r.status !== 401) throw new Error('Esperado 401, recebeu ' + r.status);
    return true;
  });

  // FASE 6: CRUD USUARIOS
  console.log('\n--- FASE 6: CRUD Usuarios ---');
  await test('GET /api/usuarios - admin', async function() {
    var r = await req('GET', '/api/usuarios', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    var users = Object.keys(r.json);
    if (users.length < 5) throw new Error('Esperado >=5 usuarios, recebeu ' + users.length);
    return true;
  });

  await test('GET /api/usuarios - vendedor (403)', async function() {
    var r = await req('GET', '/api/usuarios', null, { Authorization: 'Bearer ' + vendedorToken });
    if (r.status !== 403) throw new Error('Esperado 403, recebeu ' + r.status);
    return true;
  });

  var testUserId = 'test_user_' + Date.now();
  await test('POST /api/usuarios - criar usuario teste', async function() {
    var r = await req('POST', '/api/usuarios', { usuario: testUserId, nome: 'Usuario Teste', senha: 'teste123', cargo: 'funcionario', ativo: true, permissoes: { pode_ver_funcionario: true, pode_ver_imagens: false, pode_editar_imagens: false, pode_gerenciar_permissoes: false } }, { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('PUT /api/usuarios/:id - atualizar', async function() {
    var r = await req('PUT', '/api/usuarios/' + testUserId, { nome: 'Atualizado', cargo: 'funcionario', ativo: true, permissoes: { pode_ver_funcionario: true } }, { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('DELETE /api/usuarios/:id - excluir', async function() {
    var r = await req('DELETE', '/api/usuarios/' + testUserId, null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  // FASE 7: VENDEDORES
  console.log('\n--- FASE 7: Vendedores ---');
  await test('GET /api/vendedores', async function() {
    var r = await req('GET', '/api/vendedores', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    if (!Array.isArray(r.json) || r.json.length < 1) throw new Error('Nenhum vendedor');
    return true;
  });

  // FASE 8: CATEGORIAS
  console.log('\n--- FASE 8: Categorias e Imagens ---');
  await test('GET /api/categories', async function() {
    var r = await req('GET', '/api/categories', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  var testCat = 'test_cat_' + Date.now();
  await test('POST /api/categories - criar', async function() {
    var r = await req('POST', '/api/categories', { name: testCat }, { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('GET /api/images/:category', async function() {
    var r = await req('GET', '/api/images/' + testCat, null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('DELETE /api/categories/:name', async function() {
    var r = await req('DELETE', '/api/categories/' + testCat, null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  // FASE 9: FOTOS CLIENTES
  console.log('\n--- FASE 9: Fotos de Clientes ---');
  await test('GET /api/fotos/pastas', async function() {
    var r = await req('GET', '/api/fotos/pastas', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('GET /api/fotos/listar', async function() {
    var r = await req('GET', '/api/fotos/listar', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  var testFolder = 'test_folder_' + Date.now();
  await test('POST /api/fotos/pastas - criar', async function() {
    var r = await req('POST', '/api/fotos/pastas', { nome: testFolder }, { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('DELETE /api/fotos/pastas/:nome - excluir', async function() {
    var r = await req('DELETE', '/api/fotos/pastas/' + encodeURIComponent(testFolder), null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  // FASE 10: TAGS
  console.log('\n--- FASE 10: Tags ---');
  await test('GET /api/tags/all', async function() {
    var r = await req('GET', '/api/tags/all', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('POST /api/tags - adicionar', async function() {
    var r = await req('POST', '/api/tags', { image: 'test.jpg', category: 'test', tag: 'test_tag' }, { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('GET /api/search?q=test_tag', async function() {
    var r = await req('GET', '/api/search?q=test_tag', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('DELETE /api/tags/0 - remover', async function() {
    var r = await req('DELETE', '/api/tags/0', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  // FASE 11: CANCELAMENTOS
  console.log('\n--- FASE 11: Cancelamentos ---');
  await test('GET /api/cancelamentos', async function() {
    var r = await req('GET', '/api/cancelamentos', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  var cancelId = null;
  await test('POST /api/cancelamentos - criar (vendedor)', async function() {
    var r = await req('POST', '/api/cancelamentos', { solicitante: 'Teste', data: new Date().toISOString(), canal: 'WhatsApp', motivo: '1', observacoes: 'Teste' }, { Authorization: 'Bearer ' + vendedorToken, 'Content-Type': 'application/json' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    cancelId = r.json.cancelamento.id;
    return true;
  });

  await test('PUT /api/cancelamentos/:id - atualizar', async function() {
    if (!cancelId) throw new Error('ID nao disponivel');
    var r = await req('PUT', '/api/cancelamentos/' + cancelId, { solicitante: 'Atualizado' }, { Authorization: 'Bearer ' + vendedorToken, 'Content-Type': 'application/json' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('DELETE /api/cancelamentos/:id - excluir', async function() {
    if (!cancelId) throw new Error('ID nao disponivel');
    var r = await req('DELETE', '/api/cancelamentos/' + cancelId, null, { Authorization: 'Bearer ' + vendedorToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('POST /api/cancelamentos - admin nao pode criar (403)', async function() {
    var r = await req('POST', '/api/cancelamentos', { solicitante: 'Teste', canal: 'Telefone', motivo: '1' }, { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' });
    if (r.status !== 403) throw new Error('Esperado 403, recebeu ' + r.status);
    return true;
  });

  // FASE 12: PERMISSOES
  console.log('\n--- FASE 12: Permissoes por Role ---');
  var logisticaToken = null;
  await test('Login kelvin (logistica)', async function() {
    var r = await req('POST', '/api/login', { usuario: 'kelvin', senha: 'logistica' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    logisticaToken = r.json.token;
    return true;
  });

  await test('kelvin: GET /api/categories - pode ver', async function() {
    var r = await req('GET', '/api/categories', null, { Authorization: 'Bearer ' + logisticaToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('kelvin: POST /api/categories - 403', async function() {
    var r = await req('POST', '/api/categories', { name: 'test' }, { Authorization: 'Bearer ' + logisticaToken, 'Content-Type': 'application/json' });
    if (r.status !== 403) throw new Error('Esperado 403, recebeu ' + r.status);
    return true;
  });

  await test('kelvin: GET /api/usuarios - 403', async function() {
    var r = await req('GET', '/api/usuarios', null, { Authorization: 'Bearer ' + logisticaToken });
    if (r.status !== 403) throw new Error('Esperado 403, recebeu ' + r.status);
    return true;
  });

  // FASE 13: CONTEUDO
  console.log('\n--- FASE 13: Conteudo das Paginas ---');
  await test('index.html tem hero section', async function() {
    var r = await req('GET', '/index.html');
    return r.body.includes('hero') || r.body.includes('HERO');
  });

  await test('index.html tem secao produtos', async function() {
    var r = await req('GET', '/index.html');
    return r.body.includes('produtos') || r.body.includes('PRODUTOS');
  });

  await test('index.html tem formulario cotacao', async function() {
    var r = await req('GET', '/index.html');
    return r.body.includes('productSelector') || r.body.includes('cotacao');
  });

  await test('index.html tem WhatsApp link', async function() {
    var r = await req('GET', '/index.html');
    return r.body.includes('wa.me') || r.body.includes('whatsapp');
  });

  await test('login.html tem form login', async function() {
    var r = await req('GET', '/login.html');
    return r.body.includes('login-form') && r.body.includes('usuario') && r.body.includes('senha');
  });

  await test('funcionario.html tem sidebar', async function() {
    var r = await req('GET', '/funcionario.html');
    return r.body.includes('sidebar');
  });

  await test('funcionario.html tem 8 abas', async function() {
    var r = await req('GET', '/funcionario.html');
    var tabs = ['tela-producao','tela-conversor','tela-mureta','tela-malha','tela-fotos','tela-crm','tela-cancelamentos','tela-dashboard'];
    for (var t = 0; t < tabs.length; t++) {
      if (!r.body.includes(tabs[t])) throw new Error('Falta aba: ' + tabs[t]);
    }
    return true;
  });

  await test('permissoes.html tem tabela usuarios', async function() {
    var r = await req('GET', '/permissoes.html');
    return r.body.includes('tabela-usuarios');
  });

  // FASE 14: LOGOUT
  console.log('\n--- FASE 14: Logout ---');
  await test('POST /api/logout', async function() {
    var r = await req('POST', '/api/logout', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return true;
  });

  await test('Token invalido apos logout', async function() {
    var r = await req('GET', '/api/me', null, { Authorization: 'Bearer ' + adminToken });
    if (r.status !== 401) throw new Error('Esperado 401, recebeu ' + r.status);
    return true;
  });

  // FASE 15: 404
  console.log('\n--- FASE 15: Recursos Inexistentes ---');
  await test('Pagina inexistente = 404', async function() {
    var r = await req('GET', '/naoexiste.html');
    return r.status === 404;
  });

  await test('API inexistente = 404', async function() {
    var r = await req('GET', '/api/naoexiste');
    return r.status === 404;
  });

  // RESULTADOS
  console.log('\n========================================');
  console.log('  RESULTADO FINAL');
  console.log('========================================');
  results.forEach(function(r) { console.log(r); });
  console.log('----------------------------------------');
  console.log('  Total: ' + (passed + failed) + ' testes');
  console.log('  PASS:  ' + passed);
  console.log('  FAIL:  ' + failed);
  console.log('  WARN:  ' + warnings);
  console.log('========================================');
  if (failed > 0) process.exit(1);
}

main().catch(function(err) { console.error('Erro fatal:', err); process.exit(1); });
