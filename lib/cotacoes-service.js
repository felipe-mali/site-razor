'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const {
  calcularCotacao,
  normalizarCnpj,
  validarCnpj
} = require('../public/js/cotacoes-financeiro');

const STATUS_COTACAO = Object.freeze([
  'em_andamento',
  'aguardando_aprovacao',
  'aprovada',
  'finalizada',
  'cancelada'
]);

const STATUS_VALIDOS = new Set(STATUS_COTACAO);

const LIMITES_COTACAO = Object.freeze({
  itens: 500,
  fornecedores: 100,
  precos: 50000,
  pagina: 100,
  dinheiroCentavos: Number.MAX_SAFE_INTEGER,
  quantidadeMillesimos: Number.MAX_SAFE_INTEGER
});

class CotacoesServiceError extends Error {
  constructor(status, codigo, message, detalhes) {
    super(message);
    this.name = 'CotacoesServiceError';
    this.status = status;
    this.codigo = codigo;
    if (detalhes !== undefined) this.detalhes = detalhes;
  }
}

function falhar(status, codigo, message, detalhes) {
  throw new CotacoesServiceError(status, codigo, message, detalhes);
}

function objetoPlano(valor, campo) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    falhar(400, 'DADOS_INVALIDOS', `${campo} deve ser um objeto.`, { campo });
  }
  return valor;
}

function possui(objeto, chave) {
  return Object.prototype.hasOwnProperty.call(objeto, chave);
}

function valorOuAnterior(objeto, chave, anterior, padrao) {
  if (possui(objeto, chave)) return objeto[chave];
  if (anterior !== undefined) return anterior;
  return padrao;
}

function limparTexto(valor) {
  return valor
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

function texto(valor, campo, limite, opcoes = {}) {
  const { obrigatorio = false, padrao = '' } = opcoes;
  if (valor === undefined || valor === null) {
    if (obrigatorio) {
      falhar(400, 'CAMPO_OBRIGATORIO', `${campo} é obrigatório.`, { campo });
    }
    return padrao;
  }
  if (typeof valor !== 'string') {
    falhar(400, 'TIPO_INVALIDO', `${campo} deve ser um texto.`, { campo });
  }
  const resultado = limparTexto(valor);
  if (obrigatorio && !resultado) {
    falhar(400, 'CAMPO_OBRIGATORIO', `${campo} é obrigatório.`, { campo });
  }
  if (resultado.length > limite) {
    falhar(400, 'LIMITE_EXCEDIDO', `${campo} deve ter no máximo ${limite} caracteres.`, {
      campo,
      limite
    });
  }
  return resultado;
}

function booleano(valor, campo, padrao) {
  if (valor === undefined || valor === null) return padrao;
  if (typeof valor !== 'boolean') {
    falhar(400, 'TIPO_INVALIDO', `${campo} deve ser verdadeiro ou falso.`, { campo });
  }
  return valor;
}

function inteiro(valor, campo, opcoes = {}) {
  const {
    minimo = 0,
    maximo = Number.MAX_SAFE_INTEGER,
    padrao,
    permitirNulo = false
  } = opcoes;

  if (valor === undefined || valor === null || valor === '') {
    if (permitirNulo) return null;
    if (padrao !== undefined) return padrao;
    falhar(400, 'CAMPO_OBRIGATORIO', `${campo} é obrigatório.`, { campo });
  }

  let normalizado = valor;
  if (typeof normalizado === 'string' && /^-?\d+$/.test(normalizado.trim())) {
    normalizado = Number(normalizado.trim());
  }

  if (!Number.isSafeInteger(normalizado) || normalizado < minimo || normalizado > maximo) {
    falhar(400, 'INTEIRO_INVALIDO', `${campo} deve ser um número inteiro entre ${minimo} e ${maximo}.`, {
      campo,
      minimo,
      maximo
    });
  }
  return normalizado;
}

function dataOpcional(valor, campo, limite = 40) {
  const resultado = texto(valor, campo, limite);
  if (!resultado) return '';
  const somenteData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(resultado);
  const dataSomenteValida = somenteData && (() => {
    const [, ano, mes, dia] = somenteData.map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  })();
  if ((!somenteData && Number.isNaN(Date.parse(resultado))) || (somenteData && !dataSomenteValida)) {
    falhar(400, 'DATA_INVALIDA', `${campo} contém uma data inválida.`, { campo });
  }
  return resultado;
}

function emailOpcional(valor, campo) {
  const resultado = texto(valor, campo, 254);
  if (resultado && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resultado)) {
    falhar(400, 'EMAIL_INVALIDO', `${campo} contém um e-mail inválido.`, { campo });
  }
  return resultado;
}

function normalizarChaveNome(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function atorDoUsuario(usuario) {
  return {
    usuario: limparTexto(String(usuario && usuario.usuario ? usuario.usuario : '')).slice(0, 100),
    nome: limparTexto(String(usuario && usuario.nome ? usuario.nome : '')).slice(0, 200)
  };
}

function normalizarIdEntrada(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return '';
  return texto(String(valor), campo, 128, { obrigatorio: true });
}

function normalizarStatus(valor, campo = 'status') {
  const resultado = texto(valor, campo, 40, { obrigatorio: true });
  if (!STATUS_VALIDOS.has(resultado)) {
    falhar(400, 'STATUS_INVALIDO', 'Status de cotação inválido.', {
      campo,
      statusValidos: STATUS_COTACAO
    });
  }
  return resultado;
}

function normalizarAprovacao(valor, anterior, ator) {
  const origem = valor === undefined ? (anterior || {}) : objetoPlano(valor, 'aprovacao');
  const base = anterior || {};
  return {
    elaboradoPor: texto(
      valorOuAnterior(origem, 'elaboradoPor', base.elaboradoPor, ator.nome || ator.usuario),
      'aprovacao.elaboradoPor',
      200
    ),
    conferidoPor: texto(
      valorOuAnterior(origem, 'conferidoPor', base.conferidoPor, ''),
      'aprovacao.conferidoPor',
      200
    ),
    aprovadoPor: texto(
      valorOuAnterior(origem, 'aprovadoPor', base.aprovadoPor, ''),
      'aprovacao.aprovadoPor',
      200
    ),
    data: dataOpcional(
      valorOuAnterior(origem, 'data', base.data, ''),
      'aprovacao.data'
    )
  };
}

function normalizarItens(brutos, existentes = []) {
  if (!Array.isArray(brutos)) {
    falhar(400, 'TIPO_INVALIDO', 'itens deve ser uma lista.', { campo: 'itens' });
  }
  if (brutos.length > LIMITES_COTACAO.itens) {
    falhar(400, 'LIMITE_EXCEDIDO', `A cotação aceita no máximo ${LIMITES_COTACAO.itens} itens.`, {
      campo: 'itens',
      limite: LIMITES_COTACAO.itens
    });
  }

  const existentesPorId = new Map(existentes.map(item => [item.id, item]));
  const idsRecebidos = new Set();
  const mapaIds = new Map();

  const itens = brutos.map((entrada, indice) => {
    objetoPlano(entrada, `itens[${indice}]`);
    const idRecebido = normalizarIdEntrada(entrada.id, `itens[${indice}].id`);
    if (idRecebido && idsRecebidos.has(idRecebido)) {
      falhar(400, 'ITEM_DUPLICADO', 'Há itens com o mesmo identificador.', {
        campo: `itens[${indice}].id`
      });
    }
    if (idRecebido) idsRecebidos.add(idRecebido);

    const anterior = idRecebido ? existentesPorId.get(idRecebido) : undefined;
    const id = anterior ? anterior.id : randomUUID();
    if (idRecebido) mapaIds.set(idRecebido, id);
    mapaIds.set(id, id);
    mapaIds.set(`#${indice}`, id);

    const quantidadeRecebida = possui(entrada, 'quantidadeMillesimos')
      ? entrada.quantidadeMillesimos
      : entrada.quantidadeMilesimos;
    const quantidadeAnterior = anterior && anterior.quantidadeMillesimos;
    const ativo = booleano(
      valorOuAnterior(entrada, 'ativo', anterior && anterior.ativo, true),
      `itens[${indice}].ativo`,
      true
    );
    const codigoRecebido = possui(entrada, 'codigo') ? entrada.codigo : entrada.codigoInterno;

    return {
      id,
      codigo: texto(
        codigoRecebido !== undefined ? codigoRecebido : (anterior && anterior.codigo),
        `itens[${indice}].codigo`,
        80
      ),
      descricao: texto(
        valorOuAnterior(entrada, 'descricao', anterior && anterior.descricao, ''),
        `itens[${indice}].descricao`,
        500,
        { obrigatorio: true }
      ),
      unidade: texto(
        valorOuAnterior(entrada, 'unidade', anterior && anterior.unidade, 'UN'),
        `itens[${indice}].unidade`,
        20,
        { obrigatorio: true }
      ).toLocaleUpperCase('pt-BR'),
      quantidadeMillesimos: inteiro(
        quantidadeRecebida !== undefined ? quantidadeRecebida : quantidadeAnterior,
        `itens[${indice}].quantidadeMillesimos`,
        { minimo: ativo ? 1 : 0, maximo: LIMITES_COTACAO.quantidadeMillesimos }
      ),
      observacao: texto(
        valorOuAnterior(entrada, 'observacao', anterior && anterior.observacao, ''),
        `itens[${indice}].observacao`,
        2000
      ),
      ordem: inteiro(
        valorOuAnterior(entrada, 'ordem', anterior && anterior.ordem, indice),
        `itens[${indice}].ordem`,
        { minimo: 0, maximo: 1000000 }
      ),
      ativo
    };
  });

  itens.sort((a, b) => a.ordem - b.ordem);
  return { itens, mapaIds };
}

function normalizarFornecedores(brutos, existentes = []) {
  if (!Array.isArray(brutos)) {
    falhar(400, 'TIPO_INVALIDO', 'fornecedores deve ser uma lista.', { campo: 'fornecedores' });
  }
  if (brutos.length > LIMITES_COTACAO.fornecedores) {
    falhar(400, 'LIMITE_EXCEDIDO', `A cotação aceita no máximo ${LIMITES_COTACAO.fornecedores} fornecedores.`, {
      campo: 'fornecedores',
      limite: LIMITES_COTACAO.fornecedores
    });
  }

  const existentesPorId = new Map(existentes.map(fornecedor => [fornecedor.id, fornecedor]));
  const idsRecebidos = new Set();
  const cnpjs = new Map();
  const nomes = new Map();
  const mapaIds = new Map();

  const fornecedores = brutos.map((entrada, indice) => {
    objetoPlano(entrada, `fornecedores[${indice}]`);
    const idRecebido = normalizarIdEntrada(entrada.id, `fornecedores[${indice}].id`);
    if (idRecebido && idsRecebidos.has(idRecebido)) {
      falhar(400, 'FORNECEDOR_DUPLICADO', 'Há fornecedores com o mesmo identificador.', {
        campo: `fornecedores[${indice}].id`
      });
    }
    if (idRecebido) idsRecebidos.add(idRecebido);

    const anterior = idRecebido ? existentesPorId.get(idRecebido) : undefined;
    const id = anterior ? anterior.id : randomUUID();
    if (idRecebido) mapaIds.set(idRecebido, id);
    mapaIds.set(id, id);
    mapaIds.set(`#${indice}`, id);

    const nomeInformado = texto(
      valorOuAnterior(entrada, 'nome', anterior && anterior.nome, ''),
      `fornecedores[${indice}].nome`,
      200
    );
    const nomeFantasia = texto(
      valorOuAnterior(entrada, 'nomeFantasia', anterior && anterior.nomeFantasia, ''),
      `fornecedores[${indice}].nomeFantasia`,
      200
    );
    const razaoSocial = texto(
      valorOuAnterior(entrada, 'razaoSocial', anterior && anterior.razaoSocial, ''),
      `fornecedores[${indice}].razaoSocial`,
      240
    );
    const cnpjRecebido = valorOuAnterior(entrada, 'cnpj', anterior && anterior.cnpj, '');
    const cnpjTexto = texto(cnpjRecebido === undefined ? '' : String(cnpjRecebido), `fornecedores[${indice}].cnpj`, 30);
    const cnpj = cnpjTexto ? normalizarCnpj(cnpjTexto) : '';

    if (!nomeInformado && !nomeFantasia && !razaoSocial && !cnpj) {
      falhar(400, 'FORNECEDOR_SEM_IDENTIFICACAO', 'O fornecedor precisa de nome, razão social, nome fantasia ou CNPJ.', {
        campo: `fornecedores[${indice}]`
      });
    }
    if (cnpj && !validarCnpj(cnpj)) {
      falhar(400, 'CNPJ_INVALIDO', 'O CNPJ informado é inválido.', {
        campo: `fornecedores[${indice}].cnpj`
      });
    }

    if (cnpj && cnpjs.has(cnpj)) {
      falhar(400, 'FORNECEDOR_DUPLICADO', 'Já existe um fornecedor com este CNPJ na cotação.', {
        campo: `fornecedores[${indice}].cnpj`,
        indiceAnterior: cnpjs.get(cnpj)
      });
    }
    if (cnpj) cnpjs.set(cnpj, indice);

    const chavesNome = [...new Set([nomeInformado, nomeFantasia, razaoSocial]
      .map(normalizarChaveNome)
      .filter(Boolean))];
    for (const chave of chavesNome) {
      if (nomes.has(chave)) {
        falhar(400, 'FORNECEDOR_DUPLICADO', 'Já existe um fornecedor com este nome na cotação.', {
          campo: `fornecedores[${indice}].nome`,
          indiceAnterior: nomes.get(chave)
        });
      }
    }
    for (const chave of chavesNome) nomes.set(chave, indice);

    const ativoRecebido = possui(entrada, 'ativoComparacao')
      ? entrada.ativoComparacao
      : entrada.participaComparacao;

    return {
      id,
      nome: nomeInformado || nomeFantasia || razaoSocial,
      nomeFantasia,
      razaoSocial,
      cnpj,
      contato: texto(
        valorOuAnterior(entrada, 'contato', anterior && anterior.contato, ''),
        `fornecedores[${indice}].contato`,
        200
      ),
      telefone: texto(
        valorOuAnterior(entrada, 'telefone', anterior && anterior.telefone, ''),
        `fornecedores[${indice}].telefone`,
        40
      ),
      email: emailOpcional(
        valorOuAnterior(entrada, 'email', anterior && anterior.email, ''),
        `fornecedores[${indice}].email`
      ),
      formaPagamento: texto(
        valorOuAnterior(entrada, 'formaPagamento', anterior && anterior.formaPagamento, ''),
        `fornecedores[${indice}].formaPagamento`,
        300
      ),
      prazoEntrega: texto(
        valorOuAnterior(entrada, 'prazoEntrega', anterior && anterior.prazoEntrega, ''),
        `fornecedores[${indice}].prazoEntrega`,
        200
      ),
      freteCentavos: inteiro(
        valorOuAnterior(entrada, 'freteCentavos', anterior && anterior.freteCentavos, 0),
        `fornecedores[${indice}].freteCentavos`,
        { minimo: 0, maximo: LIMITES_COTACAO.dinheiroCentavos }
      ),
      validadeProposta: dataOpcional(
        valorOuAnterior(entrada, 'validadeProposta', anterior && anterior.validadeProposta, ''),
        `fornecedores[${indice}].validadeProposta`
      ),
      observacoes: texto(
        valorOuAnterior(entrada, 'observacoes', anterior && anterior.observacoes, ''),
        `fornecedores[${indice}].observacoes`,
        3000
      ),
      ordem: inteiro(
        valorOuAnterior(entrada, 'ordem', anterior && anterior.ordem, indice),
        `fornecedores[${indice}].ordem`,
        { minimo: 0, maximo: 1000000 }
      ),
      ativoComparacao: booleano(
        ativoRecebido !== undefined ? ativoRecebido : (anterior && anterior.ativoComparacao),
        `fornecedores[${indice}].ativoComparacao`,
        true
      )
    };
  });

  fornecedores.sort((a, b) => a.ordem - b.ordem);
  return { fornecedores, mapaIds };
}

function resolverReferencia(entrada, chave, indice, mapa, tipo) {
  const aliasIndice = tipo === 'item' ? entrada.itemIndex : entrada.fornecedorIndex;
  const referencia = entrada[chave] !== undefined && entrada[chave] !== null
    ? String(entrada[chave])
    : (Number.isInteger(aliasIndice) ? `#${aliasIndice}` : '');
  const normalizada = normalizarIdEntrada(referencia, `precos[${indice}].${chave}`);
  const id = mapa.get(normalizada);
  if (!id) {
    falhar(400, 'REFERENCIA_INVALIDA', `precos[${indice}].${chave} não referencia um ${tipo} desta cotação.`, {
      campo: `precos[${indice}].${chave}`
    });
  }
  return id;
}

function normalizarPrecos(brutos, existentes, mapaItens, mapaFornecedores) {
  if (!Array.isArray(brutos)) {
    falhar(400, 'TIPO_INVALIDO', 'precos deve ser uma lista.', { campo: 'precos' });
  }
  if (brutos.length > LIMITES_COTACAO.precos) {
    falhar(400, 'LIMITE_EXCEDIDO', `A cotação aceita no máximo ${LIMITES_COTACAO.precos} preços.`, {
      campo: 'precos',
      limite: LIMITES_COTACAO.precos
    });
  }

  const existentesPorId = new Map(existentes.map(preco => [preco.id, preco]));
  const idsRecebidos = new Set();
  const pares = new Set();

  return brutos.map((entrada, indice) => {
    objetoPlano(entrada, `precos[${indice}]`);
    const idRecebido = normalizarIdEntrada(entrada.id, `precos[${indice}].id`);
    if (idRecebido && idsRecebidos.has(idRecebido)) {
      falhar(400, 'PRECO_DUPLICADO', 'Há preços com o mesmo identificador.', {
        campo: `precos[${indice}].id`
      });
    }
    if (idRecebido) idsRecebidos.add(idRecebido);
    const anterior = idRecebido ? existentesPorId.get(idRecebido) : undefined;

    const itemId = resolverReferencia(entrada, 'itemId', indice, mapaItens, 'item');
    const fornecedorId = resolverReferencia(entrada, 'fornecedorId', indice, mapaFornecedores, 'fornecedor');
    const par = `${itemId}\u0000${fornecedorId}`;
    if (pares.has(par)) {
      falhar(400, 'PRECO_DUPLICADO', 'Existe mais de um preço para o mesmo item e fornecedor.', {
        campo: `precos[${indice}]`
      });
    }
    pares.add(par);

    const valorRecebido = possui(entrada, 'valorUnitarioCentavos')
      ? entrada.valorUnitarioCentavos
      : entrada.precoUnitarioCentavos;

    return {
      id: anterior ? anterior.id : randomUUID(),
      itemId,
      fornecedorId,
      valorUnitarioCentavos: inteiro(
        valorRecebido !== undefined ? valorRecebido : (anterior && anterior.valorUnitarioCentavos),
        `precos[${indice}].valorUnitarioCentavos`,
        {
          minimo: 0,
          maximo: LIMITES_COTACAO.dinheiroCentavos,
          permitirNulo: true
        }
      ),
      observacao: texto(
        valorOuAnterior(entrada, 'observacao', anterior && anterior.observacao, ''),
        `precos[${indice}].observacao`,
        1000
      ),
      indisponivel: booleano(
        valorOuAnterior(entrada, 'indisponivel', anterior && anterior.indisponivel, false),
        `precos[${indice}].indisponivel`,
        false
      )
    };
  });
}

function normalizarConteudo(dados, anterior, ator) {
  objetoPlano(dados, 'cotacao');
  const itensBrutos = possui(dados, 'itens') ? dados.itens : (anterior ? anterior.itens : []);
  const fornecedoresBrutos = possui(dados, 'fornecedores')
    ? dados.fornecedores
    : (anterior ? anterior.fornecedores : []);
  const precosBrutos = possui(dados, 'precos') ? dados.precos : (anterior ? anterior.precos : []);

  const itensNormalizados = normalizarItens(itensBrutos, anterior ? anterior.itens : []);
  const fornecedoresNormalizados = normalizarFornecedores(
    fornecedoresBrutos,
    anterior ? anterior.fornecedores : []
  );
  const precos = normalizarPrecos(
    precosBrutos,
    anterior ? anterior.precos : [],
    itensNormalizados.mapaIds,
    fornecedoresNormalizados.mapaIds
  );

  const descricaoRecebida = possui(dados, 'descricaoCompra')
    ? dados.descricaoCompra
    : dados.descricao;

  return {
    departamento: texto(
      valorOuAnterior(dados, 'departamento', anterior && anterior.departamento, 'Logística'),
      'departamento',
      120
    ),
    centroCusto: texto(
      valorOuAnterior(dados, 'centroCusto', anterior && anterior.centroCusto, ''),
      'centroCusto',
      120
    ),
    descricaoCompra: texto(
      descricaoRecebida !== undefined ? descricaoRecebida : (anterior && anterior.descricaoCompra),
      'descricaoCompra',
      3000
    ),
    observacoesInternas: texto(
      valorOuAnterior(dados, 'observacoesInternas', anterior && anterior.observacoesInternas, ''),
      'observacoesInternas',
      10000
    ),
    aprovacao: normalizarAprovacao(dados.aprovacao, anterior && anterior.aprovacao, ator),
    itens: itensNormalizados.itens,
    fornecedores: fornecedoresNormalizados.fornecedores,
    precos
  };
}

function recalcular(conteudo) {
  let calculos;
  try {
    calculos = calcularCotacao({
      itens: conteudo.itens,
      fornecedores: conteudo.fornecedores,
      precos: conteudo.precos
    });
  } catch (error) {
    falhar(400, 'CALCULO_INVALIDO', `Não foi possível calcular a cotação: ${error.message}`);
  }
  if (!calculos || typeof calculos !== 'object' || Array.isArray(calculos)) {
    falhar(500, 'ERRO_DE_CALCULO', 'O cálculo financeiro retornou um resultado inválido.');
  }
  const itemComEstouro = Array.isArray(calculos.itens) && calculos.itens.some(item =>
    Array.isArray(item.precos) && item.precos.some(preco => preco.valido && preco.valorTotalCentavos === null)
  );
  const fornecedorComEstouro = Array.isArray(calculos.fornecedores) && calculos.fornecedores.some(fornecedor =>
    fornecedor.ativoComparacao && fornecedor.itensCotados > 0 &&
    (fornecedor.subtotalCentavos === null || fornecedor.totalCentavos === null)
  );
  if (itemComEstouro || fornecedorComEstouro) {
    falhar(400, 'VALOR_FORA_DO_LIMITE', 'Quantidade ou valor monetário excede o limite seguro para cálculo.');
  }
  return calculos;
}

// A matriz detalhada por item/fornecedor pode ter dezenas de milhares de
// células e já está representada de forma canônica em `precos`. Persistimos os
// totais e indicadores, mas descartamos essa duplicação; `obter` a reconstrói.
function compactarCalculos(calculos) {
  return {
    ...calculos,
    itens: Array.isArray(calculos.itens)
      ? calculos.itens.map(({ precos, ...item }) => item)
      : []
  };
}

function validarBanco(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    falhar(500, 'ARQUIVO_INVALIDO', 'O arquivo de cotações possui formato inválido.');
  }
  if (!data.sequencias || typeof data.sequencias !== 'object' || Array.isArray(data.sequencias)) {
    falhar(500, 'ARQUIVO_INVALIDO', 'O arquivo de cotações não possui sequências válidas.');
  }
  if (!Array.isArray(data.cotacoes)) {
    falhar(500, 'ARQUIVO_INVALIDO', 'O arquivo de cotações não possui uma lista válida.');
  }
  return data;
}

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function respostaComCalculosCompletos(cotacao) {
  const resposta = clonar(cotacao);
  resposta.calculos = recalcular(resposta);
  return resposta;
}

function extrairDadosEntrada(valor) {
  objetoPlano(valor, 'corpo');
  if (possui(valor, 'cotacao')) return objetoPlano(valor.cotacao, 'cotacao');
  return valor;
}

function problemasFinalizacao(cotacao) {
  const itensAtivos = cotacao.itens.filter(item => item.ativo !== false);
  const fornecedoresAtivos = cotacao.fornecedores.filter(fornecedor => fornecedor.ativoComparacao !== false);
  const precosValidos = cotacao.precos.filter(preco =>
    preco.indisponivel !== true &&
    Number.isSafeInteger(preco.valorUnitarioCentavos) &&
    preco.valorUnitarioCentavos > 0
  );
  const precosPorPar = new Set(precosValidos.map(preco => `${preco.itemId}\u0000${preco.fornecedorId}`));

  const itensSemPreco = itensAtivos
    .filter(item => !fornecedoresAtivos.some(fornecedor => precosPorPar.has(`${item.id}\u0000${fornecedor.id}`)))
    .map(item => ({ id: item.id, descricao: item.descricao }));

  const fornecedoresCompletos = fornecedoresAtivos
    .filter(fornecedor => itensAtivos.every(item => precosPorPar.has(`${item.id}\u0000${fornecedor.id}`)))
    .map(fornecedor => ({ id: fornecedor.id, nome: fornecedor.nome }));

  const problemas = [];
  if (!String(cotacao.descricaoCompra || '').trim()) problemas.push('Informe a descrição da compra.');
  if (!itensAtivos.length) problemas.push('Adicione pelo menos um item ativo.');
  if (!fornecedoresAtivos.length) problemas.push('Adicione pelo menos um fornecedor ativo na comparação.');
  if (itensSemPreco.length) problemas.push('Todos os itens ativos precisam de pelo menos um preço válido.');
  if (itensAtivos.length && fornecedoresAtivos.length && !fornecedoresCompletos.length) {
    problemas.push('Pelo menos um fornecedor precisa possuir preços válidos para todos os itens ativos.');
  }

  return { problemas, itensSemPreco, fornecedoresCompletos };
}

function dataFiltro(valor, campo, fimDoDia) {
  if (valor === undefined || valor === null || valor === '') return null;
  const textoData = texto(String(valor), campo, 10, { obrigatorio: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(textoData)) {
    falhar(400, 'DATA_INVALIDA', `${campo} deve usar o formato AAAA-MM-DD.`, { campo });
  }
  const [ano, mes, dia] = textoData.split('-').map(Number);
  const ultimoDiaDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDoMes) {
    falhar(400, 'DATA_INVALIDA', `${campo} contém uma data inválida.`, { campo });
  }
  // O sistema opera em São Paulo (UTC-3). Usar "Z" aqui deslocaria para o
  // dia seguinte as cotações criadas depois das 21h no horário local.
  const horario = fimDoDia ? '23:59:59.999' : '00:00:00.000';
  const data = new Date(`${textoData}T${horario}-03:00`);
  return data.getTime();
}

function resumoCotacao(cotacao) {
  const calculos = cotacao.calculos || {};
  const idsRecomendados = Array.isArray(calculos.fornecedorIdsRecomendados)
    ? calculos.fornecedorIdsRecomendados
    : [];
  const fornecedoresPorId = new Map(cotacao.fornecedores.map(fornecedor => [fornecedor.id, fornecedor]));
  const fornecedoresRecomendados = idsRecomendados
    .map(id => fornecedoresPorId.get(id))
    .filter(Boolean)
    .map(fornecedor => ({ id: fornecedor.id, nome: fornecedor.nome }));
  const contadores = calculos.contadores || {};

  return {
    id: cotacao.id,
    numero: cotacao.numero,
    status: cotacao.status,
    criadoEm: cotacao.criadoEm,
    atualizadoEm: cotacao.atualizadoEm,
    responsavel: cotacao.responsavel,
    departamento: cotacao.departamento,
    centroCusto: cotacao.centroCusto,
    descricaoCompra: cotacao.descricaoCompra,
    quantidadeItens: contadores.itens ?? cotacao.itens.filter(item => item.ativo !== false).length,
    quantidadeFornecedores: contadores.fornecedores ?? cotacao.fornecedores.length,
    fornecedoresRecomendados,
    fornecedorRecomendado: fornecedoresRecomendados.length
      ? fornecedoresRecomendados.map(fornecedor => fornecedor.nome).join(' / ')
      : null,
    custoIdealTotalCentavos: calculos.custoIdealTotalCentavos ?? null,
    totalRecomendadoCentavos: calculos.totalRecomendadoCentavos ?? null,
    descontoSugeridoCentavos: calculos.descontoSugeridoCentavos ?? null,
    percentualNegociacaoBasisPoints: calculos.percentualNegociacaoBasisPoints ?? null
  };
}

class CotacoesService {
  constructor(opcoes = {}) {
    this.arquivo = opcoes.arquivo || process.env.COTACOES_PATH || path.join(__dirname, '..', 'data', 'cotacoes.json');
    this.garantirArquivo();
  }

  garantirArquivo() {
    const diretorio = path.dirname(this.arquivo);
    fs.mkdirSync(diretorio, { recursive: true });
    if (!fs.existsSync(this.arquivo)) {
      this.salvarBanco({ sequencias: {}, cotacoes: [] });
    }
  }

  lerBanco() {
    try {
      const conteudo = fs.readFileSync(this.arquivo, 'utf8');
      return validarBanco(JSON.parse(conteudo));
    } catch (error) {
      if (error instanceof CotacoesServiceError) throw error;
      falhar(500, 'ERRO_DE_PERSISTENCIA', `Não foi possível ler as cotações: ${error.message}`);
    }
  }

  salvarBanco(banco) {
    validarBanco(banco);
    const temporario = `${this.arquivo}.${process.pid}.${randomUUID()}.tmp`;
    let descritor;
    try {
      descritor = fs.openSync(temporario, 'wx');
      fs.writeFileSync(descritor, JSON.stringify(banco, null, 2), 'utf8');
      fs.fsyncSync(descritor);
      fs.closeSync(descritor);
      descritor = undefined;
      fs.renameSync(temporario, this.arquivo);
    } catch (error) {
      if (descritor !== undefined) {
        try { fs.closeSync(descritor); } catch { /* noop */ }
      }
      try {
        if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
      } catch { /* noop */ }
      if (error instanceof CotacoesServiceError) throw error;
      falhar(500, 'ERRO_DE_PERSISTENCIA', `Não foi possível salvar as cotações: ${error.message}`);
    }
  }

  proximoNumero(banco, agora) {
    const ano = String(agora.getFullYear());
    const expressao = new RegExp(`^COT-${ano}-(\\d+)$`);
    let maiorExistente = 0;
    const numeros = new Set();
    for (const cotacao of banco.cotacoes) {
      numeros.add(cotacao.numero);
      const correspondencia = expressao.exec(cotacao.numero || '');
      if (correspondencia) maiorExistente = Math.max(maiorExistente, Number(correspondencia[1]));
    }
    let sequencia = Math.max(
      Number.isSafeInteger(banco.sequencias[ano]) ? banco.sequencias[ano] : 0,
      maiorExistente
    ) + 1;
    let numero = `COT-${ano}-${String(sequencia).padStart(4, '0')}`;
    while (numeros.has(numero)) {
      sequencia += 1;
      numero = `COT-${ano}-${String(sequencia).padStart(4, '0')}`;
    }
    banco.sequencias[ano] = sequencia;
    return numero;
  }

  encontrar(banco, id) {
    const idNormalizado = texto(String(id || ''), 'id', 128, { obrigatorio: true });
    const cotacao = banco.cotacoes.find(registro => registro.id === idNormalizado);
    if (!cotacao) {
      falhar(404, 'COTACAO_NAO_ENCONTRADA', 'Cotação não encontrada.');
    }
    return cotacao;
  }

  criar(entrada, usuario) {
    const dados = extrairDadosEntrada(entrada);
    if (possui(dados, 'status')) {
      const status = normalizarStatus(dados.status);
      if (status !== 'em_andamento') {
        falhar(400, 'STATUS_INICIAL_INVALIDO', 'Uma nova cotação deve iniciar com status em_andamento.');
      }
    }

    const banco = this.lerBanco();
    const agoraData = new Date();
    const agora = agoraData.toISOString();
    const ator = atorDoUsuario(usuario);
    const conteudo = normalizarConteudo(dados, null, ator);
    const calculos = recalcular(conteudo);
    const cotacao = {
      id: randomUUID(),
      numero: this.proximoNumero(banco, agoraData),
      status: 'em_andamento',
      criadoEm: agora,
      atualizadoEm: agora,
      responsavel: ator,
      criadoPor: ator.usuario,
      atualizadoPor: ator.usuario,
      ...conteudo,
      calculos: compactarCalculos(calculos)
    };

    banco.cotacoes.push(cotacao);
    this.salvarBanco(banco);
    const resposta = clonar(cotacao);
    resposta.calculos = calculos;
    return resposta;
  }

  obter(id) {
    const banco = this.lerBanco();
    return respostaComCalculosCompletos(this.encontrar(banco, id));
  }

  listar(consulta = {}) {
    const pagina = inteiro(consulta.pagina, 'pagina', { minimo: 1, maximo: 1000000, padrao: 1 });
    const limite = inteiro(consulta.limite, 'limite', {
      minimo: 1,
      maximo: LIMITES_COTACAO.pagina,
      padrao: 20
    });
    const busca = normalizarChaveNome(texto(String(consulta.busca || ''), 'busca', 200));
    const numero = normalizarChaveNome(texto(String(consulta.numero || ''), 'numero', 40));
    const responsavel = normalizarChaveNome(texto(String(consulta.responsavel || ''), 'responsavel', 200));
    const status = consulta.status ? normalizarStatus(String(consulta.status)) : '';
    const inicio = dataFiltro(consulta.dataInicio, 'dataInicio', false);
    const fim = dataFiltro(consulta.dataFim, 'dataFim', true);
    if (inicio !== null && fim !== null && inicio > fim) {
      falhar(400, 'INTERVALO_INVALIDO', 'dataInicio não pode ser posterior a dataFim.');
    }

    const camposOrdenacao = new Set([
      'numero',
      'criadoEm',
      'atualizadoEm',
      'status',
      'responsavel',
      'descricaoCompra',
      'custoIdealTotalCentavos',
      'totalRecomendadoCentavos'
    ]);
    const ordenarPor = texto(String(consulta.ordenarPor || 'atualizadoEm'), 'ordenarPor', 50, { obrigatorio: true });
    if (!camposOrdenacao.has(ordenarPor)) {
      falhar(400, 'ORDENACAO_INVALIDA', 'Campo de ordenação inválido.', {
        campo: 'ordenarPor',
        camposPermitidos: [...camposOrdenacao]
      });
    }
    const ordem = texto(String(consulta.ordem || 'desc'), 'ordem', 4, { obrigatorio: true }).toLowerCase();
    if (!['asc', 'desc'].includes(ordem)) {
      falhar(400, 'ORDENACAO_INVALIDA', 'ordem deve ser asc ou desc.', { campo: 'ordem' });
    }

    const banco = this.lerBanco();
    let registros = banco.cotacoes.map(resumoCotacao).filter(cotacao => {
      const responsavelTexto = normalizarChaveNome(
        `${cotacao.responsavel && cotacao.responsavel.nome || ''} ${cotacao.responsavel && cotacao.responsavel.usuario || ''}`
      );
      const pesquisavel = normalizarChaveNome([
        cotacao.numero,
        cotacao.descricaoCompra,
        cotacao.departamento,
        cotacao.centroCusto,
        responsavelTexto,
        cotacao.fornecedorRecomendado
      ].filter(Boolean).join(' '));
      const criadoEm = Date.parse(cotacao.criadoEm);
      return (!busca || pesquisavel.includes(busca)) &&
        (!numero || normalizarChaveNome(cotacao.numero).includes(numero)) &&
        (!responsavel || responsavelTexto.includes(responsavel)) &&
        (!status || cotacao.status === status) &&
        (inicio === null || criadoEm >= inicio) &&
        (fim === null || criadoEm <= fim);
    });

    const valorOrdenacao = cotacao => {
      if (ordenarPor === 'responsavel') {
        return normalizarChaveNome(cotacao.responsavel && (cotacao.responsavel.nome || cotacao.responsavel.usuario));
      }
      return cotacao[ordenarPor];
    };
    registros.sort((a, b) => {
      const valorA = valorOrdenacao(a);
      const valorB = valorOrdenacao(b);
      if (valorA === valorB) return String(a.id).localeCompare(String(b.id));
      if (valorA === null || valorA === undefined) return 1;
      if (valorB === null || valorB === undefined) return -1;
      const comparacao = typeof valorA === 'number' && typeof valorB === 'number'
        ? valorA - valorB
        : String(valorA).localeCompare(String(valorB), 'pt-BR', { numeric: true });
      return ordem === 'asc' ? comparacao : -comparacao;
    });

    const total = registros.length;
    const inicioPagina = (pagina - 1) * limite;
    registros = registros.slice(inicioPagina, inicioPagina + limite);
    return {
      cotacoes: registros,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite)
      }
    };
  }

  atualizar(id, entrada, usuario) {
    const dados = extrairDadosEntrada(entrada);
    const banco = this.lerBanco();
    const cotacao = this.encontrar(banco, id);
    if (cotacao.status !== 'em_andamento') {
      falhar(409, 'COTACAO_SOMENTE_LEITURA', 'Somente cotações em andamento podem ser editadas.');
    }
    if (possui(dados, 'status')) {
      const status = normalizarStatus(dados.status);
      if (status !== cotacao.status) {
        falhar(400, 'TRANSICAO_DE_STATUS_INVALIDA', 'Use a ação específica para alterar o status da cotação.');
      }
    }

    const ator = atorDoUsuario(usuario);
    const conteudo = normalizarConteudo(dados, cotacao, ator);
    const calculos = recalcular(conteudo);
    const atualizado = {
      ...cotacao,
      ...conteudo,
      id: cotacao.id,
      numero: cotacao.numero,
      status: cotacao.status,
      criadoEm: cotacao.criadoEm,
      criadoPor: cotacao.criadoPor,
      responsavel: cotacao.responsavel,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: ator.usuario,
      calculos: compactarCalculos(calculos)
    };
    const indice = banco.cotacoes.findIndex(registro => registro.id === cotacao.id);
    banco.cotacoes[indice] = atualizado;
    this.salvarBanco(banco);
    const resposta = clonar(atualizado);
    resposta.calculos = calculos;
    return resposta;
  }

  duplicar(id, usuario) {
    const banco = this.lerBanco();
    const original = this.encontrar(banco, id);
    const agoraData = new Date();
    const agora = agoraData.toISOString();
    const ator = atorDoUsuario(usuario);
    const mapaItens = new Map();
    const mapaFornecedores = new Map();
    const itens = original.itens.map(item => {
      const novoId = randomUUID();
      mapaItens.set(item.id, novoId);
      return { ...item, id: novoId };
    });
    const fornecedores = original.fornecedores.map(fornecedor => {
      const novoId = randomUUID();
      mapaFornecedores.set(fornecedor.id, novoId);
      return { ...fornecedor, id: novoId };
    });
    const precos = original.precos.map(preco => ({
      ...preco,
      id: randomUUID(),
      itemId: mapaItens.get(preco.itemId),
      fornecedorId: mapaFornecedores.get(preco.fornecedorId)
    }));
    const conteudo = {
      departamento: original.departamento,
      centroCusto: original.centroCusto,
      descricaoCompra: original.descricaoCompra,
      observacoesInternas: original.observacoesInternas,
      aprovacao: {
        elaboradoPor: ator.nome || ator.usuario,
        conferidoPor: '',
        aprovadoPor: '',
        data: ''
      },
      itens,
      fornecedores,
      precos
    };
    const calculos = recalcular(conteudo);
    const duplicada = {
      id: randomUUID(),
      numero: this.proximoNumero(banco, agoraData),
      status: 'em_andamento',
      criadoEm: agora,
      atualizadoEm: agora,
      responsavel: ator,
      criadoPor: ator.usuario,
      atualizadoPor: ator.usuario,
      origemDuplicacaoId: original.id,
      origemDuplicacaoNumero: original.numero,
      ...conteudo,
      calculos: compactarCalculos(calculos)
    };
    banco.cotacoes.push(duplicada);
    this.salvarBanco(banco);
    const resposta = clonar(duplicada);
    resposta.calculos = calculos;
    return resposta;
  }

  finalizar(id, usuario) {
    const banco = this.lerBanco();
    const cotacao = this.encontrar(banco, id);
    if (cotacao.status !== 'em_andamento') {
      falhar(409, 'FINALIZACAO_NAO_PERMITIDA', 'Somente cotações em andamento podem ser finalizadas.');
    }

    const calculos = recalcular(cotacao);
    cotacao.calculos = compactarCalculos(calculos);
    const validacao = problemasFinalizacao(cotacao);
    if (validacao.problemas.length) {
      falhar(422, 'COTACAO_INCOMPLETA', 'A cotação não atende aos requisitos para finalização.', validacao);
    }

    const ator = atorDoUsuario(usuario);
    const agora = new Date().toISOString();
    cotacao.status = 'finalizada';
    cotacao.finalizadaEm = agora;
    cotacao.finalizadaPor = ator.usuario;
    cotacao.atualizadoEm = agora;
    cotacao.atualizadoPor = ator.usuario;
    this.salvarBanco(banco);
    const resposta = clonar(cotacao);
    resposta.calculos = calculos;
    return resposta;
  }

  cancelar(id, entrada, usuario) {
    const dados = entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {};
    const banco = this.lerBanco();
    const cotacao = this.encontrar(banco, id);
    if (cotacao.status === 'cancelada') {
      falhar(409, 'COTACAO_JA_CANCELADA', 'A cotação já está cancelada.');
    }
    if (cotacao.status === 'finalizada') {
      falhar(409, 'COTACAO_SOMENTE_LEITURA', 'Uma cotação finalizada não pode ser cancelada.');
    }

    const ator = atorDoUsuario(usuario);
    const agora = new Date().toISOString();
    const statusAnterior = cotacao.status;
    cotacao.status = 'cancelada';
    cotacao.canceladaEm = agora;
    cotacao.canceladaPor = ator.usuario;
    cotacao.cancelamento = {
      statusAnterior,
      motivo: texto(dados.motivo, 'motivo', 2000),
      por: ator.usuario,
      em: agora
    };
    cotacao.atualizadoEm = agora;
    cotacao.atualizadoPor = ator.usuario;
    this.salvarBanco(banco);
    return respostaComCalculosCompletos(cotacao);
  }

  excluir(id) {
    const banco = this.lerBanco();
    const idNormalizado = texto(String(id || ''), 'id', 128, { obrigatorio: true });
    const indice = banco.cotacoes.findIndex(registro => registro.id === idNormalizado);
    if (indice === -1) {
      falhar(404, 'COTACAO_NAO_ENCONTRADA', 'Cotação não encontrada.');
    }
    if (banco.cotacoes[indice].status !== 'em_andamento') {
      falhar(409, 'EXCLUSAO_NAO_PERMITIDA', 'Somente cotações em andamento podem ser excluídas.');
    }
    banco.cotacoes.splice(indice, 1);
    this.salvarBanco(banco);
  }
}

function criarCotacoesService(opcoes) {
  return new CotacoesService(opcoes);
}

module.exports = {
  CotacoesService,
  CotacoesServiceError,
  LIMITES_COTACAO,
  STATUS_COTACAO,
  criarCotacoesService
};
