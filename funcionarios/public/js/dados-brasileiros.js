(function carregarDadosBrasileiros(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DadosBrasileiros = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function criarDadosBrasileiros() {
  'use strict';

  var SENTINELAS_AUSENTES = Object.freeze({
    null: true,
    undefined: true,
    nan: true
  });

  function textoLiteral(valor) {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'number' && !Number.isFinite(valor)) return '';
    return String(valor).trim();
  }

  function textoSeguro(valor) {
    var texto = textoLiteral(valor);
    var chaveSentinela = texto.toLocaleLowerCase('pt-BR');
    if (
      !texto ||
      Object.prototype.hasOwnProperty.call(SENTINELAS_AUSENTES, chaveSentinela)
    ) return '';
    return texto;
  }

  function valorAusente(valor) {
    return textoSeguro(valor) === '';
  }

  function somenteNumeros(valor, limite) {
    var numeros = textoSeguro(valor).replace(/\D/g, '');
    if (Number.isSafeInteger(limite) && limite >= 0) return numeros.slice(0, limite);
    return numeros;
  }

  function todosIguais(numeros) {
    return Boolean(numeros) && new RegExp('^' + numeros.charAt(0) + '+$').test(numeros);
  }

  function digitoCpf(numeros, tamanho) {
    var soma = 0;
    for (var indice = 0; indice < tamanho; indice += 1) {
      soma += Number(numeros.charAt(indice)) * (tamanho + 1 - indice);
    }
    var resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  function validarCpf(valor) {
    var numeros = somenteNumeros(valor);
    if (numeros.length !== 11 || todosIguais(numeros)) return false;
    return digitoCpf(numeros, 9) === Number(numeros.charAt(9)) &&
      digitoCpf(numeros, 10) === Number(numeros.charAt(10));
  }

  function digitoCnpj(numeros, tamanho) {
    var pesos = tamanho === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var soma = 0;
    for (var indice = 0; indice < tamanho; indice += 1) {
      soma += Number(numeros.charAt(indice)) * pesos[indice];
    }
    var resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  function validarCnpj(valor) {
    var numeros = somenteNumeros(valor);
    if (numeros.length !== 14 || todosIguais(numeros)) return false;
    return digitoCnpj(numeros, 12) === Number(numeros.charAt(12)) &&
      digitoCnpj(numeros, 13) === Number(numeros.charAt(13));
  }

  function validarCpfCnpj(valor) {
    var numeros = somenteNumeros(valor);
    if (numeros.length === 11) return validarCpf(numeros);
    if (numeros.length === 14) return validarCnpj(numeros);
    return false;
  }

  function formatarCpf(valor) {
    if (!validarCpf(valor)) return '';
    var numeros = somenteNumeros(valor);
    return numeros.slice(0, 3) + '.' + numeros.slice(3, 6) + '.' +
      numeros.slice(6, 9) + '-' + numeros.slice(9);
  }

  function formatarCnpj(valor) {
    if (!validarCnpj(valor)) return '';
    var numeros = somenteNumeros(valor);
    return numeros.slice(0, 2) + '.' + numeros.slice(2, 5) + '.' +
      numeros.slice(5, 8) + '/' + numeros.slice(8, 12) + '-' + numeros.slice(12);
  }

  function formatarCpfCnpj(valor) {
    var numeros = somenteNumeros(valor);
    if (numeros.length === 11) return formatarCpf(numeros);
    if (numeros.length === 14) return formatarCnpj(numeros);
    return '';
  }

  function mascararCpfCnpjEntrada(valor) {
    var numeros = somenteNumeros(valor, 14);
    return formatarCpfCnpj(numeros) || numeros;
  }

  function separarTelefoneRamal(valor) {
    var texto = textoSeguro(valor);
    if (!texto) return { telefone: '', ramal: '' };

    var correspondencia = texto.match(
      /^(.*[\d)])\s*(?:ramal|ram\.?|r\.?|ext\.?|x)\s*[:.#-]?\s*(\d{1,10})\s*$/i
    );
    if (!correspondencia) return { telefone: texto, ramal: '' };
    return {
      telefone: correspondencia[1].trim(),
      ramal: correspondencia[2]
    };
  }

  function formatarTelefoneNacional(numeros) {
    if (numeros.length === 8) {
      return numeros.slice(0, 4) + '-' + numeros.slice(4);
    }
    if (numeros.length === 9) {
      return numeros.slice(0, 5) + '-' + numeros.slice(5);
    }
    if (numeros.length === 10) {
      return '(' + numeros.slice(0, 2) + ') ' + numeros.slice(2, 6) + '-' + numeros.slice(6);
    }
    if (numeros.length === 11) {
      return '(' + numeros.slice(0, 2) + ') ' + numeros.slice(2, 7) + '-' + numeros.slice(7);
    }
    return '';
  }

  function analisarTelefone(valor) {
    var partes = separarTelefoneRamal(valor);
    var numeros = somenteNumeros(partes.telefone);
    var codigoPais = '';
    var nacional = numeros;

    if ((numeros.length === 12 || numeros.length === 13) && numeros.slice(0, 2) === '55') {
      codigoPais = '55';
      nacional = numeros.slice(2);
    } else if (numeros.length === 12 || numeros.length === 13) {
      return {
        valido: false,
        numeros: numeros,
        nacional: '',
        codigoPais: '',
        ddd: '',
        ramal: partes.ramal,
        formatado: ''
      };
    }

    var formatadoNacional = formatarTelefoneNacional(nacional);
    var possuiDdd = nacional.length === 10 || nacional.length === 11;
    var valido = Boolean(formatadoNacional);
    return {
      valido: valido,
      numeros: valido ? codigoPais + nacional : numeros,
      nacional: valido ? nacional : '',
      codigoPais: valido ? codigoPais : '',
      ddd: valido && possuiDdd ? nacional.slice(0, 2) : '',
      ramal: partes.ramal,
      formatado: valido
        ? (codigoPais ? '+55 ' : '') + formatadoNacional
        : ''
    };
  }

  function validarTelefone(valor, opcoes) {
    opcoes = opcoes || {};
    var analise = analisarTelefone(valor);
    if (!analise.valido) return false;
    if (opcoes.permitirRamal === false && analise.ramal) return false;
    if (opcoes.exigirDdd && analise.nacional.length !== 10 && analise.nacional.length !== 11) {
      return false;
    }
    if (opcoes.permitirCodigoPais === false && analise.codigoPais) return false;
    return true;
  }

  function formatarTelefone(valor, opcoes) {
    opcoes = opcoes || {};
    if (!validarTelefone(valor, opcoes)) return '';
    var analise = analisarTelefone(valor);
    return analise.formatado + (analise.ramal ? ' ramal ' + analise.ramal : '');
  }

  function mascararTelefoneEntrada(valor) {
    var partes = separarTelefoneRamal(valor);
    var todosOsNumeros = somenteNumeros(partes.telefone);
    var limite = todosOsNumeros.slice(0, 2) === '55' ? 13 : 11;
    var numeros = todosOsNumeros.slice(0, limite);
    if (!numeros) return '';
    var formatado = formatarTelefone(
      numeros + (partes.ramal ? ' ramal ' + partes.ramal : '')
    );
    return formatado || numeros + (partes.ramal ? ' ramal ' + partes.ramal : '');
  }

  function normalizarTelefone(valor, opcoes) {
    opcoes = opcoes || {};
    if (!validarTelefone(valor, opcoes)) return '';
    var analise = analisarTelefone(valor);
    return analise.numeros + (analise.ramal ? ' ramal ' + analise.ramal : '');
  }

  function normalizarTipoChavePix(tipo) {
    var texto = textoSeguro(tipo)
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (texto === 'cpf') return 'CPF';
    if (texto === 'cnpj') return 'CNPJ';
    if (texto === 'telefone') return 'Telefone';
    if (texto === 'email' || texto === 'e-mail') return 'Email';
    if (texto === 'aleatoria' || texto === 'chave aleatoria') return 'Aleatoria';
    return '';
  }

  function validarChavePix(tipo, valor) {
    var tipoNormalizado = normalizarTipoChavePix(tipo);
    if (!tipoNormalizado) return false;
    if (tipoNormalizado === 'CPF') return validarCpf(valor);
    if (tipoNormalizado === 'CNPJ') return validarCnpj(valor);
    if (tipoNormalizado === 'Telefone') {
      return validarTelefone(valor, { exigirDdd: true, permitirRamal: false });
    }
    if (tipoNormalizado === 'Email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textoLiteral(valor));
    }
    return textoLiteral(valor).length > 0;
  }

  function erroChavePix(tipo, valor) {
    var tipoNormalizado = normalizarTipoChavePix(tipo);
    if (!tipoNormalizado) return 'Tipo de chave inválido.';
    var tipoNumerico = tipoNormalizado === 'CPF' ||
      tipoNormalizado === 'CNPJ' ||
      tipoNormalizado === 'Telefone';
    if (
      (tipoNumerico && valorAusente(valor)) ||
      (!tipoNumerico && !textoLiteral(valor))
    ) return 'Chave PIX é obrigatória.';
    if (validarChavePix(tipoNormalizado, valor)) return null;
    if (tipoNormalizado === 'CPF') return 'CPF inválido. Confira os 11 dígitos e os verificadores.';
    if (tipoNormalizado === 'CNPJ') return 'CNPJ inválido. Confira os 14 dígitos e os verificadores.';
    if (tipoNormalizado === 'Telefone') {
      return 'Telefone inválido. Informe DDD e 10 ou 11 números; o código +55 é opcional.';
    }
    if (tipoNormalizado === 'Email') return 'Formato de e-mail inválido.';
    return 'Chave aleatória não pode ser vazia.';
  }

  function normalizarChavePix(tipo, valor) {
    var tipoNormalizado = normalizarTipoChavePix(tipo);
    if (!validarChavePix(tipoNormalizado, valor)) return '';
    if (tipoNormalizado === 'CPF' || tipoNormalizado === 'CNPJ') return somenteNumeros(valor);
    if (tipoNormalizado === 'Telefone') return analisarTelefone(valor).nacional;
    return textoLiteral(valor);
  }

  function formatarChavePix(tipo, valor, vazio) {
    var tipoNormalizado = normalizarTipoChavePix(tipo);
    var fallback = vazio === undefined ? '' : textoSeguro(vazio);
    if (!validarChavePix(tipoNormalizado, valor)) return fallback;
    if (tipoNormalizado === 'CPF') return formatarCpf(valor);
    if (tipoNormalizado === 'CNPJ') return formatarCnpj(valor);
    if (tipoNormalizado === 'Telefone') {
      return formatarTelefone(valor, { exigirDdd: true, permitirRamal: false });
    }
    return textoLiteral(valor) || fallback;
  }

  function chavePixComparavel(tipo, valor) {
    var tipoNormalizado = normalizarTipoChavePix(tipo);
    var normalizada = normalizarChavePix(tipoNormalizado, valor);
    if (!tipoNormalizado || !normalizada) return '';
    return normalizada;
  }

  return Object.freeze({
    textoLiteral: textoLiteral,
    textoSeguro: textoSeguro,
    valorAusente: valorAusente,
    somenteNumeros: somenteNumeros,
    validarCpf: validarCpf,
    validarCnpj: validarCnpj,
    validarCpfCnpj: validarCpfCnpj,
    formatarCpf: formatarCpf,
    formatarCnpj: formatarCnpj,
    formatarCpfCnpj: formatarCpfCnpj,
    mascararCpfCnpjEntrada: mascararCpfCnpjEntrada,
    separarTelefoneRamal: separarTelefoneRamal,
    analisarTelefone: analisarTelefone,
    validarTelefone: validarTelefone,
    formatarTelefone: formatarTelefone,
    mascararTelefoneEntrada: mascararTelefoneEntrada,
    normalizarTelefone: normalizarTelefone,
    normalizarTipoChavePix: normalizarTipoChavePix,
    validarChavePix: validarChavePix,
    erroChavePix: erroChavePix,
    normalizarChavePix: normalizarChavePix,
    formatarChavePix: formatarChavePix,
    chavePixComparavel: chavePixComparavel
  });
});
