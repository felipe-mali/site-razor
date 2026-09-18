'use strict';
const assert = require('node:assert/strict');
const express = require('express');
const registrar = require('./fila-producao');

(async () => {
  let banco;
  const usuarios = Object.fromEntries(['vendedor', 'logistica', 'engenheiro', 'admin', 'funcionario', 'producao'].map(cargo => [cargo, { nome: cargo, cargo, pode_ver_funcionario: true }]));
  const app = express();
  app.use(express.json());
  registrar(app, {
    DATA_PATH: '.',
    authenticate(req, res, next) {
      if (!usuarios[req.headers.authorization]) return res.sendStatus(401);
      req.user = { usuario: req.headers.authorization }; next();
    },
    usuarioAtual: id => usuarios[id],
    lerJson: (_, inicial) => structuredClone(banco || inicial),
    escreverJsonAtomico: (_, dados) => { banco = structuredClone(dados); }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/fila-producao`;
  async function request(user, route = '/ordens', body, method = body ? 'POST' : 'GET') {
    const res = await fetch(base + route, { method, headers: { Authorization: user, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  try {
    const dados = { produto: 'Tela', quantidade: 1.125, unidade: 'm²', prazo: '2099-12-01', prioridade: 'normal' };
    assert.equal((await request('desconhecido')).status, 401);
    for (const cargo of ['vendedor', 'logistica', 'engenheiro', 'admin', 'funcionario']) assert.equal((await request(cargo, '/ordens', { ...dados, solicitanteId: 'falso', status: 'concluida' })).status, 201);
    assert.equal((await request('producao', '/ordens', dados)).status, 403);
    assert.equal((await request('vendedor')).data.length, 1);
    assert.equal((await request('producao')).data.length, 5);
    assert.equal(banco.ordens[0].solicitanteId, 'vendedor');
    assert.equal(banco.ordens[0].status, 'aguardando');
    for (const extra of [{ quantidade: -1 }, { quantidade: 1.1234 }, { prazo: '2099-02-31' }, { prazo: '2000-01-01' }, { produto: ' ' }, { unidade: 'x' }]) assert.equal((await request('admin', '/ordens', { ...dados, ...extra })).status, 400);
    assert.equal((await request('admin', '/ordens/1/iniciar', { versao: 1 })).status, 403);
    assert.equal((await request('producao', '/ordens/1/finalizar', { versao: 1 })).status, 409);
    assert.equal((await request('producao', '/ordens/1/iniciar', { versao: 1 })).data.status, 'producao');
    assert.equal((await request('producao', '/ordens/1/pausar', { versao: 1 })).status, 409);
    assert.equal((await request('producao', '/ordens/1/pausar', { versao: 2, motivoPausa: 'inexistente' })).status, 400);
    assert.equal((await request('producao', '/ordens/1/pausar', { versao: 2, motivoPausa: 'Falta de material' })).data.status, 'pausada');
    assert.equal((await request('producao', '/ordens/1/retomar', { versao: 3 })).data.status, 'producao');
    assert.equal((await request('producao', '/ordens/1/finalizar', { versao: 4 })).data.status, 'concluida');
    assert.equal((await request('vendedor')).data[0].status, 'concluida');
    assert.equal(banco.historico.length, 9);
    assert.equal((await request('admin')).data.length, 5);
    assert.equal((await request('admin', '/sessao')).data.podeExcluir, true);
    usuarios.funcionario.pode_gerenciar_permissoes = true;
    for (const cargo of ['vendedor', 'logistica', 'engenheiro', 'funcionario', 'producao']) {
      assert.equal((await request(cargo, '/sessao')).data.podeExcluir, false);
      assert.equal((await request(cargo, '/ordens/1', { versao: 5 }, 'DELETE')).status, 403);
    }
    assert.equal((await request('desconhecido', '/ordens/1', { versao: 5 }, 'DELETE')).status, 401);
    assert.equal((await request('admin', '/ordens/1', { versao: 1 }, 'DELETE')).status, 409);
    assert.equal(banco.ordens.length, 5);
    assert.equal((await request('admin', '/ordens/1', { versao: 5 }, 'DELETE')).status, 200);
    assert.equal((await request('producao')).data.length, 4);
    assert.equal((await request('vendedor')).data.length, 0);
    assert.equal(banco.historico.at(-1).acao, 'excluir');
    assert.equal(banco.historico.at(-1).usuario, 'admin');
    assert.equal(banco.historico.at(-1).ordem.numeroOP, 'OP-000001');
    assert.equal((await request('admin', '/ordens/1', { versao: 5 }, 'DELETE')).status, 404);
    const nova = await request('admin', '/ordens', dados);
    assert.equal(nova.data.id, 6);
    usuarios.admin.cargo = 'funcionario';
    assert.equal((await request('admin', '/ordens/2', { versao: 1 }, 'DELETE')).status, 403);
    usuarios.admin.cargo = 'admin';
    usuarios.producao.cargo = 'funcionario';
    assert.equal((await request('producao', '/ordens/2/iniciar', { versao: 1 })).status, 403);
    usuarios.admin.ativo = false;
    assert.equal((await request('admin')).status, 403);
    assert.equal((await request('admin', '/ordens/2', { versao: 1 }, 'DELETE')).status, 403);
    console.log('Fila de produção: emissão, isolamento, permissões, validações, concorrência e ciclo completo OK.');
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
