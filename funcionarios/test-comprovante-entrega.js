'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Config = require('./public/js/comprovante-entrega-config');
const Modelo = require('./public/js/comprovante-entrega-modelo');
const Pdf = require('./public/js/comprovante-entrega-pdf');

const testes = [];

function teste(nome, executar) {
  testes.push({ nome, executar });
}

function dadosValidos(alteracoes) {
  const base = {
    numeroVenda: 'VENDA-100',
    numeroPedido: 'PEDIDO-200',
    numeroNfe: '300',
    serieNfe: '1',
    chaveAcessoNfe: '1'.repeat(44),
    dataEntrega: '2026-07-27',
    destinatario: {
      nome: 'Empresa Exemplo de Ferramentas Ltda.',
      documento: '12345678000190',
      inscricaoEstadual: '',
      contato: 'Pessoa Responsável',
      endereco: 'Rua das Flores',
      numero: '100',
      bairro: 'Centro',
      cidade: 'Cidade Exemplo',
      estado: 'SP',
      cep: '14000000'
    },
    itens: [{
      codigo: 'ITEM-1',
      descricao: 'Peça de demonstração',
      unidade: 'UN',
      quantidade: '1,5',
      valorUnitario: '10,01'
    }],
    frete: '10,00',
    formaEntrega: 'terceirizado',
    descricaoOutraForma: ''
  };
  return Object.assign(base, alteracoes || {});
}

teste('configuração central é profunda e integralmente congelada', () => {
  assert.equal(Config.EMPRESA.razaoSocial, 'RAZOR COMERCIAL LTDA');
  assert.equal(Config.EMPRESA.cnpj, '43.110.625/0001-19');
  assert.equal(Config.EMPRESA.endereco, 'Avenida Marechal Costa e Silva, 3360, Vila Brasil');
  assert.equal(Config.EMPRESA.cidade, 'Ribeirão Preto/SP');
  assert.equal(Config.EMPRESA.cep, '14075-610');
  assert.equal(Config.EMPRESA.telefone, '(16) 3969-4234');
  assert.equal(Config.EMPRESA.logo, 'fotos/logo-comprovante.png');
  assert.equal(Config.FORMA_ENTREGA_PADRAO, 'terceirizado');
  assert.equal(
    Config.FORMAS_ENTREGA.terceirizado.texto,
    'Serviço de transporte terceirizado contratado pela RAZOR.'
  );
  assert.equal(
    Config.FORMAS_ENTREGA.proprio.texto,
    'Entrega realizada por veículo próprio da RAZOR.'
  );
  assert.equal(Object.isFrozen(Config), true);
  assert.equal(Object.isFrozen(Config.EMPRESA), true);
  assert.equal(Object.isFrozen(Config.FORMAS_ENTREGA.terceirizado), true);
});

teste('API pública possui parsers, cálculos, validação, máscaras e permissão', () => {
  [
    'parseMoedaCentavos',
    'parseQuantidadeMillesimos',
    'formatarMoeda',
    'formatarQuantidade',
    'calcularTotalItem',
    'calcularTotais',
    'normalizarItem',
    'normalizarDados',
    'validar',
    'comporDeclaracao',
    'gerarNomeArquivo',
    'mascararCpfCnpj',
    'mascararCep',
    'mascararChaveAcesso',
    'mascararData',
    'podeAcessar'
  ].forEach(nome => {
    assert.equal(typeof Modelo[nome], 'function', `Modelo.${nome} deve ser função.`);
  });
  assert.equal(Object.isFrozen(Modelo), true);
});

teste('parser e formatadores mantêm centavos e milésimos inteiros em pt-BR', () => {
  assert.equal(Modelo.parseMoedaCentavos('10'), 1000);
  assert.equal(Modelo.parseMoedaCentavos('R$ 1.250,75'), 125075);
  assert.equal(Modelo.parseMoedaCentavos('10,005'), 1001);
  assert.equal(Modelo.parseMoedaCentavos('0'), 0);
  assert.equal(Modelo.parseMoedaCentavos(''), null);
  assert.equal(Modelo.parseMoedaCentavos('-1'), null);
  assert.equal(Modelo.parseMoedaCentavos(Number.NaN), null);
  assert.equal(Modelo.parseQuantidadeMillesimos('1,5'), 1500);
  assert.equal(Modelo.parseQuantidadeMillesimos('1.234,567'), 1234567);
  assert.equal(Modelo.parseQuantidadeMillesimos(1.25), 1250);
  assert.equal(Modelo.formatarMoeda(125075), 'R$\u00a01.250,75');
  assert.equal(Modelo.formatarQuantidade(1234567), '1.234,567');
  assert.equal(Modelo.formatarQuantidade(1500), '1,5');
  assert.equal(Modelo.formatarQuantidade(1000), '1');
});

teste('cálculos arredondam uma única vez e não alteram os itens de entrada', () => {
  const itens = [
    { descricao: 'Item A', quantidadeMillesimos: 1500, valorUnitarioCentavos: 1001 },
    { descricao: 'Item B', quantidadeMillesimos: 2000, valorUnitarioCentavos: 325 }
  ];
  const antes = JSON.stringify(itens);
  const calculo = Modelo.calcularTotais(itens, 1000);

  assert.equal(Modelo.calcularTotalItem(1500, 1001), 1502);
  assert.equal(calculo.itens[0].valorTotalCentavos, 1502);
  assert.equal(calculo.itens[1].valorTotalCentavos, 650);
  assert.equal(calculo.totalProdutosCentavos, 2152);
  assert.equal(calculo.freteCentavos, 1000);
  assert.equal(calculo.totalGeralCentavos, 3152);
  assert.equal(JSON.stringify(itens), antes);
  assert.equal(Modelo.calcularTotalItem(0, 100), null);
  assert.equal(Modelo.calcularTotalItem(1000, -1), null);
});

teste('normalização preserva acentos e elimina espaços sem inventar opcionais', () => {
  const dados = dadosValidos({
    numeroVenda: '',
    numeroPedido: '',
    serieNfe: '',
    destinatario: {
      nome: '  Ótica   São   José  ',
      documento: '',
      inscricaoEstadual: '',
      contato: '',
      endereco: ' Avenida   das Nações ',
      numero: '',
      bairro: '',
      cidade: 'Ribeirão Preto',
      estado: 'sp',
      cep: ''
    }
  });
  const normalizado = Modelo.normalizarDados(dados);

  assert.equal(normalizado.destinatario.nome, 'Ótica São José');
  assert.equal(normalizado.destinatario.endereco, 'Avenida das Nações');
  assert.equal(normalizado.destinatario.estado, 'SP');
  assert.equal(normalizado.destinatario.documento, '');
  assert.equal(normalizado.destinatario.cep, '');
  assert.equal(normalizado.numeroVenda, '');
  assert.equal(normalizado.numeroPedido, '');
  assert.equal(normalizado.itens[0].quantidadeMillesimos, 1500);
  assert.equal(normalizado.itens[0].valorUnitarioCentavos, 1001);
  assert.equal(normalizado.itens[0].valorTotalCentavos, 1502);
  assert.equal(normalizado.totalProdutosCentavos, 1502);
  assert.equal(normalizado.totalGeralCentavos, 2502);
});

teste('validação exige somente os campos obrigatórios e descreve cada erro', () => {
  const resultado = Modelo.validar({
    dataEntrega: '31/02/2026',
    destinatario: { nome: ' ', endereco: '' },
    itens: [{ descricao: '', quantidade: '0' }],
    formaEntrega: 'outra',
    descricaoOutraForma: ''
  });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.erros.length >= 6);
  assert.match(resultado.errosPorCampo['destinatario.nome'], /destinatário/i);
  assert.match(resultado.errosPorCampo['destinatario.endereco'], /endereço/i);
  assert.match(resultado.errosPorCampo.dataEntrega, /data/i);
  assert.match(resultado.errosPorCampo['itens.0.descricao'], /descrição/i);
  assert.match(resultado.errosPorCampo['itens.0.quantidade'], /quantidade/i);
  assert.match(resultado.errosPorCampo.descricaoOutraForma, /outra forma/i);

  const valido = Modelo.validar(dadosValidos({
    numeroVenda: '',
    numeroPedido: '',
    numeroNfe: '',
    serieNfe: '',
    chaveAcessoNfe: '',
    formaEntrega: 'outra',
    descricaoOutraForma: 'Retirada autorizada no balcão'
  }));
  assert.equal(valido.valido, true);
  assert.deepEqual(valido.erros, []);
});

teste('validação rejeita valores monetários inválidos e estouros numéricos', () => {
  const textoInvalido = Modelo.validar(dadosValidos({
    frete: 'valor inválido',
    itens: [{
      codigo: 'ITEM-1',
      descricao: 'Peça de demonstração',
      unidade: 'UN',
      quantidade: '1',
      valorUnitario: 'abc'
    }]
  }));
  assert.equal(textoInvalido.valido, false);
  assert.match(textoInvalido.errosPorCampo.frete, /frete válido/i);
  assert.match(textoInvalido.errosPorCampo['itens.0.valorUnitario'], /valor unitário válido/i);

  const estouro = Modelo.validar(dadosValidos({
    itens: [{
      codigo: 'ITEM-1',
      descricao: 'Peça de demonstração',
      unidade: 'UN',
      quantidadeMillesimos: Number.MAX_SAFE_INTEGER,
      valorUnitarioCentavos: Number.MAX_SAFE_INTEGER
    }]
  }));
  assert.equal(estouro.valido, false);
  assert.match(estouro.errosPorCampo['itens.0.valorUnitario'], /excede o limite/i);
});

teste('declaração cita naturalmente apenas NF-e, pedido e venda preenchidos', () => {
  const todas = Modelo.comporDeclaracao(dadosValidos());
  assert.match(todas, /à NF-e nº 300, ao pedido interno nº PEDIDO-200 e à venda do marketplace nº VENDA-100/);
  assert.doesNotMatch(todas, /undefined|null/);

  const somentePedido = Modelo.comporDeclaracao(dadosValidos({
    numeroNfe: '',
    numeroVenda: '',
    numeroPedido: 'PED-Á-20'
  }));
  assert.match(somentePedido, /referentes ao pedido interno nº PED-Á-20,/);
  assert.doesNotMatch(somentePedido, /NF-e|marketplace|undefined|null/);

  const nenhuma = Modelo.comporDeclaracao(dadosValidos({
    numeroNfe: '',
    numeroPedido: '',
    numeroVenda: ''
  }));
  assert.match(nenhuma, /mercadorias discriminadas neste comprovante/);
  assert.doesNotMatch(nenhuma, /nº|undefined|null/);
});

teste('nome do arquivo prioriza NF-e, pedido e venda, sanitiza e tolera ausência', () => {
  assert.equal(
    Modelo.gerarNomeArquivo(dadosValidos({ numeroNfe: 'NF 3/00:á' })),
    'comprovante_entrega_NF_3_00_a_2026-07-27.pdf'
  );
  assert.equal(
    Modelo.gerarNomeArquivo(dadosValidos({ numeroNfe: '', numeroPedido: 'PED/20' })),
    'comprovante_entrega_PED_20_2026-07-27.pdf'
  );
  assert.equal(
    Modelo.gerarNomeArquivo(dadosValidos({
      numeroNfe: '',
      numeroPedido: '',
      numeroVenda: 'VENDA 10',
      dataEntrega: '27/07/2026'
    })),
    'comprovante_entrega_VENDA_10_2026-07-27.pdf'
  );
  assert.equal(
    Modelo.gerarNomeArquivo({}),
    'comprovante_entrega_sem_numero_sem_data.pdf'
  );
  assert.doesNotMatch(Modelo.gerarNomeArquivo(dadosValidos()), /[\\/:*?"<>|]/);
});

teste('máscaras aceitam digitação parcial e limitam o tamanho esperado', () => {
  assert.equal(Modelo.mascararCpfCnpj('12345678901'), '123.456.789-01');
  assert.equal(Modelo.mascararCpfCnpj('12345678000190'), '12.345.678/0001-90');
  assert.equal(Modelo.mascararCep('14075610'), '14075-610');
  assert.equal(
    Modelo.mascararChaveAcesso('12345678901234567890123456789012345678901234'),
    '1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 1234'
  );
  assert.equal(Modelo.mascararData('2026-07-27'), '27/07/2026');
  assert.equal(Modelo.mascararData('2707'), '27/07');
});

teste('descrições longas e 35 mercadorias permanecem calculáveis sem corte indevido', () => {
  const descricaoLonga = 'Descrição técnica com aço, proteção e precisão. '.repeat(30);
  const itens = Array.from({ length: 35 }, (_, indice) => ({
    codigo: `GEN-${indice + 1}`,
    descricao: `${descricaoLonga} Item ${indice + 1}`,
    unidade: 'UN',
    quantidade: '1,001',
    valorUnitario: '0,99'
  }));
  const normalizado = Modelo.normalizarDados(dadosValidos({ itens, frete: '' }));

  assert.equal(normalizado.itens.length, 35);
  assert.ok(normalizado.itens[0].descricao.length > 1000);
  assert.equal(normalizado.itens.every(item => item.valorTotalCentavos === 99), true);
  assert.equal(normalizado.totalProdutosCentavos, 3465);
  assert.equal(normalizado.totalGeralCentavos, 3465);
  assert.equal(Modelo.validar(normalizado).valido, true);
});

teste('permissão segue o módulo de Logística e sempre rejeita usuário inativo', () => {
  assert.equal(Modelo.podeAcessar({ ativo: true, cargo: 'logistica' }), true);
  assert.equal(Modelo.podeAcessar({ ativo: true, cargo: 'admin' }), true);
  assert.equal(Modelo.podeAcessar({
    ativo: true,
    cargo: 'funcionario',
    pode_gerenciar_permissoes: true
  }), true);
  assert.equal(Modelo.podeAcessar({
    ativo: true,
    cargo: 'vendedor',
    pode_acessar_cotacoes: true
  }), true);
  assert.equal(Modelo.podeAcessar({ ativo: true, cargo: 'vendedor' }), false);
  assert.equal(Modelo.podeAcessar({
    ativo: false,
    cargo: 'admin',
    pode_gerenciar_permissoes: true
  }), false);
  assert.equal(Modelo.podeAcessar(null), false);
});

teste('definição do PDF mantém A4, cabeçalho repetível, tabela e assinaturas no final', () => {
  const dados = Modelo.normalizarDados(dadosValidos());
  const definicao = Pdf.criarDefinicao(dados, '');
  const tabelaProdutos = definicao.content.find(bloco =>
    bloco && bloco.table && bloco.table.headerRows === 1 && bloco.table.widths.length === 6
  );
  const assinaturas = definicao.content.find(bloco => bloco && bloco.id === 'assinaturas-finais');

  assert.equal(definicao.pageSize, 'A4');
  assert.equal(definicao.pageOrientation, 'portrait');
  assert.equal(typeof definicao.header, 'function');
  assert.equal(typeof definicao.footer, 'function');
  assert.ok(tabelaProdutos);
  assert.equal(tabelaProdutos.table.dontBreakRows, true);
  assert.ok(assinaturas);
  assert.equal(assinaturas.table.dontBreakRows, true);
  assert.equal(definicao.content.at(-1), assinaturas);
  assert.doesNotMatch(JSON.stringify(definicao.content), /\bundefined\b|\bnull\b/);
});

teste('pdfmake gera arquivo válido em uma página e pagina mercadorias extensas', async () => {
  const simples = await Pdf.obterBuffer(dadosValidos(), '');
  const textoSimples = Buffer.from(simples).toString('latin1');
  assert.equal(textoSimples.startsWith('%PDF-'), true);
  assert.equal((textoSimples.match(/\/Type\s*\/Page\b/g) || []).length, 1);

  const itens = Array.from({ length: 35 }, (_, indice) => ({
    codigo: `TESTE-${indice + 1}`,
    descricao: `Mercadoria genérica ${indice + 1} com descrição longa para validar a quebra automática de linhas no PDF.`,
    unidade: 'UN',
    quantidade: '1,25',
    valorUnitario: '12,34'
  }));
  const extenso = await Pdf.obterBuffer(dadosValidos({ itens }), '');
  const textoExtenso = Buffer.from(extenso).toString('latin1');
  assert.equal(textoExtenso.startsWith('%PDF-'), true);
  assert.ok((textoExtenso.match(/\/Type\s*\/Page\b/g) || []).length > 1);
});

teste('integração estática contém menu, ações, biblioteca local e nenhum armazenamento de cliente', () => {
  const raiz = path.join(__dirname, 'public');
  const html = fs.readFileSync(path.join(raiz, 'funcionario.html'), 'utf8');
  const uiFonte = fs.readFileSync(path.join(raiz, 'js', 'comprovante-entrega.js'), 'utf8');
  const pdfFonte = fs.readFileSync(path.join(raiz, 'js', 'comprovante-entrega-pdf.js'), 'utf8');
  const servidor = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

  [
    'menu-comprovante-entrega',
    'tela-comprovante-entrega',
    'ce-gerar-pdf',
    'ce-visualizar-pdf',
    'ce-baixar-pdf',
    'ce-limpar'
  ].forEach(contrato => assert.match(html, new RegExp(contrato)));
  assert.match(uiFonte, /vendor\/pdfmake\/pdfmake\.min\.js/);
  assert.match(uiFonte, /vendor\/pdfmake\/vfs_fonts\.js/);
  assert.doesNotMatch(html, /<script[^>]+vendor\/pdfmake/);
  assert.match(servidor, /node_modules['"], ['"]pdfmake['"], ['"]build/);
  assert.doesNotMatch(uiFonte, /\blocalStorage\b|\bsessionStorage\b|\bfetch\s*\(|\bconsole\./);
  assert.doesNotMatch(pdfFonte, /\bwindow\.print\s*\(/);
  assert.equal((uiFonte.match(/RAZOR COMERCIAL LTDA/g) || []).length, 0);
  assert.equal((pdfFonte.match(/RAZOR COMERCIAL LTDA/g) || []).length, 0);
});

teste('arquivos funcionam no navegador via window e não persistem nem enviam dados', () => {
  const raiz = path.join(__dirname, 'public', 'js');
  const configFonte = fs.readFileSync(path.join(raiz, 'comprovante-entrega-config.js'), 'utf8');
  const modeloFonte = fs.readFileSync(path.join(raiz, 'comprovante-entrega-modelo.js'), 'utf8');
  const contexto = { window: {} };
  contexto.globalThis = contexto.window;
  vm.createContext(contexto);
  vm.runInContext(configFonte, contexto);
  vm.runInContext(modeloFonte, contexto);

  assert.equal(contexto.window.ComprovanteEntregaConfig.EMPRESA.razaoSocial, 'RAZOR COMERCIAL LTDA');
  assert.equal(typeof contexto.window.ComprovanteEntregaModelo.normalizarDados, 'function');
  assert.doesNotMatch(configFonte + modeloFonte, /\blocalStorage\b|\bsessionStorage\b|\bfetch\s*\(|\bconsole\./);
});

(async function executar() {
  let falhas = 0;
  for (const caso of testes) {
    try {
      await caso.executar();
      process.stdout.write(`✓ ${caso.nome}\n`);
    } catch (erro) {
      falhas += 1;
      process.stderr.write(`✗ ${caso.nome}\n${erro.stack || erro}\n`);
    }
  }

  if (falhas) {
    process.stderr.write(`\n${falhas} de ${testes.length} testes falharam.\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`\n${testes.length} testes concluídos com sucesso.\n`);
})();
