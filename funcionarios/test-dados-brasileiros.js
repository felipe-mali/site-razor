'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Dados = require('./public/js/dados-brasileiros');
const testes = [];

function teste(nome, executar) {
  testes.push({ nome, executar });
}

function lerProjeto(...partes) {
  return fs.readFileSync(path.join(__dirname, ...partes), 'utf8');
}

teste('valores ausentes e sentinelas são tratados sem exceção', () => {
  [null, undefined, '', '   ', 'null', 'undefined', 'NaN', Number.NaN]
    .forEach(valor => {
      assert.equal(Dados.valorAusente(valor), true);
      assert.equal(Dados.somenteNumeros(valor), '');
      assert.equal(Dados.formatarCpfCnpj(valor), '');
      assert.equal(Dados.formatarTelefone(valor), '');
    });
  assert.equal(Dados.valorAusente(0), false);
  assert.equal(Dados.textoLiteral('null'), 'null');
  assert.equal(Dados.textoSeguro('constructor'), 'constructor');
  assert.equal(Dados.textoSeguro('__proto__'), '__proto__');
  assert.equal(Dados.somenteNumeros('(+55) 16 99999-9999'), '5516999999999');
});

teste('CPF valida dígitos verificadores, repetidos, máscara e valor numérico', () => {
  assert.equal(Dados.validarCpf('52998224725'), true);
  assert.equal(Dados.validarCpf('529.982.247-25'), true);
  assert.equal(Dados.validarCpf(52998224725), true);
  assert.equal(Dados.formatarCpf('52998224725'), '529.982.247-25');
  assert.equal(Dados.validarCpf('52998224724'), false);
  assert.equal(Dados.validarCpf('11111111111'), false);
  assert.equal(Dados.validarCpf('5299822472'), false);
  assert.equal(Dados.formatarCpf('52998224724'), '');
});

teste('CNPJ valida dígitos verificadores, repetidos, máscara e valor numérico', () => {
  assert.equal(Dados.validarCnpj('11222333000181'), true);
  assert.equal(Dados.validarCnpj('11.222.333/0001-81'), true);
  assert.equal(Dados.validarCnpj(11222333000181), true);
  assert.equal(Dados.formatarCnpj('11222333000181'), '11.222.333/0001-81');
  assert.equal(Dados.validarCnpj('11222333000180'), false);
  assert.equal(Dados.validarCnpj('00000000000000'), false);
  assert.equal(Dados.validarCnpj('1122233300018'), false);
  assert.equal(Dados.formatarCnpj('11222333000180'), '');
});

teste('campo CPF/CNPJ não adivinha tipo nem cria máscara quebrada', () => {
  assert.equal(Dados.validarCpfCnpj('52998224725'), true);
  assert.equal(Dados.validarCpfCnpj('11222333000181'), true);
  assert.equal(Dados.validarCpfCnpj('5299822472'), false);
  assert.equal(Dados.validarCpfCnpj('529982247250'), false);
  assert.equal(Dados.formatarCpfCnpj('52998224725'), '529.982.247-25');
  assert.equal(Dados.formatarCpfCnpj('11222333000181'), '11.222.333/0001-81');
  assert.equal(Dados.mascararCpfCnpjEntrada('52998'), '52998');
  assert.equal(Dados.mascararCpfCnpjEntrada('52998224724'), '52998224724');
  assert.equal(Dados.mascararCpfCnpjEntrada('529.982.247-25'), '529.982.247-25');
  assert.equal(Dados.mascararCpfCnpjEntrada('11.222.333/0001-81'), '11.222.333/0001-81');
  assert.equal(Dados.mascararCpfCnpjEntrada('1'.repeat(20)).length, 14);
});

teste('telefone reconhece formatos brasileiros com e sem DDD e código +55', () => {
  assert.equal(Dados.formatarTelefone('33334444'), '3333-4444');
  assert.equal(Dados.formatarTelefone('999999999'), '99999-9999');
  assert.equal(Dados.formatarTelefone('1633334444'), '(16) 3333-4444');
  assert.equal(Dados.formatarTelefone('16999999999'), '(16) 99999-9999');
  assert.equal(Dados.formatarTelefone(16999999999), '(16) 99999-9999');
  assert.equal(Dados.formatarTelefone('551633334444'), '+55 (16) 3333-4444');
  assert.equal(Dados.formatarTelefone('+55 (16) 99999-9999'), '+55 (16) 99999-9999');
  assert.equal(Dados.validarTelefone('1234567'), false);
  assert.equal(Dados.validarTelefone('161234567890'), false);
  assert.equal(Dados.validarTelefone('5616999999999'), false);
  assert.equal(Dados.formatarTelefone('1234567'), '');
});

teste('telefone separa ramal explícito sem incorporá-lo ao número', () => {
  const analise = Dados.analisarTelefone('(16) 3333-4444 ramal 123');
  assert.equal(analise.valido, true);
  assert.equal(analise.numeros, '1633334444');
  assert.equal(analise.ramal, '123');
  assert.equal(Dados.formatarTelefone('(16) 3333-4444 ramal 123'), '(16) 3333-4444 ramal 123');
  assert.deepEqual(Dados.separarTelefoneRamal('(16) 3333-4444x123'), {
    telefone: '(16) 3333-4444',
    ramal: '123'
  });
  assert.equal(Dados.formatarTelefone('(16) 3333-4444x123'), '(16) 3333-4444 ramal 123');
  assert.equal(
    Dados.validarTelefone('(16) 3333-4444 ramal 123', { permitirRamal: false }),
    false
  );
  assert.equal(Dados.validarTelefone('1633334444123'), false);
});

teste('máscara de telefone permite correção, limita dígitos e não duplica sinais', () => {
  assert.equal(Dados.mascararTelefoneEntrada('16999999999'), '(16) 99999-9999');
  assert.equal(Dados.mascararTelefoneEntrada('(16) 99999-9999'), '(16) 99999-9999');
  assert.equal(Dados.mascararTelefoneEntrada('16999'), '16999');
  assert.equal(Dados.mascararTelefoneEntrada('abc'), '');
  assert.equal(Dados.somenteNumeros(Dados.mascararTelefoneEntrada('1'.repeat(20))).length, 11);
  assert.equal(
    Dados.somenteNumeros(Dados.mascararTelefoneEntrada('169999999999999')).length,
    11
  );
});

teste('chave PIX centraliza validação, exibição, armazenamento e duplicidade', () => {
  assert.equal(Dados.erroChavePix('CPF', '529.982.247-25'), null);
  assert.match(Dados.erroChavePix('CPF', '52998224724'), /CPF inválido/);
  assert.equal(Dados.normalizarChavePix('CPF', '529.982.247-25'), '52998224725');
  assert.equal(Dados.formatarChavePix('CPF', '52998224725'), '529.982.247-25');
  assert.equal(Dados.normalizarChavePix('CNPJ', '11.222.333/0001-81'), '11222333000181');
  assert.equal(Dados.normalizarChavePix('Telefone', '+55 (16) 99999-9999'), '16999999999');
  assert.equal(Dados.validarChavePix('Telefone', '999999999'), false);
  assert.equal(Dados.formatarChavePix('Telefone', null, '—'), '—');
  assert.equal(Dados.formatarChavePix('CPF', '52998224724', '—'), '—');
  assert.equal(Dados.formatarChavePix('Telefone', null, null), '');
  assert.equal(Dados.formatarChavePix('Telefone', null, Number.NaN), '');
  assert.equal(
    Dados.chavePixComparavel('CPF', '529.982.247-25'),
    Dados.chavePixComparavel('CPF', '52998224725')
  );
  assert.equal(
    Dados.chavePixComparavel('CPF', '529.982.247-25'),
    Dados.chavePixComparavel('Telefone', '52998224725')
  );
  assert.notEqual(
    Dados.chavePixComparavel('Email', 'Pessoa@Exemplo.com'),
    Dados.chavePixComparavel('Email', 'pessoa@exemplo.com')
  );
  assert.equal(Dados.normalizarChavePix('Aleatoria', 'null'), 'null');
});

teste('módulo funciona em navegador via global e expõe API congelada', () => {
  const fonte = lerProjeto('public', 'js', 'dados-brasileiros.js');
  const contexto = { window: {} };
  contexto.globalThis = contexto.window;
  vm.createContext(contexto);
  vm.runInContext(fonte, contexto);
  assert.equal(typeof contexto.window.DadosBrasileiros.validarCpf, 'function');
  assert.equal(
    contexto.window.DadosBrasileiros.formatarTelefone('16999999999'),
    '(16) 99999-9999'
  );
  assert.equal(Object.isFrozen(contexto.window.DadosBrasileiros), true);
});

teste('integrações ativas carregam e reutilizam o utilitário antes dos consumidores', () => {
  const painel = lerProjeto('public', 'funcionario.html');
  const chaves = lerProjeto('public', 'chaves-pagamento.html');
  const servidor = lerProjeto('server.js');
  const crm = lerProjeto('public', 'js', 'funcionario.js');
  const comprovante = lerProjeto('public', 'js', 'comprovante-entrega-modelo.js');
  const chavesJs = lerProjeto('public', 'js', 'chaves-pagamento.js');

  const indiceDadosPainel = painel.indexOf('js/dados-brasileiros.js');
  assert.ok(indiceDadosPainel >= 0);
  [
    'js/comprovante-entrega-modelo.js',
    'js/comprovante-entrega-pdf.js',
    'js/comprovante-entrega.js',
    'js/funcionario.js',
    'js/cotacoes.js'
  ].forEach(script => assert.ok(painel.indexOf(script) > indiceDadosPainel));

  const indiceDadosChaves = chaves.indexOf('js/dados-brasileiros.js');
  assert.ok(indiceDadosChaves >= 0);
  assert.ok(chaves.indexOf('js/chaves-pagamento.js') > indiceDadosChaves);

  assert.match(servidor, /require\(['"]\.\/public\/js\/dados-brasileiros['"]\)/);
  assert.equal((servidor.match(/validarFormatoChave\(/g) || []).length, 5);
  assert.match(servidor, /function validarCorpoCRM\(/);
  assert.ok((servidor.match(/DadosBrasileiros\.validarTelefone\(/g) || []).length >= 1);
  assert.ok((servidor.match(/validarCorpoCRM\(/g) || []).length >= 3);
  assert.match(crm, /crmTelefoneExibicao\(c\.telefone/);
  assert.match(crm, /\$\{crmEscaparHTML\(c\.nome/);
  assert.doesNotMatch(crm, /onclick="crmEditarUI\('/);
  assert.ok((servidor.match(/authenticate, requireCRM/g) || []).length >= 4);
  assert.match(comprovante, /DadosBrasileiros\.validarCpfCnpj\(documentoEntrada\)/);
  assert.match(chavesJs, /formatarChavePix\(normalizado, texto, '—'\)/);
});

teste('telefones institucionais estáticos do site público têm formato brasileiro reconhecido', () => {
  const html = lerProjeto('..', 'clientes', 'public', 'index.html');
  const fonte = [
    html,
    lerProjeto('..', 'clientes', 'public', 'js', 'app.js')
  ].join('\n');
  const numeros = Array.from(
    fonte.matchAll(/(?:tel:|wa\.me\/)\+?(\d{10,13})/g),
    correspondencia => correspondencia[1]
  );

  assert.ok(numeros.length > 0);
  numeros.forEach(numero => {
    assert.equal(Dados.validarTelefone(numero, { exigirDdd: true }), true);
  });

  const exibidos = html.match(/\(\d{2}\)\s*\d{4,5}-\d{4}/g) || [];
  assert.ok(exibidos.length > 0);
  exibidos.forEach(numero => {
    assert.equal(Dados.validarTelefone(numero, { exigirDdd: true }), true);
  });
});

let falhas = 0;
testes.forEach(caso => {
  try {
    caso.executar();
    process.stdout.write('✓ ' + caso.nome + '\n');
  } catch (erro) {
    falhas += 1;
    process.stderr.write('✗ ' + caso.nome + '\n' + (erro.stack || erro) + '\n');
  }
});

if (falhas) {
  process.stderr.write('\n' + falhas + ' de ' + testes.length + ' testes falharam.\n');
  process.exitCode = 1;
} else {
  process.stdout.write('\n' + testes.length + ' testes de dados brasileiros concluídos com sucesso.\n');
}
