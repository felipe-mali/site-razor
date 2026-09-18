'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ler = nome => fs.readFileSync(path.join(__dirname, 'public', nome), 'utf8');

async function testarApi() {
  let resposta;
  let erroRede;
  const contexto = {
    window: {}, AbortController, setTimeout, clearTimeout, TypeError, Error,
    localStorage: { getItem: () => 'teste' },
    fetch: async () => { if (erroRede) throw erroRede; return resposta; }
  };
  vm.createContext(contexto); vm.runInContext(ler('fila-producao/api.js'), contexto);
  resposta = { status: 401 };
  await assert.rejects(contexto.window.Api.requisitar('/api/ordens'), /sessão expirou/);
  resposta = { status: 403, ok: false, json: async () => ({ error: 'Sem permissão' }) };
  await assert.rejects(contexto.window.Api.requisitar('/api/ordens'), /Sem permissão/);
  resposta = { status: 500, ok: false, json: async () => { throw new Error('HTML'); } };
  await assert.rejects(contexto.window.Api.requisitar('/api/ordens'), /erro 500/);
  erroRede = new TypeError('Failed to fetch');
  await assert.rejects(contexto.window.Api.requisitar('/api/ordens'), /conectar ao servidor/);
  erroRede = Object.assign(new Error(), { name: 'AbortError' });
  await assert.rejects(contexto.window.Api.requisitar('/api/ordens'), /pode ter sido salvo/);
}

async function testarFormulario() {
  class Elemento {
    constructor() { this.value = ''; this.hidden = true; this.textContent = ''; this.handlers = {}; this.classList = { toggle() {} }; }
    addEventListener(nome, handler) { this.handlers[nome] = handler; }
    setAttribute() {} removeAttribute() {} setCustomValidity() {}
    scrollIntoView() { this.rolou = true; } focus() {} append() {} replaceChildren() {}
    querySelector() { return botao; } querySelectorAll() { return []; }
    checkValidity() { return valido; } reset() { this.resetado = true; }
    close() { this.fechado = true; }
  }
  const elementos = new Map();
  const obter = seletor => { if (!elementos.has(seletor)) elementos.set(seletor, new Elemento()); return elementos.get(seletor); };
  const botao = new Elemento();
  let valido = true;
  let falha = null;
  let chamadas = 0;
  const documento = { querySelector: obter, getElementById: id => obter('#' + id), querySelectorAll: () => [], createElement: () => new Elemento() };
  const contexto = {
    document: documento, window: { addEventListener() {}, RazorFeedback: { mostrar() {} } },
    location: { hash: '' }, history: {}, Modais: {}, setInterval() {},
    FormData: class { *[Symbol.iterator]() { yield ['produto', 'Tela']; yield ['quantidade', '10']; } },
    Api: { ativa: true, sessao: () => new Promise(() => {}), requisitar: async () => { chamadas++; if (falha) throw falha; return { numeroOP: 'OP-000001', dataSolicitacao: new Date().toISOString(), quantidade: 10 }; } }
  };
  vm.createContext(contexto); vm.runInContext(ler('fila-producao/solicitante.js'), contexto);
  const form = obter('#form-solicitacao'); const modal = obter('#nova-solicitacao');
  const enviar = () => form.handlers.submit({ preventDefault() {} });
  valido = false;
  form.elements = [{ willValidate: true, validity: { valid: false }, labels: [{ textContent: 'Quantidade *' }], validationMessage: 'Informe uma quantidade.', focus() {} }];
  await enviar();
  assert.equal(chamadas, 0); assert.match(obter('#erro-solicitacao').textContent, /Quantidade/);
  valido = true; falha = new Error('Sem conexão');
  await enviar();
  assert.equal(form.resetado, undefined); assert.equal(modal.fechado, undefined);
  assert.equal(botao.disabled, false); assert.equal(obter('#erro-solicitacao').hidden, false);
  assert.equal(obter('#erro-solicitacao').rolou, true);
  falha = null;
  await enviar();
  assert.equal(form.resetado, true); assert.equal(modal.fechado, true);
  assert.match(obter('#retorno-formulario').textContent, /OP-000001 salva/);
}

async function testarFeedbackGlobal() {
  const eventos = {};
  const avisos = [];
  let resposta = new Response(JSON.stringify({ error: 'Sem acesso' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  let erro;
  const contexto = {
    URL, Date,
    location: { href: 'http://localhost:3001/funcionario.html', origin: 'http://localhost:3001' },
    document: { body: null, addEventListener: (evento, fn) => { avisos.push([evento, fn]); } },
    window: { addEventListener: (evento, fn) => { eventos[evento] = fn; }, fetch: async () => { if (erro) throw erro; return resposta; } }
  };
  vm.createContext(contexto); vm.runInContext(ler('js/feedback.js'), contexto);
  const recebida = await contexto.window.fetch('/api/usuarios');
  assert.equal(recebida, resposta); assert.equal((await recebida.json()).error, 'Sem acesso');
  assert.equal(avisos.length, 2); // listener invalid + aviso agendado sem consumir o corpo
  erro = new TypeError('Offline');
  await assert.rejects(contexto.window.fetch('/api/usuarios'));
  assert.equal(avisos.length, 3);
  eventos.unhandledrejection({ reason: new Error('Falha') });
  assert.equal(avisos.length, 4);
  assert.equal(ler('js/feedback.js'), fs.readFileSync(path.join(__dirname, '../clientes/public/js/feedback.js'), 'utf8'));
  for (const nome of ['login.html', 'funcionario.html', 'permissoes.html', 'chaves-pagamento.html', 'fila-producao/main.html', 'fila-producao/producao.html']) assert.match(ler(nome), /js\/feedback\.js/);
}

(async () => {
  await testarApi(); await testarFormulario(); await testarFeedbackGlobal();
  console.log('Feedback: validação, envio, confirmação, preservação do formulário, rede, sessão e erros HTTP OK.');
})().catch(erro => { console.error(erro); process.exitCode = 1; });
