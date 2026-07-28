'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BASE_URL = String(
  process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 8080}`
).replace(/\/+$/, '');
const testarCRM = process.argv.includes('--crm');

async function requisicao(caminho, opcoes = {}, statusEsperado = 200) {
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    redirect: 'manual',
    ...opcoes
  });
  assert.equal(
    resposta.status,
    statusEsperado,
    `${opcoes.method || 'GET'} ${caminho}: esperado ${statusEsperado}, recebido ${resposta.status}`
  );
  return resposta;
}

async function json(caminho, opcoes, statusEsperado) {
  const resposta = await requisicao(caminho, opcoes, statusEsperado);
  return resposta.json();
}

async function login(usuario, senha) {
  const resposta = await json('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ usuario, senha })
  });
  assert.equal(resposta.success, true);
  assert.equal(typeof resposta.token, 'string');
  return resposta.token;
}

async function testarRotas() {
  const health = await json('/health');
  assert.equal(health.status, 'ok');
  assert.equal(health.modules.clientes, true);
  assert.equal(health.modules.funcionarios, true);

  const paginaInicial = await requisicao('/');
  assert.match(await paginaInicial.text(), /Razor/i);

  const painelSemBarra = await requisicao('/funcionarios', {}, 308);
  assert.equal(painelSemBarra.headers.get('location'), '/funcionarios/');

  const painel = await requisicao('/funcionarios/', {}, 302);
  assert.equal(painel.headers.get('location'), '/funcionarios/login.html');

  await requisicao('/funcionarios/login.html');
  await requisicao('/funcionarios/js/dados-brasileiros.js');

  const pdfmake = await requisicao('/vendor/pdfmake/pdfmake.min.js');
  assert.ok((await pdfmake.arrayBuffer()).byteLength > 1000);

  await requisicao('/api/crm', {}, 401);
  const retornoSite = await requisicao('/site-clientes', {}, 302);
  assert.equal(retornoSite.headers.get('location'), '/');
}

async function testarPersistenciaCRM() {
  const caminhoUsuarios = path.resolve(
    process.env.SMOKE_USERS_PATH ||
      path.join(ROOT, 'funcionarios', 'data', 'usuarios.json')
  );
  const usuarios = JSON.parse(fs.readFileSync(caminhoUsuarios, 'utf8'));
  const entradas = Object.entries(usuarios);
  const administrador = entradas.find(([, usuario]) =>
    usuario &&
    usuario.ativo !== false &&
    (usuario.cargo === 'admin' || usuario.pode_gerenciar_permissoes)
  );
  assert.ok(administrador, 'nenhum usuário administrador ativo para o smoke test');

  const token = await login(administrador[0], administrador[1].senha);
  const cabecalhos = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json'
  };
  const antes = await json('/api/crm', { headers: cabecalhos });
  assert.ok(Array.isArray(antes));

  const marcador =
    `smoke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const idsCriados = [];

  try {
    const criacao = await json('/api/crm', {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({
        nome: `<teste-${marcador}>`,
        empresa: 'Teste de implantação',
        telefone: '(16) 99999-9999',
        email: `${marcador}@example.invalid`,
        vendedor: '',
        observacoes: 'Registro temporário do smoke test'
      })
    });
    assert.equal(criacao.success, true);
    assert.equal(criacao.cliente.nome, `<teste-${marcador}>`);
    idsCriados.push(criacao.cliente.id);

    await requisicao('/api/crm', {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({ nome: 123 })
    }, 400);

    const atualizacao = await json(`/api/crm/${encodeURIComponent(criacao.cliente.id)}`, {
      method: 'PUT',
      headers: cabecalhos,
      body: JSON.stringify({
        nome: `Teste atualizado ${marcador}`,
        id: 'id-nao-autorizado',
        dataCriacao: '1999-01-01T00:00:00.000Z'
      })
    });
    assert.equal(atualizacao.cliente.id, criacao.cliente.id);
    assert.equal(atualizacao.cliente.dataCriacao, criacao.cliente.dataCriacao);

    const legado = {
      nome: `Teste legado ${marcador}`,
      empresa: '',
      telefone: '',
      email: '',
      vendedor: '',
      observacoes: '',
      legacyId: marcador,
      dataCriacao: '2024-01-02T03:04:05.000Z',
      dataAtualizacao: '2024-02-03T04:05:06.000Z'
    };
    const primeiraCopia = await json('/api/crm', {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(legado)
    });
    idsCriados.push(primeiraCopia.cliente.id);
    assert.equal(primeiraCopia.cliente.dataCriacao, legado.dataCriacao);

    const segundaCopia = await json('/api/crm', {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(legado)
    });
    assert.equal(segundaCopia.duplicate, true);
    assert.equal(segundaCopia.cliente.id, primeiraCopia.cliente.id);

    const logistica = entradas.find(([, usuario]) =>
      usuario && usuario.ativo !== false && usuario.cargo === 'logistica'
    );
    if (logistica) {
      const tokenLogistica = await login(logistica[0], logistica[1].senha);
      await requisicao('/api/crm', {
        headers: { authorization: `Bearer ${tokenLogistica}` }
      }, 403);
    }
  } finally {
    for (const id of idsCriados) {
      await requisicao(`/api/crm/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: cabecalhos
      });
    }
  }

  const depois = await json('/api/crm', { headers: cabecalhos });
  assert.equal(depois.length, antes.length);
}

(async () => {
  await testarRotas();
  if (testarCRM) await testarPersistenciaCRM();
  console.log(
    testarCRM
      ? 'Smoke de implantação: rotas, gateway, autenticação e CRM aprovados.'
      : 'Smoke de implantação: rotas e gateway aprovados.'
  );
})().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
