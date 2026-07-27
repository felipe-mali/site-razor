(function carregarComprovanteEntregaModelo(root, factory) {
  'use strict';

  var config = typeof module === 'object' && module.exports
    ? require('./comprovante-entrega-config')
    : root && root.ComprovanteEntregaConfig;
  var api = factory(config);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ComprovanteEntregaModelo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function criarComprovanteEntregaModelo(Config) {
  'use strict';

  if (!Config) throw new Error('ComprovanteEntregaConfig é obrigatório.');

  var MAXIMO_SEGURO = BigInt(Number.MAX_SAFE_INTEGER);

  function textoLimpo(valor, limite) {
    var texto = String(valor === undefined || valor === null ? '' : valor)
      .replace(/\s+/g, ' ')
      .trim();
    return typeof limite === 'number' ? texto.slice(0, limite) : texto;
  }

  function somenteDigitos(valor, limite) {
    var digitos = String(valor === undefined || valor === null ? '' : valor).replace(/\D/g, '');
    return typeof limite === 'number' ? digitos.slice(0, limite) : digitos;
  }

  function inteiroSeguroNaoNegativo(valor) {
    return Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
  }

  function decomporNumeroNativo(valor) {
    if (!Number.isFinite(valor) || valor < 0) return null;
    var texto = String(valor);
    if (!/^\d+(?:\.\d+)?$/.test(texto)) return null;
    var partes = texto.split('.');
    return { inteiro: partes[0], decimal: partes[1] || '' };
  }

  function inteiroBrasileiroValido(texto) {
    if (/^\d+$/.test(texto)) return texto;
    if (/^\d{1,3}(?:\.\d{3})+$/.test(texto)) return texto.replace(/\./g, '');
    return null;
  }

  function decomporDecimal(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number') return decomporNumeroNativo(valor);

    var texto = String(valor)
      .replace(/R\$/gi, '')
      .replace(/[\s\u00a0]/g, '')
      .trim();

    if (!texto || texto.charAt(0) === '-' || !/^[+]?\d[\d.,]*$/.test(texto)) return null;
    if (texto.charAt(0) === '+') texto = texto.slice(1);

    var inteiro;
    var decimal = '';
    var quantidadeVirgulas = (texto.match(/,/g) || []).length;
    var quantidadePontos = (texto.match(/\./g) || []).length;

    if (quantidadeVirgulas > 1) return null;
    if (quantidadeVirgulas === 1) {
      var partesVirgula = texto.split(',');
      inteiro = inteiroBrasileiroValido(partesVirgula[0]);
      if (inteiro === null || !/^\d*$/.test(partesVirgula[1])) return null;
      decimal = partesVirgula[1];
    } else if (quantidadePontos > 1) {
      inteiro = inteiroBrasileiroValido(texto);
      if (inteiro === null) return null;
    } else if (quantidadePontos === 1) {
      var partesPonto = texto.split('.');
      if (!/^\d+$/.test(partesPonto[0]) || !/^\d*$/.test(partesPonto[1])) return null;
      if (partesPonto[1].length === 3 && partesPonto[0].length <= 3) {
        inteiro = partesPonto[0] + partesPonto[1];
      } else {
        inteiro = partesPonto[0];
        decimal = partesPonto[1];
      }
    } else {
      inteiro = texto;
    }

    return {
      inteiro: inteiro.replace(/^0+(?=\d)/, '') || '0',
      decimal: decimal
    };
  }

  function decimalParaInteiro(valor, casasDecimais) {
    var partes = decomporDecimal(valor);
    if (!partes) return null;

    var fator = 10n ** BigInt(casasDecimais);
    var fracao = (partes.decimal + '0'.repeat(casasDecimais)).slice(0, casasDecimais) || '0';
    var resultado = BigInt(partes.inteiro) * fator + BigInt(fracao);
    var proximoDigito = partes.decimal.length > casasDecimais
      ? Number(partes.decimal.charAt(casasDecimais))
      : 0;
    if (proximoDigito >= 5) resultado += 1n;
    return resultado <= MAXIMO_SEGURO ? Number(resultado) : null;
  }

  function parseMoedaCentavos(valor) {
    return decimalParaInteiro(valor, 2);
  }

  function parseQuantidadeMillesimos(valor) {
    return decimalParaInteiro(valor, 3);
  }

  function agruparMilhares(inteiro) {
    return String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatarMoeda(centavos, vazio) {
    var valor = inteiroSeguroNaoNegativo(centavos);
    if (valor === null) return vazio === undefined ? '—' : vazio;
    var digitos = String(valor).padStart(3, '0');
    return 'R$\u00a0' + agruparMilhares(digitos.slice(0, -2)) + ',' + digitos.slice(-2);
  }

  function formatarMoedaInput(centavos) {
    var formatado = formatarMoeda(centavos, '');
    return formatado ? formatado.replace(/^R\$\u00a0/, '') : '';
  }

  function formatarQuantidade(millesimos, vazio) {
    var valor = inteiroSeguroNaoNegativo(millesimos);
    if (valor === null) return vazio === undefined ? '—' : vazio;
    var digitos = String(valor).padStart(4, '0');
    var inteiro = digitos.slice(0, -3);
    var decimal = digitos.slice(-3).replace(/0+$/, '');
    return agruparMilhares(inteiro) + (decimal ? ',' + decimal : '');
  }

  function formatarQuantidadeInput(millesimos) {
    return formatarQuantidade(millesimos, '');
  }

  function calcularTotalItem(quantidadeMillesimos, valorUnitarioCentavos) {
    if (!Number.isSafeInteger(quantidadeMillesimos) || quantidadeMillesimos <= 0) return null;
    if (!Number.isSafeInteger(valorUnitarioCentavos) || valorUnitarioCentavos < 0) return null;
    var total = (
      BigInt(quantidadeMillesimos) * BigInt(valorUnitarioCentavos) + 500n
    ) / 1000n;
    return total <= MAXIMO_SEGURO ? Number(total) : null;
  }

  function valorInteiroOuParseado(dados, chaveInteira, chaveTexto, parser, vazioComoZero) {
    if (Number.isSafeInteger(dados[chaveInteira]) && dados[chaveInteira] >= 0) {
      return dados[chaveInteira];
    }
    var texto = dados[chaveTexto];
    if ((texto === undefined || texto === null || textoLimpo(texto) === '') && vazioComoZero) return 0;
    return parser(texto);
  }

  function normalizarItem(item) {
    item = item || {};
    var quantidade = valorInteiroOuParseado(
      item,
      'quantidadeMillesimos',
      'quantidade',
      parseQuantidadeMillesimos,
      false
    );
    var valorUnitario = valorInteiroOuParseado(
      item,
      'valorUnitarioCentavos',
      'valorUnitario',
      parseMoedaCentavos,
      true
    );

    return {
      codigo: textoLimpo(item.codigo, 120),
      descricao: textoLimpo(item.descricao, 2000),
      unidade: textoLimpo(item.unidade, 40),
      quantidadeMillesimos: quantidade,
      valorUnitarioCentavos: valorUnitario,
      valorTotalCentavos: calcularTotalItem(quantidade, valorUnitario)
    };
  }

  function calcularTotais(itens, freteCentavos) {
    var itensCalculados = (Array.isArray(itens) ? itens : []).map(function (item) {
      var copia = Object.assign({}, item);
      copia.valorTotalCentavos = calcularTotalItem(
        copia.quantidadeMillesimos,
        copia.valorUnitarioCentavos
      );
      return copia;
    });
    var frete = inteiroSeguroNaoNegativo(freteCentavos);
    if (frete === null) frete = 0;

    var totalProdutosBigInt = itensCalculados.reduce(function (total, item) {
      return total + BigInt(inteiroSeguroNaoNegativo(item.valorTotalCentavos) || 0);
    }, 0n);
    var totalGeralBigInt = totalProdutosBigInt + BigInt(frete);
    var totalProdutos = totalProdutosBigInt <= MAXIMO_SEGURO ? Number(totalProdutosBigInt) : null;
    var totalGeral = totalGeralBigInt <= MAXIMO_SEGURO ? Number(totalGeralBigInt) : null;

    return {
      itens: itensCalculados,
      totalProdutosCentavos: totalProdutos,
      freteCentavos: frete,
      totalGeralCentavos: totalGeral
    };
  }

  function diasNoMes(mes, ano) {
    if (mes === 2) {
      return ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0) ? 29 : 28;
    }
    return [4, 6, 9, 11].indexOf(mes) >= 0 ? 30 : 31;
  }

  function partesData(valor) {
    var texto = textoLimpo(valor, 40);
    var correspondencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    var ano;
    var mes;
    var dia;

    if (correspondencia) {
      ano = Number(correspondencia[1]);
      mes = Number(correspondencia[2]);
      dia = Number(correspondencia[3]);
    } else {
      correspondencia = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!correspondencia) return null;
      dia = Number(correspondencia[1]);
      mes = Number(correspondencia[2]);
      ano = Number(correspondencia[3]);
    }

    if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(mes, ano)) return null;
    return {
      ano: String(ano).padStart(4, '0'),
      mes: String(mes).padStart(2, '0'),
      dia: String(dia).padStart(2, '0')
    };
  }

  function normalizarData(valor) {
    var partes = partesData(valor);
    if (partes) return partes.ano + '-' + partes.mes + '-' + partes.dia;
    return textoLimpo(valor, 40);
  }

  function mascararCpf(valor) {
    var digitos = somenteDigitos(valor, 11);
    if (digitos.length <= 3) return digitos;
    if (digitos.length <= 6) return digitos.slice(0, 3) + '.' + digitos.slice(3);
    if (digitos.length <= 9) {
      return digitos.slice(0, 3) + '.' + digitos.slice(3, 6) + '.' + digitos.slice(6);
    }
    return digitos.slice(0, 3) + '.' + digitos.slice(3, 6) + '.' +
      digitos.slice(6, 9) + '-' + digitos.slice(9);
  }

  function mascararCnpj(valor) {
    var digitos = somenteDigitos(valor, 14);
    if (digitos.length <= 2) return digitos;
    if (digitos.length <= 5) return digitos.slice(0, 2) + '.' + digitos.slice(2);
    if (digitos.length <= 8) {
      return digitos.slice(0, 2) + '.' + digitos.slice(2, 5) + '.' + digitos.slice(5);
    }
    if (digitos.length <= 12) {
      return digitos.slice(0, 2) + '.' + digitos.slice(2, 5) + '.' +
        digitos.slice(5, 8) + '/' + digitos.slice(8);
    }
    return digitos.slice(0, 2) + '.' + digitos.slice(2, 5) + '.' +
      digitos.slice(5, 8) + '/' + digitos.slice(8, 12) + '-' + digitos.slice(12);
  }

  function mascararCpfCnpj(valor) {
    var digitos = somenteDigitos(valor, 14);
    return digitos.length <= 11 ? mascararCpf(digitos) : mascararCnpj(digitos);
  }

  function mascararCep(valor) {
    var digitos = somenteDigitos(valor, 8);
    return digitos.length <= 5 ? digitos : digitos.slice(0, 5) + '-' + digitos.slice(5);
  }

  function mascararChaveAcesso(valor) {
    var digitos = somenteDigitos(valor, 44);
    return (digitos.match(/.{1,4}/g) || []).join(' ');
  }

  function mascararData(valor) {
    var partes = partesData(valor);
    if (partes) return partes.dia + '/' + partes.mes + '/' + partes.ano;
    var digitos = somenteDigitos(valor, 8);
    if (digitos.length <= 2) return digitos;
    if (digitos.length <= 4) return digitos.slice(0, 2) + '/' + digitos.slice(2);
    return digitos.slice(0, 2) + '/' + digitos.slice(2, 4) + '/' + digitos.slice(4);
  }

  function normalizarFormaEntrega(valor) {
    var forma = textoLimpo(valor, 80)
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_-]+/g, '');
    if (forma === 'proprio' || forma === 'veiculoproprio' || forma === 'veiculopropriodarazor') {
      return 'proprio';
    }
    if (forma === 'outra' || forma === 'outro' || forma === 'outraforma' ||
        forma === 'outraformadeentrega') {
      return 'outra';
    }
    return Config.FORMA_ENTREGA_PADRAO;
  }

  function escolherObjeto(entrada, chaves) {
    for (var indice = 0; indice < chaves.length; indice += 1) {
      var candidato = entrada && entrada[chaves[indice]];
      if (candidato && typeof candidato === 'object' && !Array.isArray(candidato)) return candidato;
    }
    return {};
  }

  function escolherValor(objeto, chaves) {
    for (var indice = 0; indice < chaves.length; indice += 1) {
      if (Object.prototype.hasOwnProperty.call(objeto, chaves[indice])) return objeto[chaves[indice]];
    }
    return '';
  }

  function normalizarDados(entrada) {
    entrada = entrada || {};
    var venda = escolherObjeto(entrada, ['dadosVenda', 'venda']);
    var origemVenda = Object.keys(venda).length ? venda : entrada;
    var destinatarioEntrada = escolherObjeto(entrada, ['destinatario', 'cliente']);
    var itensEntrada = Array.isArray(entrada.itens)
      ? entrada.itens
      : (Array.isArray(entrada.mercadorias) ? entrada.mercadorias : []);
    var itens = itensEntrada.map(normalizarItem);
    var frete = valorInteiroOuParseado(
      entrada,
      'freteCentavos',
      'frete',
      parseMoedaCentavos,
      true
    );
    if (frete === null) frete = 0;
    var totais = calcularTotais(itens, frete);
    var formaEntrega = normalizarFormaEntrega(
      escolherValor(entrada, ['formaEntrega', 'tipoEntrega'])
    );
    var descricaoOutraForma = textoLimpo(
      escolherValor(entrada, ['descricaoOutraForma', 'outraFormaEntrega']),
      1000
    );

    return {
      numeroVenda: textoLimpo(
        escolherValor(origemVenda, ['numeroVenda', 'vendaMarketplace', 'venda']),
        120
      ),
      numeroPedido: textoLimpo(
        escolherValor(origemVenda, ['numeroPedido', 'pedidoInterno', 'pedido']),
        120
      ),
      numeroNfe: textoLimpo(
        escolherValor(origemVenda, ['numeroNfe', 'nfe', 'notaFiscal']),
        120
      ),
      serieNfe: textoLimpo(escolherValor(origemVenda, ['serieNfe', 'serie']), 40),
      chaveAcessoNfe: mascararChaveAcesso(
        escolherValor(origemVenda, ['chaveAcessoNfe', 'chaveAcesso', 'chaveNfe'])
      ),
      dataEntrega: normalizarData(
        escolherValor(origemVenda, ['dataEntrega', 'data'])
      ),
      destinatario: {
        nome: textoLimpo(
          escolherValor(destinatarioEntrada, ['nome', 'razaoSocial', 'destinatario']),
          300
        ),
        documento: mascararCpfCnpj(
          escolherValor(destinatarioEntrada, ['documento', 'cpfCnpj', 'cnpjCpf', 'cpf', 'cnpj'])
        ),
        inscricaoEstadual: textoLimpo(
          escolherValor(destinatarioEntrada, ['inscricaoEstadual', 'ie']),
          80
        ),
        contato: textoLimpo(
          escolherValor(destinatarioEntrada, ['contato', 'nomeContato']),
          200
        ),
        endereco: textoLimpo(
          escolherValor(destinatarioEntrada, ['endereco', 'logradouro']),
          500
        ),
        numero: textoLimpo(escolherValor(destinatarioEntrada, ['numero']), 40),
        bairro: textoLimpo(escolherValor(destinatarioEntrada, ['bairro']), 160),
        cidade: textoLimpo(escolherValor(destinatarioEntrada, ['cidade']), 160),
        estado: textoLimpo(
          escolherValor(destinatarioEntrada, ['estado', 'uf']),
          2
        ).toLocaleUpperCase('pt-BR'),
        cep: mascararCep(escolherValor(destinatarioEntrada, ['cep']))
      },
      itens: totais.itens,
      freteCentavos: totais.freteCentavos,
      totalProdutosCentavos: totais.totalProdutosCentavos,
      totalGeralCentavos: totais.totalGeralCentavos,
      formaEntrega: formaEntrega,
      descricaoOutraForma: descricaoOutraForma,
      textoFormaEntrega: formaEntrega === 'outra'
        ? descricaoOutraForma
        : Config.FORMAS_ENTREGA[formaEntrega].texto
    };
  }

  function adicionarErro(erros, errosPorCampo, campo, mensagem) {
    erros.push({ campo: campo, mensagem: mensagem });
    if (!errosPorCampo[campo]) errosPorCampo[campo] = mensagem;
  }

  function moedaInformadaInvalida(origem, chaveInteira, chaveTexto) {
    origem = origem || {};
    if (Number.isSafeInteger(origem[chaveInteira]) && origem[chaveInteira] >= 0) return false;

    var valorTexto = origem[chaveTexto];
    if (textoLimpo(valorTexto) !== '') return parseMoedaCentavos(valorTexto) === null;

    return Object.prototype.hasOwnProperty.call(origem, chaveInteira) &&
      origem[chaveInteira] !== undefined &&
      origem[chaveInteira] !== null &&
      origem[chaveInteira] !== '';
  }

  function validar(entrada) {
    entrada = entrada || {};
    var dados = normalizarDados(entrada);
    var erros = [];
    var errosPorCampo = {};
    var itensEntrada = Array.isArray(entrada.itens)
      ? entrada.itens
      : (Array.isArray(entrada.mercadorias) ? entrada.mercadorias : []);

    if (!dados.destinatario.nome) {
      adicionarErro(
        erros,
        errosPorCampo,
        'destinatario.nome',
        'Informe a razão social ou o nome do destinatário.'
      );
    }
    if (!dados.destinatario.endereco) {
      adicionarErro(
        erros,
        errosPorCampo,
        'destinatario.endereco',
        'Informe o endereço da entrega.'
      );
    }
    if (!partesData(dados.dataEntrega)) {
      adicionarErro(
        erros,
        errosPorCampo,
        'dataEntrega',
        'Informe uma data de entrega válida.'
      );
    }
    if (!dados.itens.length) {
      adicionarErro(
        erros,
        errosPorCampo,
        'itens',
        'Adicione pelo menos uma mercadoria.'
      );
    }
    dados.itens.forEach(function (item, indice) {
      var itemEntrada = itensEntrada[indice] || {};
      if (!item.descricao) {
        adicionarErro(
          erros,
          errosPorCampo,
          'itens.' + indice + '.descricao',
          'Informe a descrição da mercadoria ' + (indice + 1) + '.'
        );
      }
      if (!Number.isSafeInteger(item.quantidadeMillesimos) || item.quantidadeMillesimos <= 0) {
        adicionarErro(
          erros,
          errosPorCampo,
          'itens.' + indice + '.quantidade',
          'Informe uma quantidade maior que zero para a mercadoria ' + (indice + 1) + '.'
        );
      }
      if (moedaInformadaInvalida(itemEntrada, 'valorUnitarioCentavos', 'valorUnitario')) {
        adicionarErro(
          erros,
          errosPorCampo,
          'itens.' + indice + '.valorUnitario',
          'Informe um valor unitário válido para a mercadoria ' + (indice + 1) + '.'
        );
      } else if (
        Number.isSafeInteger(item.quantidadeMillesimos) &&
        item.quantidadeMillesimos > 0 &&
        Number.isSafeInteger(item.valorUnitarioCentavos) &&
        item.valorUnitarioCentavos >= 0 &&
        item.valorTotalCentavos === null
      ) {
        adicionarErro(
          erros,
          errosPorCampo,
          'itens.' + indice + '.valorUnitario',
          'O total da mercadoria ' + (indice + 1) + ' excede o limite permitido.'
        );
      }
    });
    if (moedaInformadaInvalida(entrada, 'freteCentavos', 'frete')) {
      adicionarErro(
        erros,
        errosPorCampo,
        'frete',
        'Informe um valor de frete válido.'
      );
    }
    if (dados.totalProdutosCentavos === null || dados.totalGeralCentavos === null) {
      adicionarErro(
        erros,
        errosPorCampo,
        'totais',
        'A soma dos valores excede o limite permitido.'
      );
    }
    if (dados.formaEntrega === 'outra' && !dados.descricaoOutraForma) {
      adicionarErro(
        erros,
        errosPorCampo,
        'descricaoOutraForma',
        'Descreva a outra forma de entrega.'
      );
    }

    return {
      valido: erros.length === 0,
      erros: erros,
      errosPorCampo: errosPorCampo,
      dados: dados
    };
  }

  function juntarReferencias(referencias) {
    if (referencias.length < 2) return referencias[0] || '';
    return referencias.slice(0, -1).join(', ') + ' e ' + referencias[referencias.length - 1];
  }

  function comporDeclaracao(entrada) {
    var dados = normalizarDados(entrada);
    var referencias = [];
    if (dados.numeroNfe) referencias.push('à NF-e nº ' + dados.numeroNfe);
    if (dados.numeroPedido) referencias.push('ao pedido interno nº ' + dados.numeroPedido);
    if (dados.numeroVenda) referencias.push('à venda do marketplace nº ' + dados.numeroVenda);

    if (!referencias.length) {
      return 'Declaro, para os devidos fins, que recebi as mercadorias discriminadas neste comprovante.';
    }
    return 'Declaro, para os devidos fins, que recebi as mercadorias referentes ' +
      juntarReferencias(referencias) + ', conforme discriminado neste comprovante.';
  }

  function sanitizarTrechoArquivo(valor, limite) {
    var texto = textoLimpo(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_-]+|[_-]+$/g, '');
    return texto.slice(0, limite || 100);
  }

  function gerarNomeArquivo(entrada) {
    var dados = normalizarDados(entrada);
    var numero = sanitizarTrechoArquivo(
      dados.numeroNfe || dados.numeroPedido || dados.numeroVenda || 'sem_numero',
      100
    ) || 'sem_numero';
    var partes = partesData(dados.dataEntrega);
    var data = partes
      ? partes.ano + '-' + partes.mes + '-' + partes.dia
      : 'sem_data';
    return 'comprovante_entrega_' + numero + '_' + data + '.pdf';
  }

  function podeAcessar(usuario) {
    if (!usuario || usuario.ativo !== true) return false;
    var cargo = textoLimpo(usuario.cargo, 80).toLocaleLowerCase('pt-BR');
    return cargo === 'logistica' ||
      cargo === 'admin' ||
      usuario.pode_gerenciar_permissoes === true ||
      usuario.pode_acessar_cotacoes === true;
  }

  return Object.freeze({
    parseMoedaCentavos: parseMoedaCentavos,
    parseQuantidadeMillesimos: parseQuantidadeMillesimos,
    formatarMoeda: formatarMoeda,
    formatarMoedaInput: formatarMoedaInput,
    formatarQuantidade: formatarQuantidade,
    formatarQuantidadeInput: formatarQuantidadeInput,
    calcularTotalItem: calcularTotalItem,
    calcularTotais: calcularTotais,
    normalizarItem: normalizarItem,
    normalizarDados: normalizarDados,
    validar: validar,
    comporDeclaracao: comporDeclaracao,
    gerarNomeArquivo: gerarNomeArquivo,
    mascararCpf: mascararCpf,
    mascararCnpj: mascararCnpj,
    mascararCpfCnpj: mascararCpfCnpj,
    mascararCep: mascararCep,
    mascararChaveAcesso: mascararChaveAcesso,
    mascararData: mascararData,
    podeAcessar: podeAcessar
  });
});
