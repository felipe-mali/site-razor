(function carregarCotacoesModelo(root, factory) {
  'use strict';

  var financeiro = typeof module === 'object' && module.exports
    ? require('./cotacoes-financeiro')
    : root && root.CotacoesFinanceiro;
  var api = factory(financeiro, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CotacoesModelo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function criarCotacoesModelo(Financeiro, root) {
  'use strict';

  if (!Financeiro) throw new Error('CotacoesFinanceiro é obrigatório.');

  var sequencia = 0;

  function gerarId(prefixo) {
    if (root && root.crypto && typeof root.crypto.randomUUID === 'function') {
      return prefixo + '-' + root.crypto.randomUUID();
    }
    sequencia += 1;
    return prefixo + '-' + Date.now().toString(36) + '-' + sequencia.toString(36);
  }

  function chavePreco(produtoId, fornecedorId) {
    return Financeiro.chavePreco(produtoId, fornecedorId);
  }

  function criarEstado() {
    return {
      produtos: [],
      fornecedores: [],
      precos: {},
      impressao: {
        numero: '',
        descricao: '',
        elaboradoPor: '',
        aprovadoPor: '',
        data: ''
      }
    };
  }

  function exigirEstado(estado) {
    if (!estado || !Array.isArray(estado.produtos) || !Array.isArray(estado.fornecedores) ||
        !estado.precos || typeof estado.precos !== 'object') {
      throw new TypeError('Estado de cotação inválido.');
    }
  }

  function textoLimpo(valor, limite) {
    return String(valor === undefined || valor === null ? '' : valor).trim().slice(0, limite);
  }

  function idDisponivel(estado, colecao, id) {
    return !estado[colecao].some(function (registro) { return registro.id === id; });
  }

  function adicionarProduto(estado, dados) {
    exigirEstado(estado);
    dados = dados || {};
    var id = textoLimpo(dados.id, 160) || gerarId('produto');
    if (!idDisponivel(estado, 'produtos', id)) throw new Error('ID de produto duplicado.');
    var quantidade = Number.isSafeInteger(dados.quantidadeMillesimos) && dados.quantidadeMillesimos > 0
      ? dados.quantidadeMillesimos
      : 1000;
    var produto = {
      id: id,
      descricao: textoLimpo(dados.descricao, 240),
      quantidadeMillesimos: quantidade
    };
    estado.produtos.push(produto);
    estado.fornecedores.forEach(function (fornecedor) {
      estado.precos[chavePreco(produto.id, fornecedor.id)] = null;
    });
    return produto;
  }

  function duplicarProduto(estado, produtoId, dados) {
    exigirEstado(estado);
    var original = estado.produtos.find(function (produto) { return produto.id === produtoId; });
    if (!original) throw new Error('Produto não encontrado.');
    var duplicado = adicionarProduto(estado, {
      id: dados && dados.id,
      descricao: original.descricao,
      quantidadeMillesimos: original.quantidadeMillesimos
    });
    estado.fornecedores.forEach(function (fornecedor) {
      estado.precos[chavePreco(duplicado.id, fornecedor.id)] =
        estado.precos[chavePreco(original.id, fornecedor.id)] || null;
    });
    return duplicado;
  }

  function removerProduto(estado, produtoId) {
    exigirEstado(estado);
    var indice = estado.produtos.findIndex(function (produto) { return produto.id === produtoId; });
    if (indice < 0) return false;
    estado.produtos.splice(indice, 1);
    estado.fornecedores.forEach(function (fornecedor) {
      delete estado.precos[chavePreco(produtoId, fornecedor.id)];
    });
    return true;
  }

  function definirProduto(estado, produtoId, alteracoes) {
    exigirEstado(estado);
    var produto = estado.produtos.find(function (registro) { return registro.id === produtoId; });
    if (!produto) throw new Error('Produto não encontrado.');
    alteracoes = alteracoes || {};
    if (Object.prototype.hasOwnProperty.call(alteracoes, 'descricao')) {
      produto.descricao = textoLimpo(alteracoes.descricao, 240);
    }
    if (Object.prototype.hasOwnProperty.call(alteracoes, 'quantidadeMillesimos')) {
      produto.quantidadeMillesimos = Number.isSafeInteger(alteracoes.quantidadeMillesimos) &&
        alteracoes.quantidadeMillesimos > 0 ? alteracoes.quantidadeMillesimos : null;
    }
    return produto;
  }

  function adicionarFornecedor(estado, nome, opcoes) {
    exigirEstado(estado);
    opcoes = opcoes || {};
    var nomeLimpo = textoLimpo(nome, 160);
    if (!nomeLimpo) throw new Error('Informe o nome do fornecedor.');
    var id = textoLimpo(opcoes.id, 160) || gerarId('fornecedor');
    if (!idDisponivel(estado, 'fornecedores', id)) throw new Error('ID de fornecedor duplicado.');
    var fornecedor = { id: id, nome: nomeLimpo };
    estado.fornecedores.push(fornecedor);
    estado.produtos.forEach(function (produto) {
      estado.precos[chavePreco(produto.id, fornecedor.id)] = null;
    });
    return fornecedor;
  }

  function renomearFornecedor(estado, fornecedorId, nome) {
    exigirEstado(estado);
    var fornecedor = estado.fornecedores.find(function (registro) { return registro.id === fornecedorId; });
    if (!fornecedor) throw new Error('Fornecedor não encontrado.');
    var nomeLimpo = textoLimpo(nome, 160);
    if (!nomeLimpo) throw new Error('Informe o nome do fornecedor.');
    fornecedor.nome = nomeLimpo;
    return fornecedor;
  }

  function removerFornecedor(estado, fornecedorId) {
    exigirEstado(estado);
    var indice = estado.fornecedores.findIndex(function (fornecedor) { return fornecedor.id === fornecedorId; });
    if (indice < 0) return false;
    estado.fornecedores.splice(indice, 1);
    estado.produtos.forEach(function (produto) {
      delete estado.precos[chavePreco(produto.id, fornecedorId)];
    });
    return true;
  }

  function definirPreco(estado, produtoId, fornecedorId, centavos) {
    exigirEstado(estado);
    var produtoExiste = estado.produtos.some(function (produto) { return produto.id === produtoId; });
    var fornecedorExiste = estado.fornecedores.some(function (fornecedor) { return fornecedor.id === fornecedorId; });
    if (!produtoExiste || !fornecedorExiste) throw new Error('Relação produto-fornecedor inválida.');
    estado.precos[chavePreco(produtoId, fornecedorId)] = Number.isSafeInteger(centavos) && centavos > 0
      ? centavos
      : null;
    return estado.precos[chavePreco(produtoId, fornecedorId)];
  }

  function proximaChavePreco(estado, produtoId, fornecedorId) {
    exigirEstado(estado);
    var chaves = [];
    estado.produtos.forEach(function (produto) {
      estado.fornecedores.forEach(function (fornecedor) {
        chaves.push(chavePreco(produto.id, fornecedor.id));
      });
    });
    var atual = chaves.indexOf(chavePreco(produtoId, fornecedorId));
    return atual >= 0 && atual + 1 < chaves.length ? chaves[atual + 1] : null;
  }

  function limparEstado(estado) {
    exigirEstado(estado);
    estado.produtos.splice(0, estado.produtos.length);
    estado.fornecedores.splice(0, estado.fornecedores.length);
    estado.precos = {};
    estado.impressao = { numero: '', descricao: '', elaboradoPor: '', aprovadoPor: '', data: '' };
    return estado;
  }

  function calcular(estado) {
    exigirEstado(estado);
    return Financeiro.calcularCotacao(estado);
  }

  function podeAcessar(usuario) {
    return Boolean(usuario && usuario.ativo === true && (
      usuario.cargo === 'logistica' ||
      usuario.cargo === 'admin' ||
      usuario.pode_gerenciar_permissoes === true ||
      usuario.pode_acessar_cotacoes === true
    ));
  }

  return Object.freeze({
    chavePreco: chavePreco,
    criarEstado: criarEstado,
    adicionarProduto: adicionarProduto,
    duplicarProduto: duplicarProduto,
    removerProduto: removerProduto,
    definirProduto: definirProduto,
    adicionarFornecedor: adicionarFornecedor,
    renomearFornecedor: renomearFornecedor,
    removerFornecedor: removerFornecedor,
    definirPreco: definirPreco,
    proximaChavePreco: proximaChavePreco,
    limparEstado: limparEstado,
    calcular: calcular,
    podeAcessar: podeAcessar
  });
});
