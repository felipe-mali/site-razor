'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const {
  calcularCotacao,
  formatarBasisPoints,
  formatarCentavos,
  formatarQuantidade,
  normalizarCnpj,
  parseMoedaParaCentavos,
  parseQuantidadeParaMillesimos,
  validarCnpj
} = require('./public/js/cotacoes-financeiro');
const { criarCotacoesService } = require('./lib/cotacoes-service');
const CotacoesPrint = require('./public/js/cotacoes-print');

const RAIZ = __dirname;
const testes = [];

class TestePulado extends Error {
  constructor(message) {
    super(message);
    this.name = 'TestePulado';
  }
}

function teste(nome, executar) {
  testes.push({ nome, executar });
}

function pular(message) {
  throw new TestePulado(message);
}

function cenarioFinanceiroObrigatorio() {
  return {
    itens: [
      { id: 'item-1', descricao: 'Item 1', unidade: 'UN', quantidadeMillesimos: 1000 },
      { id: 'item-2', descricao: 'Item 2', unidade: 'UN', quantidadeMillesimos: 1000 }
    ],
    fornecedores: [
      { id: 'fornecedor-a', nome: 'Fornecedor A', freteCentavos: 0 },
      { id: 'fornecedor-b', nome: 'Fornecedor B', freteCentavos: 0 },
      { id: 'fornecedor-c', nome: 'Fornecedor C', freteCentavos: 0 }
    ],
    precos: [
      { itemId: 'item-1', fornecedorId: 'fornecedor-a', valorUnitarioCentavos: 25000 },
      { itemId: 'item-2', fornecedorId: 'fornecedor-a', valorUnitarioCentavos: 29000 },
      { itemId: 'item-1', fornecedorId: 'fornecedor-b', valorUnitarioCentavos: 22000 },
      { itemId: 'item-2', fornecedorId: 'fornecedor-b', valorUnitarioCentavos: 34500 },
      { itemId: 'item-1', fornecedorId: 'fornecedor-c', valorUnitarioCentavos: 30000 },
      { itemId: 'item-2', fornecedorId: 'fornecedor-c', valorUnitarioCentavos: 30500 }
    ]
  };
}

function entradaServicoObrigatoria() {
  return {
    departamento: 'Logística',
    centroCusto: 'TESTE',
    descricaoCompra: 'Cenário financeiro obrigatório',
    observacoesInternas: 'Dados isolados da suíte automatizada.',
    itens: [
      { descricao: 'Item 1', unidade: 'UN', quantidadeMillesimos: 1000, ordem: 0 },
      { descricao: 'Item 2', unidade: 'UN', quantidadeMillesimos: 1000, ordem: 1 }
    ],
    fornecedores: [
      { nome: 'Fornecedor A', freteCentavos: 0, ordem: 0 },
      { nome: 'Fornecedor B', freteCentavos: 0, ordem: 1 },
      { nome: 'Fornecedor C', freteCentavos: 0, ordem: 2 }
    ],
    precos: [
      { itemIndex: 0, fornecedorIndex: 0, valorUnitarioCentavos: 25000 },
      { itemIndex: 1, fornecedorIndex: 0, valorUnitarioCentavos: 29000 },
      { itemIndex: 0, fornecedorIndex: 1, valorUnitarioCentavos: 22000 },
      { itemIndex: 1, fornecedorIndex: 1, valorUnitarioCentavos: 34500 },
      { itemIndex: 0, fornecedorIndex: 2, valorUnitarioCentavos: 30000 },
      { itemIndex: 1, fornecedorIndex: 2, valorUnitarioCentavos: 30500 }
    ],
    // O serviço deve ignorar qualquer derivado financeiro recebido do cliente.
    calculos: {
      custoIdealTotalCentavos: 1,
      totalRecomendadoCentavos: 1,
      descontoSugeridoCentavos: 99999999
    },
    totalRecomendadoCentavos: 1
  };
}

function verificarErroServico(operacao, codigo, status) {
  let capturado = null;
  try {
    operacao();
  } catch (error) {
    capturado = error;
  }
  assert.ok(capturado, `Era esperado o erro ${codigo}.`);
  assert.equal(capturado.codigo, codigo);
  assert.equal(capturado.status, status);
  return capturado;
}

function validarDiretorioTemporario(diretorio) {
  const raizTemporaria = path.resolve(os.tmpdir()).toLocaleLowerCase();
  const alvo = path.resolve(diretorio).toLocaleLowerCase();
  const prefixo = raizTemporaria.endsWith(path.sep)
    ? raizTemporaria
    : raizTemporaria + path.sep;
  if (!alvo.startsWith(prefixo)) {
    throw new Error('Recusa de remoção: o alvo não pertence ao diretório temporário do sistema.');
  }
}

function removerDiretorioTemporario(diretorio) {
  validarDiretorioTemporario(diretorio);
  fs.rmSync(diretorio, { recursive: true, force: true });
}

function contar(texto, expressao) {
  return (texto.match(expressao) || []).length;
}

function requisicaoJson(porta, metodo, rota, corpo, token) {
  return new Promise((resolve, reject) => {
    const serializado = corpo === undefined ? null : JSON.stringify(corpo);
    const headers = { Accept: 'application/json', Connection: 'close' };
    if (serializado !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(serializado);
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    let concluida = false;
    let limiteRequisicao = null;
    const concluir = (callback, valor) => {
      if (concluida) return;
      concluida = true;
      clearTimeout(limiteRequisicao);
      callback(valor);
    };
    const requisicao = http.request({
      hostname: '127.0.0.1',
      port: porta,
      path: rota,
      method: metodo,
      headers
    }, resposta => {
      let conteudo = '';
      resposta.setEncoding('utf8');
      resposta.on('data', parte => {
        conteudo += parte;
      });
      resposta.on('error', error => concluir(reject, error));
      resposta.on('end', () => {
        let body = null;
        if (conteudo) {
          try {
            body = JSON.parse(conteudo);
          } catch {
            body = conteudo;
          }
        }
        concluir(resolve, { status: resposta.statusCode, body });
      });
    });
    limiteRequisicao = setTimeout(() => {
      requisicao.destroy(new Error('Tempo limite da requisição excedido.'));
    }, 3000);
    requisicao.on('error', error => concluir(reject, error));
    if (serializado !== null) requisicao.write(serializado);
    requisicao.end();
  });
}

function obterPortaLivre() {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.unref();
    servidor.on('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const endereco = servidor.address();
      servidor.close(error => {
        if (error) reject(error);
        else resolve(endereco.port);
      });
    });
  });
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function aguardarServidor(processo, porta) {
  const limite = Date.now() + 10000;
  while (Date.now() < limite) {
    if (processo.exitCode !== null) {
      throw new Error(`O servidor de teste encerrou antes de iniciar (código ${processo.exitCode}).`);
    }
    try {
      await requisicaoJson(porta, 'GET', '/api/cotacoes');
      return;
    } catch {
      await esperar(100);
    }
  }
  throw new Error('O servidor de teste não iniciou dentro de 10 segundos.');
}

function aguardarSaida(processo, limiteMs) {
  if (!processo || processo.exitCode !== null) return Promise.resolve(true);
  return new Promise(resolve => {
    let finalizado = false;
    const concluir = valor => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(timer);
      processo.removeListener('exit', aoSair);
      resolve(valor);
    };
    const aoSair = () => concluir(true);
    const timer = setTimeout(() => concluir(false), limiteMs);
    processo.once('exit', aoSair);
  });
}

async function encerrarServidor(processo) {
  if (!processo || processo.exitCode !== null) return;
  processo.kill();
  if (await aguardarSaida(processo, 2000)) return;
  processo.kill('SIGKILL');
  await aguardarSaida(processo, 2000);
}

async function autenticar(porta, credencial, rotulo) {
  const resposta = await requisicaoJson(porta, 'POST', '/api/login', {
    usuario: credencial.usuario,
    senha: credencial.senha
  });
  if (resposta.status !== 200) {
    throw new Error(`O login da fixture ${rotulo} retornou HTTP ${resposta.status}.`);
  }
  if (!resposta.body || typeof resposta.body.token !== 'string' || !resposta.body.token) {
    throw new Error(`O login da fixture ${rotulo} não retornou um token.`);
  }
  return resposta.body.token;
}

teste('parser, formatadores e CNPJ usam representações inteiras', () => {
  assert.equal(parseMoedaParaCentavos('10'), 1000);
  assert.equal(parseMoedaParaCentavos('10,5'), 1050);
  assert.equal(parseMoedaParaCentavos('10,50'), 1050);
  assert.equal(parseMoedaParaCentavos('1.250,75'), 125075);
  assert.equal(parseMoedaParaCentavos('10,001'), null);
  assert.equal(formatarCentavos(125075), 'R$ 1.250,75');
  assert.equal(parseQuantidadeParaMillesimos('1.234,567'), 1234567);
  assert.equal(formatarQuantidade(1234567), '1.234,567');
  assert.equal(formatarBasisPoints(556), '5,56%');
  assert.equal(normalizarCnpj('04.252.011/0001-10'), '04252011000110');
  assert.equal(validarCnpj('04.252.011/0001-10'), true);
  assert.equal(validarCnpj('11.111.111/1111-11'), false);
});

teste('cenário financeiro obrigatório produz 54000, 51000, 3000 e 556 bps', () => {
  const entrada = cenarioFinanceiroObrigatorio();
  const antes = JSON.stringify(entrada);
  const resultado = calcularCotacao(entrada);

  assert.equal(JSON.stringify(entrada), antes, 'O cálculo não deve alterar a entrada.');
  assert.deepEqual(resultado.fornecedorIdsRecomendados, ['fornecedor-a']);
  assert.equal(resultado.totalRecomendadoCentavos, 54000);
  assert.equal(resultado.custoIdealTotalCentavos, 51000);
  assert.equal(resultado.descontoSugeridoCentavos, 3000);
  assert.equal(resultado.percentualNegociacaoBasisPoints, 556);
  assert.equal(resultado.contadores.fornecedoresCompletos, 3);
});

teste('empates preservam todos os menores e todos os recomendados', () => {
  const resultado = calcularCotacao({
    itens: [{ id: 'item', quantidadeMillesimos: 1500 }],
    fornecedores: [{ id: 'a' }, { id: 'b' }],
    precos: [
      { itemId: 'item', fornecedorId: 'a', valorUnitarioCentavos: 101 },
      { itemId: 'item', fornecedorId: 'b', valorUnitarioCentavos: 101 }
    ]
  });

  assert.equal(resultado.itens[0].custoIdealTotalCentavos, 152, 'Arredondamento deve ser half-up.');
  assert.deepEqual(resultado.itens[0].fornecedorIdsMenorPreco, ['a', 'b']);
  assert.deepEqual(resultado.fornecedorIdsRecomendados, ['a', 'b']);
  assert.equal(resultado.itens[0].precos.every(preco => preco.menorPreco), true);
});

teste('fornecedor incompleto, preço indisponível e zero não são recomendados', () => {
  const resultado = calcularCotacao({
    itens: [
      { id: 'i1', quantidadeMillesimos: 1000 },
      { id: 'i2', quantidadeMillesimos: 1000 }
    ],
    fornecedores: [{ id: 'completo' }, { id: 'parcial' }, { id: 'indisponivel' }],
    precos: [
      { itemId: 'i1', fornecedorId: 'completo', valorUnitarioCentavos: 100 },
      { itemId: 'i2', fornecedorId: 'completo', valorUnitarioCentavos: 100 },
      { itemId: 'i1', fornecedorId: 'parcial', valorUnitarioCentavos: 1 },
      { itemId: 'i2', fornecedorId: 'parcial', valorUnitarioCentavos: 0 },
      { itemId: 'i1', fornecedorId: 'indisponivel', valorUnitarioCentavos: 1 },
      { itemId: 'i2', fornecedorId: 'indisponivel', valorUnitarioCentavos: 1, indisponivel: true }
    ]
  });

  assert.deepEqual(resultado.fornecedorIdsRecomendados, ['completo']);
  assert.equal(resultado.fornecedores[1].completo, false);
  assert.deepEqual(resultado.fornecedores[1].itemIdsFaltantes, ['i2']);
  assert.equal(resultado.fornecedores[2].completo, false);
  assert.equal(resultado.contadores.fornecedoresIncompletos, 2);
});

teste('frete altera corretamente o fornecedor recomendado', () => {
  const resultado = calcularCotacao({
    itens: [{ id: 'item', quantidadeMillesimos: 1000 }],
    fornecedores: [
      { id: 'produtos-menores', freteCentavos: 200 },
      { id: 'total-menor', freteCentavos: 0 }
    ],
    precos: [
      { itemId: 'item', fornecedorId: 'produtos-menores', valorUnitarioCentavos: 100 },
      { itemId: 'item', fornecedorId: 'total-menor', valorUnitarioCentavos: 150 }
    ]
  });

  assert.equal(resultado.custoIdealTotalCentavos, 100);
  assert.deepEqual(resultado.fornecedorIdsRecomendados, ['total-menor']);
  assert.equal(resultado.totalRecomendadoCentavos, 150);
});

teste('matriz grande mantém cálculo linear dentro do limite de desempenho', () => {
  const quantidadeItens = 500;
  const quantidadeFornecedores = 50;
  const itens = Array.from({ length: quantidadeItens }, (_, indice) => ({
    id: `item-${indice}`,
    quantidadeMillesimos: 1000 + (indice % 3)
  }));
  const fornecedores = Array.from({ length: quantidadeFornecedores }, (_, indice) => ({
    id: `fornecedor-${indice}`,
    freteCentavos: indice
  }));
  const precos = [];
  for (const item of itens) {
    for (let indice = 0; indice < quantidadeFornecedores; indice += 1) {
      precos.push({
        itemId: item.id,
        fornecedorId: fornecedores[indice].id,
        valorUnitarioCentavos: 100 + indice
      });
    }
  }

  const inicio = performance.now();
  const resultado = calcularCotacao({ itens, fornecedores, precos });
  const duracao = performance.now() - inicio;

  assert.equal(resultado.itens.length, quantidadeItens);
  assert.equal(resultado.itens[0].precos.length, quantidadeFornecedores);
  assert.equal(resultado.contadores.fornecedoresCompletos, quantidadeFornecedores);
  assert.ok(duracao < 5000, `A matriz 500x50 levou ${Math.round(duracao)} ms.`);
});

teste('serviço rejeita item, fornecedor, frete, data e referência inválidos', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'razor-cotacoes-validacao-'));
  const arquivo = path.join(diretorio, 'cotacoes.json');
  const usuario = { usuario: 'teste-logistica', nome: 'Teste Logística' };
  try {
    const servico = criarCotacoesService({ arquivo });
    verificarErroServico(() => servico.criar({
      itens: [{ descricao: '', unidade: 'UN', quantidadeMillesimos: 1000 }],
      fornecedores: [], precos: []
    }, usuario), 'CAMPO_OBRIGATORIO', 400);
    verificarErroServico(() => servico.criar({
      itens: [{ descricao: 'Item', unidade: 'UN', quantidadeMillesimos: 0 }],
      fornecedores: [], precos: []
    }, usuario), 'INTEIRO_INVALIDO', 400);
    verificarErroServico(() => servico.criar({
      itens: [], fornecedores: [{ nome: 'Fornecedor', freteCentavos: -1 }], precos: []
    }, usuario), 'INTEIRO_INVALIDO', 400);
    verificarErroServico(() => servico.criar({
      itens: [],
      fornecedores: [{ nome: 'Mesmo nome' }, { nome: ' mesmo  nome ' }],
      precos: []
    }, usuario), 'FORNECEDOR_DUPLICADO', 400);
    verificarErroServico(() => servico.criar({
      itens: [], fornecedores: [{ nome: 'Fornecedor', validadeProposta: '2026-02-30' }], precos: []
    }, usuario), 'DATA_INVALIDA', 400);
    verificarErroServico(() => servico.criar({
      itens: [{ descricao: 'Item', unidade: 'UN', quantidadeMillesimos: 1000 }],
      fornecedores: [{ nome: 'Fornecedor' }],
      precos: [{ itemId: 'inexistente', fornecedorIndex: 0, valorUnitarioCentavos: 100 }]
    }, usuario), 'REFERENCIA_INVALIDA', 400);
  } finally {
    removerDiretorioTemporario(diretorio);
  }
});

teste('serviço persiste, reabre, recalcula e aplica todo o ciclo de estados', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'razor-cotacoes-service-'));
  const arquivo = path.join(diretorio, 'dados', 'cotacoes.json');
  const usuario = { usuario: 'teste-logistica', nome: 'Teste Logística' };

  try {
    const servico = criarCotacoesService({ arquivo });
    const criada = servico.criar(entradaServicoObrigatoria(), usuario);

    assert.equal(fs.existsSync(arquivo), true);
    assert.match(criada.numero, /^COT-\d{4}-\d{4}$/);
    assert.equal(criada.status, 'em_andamento');
    assert.equal(criada.calculos.totalRecomendadoCentavos, 54000);
    assert.equal(criada.calculos.custoIdealTotalCentavos, 51000);
    assert.equal(criada.calculos.descontoSugeridoCentavos, 3000);
    assert.equal(criada.calculos.percentualNegociacaoBasisPoints, 556);
    assert.notEqual(criada.calculos.totalRecomendadoCentavos, 1);

    const bancoCompactado = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    assert.equal(bancoCompactado.cotacoes[0].calculos.itens[0].precos, undefined);

    const reaberto = criarCotacoesService({ arquivo });
    assert.equal(reaberto.obter(criada.id).numero, criada.numero);
    assert.equal(reaberto.obter(criada.id).calculos.itens[0].precos.length, 3);
    assert.equal(reaberto.listar({ limite: 10 }).paginacao.total, 1);

    const atualizada = reaberto.atualizar(criada.id, {
      descricaoCompra: 'Descrição atualizada',
      calculos: { totalRecomendadoCentavos: 7 },
      totalRecomendadoCentavos: 7
    }, usuario);
    assert.equal(atualizada.descricaoCompra, 'Descrição atualizada');
    assert.equal(atualizada.calculos.totalRecomendadoCentavos, 54000);

    const duplicada = reaberto.duplicar(criada.id, usuario);
    assert.notEqual(duplicada.id, criada.id);
    assert.notEqual(duplicada.numero, criada.numero);
    assert.equal(duplicada.origemDuplicacaoId, criada.id);
    assert.equal(duplicada.calculos.totalRecomendadoCentavos, 54000);
    assert.notEqual(duplicada.itens[0].id, criada.itens[0].id);
    assert.notEqual(duplicada.fornecedores[0].id, criada.fornecedores[0].id);

    const finalizada = reaberto.finalizar(criada.id, usuario);
    assert.equal(finalizada.status, 'finalizada');
    assert.ok(finalizada.finalizadaEm);
    verificarErroServico(
      () => reaberto.atualizar(criada.id, { descricaoCompra: 'Não permitido' }, usuario),
      'COTACAO_SOMENTE_LEITURA',
      409
    );
    verificarErroServico(
      () => reaberto.cancelar(criada.id, { motivo: 'Não permitido' }, usuario),
      'COTACAO_SOMENTE_LEITURA',
      409
    );
    verificarErroServico(
      () => reaberto.excluir(criada.id),
      'EXCLUSAO_NAO_PERMITIDA',
      409
    );
    verificarErroServico(
      () => reaberto.finalizar(criada.id, usuario),
      'FINALIZACAO_NAO_PERMITIDA',
      409
    );

    const cancelada = reaberto.cancelar(duplicada.id, { motivo: 'Teste de regra' }, usuario);
    assert.equal(cancelada.status, 'cancelada');
    assert.equal(cancelada.cancelamento.motivo, 'Teste de regra');
    verificarErroServico(
      () => reaberto.cancelar(duplicada.id, {}, usuario),
      'COTACAO_JA_CANCELADA',
      409
    );
    verificarErroServico(
      () => reaberto.excluir(duplicada.id),
      'EXCLUSAO_NAO_PERMITIDA',
      409
    );
    verificarErroServico(
      () => reaberto.atualizar(duplicada.id, { descricaoCompra: 'Não permitido' }, usuario),
      'COTACAO_SOMENTE_LEITURA',
      409
    );
    verificarErroServico(
      () => reaberto.finalizar(duplicada.id, usuario),
      'FINALIZACAO_NAO_PERMITIDA',
      409
    );

    const incompleta = reaberto.criar({
      descricaoCompra: 'Incompleta',
      itens: [
        { descricao: 'Item 1', unidade: 'UN', quantidadeMillesimos: 1000 },
        { descricao: 'Item 2', unidade: 'UN', quantidadeMillesimos: 1000 }
      ],
      fornecedores: [{ nome: 'Fornecedor único', freteCentavos: 0 }],
      precos: [{ itemIndex: 0, fornecedorIndex: 0, valorUnitarioCentavos: 100 }]
    }, usuario);
    verificarErroServico(
      () => reaberto.finalizar(incompleta.id, usuario),
      'COTACAO_INCOMPLETA',
      422
    );
    reaberto.excluir(incompleta.id);
    verificarErroServico(
      () => reaberto.obter(incompleta.id),
      'COTACAO_NAO_ENCONTRADA',
      404
    );

    const deletavel = reaberto.criar({
      descricaoCompra: 'Rascunho deletável',
      itens: [],
      fornecedores: [],
      precos: []
    }, usuario);
    reaberto.excluir(deletavel.id);
    verificarErroServico(
      () => reaberto.obter(deletavel.id),
      'COTACAO_NAO_ENCONTRADA',
      404
    );

    const bancoPersistido = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    assert.equal(bancoPersistido.cotacoes.length, 2);
    assert.deepEqual(
      bancoPersistido.cotacoes.map(cotacao => cotacao.status).sort(),
      ['cancelada', 'finalizada']
    );
  } finally {
    removerDiretorioTemporario(diretorio);
  }

  assert.equal(fs.existsSync(diretorio), false);
});

teste('histórico filtra pelo dia civil de São Paulo, não por UTC', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'razor-cotacoes-data-'));
  const arquivo = path.join(diretorio, 'cotacoes.json');
  try {
    const servico = criarCotacoesService({ arquivo });
    const criada = servico.criar({ itens: [], fornecedores: [], precos: [] }, {
      usuario: 'teste-logistica',
      nome: 'Teste Logística'
    });
    const banco = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    banco.cotacoes.find(cotacao => cotacao.id === criada.id).criadoEm = '2026-07-23T01:30:00.000Z';
    fs.writeFileSync(arquivo, JSON.stringify(banco, null, 2), 'utf8');

    assert.equal(servico.listar({ dataInicio: '2026-07-22', dataFim: '2026-07-22' }).paginacao.total, 1);
    assert.equal(servico.listar({ dataInicio: '2026-07-23', dataFim: '2026-07-23' }).paginacao.total, 0);
  } finally {
    removerDiretorioTemporario(diretorio);
  }
});

teste('renderizador CommonJS divide sete fornecedores em blocos de no máximo três', () => {
  const fornecedores = Array.from({ length: 7 }, (_, indice) => ({
    id: `fornecedor-${indice + 1}`,
    nome: `Fornecedor ${indice + 1}`,
    freteCentavos: indice * 10,
    ativoComparacao: true
  }));
  const cotacao = {
    numero: 'COT-TESTE-0001',
    status: 'em_andamento',
    criadoEm: '2026-01-01T12:00:00.000Z',
    departamento: 'Logística',
    descricaoCompra: 'Teste de impressão com sete fornecedores.',
    observacoesInternas: 'OBSERVACAO_INTERNA_TESTE',
    itens: [{
      id: 'item-1',
      descricao: 'Item de impressão',
      observacao: 'OBSERVACAO_ITEM_TESTE',
      unidade: 'UN',
      quantidadeMillesimos: 1000,
      ativo: true
    }],
    fornecedores,
    precos: fornecedores.map((fornecedor, indice) => ({
      itemId: 'item-1',
      fornecedorId: fornecedor.id,
      valorUnitarioCentavos: 1000 + indice,
      indisponivel: false
    }))
  };

  const blocos = CotacoesPrint.dividirFornecedoresEmBlocos(fornecedores);
  assert.deepEqual(blocos.map(bloco => bloco.length), [3, 3, 1]);

  const html = CotacoesPrint.renderizar(cotacao, {
    emitidoEm: '2026-01-02T12:00:00.000Z',
    incluirObservacoes: true,
    incluirAssinaturas: true
  });
  const folhas = html.split('<article class="cot-print-sheet"').slice(1);

  assert.equal(folhas.length, 3);
  assert.equal(contar(html, /data-print-block="\d+"/g), 3);
  assert.deepEqual(
    folhas.map(folha => contar(folha, /<article class="cot-print-supplier(?: recommended)?">/g)),
    [3, 3, 1]
  );
  assert.equal(folhas.every(folha =>
    contar(folha, /<article class="cot-print-supplier(?: recommended)?">/g) <= 3
  ), true);

  const htmlSelecionado = CotacoesPrint.renderizar(cotacao, {
    fornecedorIds: ['fornecedor-7'],
    incluirObservacoes: false,
    incluirAssinaturas: false,
    emitidoEm: '2026-01-02T12:00:00.000Z'
  });
  assert.match(htmlSelecionado, /Fornecedor 7 · RECOMENDADO/);
  assert.doesNotMatch(htmlSelecionado, /Fornecedor 1/);
  assert.match(htmlSelecionado, /Resumo da compra/);
  assert.match(htmlSelecionado, /Teste de impressão com sete fornecedores\./);
  assert.doesNotMatch(htmlSelecionado, /OBSERVACAO_INTERNA_TESTE/);
  assert.doesNotMatch(htmlSelecionado, /OBSERVACAO_ITEM_TESTE/);
});

teste('contrato estático integra menu, permissão configurável, guards, IDs e scripts', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public', 'funcionario.html'), 'utf8');
  const navegacao = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'funcionario.js'), 'utf8');
  const frontend = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'cotacoes.js'), 'utf8');
  const css = fs.readFileSync(path.join(RAIZ, 'public', 'css', 'cotacoes.css'), 'utf8');
  const permissoesHtml = fs.readFileSync(path.join(RAIZ, 'public', 'permissoes.html'), 'utf8');
  const permissoesJs = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'permissoes.js'), 'utf8');
  const usuarios = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'usuarios.json'), 'utf8'));

  assert.match(html, /id="menu-cotacoes"[^>]*\shidden/);
  assert.match(navegacao, /cargo === 'logistica'/);
  assert.match(navegacao, /usuario\.pode_gerenciar_permissoes === true/);
  assert.match(navegacao, /usuario\.pode_acessar_cotacoes === true/);
  assert.match(frontend, /window\.podeAcessarModuloCotacoes/);
  assert.ok(frontend.indexOf('if (!autorizarOuNegar())') < frontend.indexOf('window.fetch('));
  assert.ok(html.indexOf('js/cotacoes-financeiro.js') < html.indexOf('js/cotacoes-print.js'));
  assert.ok(html.indexOf('js/cotacoes-print.js') < html.indexOf('js/cotacoes.js'));
  assert.match(css, /@page cotacoes-documento\s*\{\s*size:\s*A4 landscape;/);
  assert.match(permissoesHtml, /id="perm-cotacoes"/);
  assert.match(permissoesJs, /pode_acessar_cotacoes/);

  for (const login of ['admin', 'felipe', 'kelvin', 'daniela']) {
    assert.equal(usuarios[login] && usuarios[login].pode_acessar_cotacoes, true, `${login} deve acessar cotações`);
  }
  assert.equal(usuarios.miqueias && usuarios.miqueias.pode_acessar_cotacoes, false);

  const idsHtml = new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), resultado => resultado[1]));
  const idsReferenciados = Array.from(frontend.matchAll(/porId\('([^']+)'\)/g), resultado => resultado[1]);
  const ausentes = Array.from(new Set(idsReferenciados.filter(id => !idsHtml.has(id))));
  assert.deepEqual(ausentes, []);
});

teste('API real aplica 401/403 e aceita Logística, admin, todos os direitos e permissão específica', async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'razor-cotacoes-http-'));
  const arquivoCotacoes = path.join(diretorio, 'cotacoes-http.json');
  const usuariosPath = path.join(diretorio, 'usuarios-http.json');
  const usuarios = {
    logistica: {
      senha: 'teste-logistica', nome: 'Teste Logística', cargo: 'logistica', ativo: true,
      pode_ver_funcionario: true, pode_ver_imagens: true, pode_editar_imagens: false,
      pode_gerenciar_permissoes: false, pode_acessar_cotacoes: false
    },
    admin: {
      senha: 'teste-admin', nome: 'Teste Admin', cargo: 'admin', ativo: true,
      pode_ver_funcionario: true, pode_ver_imagens: true, pode_editar_imagens: true,
      pode_gerenciar_permissoes: false, pode_acessar_cotacoes: false
    },
    felipe: {
      senha: 'teste-felipe', nome: 'Teste Todos os Direitos', cargo: 'engenheiro', ativo: true,
      pode_ver_funcionario: true, pode_ver_imagens: true, pode_editar_imagens: true,
      pode_gerenciar_permissoes: true, pode_acessar_cotacoes: false
    },
    daniela: {
      senha: 'teste-daniela', nome: 'Teste Permissão Específica', cargo: 'vendedor', ativo: true,
      pode_ver_funcionario: true, pode_ver_imagens: true, pode_editar_imagens: false,
      pode_gerenciar_permissoes: false, pode_acessar_cotacoes: true
    },
    sem_permissao: {
      senha: 'teste-sem-permissao', nome: 'Teste Sem Permissão', cargo: 'vendedor', ativo: true,
      pode_ver_funcionario: true, pode_ver_imagens: true, pode_editar_imagens: false,
      pode_gerenciar_permissoes: false, pode_acessar_cotacoes: false
    }
  };
  const usuariosConteudoOriginal = JSON.stringify(usuarios, null, 2);
  fs.writeFileSync(usuariosPath, usuariosConteudoOriginal, 'utf8');
  let porta = null;
  let processo = null;

  try {
    porta = await obterPortaLivre();
    processo = spawn(process.execPath, ['server.js'], {
      cwd: RAIZ,
      env: {
        ...process.env,
        PORT: String(porta),
        COTACOES_PATH: arquivoCotacoes,
        USUARIOS_PATH: usuariosPath
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    processo.stdout.resume();
    processo.stderr.resume();
    await aguardarServidor(processo, porta);

    const semToken = await requisicaoJson(porta, 'GET', '/api/cotacoes');
    assert.equal(semToken.status, 401);
    const semTokenPost = await requisicaoJson(porta, 'POST', '/api/cotacoes', entradaServicoObrigatoria());
    assert.equal(semTokenPost.status, 401);

    const tokenSemPermissao = await autenticar(
      porta, { usuario: 'sem_permissao', senha: usuarios.sem_permissao.senha }, 'sem permissão'
    );
    const proibida = await requisicaoJson(porta, 'GET', '/api/cotacoes', undefined, tokenSemPermissao);
    assert.equal(proibida.status, 403);
    assert.equal(proibida.body && proibida.body.codigo, 'PERMISSAO_COTACOES_OBRIGATORIA');
    const proibidaPost = await requisicaoJson(
      porta, 'POST', '/api/cotacoes', entradaServicoObrigatoria(), tokenSemPermissao
    );
    assert.equal(proibidaPost.status, 403);

    const tokensAutorizados = {};
    for (const login of ['logistica', 'admin', 'felipe', 'daniela']) {
      tokensAutorizados[login] = await autenticar(
        porta, { usuario: login, senha: usuarios[login].senha }, login
      );
      const permitida = await requisicaoJson(porta, 'GET', '/api/cotacoes', undefined, tokensAutorizados[login]);
      assert.equal(permitida.status, 200, `${login} deveria acessar cotações`);
    }

    const usuariosGerenciados = await requisicaoJson(
      porta, 'GET', '/api/usuarios', undefined, tokensAutorizados.felipe
    );
    assert.equal(usuariosGerenciados.status, 200);
    assert.equal(usuariosGerenciados.body.daniela.pode_acessar_cotacoes, true);

    const concedida = await requisicaoJson(
      porta, 'PUT', '/api/usuarios/sem_permissao', {
        permissoes: {
          pode_ver_funcionario: true,
          pode_ver_imagens: true,
          pode_editar_imagens: false,
          pode_gerenciar_permissoes: false,
          pode_acessar_cotacoes: true
        }
      }, tokensAutorizados.felipe
    );
    assert.equal(concedida.status, 200);
    assert.equal((await requisicaoJson(porta, 'GET', '/api/cotacoes', undefined, tokenSemPermissao)).status, 200);

    const revogada = await requisicaoJson(
      porta, 'PUT', '/api/usuarios/sem_permissao', {
        permissoes: {
          pode_ver_funcionario: true,
          pode_ver_imagens: true,
          pode_editar_imagens: false,
          pode_gerenciar_permissoes: false,
          pode_acessar_cotacoes: false
        }
      }, tokensAutorizados.felipe
    );
    assert.equal(revogada.status, 200);
    assert.equal((await requisicaoJson(porta, 'GET', '/api/cotacoes', undefined, tokenSemPermissao)).status, 403);

    const tokenLogistica = tokensAutorizados.logistica;
    const criada = await requisicaoJson(
      porta,
      'POST',
      '/api/cotacoes',
      entradaServicoObrigatoria(),
      tokenLogistica
    );
    assert.equal(criada.status, 201);
    assert.equal(criada.body && criada.body.success, true);
    assert.equal(criada.body.cotacao.status, 'em_andamento');
    assert.equal(criada.body.cotacao.calculos.totalRecomendadoCentavos, 54000);
    assert.equal(criada.body.cotacao.calculos.custoIdealTotalCentavos, 51000);
    assert.equal(criada.body.cotacao.calculos.descontoSugeridoCentavos, 3000);
    assert.equal(criada.body.cotacao.calculos.percentualNegociacaoBasisPoints, 556);

    const listagem = await requisicaoJson(porta, 'GET', '/api/cotacoes', undefined, tokenLogistica);
    assert.equal(listagem.status, 200);
    assert.equal(listagem.body.paginacao.total, 1);

    const impressao = await requisicaoJson(
      porta,
      'GET',
      `/api/cotacoes/${encodeURIComponent(criada.body.cotacao.id)}/impressao`,
      undefined,
      tokenLogistica
    );
    assert.equal(impressao.status, 200);
    assert.equal(impressao.body.cotacao.numero, criada.body.cotacao.numero);

    const atualizada = await requisicaoJson(
      porta, 'PUT', `/api/cotacoes/${encodeURIComponent(criada.body.cotacao.id)}`,
      { descricaoCompra: 'Atualizada pela integração HTTP' }, tokenLogistica
    );
    assert.equal(atualizada.status, 200);
    assert.equal(atualizada.body.cotacao.descricaoCompra, 'Atualizada pela integração HTTP');

    const duplicada = await requisicaoJson(
      porta, 'POST', `/api/cotacoes/${encodeURIComponent(criada.body.cotacao.id)}/duplicar`, {}, tokenLogistica
    );
    assert.equal(duplicada.status, 201);

    const finalizada = await requisicaoJson(
      porta, 'POST', `/api/cotacoes/${encodeURIComponent(criada.body.cotacao.id)}/finalizar`, {}, tokenLogistica
    );
    assert.equal(finalizada.status, 200);
    assert.equal(finalizada.body.cotacao.status, 'finalizada');
    const edicaoBloqueada = await requisicaoJson(
      porta, 'PUT', `/api/cotacoes/${encodeURIComponent(criada.body.cotacao.id)}`,
      { descricaoCompra: 'Não deve alterar' }, tokenLogistica
    );
    assert.equal(edicaoBloqueada.status, 409);

    const cancelada = await requisicaoJson(
      porta, 'POST', `/api/cotacoes/${encodeURIComponent(duplicada.body.cotacao.id)}/cancelar`,
      { motivo: 'Teste HTTP' }, tokenLogistica
    );
    assert.equal(cancelada.status, 200);
    assert.equal(cancelada.body.cotacao.status, 'cancelada');

    const rascunho = await requisicaoJson(
      porta, 'POST', '/api/cotacoes', { descricaoCompra: 'Excluir', itens: [], fornecedores: [], precos: [] }, tokenLogistica
    );
    assert.equal(rascunho.status, 201);
    const excluida = await requisicaoJson(
      porta, 'DELETE', `/api/cotacoes/${encodeURIComponent(rascunho.body.cotacao.id)}`, undefined, tokenLogistica
    );
    assert.equal(excluida.status, 200);

    const bancoIsolado = JSON.parse(fs.readFileSync(arquivoCotacoes, 'utf8'));
    assert.equal(bancoIsolado.cotacoes.length, 2);
    assert.deepEqual(bancoIsolado.cotacoes.map(cotacao => cotacao.status).sort(), ['cancelada', 'finalizada']);
    assert.equal(JSON.parse(fs.readFileSync(usuariosPath, 'utf8')).sem_permissao.pode_acessar_cotacoes, false);
  } finally {
    await encerrarServidor(processo);
    removerDiretorioTemporario(diretorio);
  }

  assert.equal(fs.existsSync(diretorio), false);
});

async function executarSuite() {
  let falhas = 0;
  let pulados = 0;
  const inicioSuite = performance.now();

  for (const caso of testes) {
    const inicio = performance.now();
    try {
      await caso.executar();
      const duracao = Math.round(performance.now() - inicio);
      console.log(`✓ ${caso.nome} (${duracao} ms)`);
    } catch (error) {
      if (error instanceof TestePulado) {
        pulados += 1;
        console.log(`- ${caso.nome} [PULADO: ${error.message}]`);
      } else {
        falhas += 1;
        console.error(`✗ ${caso.nome}`);
        console.error(error && error.stack ? error.stack : error);
      }
    }
  }

  const duracaoTotal = Math.round(performance.now() - inicioSuite);
  const aprovados = testes.length - falhas - pulados;
  console.log(`\nCotações: ${aprovados} aprovados, ${falhas} falhas, ${pulados} pulados (${duracaoTotal} ms).`);
  if (falhas > 0) process.exitCode = 1;
}

executarSuite().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
