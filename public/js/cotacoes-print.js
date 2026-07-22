(function cotacoesPrintUmd(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cotacoes-financeiro.js'));
  } else {
    root.CotacoesPrintView = factory(root.CotacoesFinanceiro);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function criarCotacoesPrintView(CotacoesFinanceiro) {
  'use strict';

  if (!CotacoesFinanceiro || typeof CotacoesFinanceiro.calcularCotacao !== 'function') {
    throw new Error('CotacoesPrintView requer CotacoesFinanceiro.');
  }

  var STATUS_LABELS = {
    em_andamento: 'Em andamento',
    aguardando_aprovacao: 'Aguardando aprovação',
    aprovada: 'Aprovada',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada'
  };

  function escapar(valor) {
    return String(valor === undefined || valor === null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function texto(valor, fallback) {
    var normalizado = String(valor === undefined || valor === null ? '' : valor).trim();
    return escapar(normalizado || fallback || '—');
  }

  function dinheiro(centavos) {
    return centavos === null || centavos === undefined
      ? '—'
      : escapar(CotacoesFinanceiro.formatarCentavos(centavos));
  }

  function quantidade(millesimos) {
    return millesimos === null || millesimos === undefined
      ? '—'
      : escapar(CotacoesFinanceiro.formatarQuantidade(millesimos));
  }

  function dataPt(valor, incluirHora) {
    if (!valor) return '—';
    var somenteData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
    if (somenteData) return somenteData[3] + '/' + somenteData[2] + '/' + somenteData[1];
    var data = new Date(valor);
    if (Number.isNaN(data.getTime())) return texto(valor);
    var opcoes = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (incluirHora) {
      opcoes.hour = '2-digit';
      opcoes.minute = '2-digit';
    }
    return escapar(new Intl.DateTimeFormat('pt-BR', opcoes).format(data));
  }

  function formatarCnpj(valor) {
    var digitos = String(valor || '').replace(/\D/g, '');
    if (digitos.length !== 14) return texto(valor);
    return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  function obterId(entidade) {
    return String(entidade && (entidade.id || entidade._id || entidade.itemId || entidade.fornecedorId) || '');
  }

  function obterNomeFornecedor(fornecedor) {
    return fornecedor.nome || fornecedor.nomeFantasia || fornecedor.razaoSocial || 'Fornecedor sem identificação';
  }

  function dividirEmBlocos(lista, tamanho) {
    var blocos = [];
    for (var indice = 0; indice < lista.length; indice += tamanho) {
      blocos.push(lista.slice(indice, indice + tamanho));
    }
    return blocos.length ? blocos : [[]];
  }

  function mapaPorId(lista, campo) {
    var mapa = new Map();
    (lista || []).forEach(function adicionar(item) {
      mapa.set(String(item[campo] || item.id || ''), item);
    });
    return mapa;
  }

  function normalizarOpcoes(cotacao, opcoes, calculos) {
    var entrada = opcoes || {};
    var idsSelecionados = Array.isArray(entrada.fornecedorIds)
      ? new Set(entrada.fornecedorIds.map(String))
      : null;
    var calculosFornecedor = mapaPorId(calculos.fornecedores, 'fornecedorId');
    var fornecedores = (cotacao.fornecedores || []).filter(function filtrar(fornecedor) {
      var id = obterId(fornecedor);
      if (idsSelecionados && !idsSelecionados.has(id)) return false;
      if (entrada.incluirFornecedoresIncompletos === false) {
        var calculo = calculosFornecedor.get(id);
        return Boolean(calculo && calculo.completo);
      }
      return true;
    });

    return {
      fornecedores: fornecedores,
      incluirObservacoes: entrada.incluirObservacoes !== false,
      incluirAssinaturas: entrada.incluirAssinaturas !== false,
      logoUrl: entrada.logoUrl || 'fotos/logo.jpg',
      nomeEmpresa: entrada.nomeEmpresa || 'Razor Indústria',
      razaoSocialEmpresa: entrada.razaoSocialEmpresa || '',
      emitidoEm: entrada.emitidoEm || new Date().toISOString()
    };
  }

  function renderizarCabecalho(cotacao, opcoes, indiceBloco, totalBlocos) {
    var numero = cotacao.numero || cotacao.numeroCotacao || 'Rascunho';
    var responsavel = cotacao.responsavelNome || cotacao.criadoPorNome || cotacao.responsavel || '—';
    if (responsavel && typeof responsavel === 'object') responsavel = responsavel.nome || responsavel.usuario || '—';
    var criadoEm = cotacao.criadoEm || cotacao.dataCriacao || cotacao.createdAt;
    var status = STATUS_LABELS[cotacao.status] || cotacao.status || 'Em andamento';

    return '<header class="cot-print-header">' +
      '<img class="cot-print-logo" src="' + escapar(opcoes.logoUrl) + '" alt="Logotipo ' + escapar(opcoes.nomeEmpresa) + '">' +
      '<div class="cot-print-company"><h1>Cotação de Preços</h1><p>' + texto(opcoes.nomeEmpresa) +
        (opcoes.razaoSocialEmpresa ? ' · ' + texto(opcoes.razaoSocialEmpresa) : '') + '</p></div>' +
      '<div class="cot-print-meta"><strong>' + texto(numero) + '</strong><span>Emissão: ' + dataPt(opcoes.emitidoEm, false) + '</span></div>' +
    '</header>' +
    '<div class="cot-print-context">' +
      '<div><small>Data de criação</small><span>' + dataPt(criadoEm, false) + '</span></div>' +
      '<div><small>Responsável</small><span>' + texto(responsavel) + '</span></div>' +
      '<div><small>Departamento</small><span>' + texto(cotacao.departamento) + '</span></div>' +
      '<div><small>Centro de custo</small><span>' + texto(cotacao.centroCusto) + '</span></div>' +
      '<div><small>Status</small><span>' + texto(status) + '</span></div>' +
    '</div>' +
    '<p class="cot-print-block-label">Bloco ' + (indiceBloco + 1) + ' de ' + totalBlocos + '</p>';
  }

  function renderizarFornecedores(fornecedores, calculosFornecedor) {
    var colunas = Math.max(1, fornecedores.length);
    return '<section class="cot-print-suppliers" style="grid-template-columns:repeat(' + colunas + ',minmax(0,1fr))">' +
      fornecedores.map(function renderizarFornecedor(fornecedor) {
        var id = obterId(fornecedor);
        var calculo = calculosFornecedor.get(id) || {};
        var recomendado = calculo.recomendado === true;
        return '<article class="cot-print-supplier' + (recomendado ? ' recommended' : '') + '">' +
          '<h3>' + texto(obterNomeFornecedor(fornecedor)) + (recomendado ? ' · RECOMENDADO' : '') + '</h3>' +
          '<dl>' +
            '<dt>Razão social</dt><dd>' + texto(fornecedor.razaoSocial) + '</dd>' +
            '<dt>CNPJ</dt><dd>' + formatarCnpj(fornecedor.cnpj) + '</dd>' +
            '<dt>Pagamento</dt><dd>' + texto(fornecedor.formaPagamento) + '</dd>' +
            '<dt>Prazo</dt><dd>' + texto(fornecedor.prazoEntrega) + '</dd>' +
            '<dt>Frete</dt><dd>' + dinheiro(fornecedor.freteCentavos || 0) + '</dd>' +
            '<dt>Validade</dt><dd>' + dataPt(fornecedor.validadeProposta, false) + '</dd>' +
          '</dl>' +
        '</article>';
      }).join('') +
    '</section>';
  }

  function renderizarTabela(cotacao, fornecedores, calculos, opcoes) {
    var calculosItens = mapaPorId(calculos.itens, 'itemId');
    var calculosFornecedores = mapaPorId(calculos.fornecedores, 'fornecedorId');
    var precos = new Map();
    (cotacao.precos || []).forEach(function indexarPreco(preco) {
      precos.set(String(preco.itemId) + '::' + String(preco.fornecedorId), preco);
    });

    var cabecalhoFornecedor = fornecedores.map(function cabecalho(fornecedor) {
      return '<th colspan="2">' + texto(obterNomeFornecedor(fornecedor)) + '</th>';
    }).join('');
    var subcabecalhoFornecedor = fornecedores.map(function subcabecalho() {
      return '<th>Unitário</th><th>Total</th>';
    }).join('');

    var linhas = (cotacao.itens || []).filter(function apenasAtivos(item) {
      return item.ativo !== false;
    }).map(function renderizarItem(item, indice) {
      var itemId = obterId(item);
      var calculoItem = calculosItens.get(itemId) || {};
      var calculosPreco = mapaPorId(calculoItem.precos, 'fornecedorId');
      var colunas = fornecedores.map(function renderizarPreco(fornecedor) {
        var fornecedorId = obterId(fornecedor);
        var precoOriginal = precos.get(itemId + '::' + fornecedorId) || {};
        var precoCalculado = calculosPreco.get(fornecedorId) || {};
        var indisponivel = precoOriginal.indisponivel === true;
        if (indisponivel || !precoCalculado.valido) {
          return '<td class="unavailable" colspan="2">' + (indisponivel ? 'Indisponível' : '—') + '</td>';
        }
        var classeMenor = precoCalculado.menorPreco ? ' best-price' : '';
        return '<td class="money' + classeMenor + '">' + dinheiro(precoCalculado.valorUnitarioCentavos) + '</td>' +
          '<td class="money">' + dinheiro(precoCalculado.valorTotalCentavos) + '</td>';
      }).join('');

      var observacaoItem = opcoes.incluirObservacoes && item.observacao
        ? '<br><small>Obs. ' + texto(item.observacao) + '</small>'
        : '';

      return '<tr>' +
        '<td class="item-number">' + (indice + 1) + '</td>' +
        '<td class="item-description">' + texto(item.descricao) + (item.codigo ? '<br><small>Cód. ' + texto(item.codigo) + '</small>' : '') + observacaoItem + '</td>' +
        '<td class="item-unit">' + texto(item.unidade, 'UN') + '</td>' +
        '<td class="item-quantity">' + quantidade(item.quantidadeMillesimos) + '</td>' +
        colunas +
        '<td class="money ideal">' + dinheiro(calculoItem.custoIdealUnitarioCentavos) + '</td>' +
        '<td class="money ideal">' + dinheiro(calculoItem.custoIdealTotalCentavos) + '</td>' +
      '</tr>';
    }).join('');

    function linhaTotal(rotulo, propriedade) {
      return '<tr><th colspan="4">' + rotulo + '</th>' + fornecedores.map(function totalFornecedor(fornecedor) {
        var calculo = calculosFornecedores.get(obterId(fornecedor)) || {};
        return '<td colspan="2">' + dinheiro(calculo[propriedade]) + '</td>';
      }).join('') + '<td colspan="2" class="ideal">' + (propriedade === 'totalCentavos' ? dinheiro(calculos.custoIdealTotalCentavos) : '—') + '</td></tr>';
    }

    var completude = '<tr><th colspan="4">Cobertura da proposta</th>' + fornecedores.map(function fornecedorCompleto(fornecedor) {
      var calculo = calculosFornecedores.get(obterId(fornecedor)) || {};
      var classe = calculo.completo ? 'cot-print-complete' : 'cot-print-incomplete';
      var label = calculo.completo ? '✓ Completa' : '⚠ Incompleta · faltam ' + (calculo.itensFaltantes || 0);
      return '<td colspan="2" class="' + classe + '">' + label + '</td>';
    }).join('') + '<td colspan="2" class="ideal">Custo ideal</td></tr>';

    return '<table class="cot-print-table">' +
      '<thead><tr><th rowspan="2" class="item-number">#</th><th rowspan="2" class="item-description">Descrição</th><th rowspan="2" class="item-unit">Un.</th><th rowspan="2" class="item-quantity">Qtd.</th>' + cabecalhoFornecedor + '<th colspan="2">Custo ideal</th></tr>' +
      '<tr>' + subcabecalhoFornecedor + '<th>Unitário</th><th>Total</th></tr></thead>' +
      '<tbody>' + (linhas || '<tr><td colspan="99">Nenhum item cadastrado.</td></tr>') + '</tbody>' +
      '<tfoot>' + linhaTotal('Subtotal dos produtos', 'subtotalCentavos') + linhaTotal('Frete', 'freteCentavos') + linhaTotal('Total geral', 'totalCentavos') + completude + '</tfoot>' +
    '</table>';
  }

  function renderizarResumo(cotacao, calculos, opcoes, indiceBloco, totalBlocos) {
    var fornecedoresPorId = mapaPorId(cotacao.fornecedores, 'id');
    var recomendados = (calculos.fornecedorIdsRecomendados || []).map(function nome(id) {
      var fornecedor = fornecedoresPorId.get(String(id));
      return fornecedor ? obterNomeFornecedor(fornecedor) : id;
    });
    var percentual = calculos.percentualNegociacaoBasisPoints === null || calculos.percentualNegociacaoBasisPoints === undefined
      ? '—'
      : (calculos.percentualNegociacaoBasisPoints / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    var aprovacao = cotacao.aprovacao || {};

    var html = '<section class="cot-print-summary">' +
      '<div><small>Custo ideal total</small><strong>' + dinheiro(calculos.custoIdealTotalCentavos) + '</strong></div>' +
      '<div><small>Fornecedor recomendado</small><strong>' + texto(recomendados.join(' / '), 'Nenhum fornecedor completo') + '</strong></div>' +
      '<div><small>Total recomendado</small><strong>' + dinheiro(calculos.totalRecomendadoCentavos) + '</strong></div>' +
      '<div><small>Margem de negociação</small><strong>' + dinheiro(calculos.descontoSugeridoCentavos) + ' · ' + escapar(percentual) + '</strong></div>' +
    '</section>';

    html += '<section class="cot-print-description"><h3>Resumo da compra</h3><p>' +
      texto(cotacao.descricaoCompra, 'Sem descrição informada.') + '</p>';
    if (opcoes.incluirObservacoes && cotacao.observacoesInternas) {
      html += '<h3 style="margin-top:5px">Observações</h3><p>' +
        texto(cotacao.observacoesInternas) + '</p>';
    }
    html += '</section>';
    if (opcoes.incluirAssinaturas) {
      var dataAprovacao = aprovacao.data ? dataPt(aprovacao.data, false) : '____/____/________';
      html += '<section class="cot-print-signatures">' +
        '<div class="cot-print-signature">Elaborado por<br>' + texto(aprovacao.elaboradoPor || cotacao.responsavelNome, 'Nome / assinatura') + '<br><small>Data: ' + dataAprovacao + '</small></div>' +
        '<div class="cot-print-signature">Conferido por<br>' + texto(aprovacao.conferidoPor, 'Nome / assinatura') + '<br><small>Data: ' + dataAprovacao + '</small></div>' +
        '<div class="cot-print-signature">Aprovado por<br>' + texto(aprovacao.aprovadoPor, 'Nome / assinatura') + '<br><small>Data: ' + dataAprovacao + '</small></div>' +
      '</section>';
    }
    html += '<footer class="cot-print-footer"><span>Documento gerado pelo módulo Cotação de Preços</span><span>Bloco ' + (indiceBloco + 1) + '/' + totalBlocos + ' · ' + texto(cotacao.numero || 'Rascunho') + '</span></footer>';
    return html;
  }

  function renderizar(cotacaoEntrada, opcoesEntrada) {
    var cotacao = cotacaoEntrada || {};
    var calculosGlobais = CotacoesFinanceiro.calcularCotacao(cotacao);
    var opcoes = normalizarOpcoes(cotacao, opcoesEntrada, calculosGlobais);
    var idsImpressos = new Set(opcoes.fornecedores.map(function mapearId(fornecedor) {
      return obterId(fornecedor);
    }));
    var cotacaoImpressa = Object.assign({}, cotacao, {
      fornecedores: opcoes.fornecedores,
      precos: (cotacao.precos || []).filter(function filtrarPreco(preco) {
        return idsImpressos.has(String(preco.fornecedorId));
      })
    });
    var calculos = CotacoesFinanceiro.calcularCotacao(cotacaoImpressa);
    var recomendados = new Set((calculos.fornecedorIdsRecomendados || []).map(String));
    (calculos.fornecedores || []).forEach(function marcarRecomendado(fornecedor) {
      fornecedor.recomendado = recomendados.has(String(fornecedor.fornecedorId));
    });
    var blocos = dividirEmBlocos(opcoes.fornecedores, 3);
    var calculosFornecedor = mapaPorId(calculos.fornecedores, 'fornecedorId');

    return blocos.map(function renderizarBloco(fornecedores, indice) {
      return '<article class="cot-print-sheet" data-print-block="' + (indice + 1) + '">' +
        renderizarCabecalho(cotacao, opcoes, indice, blocos.length) +
        renderizarFornecedores(fornecedores, calculosFornecedor) +
        renderizarTabela(cotacao, fornecedores, calculos, opcoes) +
        renderizarResumo(cotacao, calculos, opcoes, indice, blocos.length) +
      '</article>';
    }).join('');
  }

  return Object.freeze({
    renderizar: renderizar,
    gerarHTML: renderizar,
    dividirFornecedoresEmBlocos: function dividir(lista) { return dividirEmBlocos(lista || [], 3); }
  });
}));
