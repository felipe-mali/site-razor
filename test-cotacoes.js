'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const Financeiro = require('./public/js/cotacoes-financeiro');
const Modelo = require('./public/js/cotacoes-modelo');
const PrintView = require('./public/js/cotacoes-print');

const RAIZ = __dirname;
const testes = [];

function teste(nome, executar) {
  testes.push({ nome, executar });
}

function ler(caminho) {
  return fs.readFileSync(path.join(RAIZ, caminho), 'utf8');
}

function contar(texto, expressao) {
  return (texto.match(expressao) || []).length;
}

function assertFuncoes(objeto, nomes, rotulo) {
  nomes.forEach(nome => {
    assert.equal(typeof objeto[nome], 'function', `${rotulo}.${nome} deve ser uma função.`);
  });
}

function adicionarProduto(estado, dados) {
  return Modelo.adicionarProduto(estado, dados);
}

function adicionarFornecedor(estado, nome, opcoes) {
  return Modelo.adicionarFornecedor(estado, nome, opcoes);
}

function preco(estado, produtoId, fornecedorId) {
  return estado.precos[Financeiro.chavePreco(produtoId, fornecedorId)];
}

function possuiPreco(estado, produtoId, fornecedorId) {
  return Object.prototype.hasOwnProperty.call(
    estado.precos,
    Financeiro.chavePreco(produtoId, fornecedorId)
  );
}

function resultadoFornecedor(resultado, fornecedorId) {
  return resultado.fornecedores.find(fornecedor => fornecedor.fornecedorId === fornecedorId);
}

function resultadoProduto(resultado, produtoId) {
  return resultado.produtos.find(produto => produto.produtoId === produtoId);
}

function entradaFinanceiraObrigatoria() {
  const valores = {
    a: [1000, 1000, 1000, 1500, 500, 1000, 800, 1500, 1500, 1000],
    b: [1100, 1100, 900, 1700, 400, 1100, 700, 1400, 1700, 1200],
    c: [900, 1200, 1100, 1600, 600, 1200, 900, 1600, 1400, 1600]
  };
  const produtos = Array.from({ length: 10 }, (_, indice) => ({
    id: `produto-${indice + 1}`,
    descricao: `Produto ${indice + 1}`,
    quantidadeMillesimos: 5000
  }));
  const fornecedores = [
    { id: 'a', nome: 'Fornecedor A' },
    { id: 'b', nome: 'Fornecedor B' },
    { id: 'c', nome: 'Fornecedor C' }
  ];
  const precos = {};

  produtos.forEach((produto, indice) => {
    fornecedores.forEach(fornecedor => {
      precos[Financeiro.chavePreco(produto.id, fornecedor.id)] = valores[fornecedor.id][indice];
    });
  });

  return { produtos, fornecedores, precos };
}

teste('módulos expõem somente as operações necessárias à calculadora temporária', () => {
  assertFuncoes(Financeiro, [
    'calcularCotacao',
    'parseMoedaCentavos',
    'parseQuantidadeMillesimos',
    'formatarMoeda',
    'formatarQuantidade',
    'chavePreco'
  ], 'Financeiro');
  assertFuncoes(Modelo, [
    'criarEstado',
    'adicionarProduto',
    'duplicarProduto',
    'removerProduto',
    'adicionarFornecedor',
    'renomearFornecedor',
    'definirPrazoEntrega',
    'removerFornecedor',
    'definirProduto',
    'definirPreco',
    'limparEstado',
    'proximaChavePreco',
    'calcular',
    'podeAcessar'
  ], 'Modelo');
  assertFuncoes(PrintView, ['renderizar', 'dividirEmBlocos'], 'PrintView');
});

teste('parser e formatadores usam centavos e milésimos inteiros no padrão brasileiro', () => {
  assert.equal(Financeiro.parseMoedaCentavos('10'), 1000);
  assert.equal(Financeiro.parseMoedaCentavos('10,5'), 1050);
  assert.equal(Financeiro.parseMoedaCentavos('10,50'), 1050);
  assert.equal(Financeiro.parseMoedaCentavos('1250,75'), 125075);
  assert.equal(Financeiro.parseMoedaCentavos('1.250,75'), 125075);
  assert.equal(Financeiro.parseMoedaCentavos('R$ 1.234,56'), 123456);
  assert.equal(Financeiro.parseMoedaCentavos(''), null);
  assert.equal(Financeiro.parseMoedaCentavos('-1'), null);
  assert.equal(Financeiro.parseMoedaCentavos(Number.NaN), null);
  assert.equal(Financeiro.parseMoedaCentavos(Number.POSITIVE_INFINITY), null);
  assert.equal(Financeiro.parseMoedaCentavos('10,001'), 1000, 'A terceira casa deve ser arredondada.');
  assert.equal(Financeiro.parseMoedaCentavos('0'), 0, 'Zero é parseável, mas não é preço válido.');

  assert.equal(Financeiro.parseQuantidadeMillesimos('5'), 5000);
  assert.equal(Financeiro.parseQuantidadeMillesimos('1,5'), 1500);
  assert.equal(Financeiro.parseQuantidadeMillesimos('1.234,567'), 1234567);
  assert.equal(Financeiro.parseQuantidadeMillesimos('-1'), null);
  assert.equal(Financeiro.formatarMoeda(125075), 'R$ 1.250,75');
  assert.equal(Financeiro.formatarQuantidade(1234567), '1.234,567');

  const chave = Financeiro.chavePreco('produto-1', 'fornecedor-2');
  assert.equal(chave, Financeiro.chavePreco('produto-1', 'fornecedor-2'));
  assert.notEqual(chave, Financeiro.chavePreco('produto-2', 'fornecedor-1'));
});

teste('produto e fornecedor criados em qualquer ordem geram todo o produto cartesiano', () => {
  const estado = Modelo.criarEstado();
  adicionarProduto(estado, { id: 'p1', descricao: 'Produto 1', quantidadeMillesimos: 1000 });
  adicionarProduto(estado, { id: 'p2', descricao: 'Produto 2', quantidadeMillesimos: 2000 });
  adicionarFornecedor(estado, 'Fornecedor A', { id: 'f1' });
  adicionarFornecedor(estado, 'Fornecedor B', { id: 'f2' });

  assert.equal(estado.fornecedores[0].prazoEntrega, '');
  assert.equal(estado.fornecedores[1].prazoEntrega, '');

  assert.equal(estado.produtos.length, 2);
  assert.equal(estado.fornecedores.length, 2);
  assert.equal(Object.keys(estado.precos).length, 4);
  for (const produto of estado.produtos) {
    for (const fornecedor of estado.fornecedores) {
      assert.equal(possuiPreco(estado, produto.id, fornecedor.id), true);
      assert.equal(preco(estado, produto.id, fornecedor.id), null);
    }
  }

  const inverso = Modelo.criarEstado();
  adicionarFornecedor(inverso, 'Fornecedor A', { id: 'f1' });
  adicionarFornecedor(inverso, 'Fornecedor B', { id: 'f2' });
  adicionarProduto(inverso, { id: 'p1', descricao: 'Produto 1', quantidadeMillesimos: 1000 });
  adicionarProduto(inverso, { id: 'p2', descricao: 'Produto 2', quantidadeMillesimos: 2000 });

  assert.deepEqual(Object.keys(inverso.precos).sort(), Object.keys(estado.precos).sort());
});

teste('editar, duplicar e remover produto preserva apenas as relações corretas', () => {
  const estado = Modelo.criarEstado();
  adicionarFornecedor(estado, 'Fornecedor A', { id: 'f1' });
  adicionarFornecedor(estado, 'Fornecedor B', { id: 'f2' });
  adicionarProduto(estado, { id: 'p1', descricao: 'Original', quantidadeMillesimos: 1000 });
  adicionarProduto(estado, { id: 'p2', descricao: 'Permanente', quantidadeMillesimos: 1000 });
  Modelo.definirPreco(estado, 'p1', 'f1', 1050);
  Modelo.definirPreco(estado, 'p1', 'f2', 1200);
  Modelo.definirPreco(estado, 'p2', 'f1', 900);
  Modelo.definirProduto(estado, 'p1', { descricao: 'Alicate universal', quantidadeMillesimos: 2500 });

  const duplicado = Modelo.duplicarProduto(estado, 'p1', { id: 'p1-copia' });
  assert.equal(duplicado.id, 'p1-copia');
  assert.equal(duplicado.descricao, 'Alicate universal');
  assert.equal(duplicado.quantidadeMillesimos, 2500);
  assert.equal(preco(estado, 'p1-copia', 'f1'), 1050);
  assert.equal(preco(estado, 'p1-copia', 'f2'), 1200);
  assert.equal(new Set(estado.produtos.map(produto => produto.id)).size, estado.produtos.length);

  assert.equal(Modelo.removerProduto(estado, 'p1'), true);
  assert.equal(estado.produtos.some(produto => produto.id === 'p1'), false);
  assert.equal(possuiPreco(estado, 'p1', 'f1'), false);
  assert.equal(possuiPreco(estado, 'p1', 'f2'), false);
  assert.equal(preco(estado, 'p1-copia', 'f1'), 1050);
  assert.equal(preco(estado, 'p2', 'f1'), 900);
});

teste('prazo pertence ao fornecedor e sobrevive a edição e renomeação sem alterar cálculos', () => {
  const estado = Modelo.criarEstado();
  adicionarProduto(estado, { id: 'p1', descricao: 'Produto 1', quantidadeMillesimos: 1000 });
  adicionarProduto(estado, { id: 'p2', descricao: 'Produto 2', quantidadeMillesimos: 1000 });
  const fornecedorA = adicionarFornecedor(estado, 'Fornecedor A', {
    id: 'f1',
    prazoEntrega: ' 2 dias úteis '
  });
  adicionarFornecedor(estado, 'Fornecedor B', { id: 'f2' });
  Modelo.definirPreco(estado, 'p1', 'f1', 1000);
  Modelo.definirPreco(estado, 'p1', 'f2', 1100);

  assert.equal(fornecedorA.prazoEntrega, '2 dias úteis');
  assert.equal(estado.fornecedores[1].prazoEntrega, '');
  const calculosAntesDoPrazo = Modelo.calcular(estado);

  const prazoEditado = Modelo.definirPrazoEntrega(estado, 'f1', ' 5 dias úteis ');
  assert.equal(prazoEditado.prazoEntrega, '5 dias úteis');
  assert.deepEqual(Modelo.calcular(estado), calculosAntesDoPrazo);

  const renomeado = Modelo.renomearFornecedor(estado, 'f1', 'Fornecedor Alfa');
  assert.equal(renomeado.id, 'f1');
  assert.equal(renomeado.nome, 'Fornecedor Alfa');
  assert.equal(renomeado.prazoEntrega, '5 dias úteis');
  assert.equal(preco(estado, 'p1', 'f1'), 1000);

  Modelo.definirPrazoEntrega(estado, 'f2', 'Retirada no local');

  assert.equal(Modelo.removerFornecedor(estado, 'f1'), true);
  assert.equal(estado.fornecedores.some(fornecedor => fornecedor.id === 'f1'), false);
  assert.equal(possuiPreco(estado, 'p1', 'f1'), false);
  assert.equal(possuiPreco(estado, 'p2', 'f1'), false);
  assert.equal(preco(estado, 'p1', 'f2'), 1100);
  assert.equal(possuiPreco(estado, 'p2', 'f2'), true);
  assert.equal(estado.fornecedores[0].prazoEntrega, 'Retirada no local');
});

teste('preços inválidos viram vazios, limpar descarta o estado e Enter segue ordem previsível', () => {
  const estado = Modelo.criarEstado();
  adicionarProduto(estado, { id: 'p1', descricao: 'Produto 1', quantidadeMillesimos: 1000 });
  adicionarProduto(estado, { id: 'p2', descricao: 'Produto 2', quantidadeMillesimos: 1000 });
  adicionarFornecedor(estado, 'Fornecedor A', { id: 'f1' });
  adicionarFornecedor(estado, 'Fornecedor B', { id: 'f2' });

  Modelo.definirPreco(estado, 'p1', 'f1', 1000);
  Modelo.definirPreco(estado, 'p1', 'f2', 0);
  Modelo.definirPreco(estado, 'p2', 'f1', -1);
  assert.equal(preco(estado, 'p1', 'f1'), 1000);
  assert.equal(preco(estado, 'p1', 'f2'), null);
  assert.equal(preco(estado, 'p2', 'f1'), null);

  assert.equal(
    Modelo.proximaChavePreco(estado, 'p1', 'f1'),
    Financeiro.chavePreco('p1', 'f2')
  );
  assert.equal(
    Modelo.proximaChavePreco(estado, 'p1', 'f2'),
    Financeiro.chavePreco('p2', 'f1')
  );
  assert.equal(Modelo.proximaChavePreco(estado, 'p2', 'f2'), null);

  estado.impressao.numero = 'TEMP-1';
  estado.impressao.descricao = 'Não deve sobreviver à limpeza.';
  Modelo.definirPrazoEntrega(estado, 'f1', 'Sob consulta');
  assert.equal(Modelo.limparEstado(estado), estado);
  assert.deepEqual(estado.produtos, []);
  assert.deepEqual(estado.fornecedores, []);
  assert.deepEqual(estado.precos, {});
  assert.deepEqual(estado.impressao, {
    numero: '', descricao: '', elaboradoPor: '', aprovadoPor: '', data: ''
  });
});

teste('cenário obrigatório recomenda A e calcula 54000, 51000, 3000 e 556 bps', () => {
  const entrada = entradaFinanceiraObrigatoria();
  const antes = JSON.stringify(entrada);
  const resultado = Financeiro.calcularCotacao(entrada);

  assert.equal(JSON.stringify(entrada), antes, 'O cálculo não deve alterar a entrada.');
  assert.equal(resultadoFornecedor(resultado, 'a').totalCentavos, 54000);
  assert.equal(resultadoFornecedor(resultado, 'b').totalCentavos, 56500);
  assert.equal(resultadoFornecedor(resultado, 'c').totalCentavos, 60500);
  assert.deepEqual(resultado.fornecedoresRecomendados, ['a']);
  assert.equal(resultado.totalRecomendadoCentavos, 54000);
  assert.equal(resultado.custoIdealTotalCentavos, 51000);
  assert.equal(resultado.descontoSugeridoCentavos, 3000);
  assert.equal(resultado.percentualNegociacaoBasisPoints, 556);

  entrada.fornecedores.forEach((fornecedor, indice) => {
    fornecedor.prazoEntrega = `${indice + 3} dias úteis`;
  });
  assert.deepEqual(
    Financeiro.calcularCotacao(entrada),
    resultado,
    'Prazo de entrega não pode participar de nenhum cálculo financeiro.'
  );
});

teste('totais usam quantidade, menor preço e empate com arredondamento financeiro exato', () => {
  const resultado = Financeiro.calcularCotacao({
    produtos: [{ id: 'p1', quantidadeMillesimos: 1500 }],
    fornecedores: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }],
    precos: {
      [Financeiro.chavePreco('p1', 'a')]: 101,
      [Financeiro.chavePreco('p1', 'b')]: 101
    }
  });
  const produto = resultadoProduto(resultado, 'p1');

  assert.equal(produto.porFornecedor.a.valorTotalCentavos, 152, '1,5 × R$ 1,01 arredonda para R$ 1,52.');
  assert.equal(produto.porFornecedor.b.valorTotalCentavos, 152);
  assert.equal(produto.menorValorUnitarioCentavos, 101);
  assert.deepEqual(produto.fornecedoresMenorPreco, ['a', 'b']);
  assert.equal(produto.porFornecedor.a.menorPreco, true);
  assert.equal(produto.porFornecedor.b.menorPreco, true);
  assert.equal(produto.custoIdealTotalCentavos, 152);
  assert.deepEqual(resultado.fornecedoresRecomendados, ['a', 'b']);
  assert.equal(resultado.descontoSugeridoCentavos, 0);
  assert.equal(resultado.percentualNegociacaoBasisPoints, 0);
});

teste('vazio, zero e negativo não completam proposta nem participam do menor preço', () => {
  const entrada = {
    produtos: [
      { id: 'p1', quantidadeMillesimos: 1000 },
      { id: 'p2', quantidadeMillesimos: 2000 }
    ],
    fornecedores: [
      { id: 'completo', nome: 'Completo' },
      { id: 'parcial', nome: 'Parcial' },
      { id: 'invalidos', nome: 'Inválidos' }
    ],
    precos: {
      [Financeiro.chavePreco('p1', 'completo')]: 100,
      [Financeiro.chavePreco('p2', 'completo')]: 200,
      [Financeiro.chavePreco('p1', 'parcial')]: 1,
      [Financeiro.chavePreco('p2', 'parcial')]: null,
      [Financeiro.chavePreco('p1', 'invalidos')]: 0,
      [Financeiro.chavePreco('p2', 'invalidos')]: -100
    }
  };
  const resultado = Financeiro.calcularCotacao(entrada);

  assert.equal(resultadoFornecedor(resultado, 'completo').completo, true);
  assert.equal(resultadoFornecedor(resultado, 'parcial').completo, false);
  assert.equal(resultadoFornecedor(resultado, 'parcial').faltantes, 1);
  assert.equal(resultadoFornecedor(resultado, 'invalidos').completo, false);
  assert.equal(resultadoProduto(resultado, 'p1').fornecedoresMenorPreco.includes('invalidos'), false);
  assert.deepEqual(resultado.fornecedoresRecomendados, ['completo']);

  delete entrada.precos[Financeiro.chavePreco('p2', 'completo')];
  const nenhumCompleto = Financeiro.calcularCotacao(entrada);
  assert.deepEqual(nenhumCompleto.fornecedoresRecomendados, []);
  assert.equal(nenhumCompleto.custoIdealCompleto, false);
  assert.equal(nenhumCompleto.custoIdealTotalCentavos, null);
  assert.equal(nenhumCompleto.totalRecomendadoCentavos, null);
  assert.equal(nenhumCompleto.descontoSugeridoCentavos, null);
  assert.equal(nenhumCompleto.percentualNegociacaoBasisPoints, null);
});

teste('matriz 500 por 50 mantém cálculo puro dentro de limite folgado', () => {
  const produtos = Array.from({ length: 500 }, (_, indice) => ({
    id: `p-${indice}`,
    quantidadeMillesimos: 1000 + (indice % 3)
  }));
  const fornecedores = Array.from({ length: 50 }, (_, indice) => ({
    id: `f-${indice}`,
    nome: `Fornecedor ${indice}`
  }));
  const precos = {};
  produtos.forEach(produto => {
    fornecedores.forEach((fornecedor, indice) => {
      precos[Financeiro.chavePreco(produto.id, fornecedor.id)] = 100 + indice;
    });
  });

  const inicio = performance.now();
  const resultado = Financeiro.calcularCotacao({ produtos, fornecedores, precos });
  const duracao = performance.now() - inicio;

  assert.equal(resultado.produtos.length, 500);
  assert.equal(resultado.fornecedores.length, 50);
  assert.equal(resultado.fornecedores.every(fornecedor => fornecedor.completo), true);
  assert.ok(duracao < 5000, `A matriz 500×50 levou ${Math.round(duracao)} ms.`);
});

teste('permissão atual aceita Logística, admin, todos os direitos e permissão específica', () => {
  assert.equal(Modelo.podeAcessar({ ativo: true, cargo: 'logistica' }), true);
  assert.equal(Modelo.podeAcessar({ ativo: true, cargo: 'admin' }), true);
  assert.equal(Modelo.podeAcessar({
    ativo: true,
    cargo: 'engenheiro',
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
    pode_gerenciar_permissoes: true,
    pode_acessar_cotacoes: true
  }), false);
  assert.equal(Modelo.podeAcessar(null), false);
});

teste('impressão divide sete fornecedores em blocos de até três e repete a planilha', () => {
  const estado = Modelo.criarEstado();
  adicionarProduto(estado, { id: 'p1', descricao: 'Alicate <universal>', quantidadeMillesimos: 5000 });
  adicionarProduto(estado, { id: 'p2', descricao: 'Trena 5 metros', quantidadeMillesimos: 2000 });
  const prazos = [
    '3 dias',
    '5 dias úteis',
    '10 dias corridos',
    'Entrega imediata',
    'Até 15 dias',
    'Sob <consulta>',
    ''
  ];
  for (let indice = 1; indice <= 7; indice += 1) {
    adicionarFornecedor(estado, `Fornecedor ${indice}`, {
      id: `f${indice}`,
      prazoEntrega: prazos[indice - 1]
    });
    Modelo.definirPreco(estado, 'p1', `f${indice}`, 900 + indice * 100);
    Modelo.definirPreco(estado, 'p2', `f${indice}`, 500 + indice * 100);
  }
  estado.impressao = {
    numero: '210726',
    descricao: 'Reposição <urgente> do estoque',
    elaboradoPor: 'Daniela',
    aprovadoPor: 'Responsável',
    data: '2026-07-22'
  };

  const blocos = PrintView.dividirEmBlocos(estado.fornecedores);
  assert.deepEqual(blocos.map(bloco => bloco.length), [3, 3, 1]);

  const html = PrintView.renderizar(estado, { emitidoEm: '2026-07-22T12:00:00.000Z' });
  const folhas = html.split(/<article\b[^>]*class="[^"]*cot-print-sheet[^"]*"[^>]*>/i).slice(1);
  assert.equal(folhas.length, 3);
  assert.equal(contar(html, /data-print-block="\d+"/g), 3);

  const quantidadesFornecedores = folhas.map(folha => {
    const cabecalho = folha.match(/<thead\b[^>]*>[\s\S]*?<\/thead>/i);
    assert.ok(cabecalho, 'Cada bloco deve possuir cabeçalho próprio.');
    const nomes = cabecalho[0].match(/Fornecedor\s+[1-7]/gi) || [];
    return new Set(nomes.map(nome => nome.toLocaleLowerCase())).size;
  });
  assert.deepEqual(quantidadesFornecedores, [3, 3, 1]);
  assert.match(folhas[0], /3 dias/);
  assert.match(folhas[0], /5 dias úteis/);
  assert.match(folhas[0], /10 dias corridos/);
  assert.doesNotMatch(folhas[0], /Entrega imediata/);
  assert.match(folhas[1], /Entrega imediata/);
  assert.match(folhas[1], /Até 15 dias/);
  assert.match(folhas[1], /Sob &lt;consulta&gt;/);
  assert.match(folhas[2], /Prazo de entrega: Não informado/);
  assert.equal(contar(html, /class="cot-print-delivery-term"/g), 7);
  folhas.forEach(folha => {
    assert.match(folha, /210726/);
    assert.match(folha, /PRODUTO/i);
    assert.match(folha, /QUANTIDADE/i);
    assert.match(folha, /CUSTO IDEAL/i);
  });

  assert.match(html, /Cotação de Preços/i);
  assert.match(html, /Fornecedor recomendado/i);
  assert.match(html, /Desconto sugerido/i);
  assert.match(html, /Percentual de negociação/i);
  assert.match(html, /best-price|data-best="true"/i);
  assert.match(html, /Alicate &lt;universal&gt;/);
  assert.match(html, /Reposição &lt;urgente&gt; do estoque/);
  assert.match(html, /Prazo de entrega:/i);
  assert.doesNotMatch(html, /Sob <consulta>/);
  assert.doesNotMatch(html, /<input\b|<button\b|<textarea\b/i);
  assert.doesNotMatch(html, /RAZÃO SOCIAL|CNPJ|FORMA (?:DE )?PGTO|FRETE|TELEFONE|E-?MAIL/i);
});

teste('contrato estático mantém planilha compacta, impressão, temas e quatro ações principais', () => {
  const html = ler('public/funcionario.html');
  const inicioTela = html.indexOf('<section id="tela-cotacoes"');
  const fimTela = html.indexOf('<!-- TELA 9', inicioTela);
  const tela = html.slice(inicioTela, fimTela > inicioTela ? fimTela : undefined);
  const frontend = ler('public/js/cotacoes.js');
  const modelo = ler('public/js/cotacoes-modelo.js');
  const css = ler('public/css/cotacoes.css');
  const servidor = ler('server.js');
  const navegacao = ler('public/js/funcionario.js');
  const permissoesHtml = ler('public/permissoes.html');
  const permissoesJs = ler('public/js/permissoes.js');

  assert.ok(inicioTela >= 0, 'A tela de cotações deve existir.');
  assert.match(html, /id="menu-cotacoes"[^>]*\shidden/);

  const idsObrigatorios = [
    'cotacoes-acesso-negado', 'cotacoes-app', 'cotacoes-titulo',
    'cotacoes-adicionar-item', 'cotacoes-adicionar-fornecedor', 'cotacoes-imprimir',
    'cotacoes-limpar', 'cotacoes-sheet-status', 'cotacoes-tabela-wrap', 'cotacoes-resumo',
    'cotacao-numero', 'cotacao-descricao', 'cotacao-elaborado-por',
    'cotacao-aprovado-por', 'cotacao-data', 'cotacoes-print-preview',
    'cotacoes-print-title', 'cotacoes-print-executar', 'cotacoes-print-fechar',
    'cotacoes-print-document'
  ];
  idsObrigatorios.forEach(id => assert.match(tela, new RegExp(`id="${id}"`)));

  const toolbar = tela.match(/<div class="cotacoes-toolbar"[\s\S]*?<\/div>/);
  assert.ok(toolbar, 'A barra de ações principal deve existir.');
  assert.equal(contar(toolbar[0], /<button\b/g), 4);
  assert.match(toolbar[0], /\+ Adicionar Produto/);
  assert.match(toolbar[0], /\+ Adicionar Fornecedor/);
  assert.match(toolbar[0], />Imprimir</);
  assert.match(toolbar[0], />Limpar Tabela</);

  for (const id of [
    'cotacoes-salvar', 'cotacoes-finalizar', 'cotacoes-historico',
    'cotacoes-cancelar', 'cotacoes-aprovar', 'cotacoes-reabrir'
  ]) {
    assert.doesNotMatch(tela, new RegExp(`id="${id}"`));
  }

  const scripts = [
    'js/cotacoes-financeiro.js',
    'js/cotacoes-modelo.js',
    'js/cotacoes-print.js',
    'js/cotacoes.js'
  ];
  scripts.forEach(script => assert.match(html, new RegExp(`src="${script.replace(/\./g, '\\.')}`)));
  assert.ok(html.indexOf(scripts[0]) < html.indexOf(scripts[1]));
  assert.ok(html.indexOf(scripts[1]) < html.indexOf(scripts[3]));
  assert.ok(html.indexOf(scripts[2]) < html.indexOf(scripts[3]));

  assert.match(frontend, /data-(?:item|produto)-id/);
  assert.match(frontend, /data-(?:supplier|fornecedor)-id|data-price-supplier/);
  assert.match(frontend, /data-preco-chave/);
  assert.match(frontend, /data-produto-id/);
  assert.match(frontend, /data-fornecedor-id/);
  assert.match(frontend, /data-fornecedor-prazo/);
  assert.match(frontend, /(?:evento|event)\.key\s*[!=]===?\s*['"]Enter['"]/);
  assert.doesNotMatch(frontend, /(?:evento|event)\.key\s*===?\s*['"]Tab['"]/);
  assert.match(frontend, /window\.print\s*\(/);
  assert.match(frontend, /PrintView\.renderizar|CotacoesPrintView\.renderizar/);
  assert.match(frontend, /confirm\s*\(/);

  assert.match(css, /\.cotacoes-sheet-wrap\s*\{[^}]*overflow\s*:\s*(?:auto|[^;}]*horizontal)/s);
  assert.match(css, /\.cotacoes-sheet-table[\s\S]*position\s*:\s*sticky/);
  for (const classe of [
    'cotacoes-col-number', 'cotacoes-col-item', 'cotacoes-col-quantity',
    'cotacoes-col-supplier', 'cotacoes-col-ideal', 'cotacoes-totals-row',
    'cotacoes-summary-strip', 'cotacoes-print-fields', 'cot-print-sheet', 'cot-print-table'
  ]) {
    assert.match(css, new RegExp(`\\.${classe}\\b`));
  }
  assert.match(css, /\.cotacoes-price-cell\[data-best=(?:"?true"?)\]/);
  assert.match(css, /\.cotacoes-supplier-term\b/);
  assert.match(css, /\.cot-print-delivery-term\b/);
  assert.match(css, /(?:prefers-color-scheme\s*:\s*light|data-theme[^\n{]*light|color-scheme\s*:[^;]*light)/i);
  assert.match(css, /(?:prefers-color-scheme\s*:\s*dark|data-theme[^\n{]*dark|--cot-bg\s*:\s*#[0-2])/i);
  assert.match(css, /@page(?:\s+[\w-]+)?\s*\{[^}]*size\s*:\s*A4 landscape[^}]*margin\s*:\s*8mm/is);
  assert.match(css, /@media\s+print/i);
  assert.match(css, /print-color-adjust\s*:\s*exact/i);
  assert.match(css, /-webkit-print-color-adjust\s*:\s*exact/i);
  assert.doesNotMatch(css, /(?:linear|radial)-gradient\s*\(/i);

  assert.doesNotMatch(frontend, /\/api\/cotacoes|\bfetch\s*\(|localStorage|sessionStorage|autosave/i);
  assert.doesNotMatch(modelo, /\/api\/cotacoes|\bfetch\s*\(|localStorage|sessionStorage|autosave/i);
  assert.doesNotMatch(servidor, /\/api\/cotacoes|cotacoes-service|COTACOES_PATH/);
  assert.equal(fs.existsSync(path.join(RAIZ, 'lib', 'cotacoes-service.js')), false);
  assert.equal(fs.existsSync(path.join(RAIZ, 'data', 'cotacoes.json')), false);

  assert.match(navegacao, /podeAcessarModuloCotacoes|CotacoesModelo\.podeAcessar/);
  assert.match(navegacao, /tela\s*===\s*['"]cotacoes['"]/);
  assert.match(permissoesHtml, /id="perm-cotacoes"/);
  assert.match(permissoesJs, /pode_acessar_cotacoes/);

  const idsHtml = new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), resultado => resultado[1]));
  const idsReferenciados = [
    ...Array.from(frontend.matchAll(/(?:porId|document\.getElementById)\(['"]([^'"]+)['"]\)/g), resultado => resultado[1])
  ];
  const idsAusentes = Array.from(new Set(idsReferenciados.filter(id => !idsHtml.has(id))));
  assert.deepEqual(idsAusentes, []);
});

async function executarSuite() {
  let falhas = 0;
  const inicioSuite = performance.now();

  for (const caso of testes) {
    const inicio = performance.now();
    try {
      await caso.executar();
      console.log(`✓ ${caso.nome} (${Math.round(performance.now() - inicio)} ms)`);
    } catch (error) {
      falhas += 1;
      console.error(`✗ ${caso.nome}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  const duracao = Math.round(performance.now() - inicioSuite);
  console.log(`\nCotações temporárias: ${testes.length - falhas} aprovados, ${falhas} falhas (${duracao} ms).`);
  if (falhas > 0) process.exitCode = 1;
}

executarSuite().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
