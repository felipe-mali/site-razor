(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CotacoesFinanceiro = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;

  function inteiroSeguro(valor) {
    return typeof valor === 'number' && Number.isFinite(valor) &&
      Math.floor(valor) === valor && Math.abs(valor) <= MAX_SAFE_INTEGER;
  }

  function normalizarInteiro(valor) {
    if (inteiroSeguro(valor)) return valor;

    if (typeof valor !== 'string') return null;

    var texto = valor.trim();
    if (!/^[+-]?\d+$/.test(texto)) return null;

    var numero = Number(texto);
    return inteiroSeguro(numero) ? numero : null;
  }

  function parseNumeroDecimal(valor, casasDecimais, permiteMoeda) {
    var escala = Math.pow(10, casasDecimais);

    if (typeof valor === 'number') {
      if (!Number.isFinite(valor)) return null;

      var escalado = valor * escala;
      var arredondado = Math.round(escalado);
      var tolerancia = Math.max(1, Math.abs(escalado)) * Number.EPSILON * 4;

      if (Math.abs(escalado - arredondado) > tolerancia ||
          Math.abs(arredondado) > MAX_SAFE_INTEGER) {
        return null;
      }

      return arredondado === 0 ? 0 : arredondado;
    }

    if (typeof valor !== 'string') return null;

    var texto = valor.trim();
    if (!texto) return null;

    texto = texto.replace(/[\s\u00a0]/g, '');

    var sinal = 1;
    var sinalInformado = false;
    if (texto.charAt(0) === '-' || texto.charAt(0) === '+') {
      sinalInformado = true;
      sinal = texto.charAt(0) === '-' ? -1 : 1;
      texto = texto.slice(1);
    }

    if (permiteMoeda) {
      texto = texto.replace(/^R\$/i, '');
    }

    // Também aceita o sinal depois do símbolo ("R$ -10,00"), mas nunca dois
    // sinais na mesma entrada.
    if (texto.charAt(0) === '-' || texto.charAt(0) === '+') {
      if (sinalInformado) return null;
      sinal = texto.charAt(0) === '-' ? -1 : 1;
      texto = texto.slice(1);
    }

    if (!texto || !/^[\d.,]+$/.test(texto)) return null;

    var parteInteira;
    var parteDecimal = '';
    var possuiVirgula = texto.indexOf(',') !== -1;
    var quantidadePontos = (texto.match(/\./g) || []).length;

    if (possuiVirgula) {
      if ((texto.match(/,/g) || []).length !== 1) return null;

      var partesVirgula = texto.split(',');
      parteInteira = partesVirgula[0];
      parteDecimal = partesVirgula[1];

      if (!parteDecimal || parteDecimal.length > casasDecimais ||
          !/^\d+$/.test(parteDecimal)) {
        return null;
      }

      if (parteInteira.indexOf('.') !== -1) {
        if (!/^\d{1,3}(?:\.\d{3})+$/.test(parteInteira)) return null;
        parteInteira = parteInteira.replace(/\./g, '');
      } else if (!/^\d+$/.test(parteInteira)) {
        return null;
      }
    } else if (quantidadePontos > 0) {
      if (/^\d{1,3}(?:\.\d{3})+$/.test(texto)) {
        parteInteira = texto.replace(/\./g, '');
      } else if (quantidadePontos === 1) {
        var partesPonto = texto.split('.');
        parteInteira = partesPonto[0];
        parteDecimal = partesPonto[1];

        if (!parteInteira || !parteDecimal ||
            !/^\d+$/.test(parteInteira) ||
            !/^\d+$/.test(parteDecimal) ||
            parteDecimal.length > casasDecimais) {
          return null;
        }
      } else {
        return null;
      }
    } else {
      if (!/^\d+$/.test(texto)) return null;
      parteInteira = texto;
    }

    var decimalCompleto = parteDecimal.padEnd(casasDecimais, '0');
    var digitosEscalados = (parteInteira.replace(/^0+(?=\d)/, '') || '0') +
      decimalCompleto;
    var absoluto = Number(digitosEscalados);

    if (!inteiroSeguro(absoluto)) return null;

    var resultado = sinal * absoluto;
    return resultado === 0 ? 0 : resultado;
  }

  /**
   * Converte um valor em reais para centavos inteiros. Entradas vazias ou
   * inválidas retornam null. Strings seguem a notação brasileira; números são
   * interpretados como reais.
   */
  function parseMoedaParaCentavos(valor) {
    return parseNumeroDecimal(valor, 2, true);
  }

  function agruparMilhares(texto) {
    return texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Formata centavos inteiros sem converter o valor financeiro para float.
   * Retorna um travessão quando o argumento não é um inteiro seguro.
   */
  function formatarCentavos(centavos) {
    var valor = normalizarInteiro(centavos);
    if (valor === null) return '—';

    var negativo = valor < 0;
    var absoluto = Math.abs(valor);
    var reais = Math.floor(absoluto / 100);
    var resto = String(absoluto % 100).padStart(2, '0');

    return (negativo ? '-' : '') + 'R$ ' + agruparMilhares(String(reais)) + ',' + resto;
  }

  /**
   * Converte uma quantidade decimal para milésimos inteiros. Entradas vazias
   * ou com mais de três casas decimais retornam null.
   */
  function parseQuantidadeParaMillesimos(valor) {
    return parseNumeroDecimal(valor, 3, false);
  }

  /**
   * Formata milésimos inteiros com até três casas decimais, removendo apenas
   * os zeros não significativos da parte fracionária.
   */
  function formatarQuantidade(millesimos) {
    var valor = normalizarInteiro(millesimos);
    if (valor === null) return '—';

    var negativo = valor < 0;
    var absoluto = Math.abs(valor);
    var unidades = Math.floor(absoluto / 1000);
    var fracao = String(absoluto % 1000).padStart(3, '0').replace(/0+$/, '');
    var resultado = agruparMilhares(String(unidades));

    if (fracao) resultado += ',' + fracao;
    return (negativo ? '-' : '') + resultado;
  }

  function formatarBasisPoints(basisPoints) {
    var valor = normalizarInteiro(basisPoints);
    if (valor === null) return '—';

    var negativo = valor < 0;
    var absoluto = Math.abs(valor);
    var inteiros = Math.floor(absoluto / 100);
    var fracao = String(absoluto % 100).padStart(2, '0');

    return (negativo ? '-' : '') + agruparMilhares(String(inteiros)) + ',' + fracao + '%';
  }

  function somarSeguro(a, b) {
    if (!inteiroSeguro(a) || !inteiroSeguro(b)) {
      throw new TypeError('A soma financeira exige inteiros seguros.');
    }

    if (b > 0 && a > MAX_SAFE_INTEGER - b) {
      throw new RangeError('O resultado financeiro excede o limite de inteiro seguro.');
    }

    if (b < 0 && a < -MAX_SAFE_INTEGER - b) {
      throw new RangeError('O resultado financeiro excede o limite de inteiro seguro.');
    }

    return a + b;
  }

  /**
   * Calcula a divisão de um produto positivo com arredondamento half-up.
   * O caminho comum usa Number; BigInt só é usado quando o produto intermediário
   * ultrapassaria o limite seguro, mantendo exatidão sem penalizar matrizes comuns.
   */
  function multiplicarDividirHalfUp(a, b, divisor) {
    if (!inteiroSeguro(a) || !inteiroSeguro(b) || !inteiroSeguro(divisor) ||
        a < 0 || b < 0 || divisor <= 0) {
      throw new TypeError('O cálculo half-up exige inteiros seguros não negativos.');
    }

    if (a === 0 || b === 0) return 0;

    if (a <= Math.floor(MAX_SAFE_INTEGER / b)) {
      var produto = a * b;
      var quociente = Math.floor(produto / divisor);
      var resto = produto % divisor;
      return resto >= Math.ceil(divisor / 2) ? quociente + 1 : quociente;
    }

    if (typeof BigInt !== 'function') {
      throw new RangeError('O produto financeiro excede o limite de inteiro seguro.');
    }

    var resultadoGrande = (
      BigInt(a) * BigInt(b) + BigInt(Math.floor(divisor / 2))
    ) / BigInt(divisor);
    var limiteGrande = BigInt(MAX_SAFE_INTEGER);

    if (resultadoGrande > limiteGrande) {
      throw new RangeError('O resultado financeiro excede o limite de inteiro seguro.');
    }

    return Number(resultadoGrande);
  }

  function normalizarId(valor) {
    if (valor === null || valor === undefined) return null;
    var id = String(valor).trim();
    return id ? id : null;
  }

  function obterQuantidade(item) {
    if (!item || typeof item !== 'object') return null;

    var valor = item.quantidadeMillesimos;
    if (valor === undefined) valor = item.quantidadeMilesimos;
    return normalizarInteiro(valor);
  }

  function fornecedorParticipaComparacao(fornecedor) {
    if (!fornecedor || typeof fornecedor !== 'object') return false;
    if (fornecedor.ativo === false) return false;
    if (fornecedor.ativoComparacao === false) return false;
    if (fornecedor.ativoNaComparacao === false) return false;
    if (fornecedor.incluirNaComparacao === false) return false;
    return true;
  }

  function precoEstaDisponivel(preco) {
    return Boolean(preco) && preco.indisponivel !== true &&
      preco.disponivel !== false && preco.ativo !== false;
  }

  function obterNomeFornecedor(fornecedor, fornecedorId) {
    var candidatos = [
      fornecedor && fornecedor.nome,
      fornecedor && fornecedor.nomeFantasia,
      fornecedor && fornecedor.razaoSocial,
      fornecedorId
    ];

    for (var i = 0; i < candidatos.length; i += 1) {
      if (typeof candidatos[i] === 'string' && candidatos[i].trim()) {
        return candidatos[i].trim();
      }
    }

    return fornecedorId;
  }

  function listarNomes(nomes) {
    if (nomes.length === 0) return '';
    if (nomes.length === 1) return nomes[0];
    if (nomes.length === 2) return nomes[0] + ' e ' + nomes[1];
    return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  }

  function criarAnaliseTextual(resultado, fornecedorPorId) {
    var recomendados = resultado.fornecedorIdsRecomendados;

    if (recomendados.length === 0) {
      if (resultado.contadores.itens === 0) {
        return 'Adicione ao menos um item para iniciar a análise financeira da cotação.';
      }

      if (resultado.contadores.fornecedoresComparados === 0) {
        return 'Ainda não foi possível recomendar um fornecedor, pois não há fornecedores ativos na comparação.';
      }

      if (resultado.contadores.fornecedoresCompletos > 0) {
        return 'Ainda não foi possível recomendar um fornecedor, pois existem quantidades ou fretes inválidos que impedem o cálculo do total completo.';
      }

      return 'Ainda não foi possível recomendar um fornecedor, pois nenhuma proposta possui preços válidos para todos os itens.';
    }

    var nomes = recomendados.map(function (fornecedorId) {
      var fornecedor = fornecedorPorId.get(fornecedorId);
      return obterNomeFornecedor(fornecedor, fornecedorId);
    });
    var abertura;

    if (nomes.length === 1) {
      var nomeUnico = nomes[0];
      abertura = (/^fornecedor\b/i.test(nomeUnico) ? 'O ' : 'O fornecedor ') +
        nomeUnico + ' possui o menor valor total para o pedido completo. ';
    } else {
      abertura = 'As propostas de ' + listarNomes(nomes) +
        ' estão empatadas no menor valor total para o pedido completo. ';
    }

    return abertura + 'O total informado é de ' +
      formatarCentavos(resultado.totalRecomendadoCentavos) +
      ', enquanto o custo ideal, combinando os menores preços de cada item, é de ' +
      formatarCentavos(resultado.custoIdealTotalCentavos) + '. ' +
      'Existe uma margem sugerida de negociação de ' +
      formatarCentavos(resultado.descontoSugeridoCentavos) + ', equivalente a ' +
      formatarBasisPoints(resultado.percentualNegociacaoBasisPoints) +
      ' do total recomendado.';
  }

  /**
   * Recalcula toda a comparação em O(itens * fornecedores + preços).
   *
   * Entrada canônica:
   * - itens: { id, quantidadeMillesimos, ativo? }
   * - fornecedores: { id, nome?, freteCentavos?, ativoComparacao? }
   * - precos: { itemId, fornecedorId, valorUnitarioCentavos, indisponivel? }
   *
   * Campos monetários e quantidades derivados são sempre inteiros. Resultados
   * que ainda não podem ser calculados são representados por null.
   */
  function calcularCotacao(entrada) {
    entrada = entrada && typeof entrada === 'object' ? entrada : {};

    var itensEntrada = Array.isArray(entrada.itens) ? entrada.itens : [];
    var fornecedoresEntrada = Array.isArray(entrada.fornecedores) ? entrada.fornecedores : [];
    var precosEntrada = Array.isArray(entrada.precos) ? entrada.precos : [];
    var itensAtivos = [];
    var fornecedores = [];
    var itemPorId = new Map();
    var fornecedorPorId = new Map();

    itensEntrada.forEach(function (item) {
      if (!item || typeof item !== 'object' || item.ativo === false) return;

      var itemId = normalizarId(item.id !== undefined ? item.id : item.itemId);
      if (itemId === null || itemPorId.has(itemId)) return;

      var normalizado = {
        id: itemId,
        original: item,
        quantidadeMillesimos: obterQuantidade(item)
      };

      itemPorId.set(itemId, normalizado);
      itensAtivos.push(normalizado);
    });

    fornecedoresEntrada.forEach(function (fornecedor) {
      if (!fornecedor || typeof fornecedor !== 'object') return;

      var fornecedorId = normalizarId(
        fornecedor.id !== undefined ? fornecedor.id : fornecedor.fornecedorId
      );
      if (fornecedorId === null || fornecedorPorId.has(fornecedorId)) return;

      var normalizado = {
        id: fornecedorId,
        original: fornecedor,
        ativoComparacao: fornecedorParticipaComparacao(fornecedor)
      };

      fornecedorPorId.set(fornecedorId, fornecedor);
      fornecedores.push(normalizado);
    });

    var precosPorItem = new Map();
    precosEntrada.forEach(function (preco) {
      if (!preco || typeof preco !== 'object') return;

      var itemId = normalizarId(preco.itemId);
      var fornecedorId = normalizarId(preco.fornecedorId);
      if (!itemPorId.has(itemId) || !fornecedorPorId.has(fornecedorId)) return;

      var porFornecedor = precosPorItem.get(itemId);
      if (!porFornecedor) {
        porFornecedor = new Map();
        precosPorItem.set(itemId, porFornecedor);
      }

      // A última ocorrência vence de forma determinística. A validação de
      // unicidade pertence à camada de persistência.
      porFornecedor.set(fornecedorId, preco);
    });

    var acumuladores = new Map();
    fornecedores.forEach(function (fornecedor) {
      acumuladores.set(fornecedor.id, {
        subtotalCentavos: 0,
        possuiTotalIncalculavel: false,
        itensCotados: 0,
        itemIdsFaltantes: []
      });
    });

    var resultadosItens = [];
    var custoIdealAcumulado = 0;
    var custoIdealCompleto = itensAtivos.length > 0;
    var itensComPreco = 0;

    itensAtivos.forEach(function (item) {
      var quantidade = item.quantidadeMillesimos;
      var quantidadeValida = quantidade !== null && quantidade > 0;
      var precosDoItem = precosPorItem.get(item.id) || new Map();
      var precosCalculados = [];
      var menorValor = null;
      var fornecedorIdsMenorPreco = [];

      fornecedores.forEach(function (fornecedor) {
        var precoEntrada = precosDoItem.get(fornecedor.id);
        var valorUnitario = precoEntrada
          ? normalizarInteiro(precoEntrada.valorUnitarioCentavos)
          : null;
        var valido = fornecedor.ativoComparacao && precoEstaDisponivel(precoEntrada) &&
          valorUnitario !== null && valorUnitario > 0;
        var valorTotal = null;
        var acumulador = acumuladores.get(fornecedor.id);

        if (valido) {
          acumulador.itensCotados += 1;

          if (quantidadeValida) {
            valorTotal = multiplicarDividirHalfUp(quantidade, valorUnitario, 1000);
            acumulador.subtotalCentavos = somarSeguro(
              acumulador.subtotalCentavos,
              valorTotal
            );
          } else {
            acumulador.possuiTotalIncalculavel = true;
          }

          if (menorValor === null || valorUnitario < menorValor) {
            menorValor = valorUnitario;
            fornecedorIdsMenorPreco = [fornecedor.id];
          } else if (valorUnitario === menorValor) {
            fornecedorIdsMenorPreco.push(fornecedor.id);
          }
        } else if (fornecedor.ativoComparacao) {
          acumulador.itemIdsFaltantes.push(item.id);
        }

        precosCalculados.push({
          fornecedorId: fornecedor.id,
          valorUnitarioCentavos: valorUnitario,
          valorTotalCentavos: valorTotal,
          valido: valido,
          menorPreco: false
        });
      });

      if (menorValor !== null) {
        itensComPreco += 1;
        var menores = new Set(fornecedorIdsMenorPreco);
        precosCalculados.forEach(function (preco) {
          preco.menorPreco = preco.valido && menores.has(preco.fornecedorId);
        });
      }

      var custoIdealTotal = menorValor !== null && quantidadeValida
        ? multiplicarDividirHalfUp(quantidade, menorValor, 1000)
        : null;

      if (custoIdealTotal === null) {
        custoIdealCompleto = false;
      } else {
        custoIdealAcumulado = somarSeguro(custoIdealAcumulado, custoIdealTotal);
      }

      resultadosItens.push({
        itemId: item.id,
        quantidadeMillesimos: quantidade,
        quantidadeValida: quantidadeValida,
        temPrecoValido: menorValor !== null,
        menorValorUnitarioCentavos: menorValor,
        fornecedorIdsMenorPreco: fornecedorIdsMenorPreco,
        custoIdealUnitarioCentavos: menorValor,
        custoIdealTotalCentavos: custoIdealTotal,
        precos: precosCalculados
      });
    });

    var resultadosFornecedores = [];
    var menorTotalRecomendado = null;
    var fornecedorIdsRecomendados = [];
    var fornecedoresCompletos = 0;
    var fornecedoresIncompletos = 0;
    var fornecedoresComparados = 0;

    fornecedores.forEach(function (fornecedor) {
      var acumulador = acumuladores.get(fornecedor.id);
      var freteBruto = fornecedor.original.freteCentavos;
      var frete = freteBruto === undefined || freteBruto === null || freteBruto === ''
        ? 0
        : normalizarInteiro(freteBruto);
      var freteValido = frete !== null && frete >= 0;
      var completo = fornecedor.ativoComparacao && itensAtivos.length > 0 &&
        acumulador.itemIdsFaltantes.length === 0;
      var subtotal = fornecedor.ativoComparacao
        ? acumulador.subtotalCentavos
        : null;
      var total = fornecedor.ativoComparacao && freteValido &&
        !acumulador.possuiTotalIncalculavel
        ? somarSeguro(subtotal, frete)
        : null;

      if (fornecedor.ativoComparacao) {
        fornecedoresComparados += 1;
        if (completo) fornecedoresCompletos += 1;
        else fornecedoresIncompletos += 1;
      }

      if (completo && total !== null) {
        if (menorTotalRecomendado === null || total < menorTotalRecomendado) {
          menorTotalRecomendado = total;
          fornecedorIdsRecomendados = [fornecedor.id];
        } else if (total === menorTotalRecomendado) {
          fornecedorIdsRecomendados.push(fornecedor.id);
        }
      }

      resultadosFornecedores.push({
        fornecedorId: fornecedor.id,
        ativoComparacao: fornecedor.ativoComparacao,
        subtotalCentavos: subtotal,
        freteCentavos: frete,
        totalCentavos: total,
        completo: completo,
        itensCotados: acumulador.itensCotados,
        itensFaltantes: acumulador.itemIdsFaltantes.length,
        itemIdsFaltantes: acumulador.itemIdsFaltantes.slice()
      });
    });

    var custoIdealTotalCentavos = custoIdealCompleto ? custoIdealAcumulado : null;
    var descontoSugeridoCentavos = null;
    var percentualNegociacaoBasisPoints = null;

    if (menorTotalRecomendado !== null && custoIdealTotalCentavos !== null) {
      descontoSugeridoCentavos = Math.max(
        0,
        menorTotalRecomendado - custoIdealTotalCentavos
      );

      percentualNegociacaoBasisPoints = menorTotalRecomendado > 0
        ? multiplicarDividirHalfUp(
          descontoSugeridoCentavos,
          10000,
          menorTotalRecomendado
        )
        : 0;
    }

    var resultado = {
      itens: resultadosItens,
      fornecedores: resultadosFornecedores,
      custoIdealTotalCentavos: custoIdealTotalCentavos,
      custoIdealCompleto: custoIdealCompleto,
      fornecedorIdsRecomendados: fornecedorIdsRecomendados,
      totalRecomendadoCentavos: menorTotalRecomendado,
      descontoSugeridoCentavos: descontoSugeridoCentavos,
      percentualNegociacaoBasisPoints: percentualNegociacaoBasisPoints,
      contadores: {
        itens: itensAtivos.length,
        fornecedores: fornecedores.length,
        fornecedoresComparados: fornecedoresComparados,
        itensComPreco: itensComPreco,
        itensSemPreco: itensAtivos.length - itensComPreco,
        fornecedoresCompletos: fornecedoresCompletos,
        fornecedoresIncompletos: fornecedoresIncompletos
      },
      analiseTextual: ''
    };

    resultado.analiseTextual = criarAnaliseTextual(resultado, fornecedorPorId);
    return resultado;
  }

  function normalizarCnpj(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).replace(/\D/g, '');
  }

  function calcularDigitoCnpj(base, pesos) {
    var soma = 0;

    for (var i = 0; i < pesos.length; i += 1) {
      soma += Number(base.charAt(i)) * pesos[i];
    }

    var resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  function validarCnpj(valor) {
    var cnpj = normalizarCnpj(valor);
    if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

    var primeiro = calcularDigitoCnpj(
      cnpj.slice(0, 12),
      [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    );
    var segundo = calcularDigitoCnpj(
      cnpj.slice(0, 12) + primeiro,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    );

    return cnpj.slice(-2) === String(primeiro) + String(segundo);
  }

  var api = {
    parseMoedaParaCentavos: parseMoedaParaCentavos,
    formatarCentavos: formatarCentavos,
    parseQuantidadeParaMillesimos: parseQuantidadeParaMillesimos,
    formatarQuantidade: formatarQuantidade,
    formatarBasisPoints: formatarBasisPoints,
    calcularCotacao: calcularCotacao,
    normalizarCnpj: normalizarCnpj,
    validarCnpj: validarCnpj
  };

  return Object.freeze ? Object.freeze(api) : api;
}));
