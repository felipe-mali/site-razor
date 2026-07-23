(function carregarCotacoesPrint(root, factory) {
  'use strict';

  var financeiro = typeof module === 'object' && module.exports
    ? require('./cotacoes-financeiro')
    : root && root.CotacoesFinanceiro;
  var api = factory(financeiro);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CotacoesPrintView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function criarCotacoesPrintView(Financeiro) {
  'use strict';

  if (!Financeiro) throw new Error('CotacoesFinanceiro é obrigatório para a impressão.');

  function escapar(valor) {
    return String(valor === undefined || valor === null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function dividirEmBlocos(lista, tamanho) {
    var limite = Number.isInteger(tamanho) && tamanho > 0 ? tamanho : 3;
    var blocos = [];
    for (var indice = 0; indice < lista.length; indice += limite) {
      blocos.push(lista.slice(indice, indice + limite));
    }
    return blocos.length ? blocos : [[]];
  }

  function comoData(valor) {
    if (!valor) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) {
      var partes = String(valor).split('-');
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }
    var data = new Date(valor);
    if (Number.isNaN(data.getTime())) return null;
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(data);
  }

  function numeroTemporario(valorData) {
    var data = valorData instanceof Date ? valorData : new Date(valorData || Date.now());
    if (Number.isNaN(data.getTime())) data = new Date();
    var partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(data).reduce(function (acumulado, parte) {
      acumulado[parte.type] = parte.value;
      return acumulado;
    }, {});
    return partes.day + partes.month + partes.year + '-' + partes.hour + partes.minute;
  }

  function produtoCalculado(calculos, produtoId) {
    return calculos.produtos.find(function (produto) { return produto.produtoId === produtoId; });
  }

  function fornecedorCalculado(calculos, fornecedorId) {
    return calculos.fornecedores.find(function (fornecedor) { return fornecedor.fornecedorId === fornecedorId; });
  }

  function cabecalho(numero, data, bloco, indice, totalBlocos) {
    return '' +
      '<header class="cot-print-header">' +
        '<div><h1>Cotação de Preços</h1><p>Comparativo temporário de valores por produto e fornecedor</p></div>' +
        '<div class="cot-print-meta">' +
          '<span>Cotação<strong>' + escapar(numero) + '</strong></span>' +
          '<span>Data<strong>' + escapar(data) + '</strong></span>' +
        '</div>' +
      '</header>' +
      '<p class="cot-print-block-label">Bloco ' + (indice + 1) + ' de ' + totalBlocos +
        (bloco.length ? ' · ' + escapar(bloco.map(function (fornecedor) { return fornecedor.nome; }).join(' · ')) : '') +
      '</p>';
  }

  function tabela(estado, calculos, bloco) {
    var grupos = bloco.map(function (fornecedor) {
      var prazo = String(fornecedor.prazoEntrega || '').trim();
      return '<th colspan="2" scope="colgroup">' + escapar(fornecedor.nome) +
        '<small class="cot-print-delivery-term">' +
          escapar(prazo ? 'Prazo de entrega: ' + prazo : 'Prazo de entrega: Não informado') +
        '</small></th>';
    }).join('');
    var subgrupos = bloco.map(function () {
      return '<th scope="col">Valor unit.</th><th scope="col">Valor total</th>';
    }).join('');
    var linhas = estado.produtos.map(function (produto, indice) {
      var calculado = produtoCalculado(calculos, produto.id);
      var precos = bloco.map(function (fornecedor) {
        var preco = calculado.porFornecedor[fornecedor.id];
        return '' +
          '<td class="cot-print-money" data-best="' + String(Boolean(preco.menorPreco)) + '"' +
            (preco.menorPreco ? ' title="Menor preço deste produto"' : '') + '>' +
            Financeiro.formatarMoeda(preco.valorUnitarioCentavos, '') +
            (preco.menorPreco ? '<span class="sr-only"> Menor preço deste produto</span>' : '') +
          '</td>' +
          '<td class="cot-print-money">' + Financeiro.formatarMoeda(preco.valorTotalCentavos, '') + '</td>';
      }).join('');
      return '' +
        '<tr>' +
          '<th class="cot-print-number" scope="row">' + (indice + 1) + '</th>' +
          '<td class="cot-print-product">' + escapar(produto.descricao || 'Produto sem descrição') + '</td>' +
          '<td class="cot-print-quantity">' + Financeiro.formatarQuantidade(produto.quantidadeMillesimos, '') + '</td>' +
          precos +
          '<td class="cot-print-money cot-print-ideal">' + Financeiro.formatarMoeda(calculado.menorValorUnitarioCentavos, '') + '</td>' +
          '<td class="cot-print-money cot-print-ideal">' + Financeiro.formatarMoeda(calculado.custoIdealTotalCentavos, '') + '</td>' +
        '</tr>';
    }).join('');
    var totais = bloco.map(function (fornecedor) {
      var calculado = fornecedorCalculado(calculos, fornecedor.id);
      return '<td colspan="2" class="cot-print-money">' +
        Financeiro.formatarMoeda(calculado.totalCentavos, 'R$ 0,00') + '<br>' +
        '<span class="' + (calculado.completo ? 'cot-print-complete' : 'cot-print-incomplete') + '">' +
          (calculado.completo ? 'Cotação completa' : 'Cotação incompleta: ' + calculado.faltantes + ' pendente(s)') +
        '</span></td>';
    }).join('');
    var totalColunasRestantes = bloco.length * 2 + 2;

    return '' +
      '<table class="cot-print-table">' +
        '<thead>' +
          '<tr><th class="cot-print-number" rowspan="2" scope="col">Nº</th>' +
            '<th class="cot-print-product" rowspan="2" scope="col">Produto</th>' +
            '<th class="cot-print-quantity" rowspan="2" scope="col">Quantidade</th>' +
            grupos + '<th class="cot-print-ideal" colspan="2" scope="colgroup">Custo ideal</th></tr>' +
          '<tr>' + subgrupos + '<th class="cot-print-ideal" scope="col">Valor unit.</th><th class="cot-print-ideal" scope="col">Valor total</th></tr>' +
        '</thead>' +
        '<tbody>' + (linhas || '<tr><td colspan="' + (5 + bloco.length * 2) + '">Nenhum produto informado.</td></tr>') + '</tbody>' +
        '<tfoot>' +
          '<tr class="totals-row"><th colspan="3" scope="row">Totais</th>' + totais +
            '<td colspan="2" class="cot-print-money">' + Financeiro.formatarMoeda(calculos.custoIdealTotalCentavos, '') + '<br><span>Custo ideal total</span></td></tr>' +
          '<tr class="discount-row"><th colspan="3" scope="row">Desconto sugerido</th>' +
            '<td colspan="' + totalColunasRestantes + '" class="cot-print-money">' +
              Financeiro.formatarMoeda(calculos.descontoSugeridoCentavos) + ' · ' +
              Financeiro.formatarPercentualBasisPoints(calculos.percentualNegociacaoBasisPoints) +
            '</td></tr>' +
        '</tfoot>' +
      '</table>';
  }

  function resumo(estado, calculos) {
    var nomes = calculos.fornecedoresRecomendados.map(function (id) {
      var fornecedor = estado.fornecedores.find(function (registro) { return registro.id === id; });
      return fornecedor ? fornecedor.nome : '';
    }).filter(Boolean).join(', ');
    return '' +
      '<section class="cot-print-summary" aria-label="Resumo financeiro">' +
        '<div><small>Fornecedor recomendado</small><strong>' + escapar(nomes || 'Nenhum fornecedor completo') + '</strong></div>' +
        '<div><small>Total recomendado</small><strong>' + Financeiro.formatarMoeda(calculos.totalRecomendadoCentavos) + '</strong></div>' +
        '<div><small>Desconto sugerido</small><strong>' + Financeiro.formatarMoeda(calculos.descontoSugeridoCentavos) + '</strong></div>' +
        '<div><small>Percentual de negociação</small><strong>' + Financeiro.formatarPercentualBasisPoints(calculos.percentualNegociacaoBasisPoints) + '</strong></div>' +
      '</section>';
  }

  function informacoesFinais(estado, data) {
    var dados = estado.impressao || {};
    return '' +
      '<section class="cot-print-description">' +
        '<h2>Descrição / resumo da compra</h2>' +
        '<p>' + escapar(dados.descricao || 'Não informado.') + '</p>' +
      '</section>' +
      '<section class="cot-print-signatures" aria-label="Assinaturas">' +
        '<div class="cot-print-signature"><strong>' + escapar(dados.elaboradoPor || '') + '</strong><br>Elaborado por · Data: ' + escapar(data) + '</div>' +
        '<div class="cot-print-signature"><strong>' + escapar(dados.aprovadoPor || '') + '</strong><br>Aprovado por · Data: ____/____/________</div>' +
      '</section>';
  }

  function renderizar(estado, opcoes) {
    if (!estado || !Array.isArray(estado.produtos) || !Array.isArray(estado.fornecedores)) {
      throw new TypeError('Estado inválido para impressão.');
    }
    opcoes = opcoes || {};
    var emitidoEm = opcoes.emitidoEm || new Date().toISOString();
    var dados = estado.impressao || {};
    var numero = String(dados.numero || '').trim() || numeroTemporario(emitidoEm);
    var data = comoData(dados.data) || comoData(emitidoEm) || '—';
    var calculos = Financeiro.calcularCotacao(estado);
    var blocos = dividirEmBlocos(estado.fornecedores, 3);

    return blocos.map(function (bloco, indice) {
      var ultimo = indice === blocos.length - 1;
      return '' +
        '<article class="cot-print-sheet" data-print-block="' + (indice + 1) + '">' +
          cabecalho(numero, data, bloco, indice, blocos.length) +
          tabela(estado, calculos, bloco) +
          resumo(estado, calculos) +
          (ultimo ? informacoesFinais(estado, data) : '') +
          '<footer class="cot-print-footer"><span>Cotação ' + escapar(numero) + '</span><span>Bloco ' + (indice + 1) + ' de ' + blocos.length + '</span></footer>' +
        '</article>';
    }).join('');
  }

  return Object.freeze({
    dividirEmBlocos: dividirEmBlocos,
    numeroTemporario: numeroTemporario,
    renderizar: renderizar
  });
});
