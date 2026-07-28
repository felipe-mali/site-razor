'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const DadosBrasileiros = require('./public/js/dados-brasileiros');

const raiz = __dirname;
const fonte = fs.readFileSync(
  path.join(raiz, 'public', 'js', 'funcionario.js'),
  'utf8'
);
const inicio = fonte.indexOf("const CRM_DB_NAME = 'razor-crm'");
const fim = fonte.indexOf('async function crmRenderizar()');
assert.ok(inicio >= 0 && fim > inicio, 'bloco funcional do CRM não localizado');

const requisicoes = [];
const contexto = {
  console,
  token: 'token-de-teste',
  localStorage: {
    removeItem() {}
  },
  fetch: async (url, opcoes = {}) => {
    requisicoes.push({ url, opcoes });
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true };
      }
    };
  },
  window: {
    DadosBrasileiros,
    indexedDB: null,
    location: { href: '' },
    confirm: () => false,
    alert() {}
  }
};
vm.createContext(contexto);
vm.runInContext(
  fonte.slice(inicio, fim) +
    '\nthis.__crm = {' +
    'crmEscaparHTML, crmPlanejarImportacao, crmSalvarCliente, crmResumoImportacao' +
    '};',
  contexto
);

const CRM = contexto.__crm;

assert.equal(
  CRM.crmEscaparHTML(`<img src=x onerror="alert(1)"> & 'x'`),
  '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;x&#39;'
);
assert.doesNotMatch(fonte, /onclick="crm(?:Editar|Excluir)UI\('/);
assert.match(fonte, /\$\{crmEscaparHTML\(c\.nome/);

const existentes = [{
  id: 'servidor-1',
  nome: 'Cliente já salvo',
  empresa: 'Razor',
  telefone: '(16) 99999-9999',
  email: 'salvo@example.com'
}];
const candidatos = [
  {
    id: 'servidor-1',
    nome: 'Cliente já salvo',
    empresa: 'Razor',
    telefone: '(16) 99999-9999',
    email: 'salvo@example.com'
  },
  {
    id: 'legado-2',
    nome: 'Mesmo cadastro',
    empresa: 'Empresa',
    telefone: '(16) 3333-4444',
    email: 'mesmo@example.com',
    dataCriacao: '2024-01-02T03:04:05.000Z'
  },
  {
    id: 'legado-3',
    nome: 'Mesmo cadastro',
    empresa: 'Empresa',
    telefone: '(16) 3333-4444',
    email: 'mesmo@example.com'
  },
  {
    id: 'legado-4',
    nome: 'Telefone antigo',
    telefone: 'recado com João',
    observacoes: 'Cadastro original'
  }
];
const plano = CRM.crmPlanejarImportacao(candidatos, existentes, {
  preservarTelefoneInvalido: true
});

assert.equal(plano.duplicados, 1);
assert.equal(plano.invalidos, 0);
assert.equal(plano.ajustados, 1);
assert.equal(plano.candidatos.length, 3);
assert.equal(plano.candidatos[0].legacyId, 'legado-2');
assert.equal(plano.candidatos[0].dataCriacao, '2024-01-02T03:04:05.000Z');
assert.equal(plano.candidatos[2].telefone, '');
assert.match(plano.candidatos[2].observacoes, /Telefone legado não validado/);
assert.equal(candidatos[3].telefone, 'recado com João');

(async () => {
  await CRM.crmSalvarCliente(plano.candidatos[0]);
  await CRM.crmSalvarCliente(
    {
      nome: 'Editado',
      empresa: '',
      telefone: '',
      email: '',
      vendedor: '',
      observacoes: ''
    },
    'id/seguro'
  );

  assert.equal(requisicoes[0].url, '/api/crm');
  assert.equal(requisicoes[0].opcoes.method, 'POST');
  const corpoCriacao = JSON.parse(requisicoes[0].opcoes.body);
  assert.equal(corpoCriacao.legacyId, 'legado-2');
  assert.equal(corpoCriacao.dataCriacao, '2024-01-02T03:04:05.000Z');

  assert.equal(requisicoes[1].url, '/api/crm/id%2Fseguro');
  assert.equal(requisicoes[1].opcoes.method, 'PUT');
  assert.match(
    CRM.crmResumoImportacao(
      { importados: 3, duplicados: 1, invalidos: 0, ajustados: 1, falhas: 0 },
      'Teste'
    ),
    /preservado/
  );

  const servidor = fs.readFileSync(path.join(raiz, 'server.js'), 'utf8');
  assert.ok((servidor.match(/authenticate, requireCRM/g) || []).length >= 4);
  assert.match(servidor, /function validarCorpoCRM\(/);
  assert.doesNotMatch(servidor, /\.\.\.corpo,\s*\n\s*id:/);

  console.log('CRM: migração, deduplicação, API e neutralização de HTML aprovadas.');
})().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
