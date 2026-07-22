(function carregarCotacoesFinanceiro(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CotacoesFinanceiro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function criarCotacoesFinanceiro() {
  'use strict';

  var MAXIMO_SEGURO = BigInt(Number.MAX_SAFE_INTEGER);

  function chavePreco(produtoId, fornecedorId) {
    return String(produtoId) + '::' + String(fornecedorId);
  }

  function decomporDecimal(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number' && !Number.isFinite(valor)) return null;

    var texto = String(valor)
      .replace(/R\$/gi, '')
      .replace(/[\s\u00a0]/g, '')
      .trim();

    if (!texto || texto.charAt(0) === '-' || !/^[+]?\d[\d.,]*$/.test(texto)) {
      return null;
    }
    if (texto.charAt(0) === '+') texto = texto.slice(1);
    if (!texto || !/\d/.test(texto)) return null;

    var inteiro;
    var decimal = '';
    var virgulas = (texto.match(/,/g) || []).length;
    var pontos = (texto.match(/\./g) || []).length;

    if (virgulas > 1) return null;
    if (virgulas === 1) {
      var partesVirgula = texto.split(',');
      if (!/^\d*(?:\.\d{3})*$/.test(partesVirgula[0]) || !/^\d*$/.test(partesVirgula[1])) return null;
      inteiro = partesVirgula[0].replace(/\./g, '') || '0';
      decimal = partesVirgula[1] || '';
    } else if (pontos > 1) {
      var grupos = texto.split('.');
      if (!/^\d{1,3}$/.test(grupos[0]) || grupos.slice(1).some(function (grupo) { return !/^\d{3}$/.test(grupo); })) {
        return null;
      }
      inteiro = grupos.join('');
    } else if (pontos === 1) {
      var partesPonto = texto.split('.');
      if (!/^\d*$/.test(partesPonto[0]) || !/^\d*$/.test(partesPonto[1])) return null;
      if (partesPonto[1].length === 3 && partesPonto[0].length >= 1 && partesPonto[0].length <= 3) {
        inteiro = partesPonto.join('');
      } else {
        inteiro = partesPonto[0] || '0';
        decimal = partesPonto[1] || '';
      }
    } else {
      inteiro = texto || '0';
    }

    if (!/^\d+$/.test(inteiro) || !/^\d*$/.test(decimal)) return null;
    return { inteiro: inteiro.replace(/^0+(?=\d)/, '') || '0', decimal: decimal };
  }

  function decimalParaInteiro(valor, casas) {
    var partes = decomporDecimal(valor);
    if (!partes) return null;

    var fator = 10n ** BigInt(casas);
    var fracaoBase = (partes.decimal + '0'.repeat(casas)).slice(0, casas) || '0';
    var resultado = BigInt(partes.inteiro) * fator + BigInt(fracaoBase);
    var proximoDigito = partes.decimal.length > casas ? Number(partes.decimal.charAt(casas)) : 0;
    if (proximoDigito >= 5) resultado += 1n;
    if (resultado > MAXIMO_SEGURO) return null;
    return Number(resultado);
  }

  function parseMoedaCentavos(valor) {
    return decimalParaInteiro(valor, 2);
  }

  function parseQuantidadeMillesimos(valor) {
    return decimalParaInteiro(valor, 3);
  }

  function inteiroNaoNegativo(valor) {
    return Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
  }

  function formatarMoeda(centavos, vazio) {
    var numero = inteiroNaoNegativo(centavos);
    if (numero === null) return vazio === undefined ? '—' : vazio;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numero / 100);
  }

  function formatarMoedaInput(centavos) {
    var numero = inteiroNaoNegativo(centavos);
    if (numero === null || numero === 0) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numero / 100);
  }

  function formatarQuantidade(millesimos, vazio) {
    var numero = inteiroNaoNegativo(millesimos);
    if (numero === null) return vazio === undefined ? '—' : vazio;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: numero % 1000 === 0 ? 0 : 1,
      maximumFractionDigits: 3
    }).format(numero / 1000);
  }

  function formatarPercentualBasisPoints(basisPoints, vazio) {
    var numero = inteiroNaoNegativo(basisPoints);
    if (numero === null) return vazio === undefined ? '—' : vazio;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numero / 100) + '%';
  }

  function dividirArredondando(numerador, denominador) {
    if (denominador <= 0n) return null;
    return (numerador + denominador / 2n) / denominador;
  }

  function calcularTotalItem(quantidadeMillesimos, valorUnitarioCentavos) {
    if (!Number.isSafeInteger(quantidadeMillesimos) || quantidadeMillesimos <= 0) return null;
    if (!Number.isSafeInteger(valorUnitarioCentavos) || valorUnitarioCentavos <= 0) return null;
    var resultado = dividirArredondando(
      BigInt(quantidadeMillesimos) * BigInt(valorUnitarioCentavos),
      1000n
    );
    if (resultado === null || resultado > MAXIMO_SEGURO) return null;
    return Number(resultado);
  }

  function obterPreco(precos, produtoId, fornecedorId) {
    var chave = chavePreco(produtoId, fornecedorId);
    var valor = precos instanceof Map ? precos.get(chave) : precos && precos[chave];
    return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
  }

  function calcularCotacao(entrada) {
    var produtos = Array.isArray(entrada && entrada.produtos) ? entrada.produtos : [];
    var fornecedores = Array.isArray(entrada && entrada.fornecedores) ? entrada.fornecedores : [];
    var precos = entrada && entrada.precos ? entrada.precos : {};
    var totaisFornecedores = new Map();

    fornecedores.forEach(function (fornecedor) {
      totaisFornecedores.set(fornecedor.id, {
        fornecedorId: fornecedor.id,
        totalCentavos: 0,
        faltantes: 0,
        completo: produtos.length > 0
      });
    });

    var produtosCalculados = produtos.map(function (produto) {
      var quantidade = Number.isSafeInteger(produto.quantidadeMillesimos) && produto.quantidadeMillesimos > 0
        ? produto.quantidadeMillesimos
        : null;
      var porFornecedor = {};
      var menorUnitario = null;

      fornecedores.forEach(function (fornecedor) {
        var unitario = obterPreco(precos, produto.id, fornecedor.id);
        var total = quantidade === null || unitario === null ? null : calcularTotalItem(quantidade, unitario);
        var valido = total !== null;
        porFornecedor[fornecedor.id] = {
          valorUnitarioCentavos: unitario,
          valorTotalCentavos: total,
          valido: valido,
          menorPreco: false
        };

        var consolidado = totaisFornecedores.get(fornecedor.id);
        if (!valido) {
          consolidado.faltantes += 1;
          consolidado.completo = false;
        } else {
          consolidado.totalCentavos += total;
          if (menorUnitario === null || unitario < menorUnitario) menorUnitario = unitario;
        }
      });

      var fornecedoresMenorPreco = [];
      if (menorUnitario !== null) {
        fornecedores.forEach(function (fornecedor) {
          if (porFornecedor[fornecedor.id].valorUnitarioCentavos === menorUnitario) {
            porFornecedor[fornecedor.id].menorPreco = true;
            fornecedoresMenorPreco.push(fornecedor.id);
          }
        });
      }

      return {
        produtoId: produto.id,
        quantidadeMillesimos: quantidade,
        porFornecedor: porFornecedor,
        menorValorUnitarioCentavos: menorUnitario,
        fornecedoresMenorPreco: fornecedoresMenorPreco,
        custoIdealTotalCentavos: quantidade === null || menorUnitario === null
          ? null
          : calcularTotalItem(quantidade, menorUnitario)
      };
    });

    var fornecedoresCalculados = fornecedores.map(function (fornecedor) {
      return totaisFornecedores.get(fornecedor.id);
    });
    var custoIdealCompleto = produtos.length > 0 && produtosCalculados.every(function (produto) {
      return produto.custoIdealTotalCentavos !== null;
    });
    var custoIdealTotal = produtosCalculados.reduce(function (total, produto) {
      return total + (produto.custoIdealTotalCentavos || 0);
    }, 0);

    var completos = fornecedoresCalculados.filter(function (fornecedor) { return fornecedor.completo; });
    var totalRecomendado = completos.length
      ? Math.min.apply(null, completos.map(function (fornecedor) { return fornecedor.totalCentavos; }))
      : null;
    var fornecedoresRecomendados = totalRecomendado === null ? [] : completos
      .filter(function (fornecedor) { return fornecedor.totalCentavos === totalRecomendado; })
      .map(function (fornecedor) { return fornecedor.fornecedorId; });

    var desconto = totalRecomendado === null || !custoIdealCompleto
      ? null
      : Math.max(0, totalRecomendado - custoIdealTotal);
    var percentual = null;
    if (desconto !== null && totalRecomendado > 0) {
      percentual = Number(dividirArredondando(BigInt(desconto) * 10000n, BigInt(totalRecomendado)));
    }

    return {
      produtos: produtosCalculados,
      fornecedores: fornecedoresCalculados,
      custoIdealCompleto: custoIdealCompleto,
      custoIdealTotalCentavos: custoIdealCompleto ? custoIdealTotal : null,
      fornecedoresRecomendados: fornecedoresRecomendados,
      totalRecomendadoCentavos: totalRecomendado,
      descontoSugeridoCentavos: desconto,
      percentualNegociacaoBasisPoints: percentual
    };
  }

  return Object.freeze({
    chavePreco: chavePreco,
    parseMoedaCentavos: parseMoedaCentavos,
    parseQuantidadeMillesimos: parseQuantidadeMillesimos,
    formatarMoeda: formatarMoeda,
    formatarMoedaInput: formatarMoedaInput,
    formatarQuantidade: formatarQuantidade,
    formatarPercentualBasisPoints: formatarPercentualBasisPoints,
    calcularTotalItem: calcularTotalItem,
    calcularCotacao: calcularCotacao
  });
});
