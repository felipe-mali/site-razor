(function iniciarCalculadoraCotacoes(window, document) {
  'use strict';

  var Financeiro = window.CotacoesFinanceiro;
  var Modelo = window.CotacoesModelo;
  var PrintView = window.CotacoesPrintView;
  var estado = Modelo ? Modelo.criarEstado() : null;
  var calculos = null;
  var elementos = {};
  var inicializado = false;
  var focoAntesDaPrevia = null;
  var timerStatus = null;
  var fornecedoresCadastrados = [];

  function porId(id) {
    return document.getElementById(id);
  }

  function escapar(valor) {
    return String(valor === undefined || valor === null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escaparSeletor(valor) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(valor));
    return String(valor).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function possuiAcesso() {
    return typeof window.usuarioAtualPodeAcessarCotacoes === 'function' &&
      window.usuarioAtualPodeAcessarCotacoes();
  }

  function mostrarAcessoNegado() {
    if (elementos.app) elementos.app.hidden = true;
    fecharPrevia();
    if (elementos.acessoNegado) {
      elementos.acessoNegado.hidden = false;
      elementos.acessoNegado.innerHTML =
        '<div class="cotacoes-access-card" role="alert">' +
          '<p class="cotacoes-eyebrow">Permissão necessária</p>' +
          '<h2>ACESSO NEGADO</h2>' +
          '<p>Você não possui permissão para acessar a Calculadora de Cotação de Preços.</p>' +
        '</div>';
    }
  }

  function autorizarOuNegar() {
    if (!possuiAcesso()) {
      mostrarAcessoNegado();
      return false;
    }
    if (elementos.app) elementos.app.hidden = false;
    if (elementos.acessoNegado) elementos.acessoNegado.hidden = true;
    return true;
  }

  function mostrarStatus(mensagem, tipo, temporario) {
    if (!elementos.status) return;
    window.clearTimeout(timerStatus);
    elementos.status.textContent = mensagem || '';
    elementos.status.dataset.state = tipo || 'info';
    if (temporario) {
      timerStatus = window.setTimeout(function () {
        atualizarStatusContagem();
      }, 2800);
    }
  }

  function atualizarStatusContagem() {
    if (!estado) return;
    mostrarStatus(
      estado.produtos.length + (estado.produtos.length === 1 ? ' produto' : ' produtos') +
      ' · ' + estado.fornecedores.length +
      (estado.fornecedores.length === 1 ? ' fornecedor' : ' fornecedores'),
      'info',
      false
    );
  }

  function fornecedorPorId(id) {
    return estado.fornecedores.find(function (fornecedor) { return fornecedor.id === id; });
  }

  function produtoCalculadoPorId(id) {
    return calculos && calculos.produtos.find(function (produto) { return produto.produtoId === id; });
  }

  function fornecedorCalculadoPorId(id) {
    return calculos && calculos.fornecedores.find(function (fornecedor) { return fornecedor.fornecedorId === id; });
  }

  function rotuloPreco(produto, fornecedor, menorPreco) {
    return 'Valor unitário de ' + (produto.descricao || 'produto sem descrição') +
      ' em ' + (fornecedor.nome || 'Fornecedor') +
      (menorPreco ? '. Menor preço desta linha' : '');
  }

  function atualizarRotulosPrecos(produtoId, fornecedorId) {
    var produtos = produtoId
      ? estado.produtos.filter(function (produto) { return produto.id === produtoId; })
      : estado.produtos;
    var fornecedores = fornecedorId
      ? estado.fornecedores.filter(function (fornecedor) { return fornecedor.id === fornecedorId; })
      : estado.fornecedores;

    produtos.forEach(function (produto) {
      var produtoCalculado = produtoCalculadoPorId(produto.id);
      fornecedores.forEach(function (fornecedor) {
        var chave = escaparSeletor(Modelo.chavePreco(produto.id, fornecedor.id));
        var input = elementos.tabela.querySelector('[data-preco-chave="' + chave + '"]');
        var preco = produtoCalculado && produtoCalculado.porFornecedor[fornecedor.id];
        if (input) input.setAttribute('aria-label', rotuloPreco(produto, fornecedor, Boolean(preco && preco.menorPreco)));
      });
    });
  }

  function celulaPrecoHtml(produto, fornecedor, calculado) {
    var chave = Modelo.chavePreco(produto.id, fornecedor.id);
    var preco = estado.precos[chave];
    var menor = Boolean(calculado && calculado.menorPreco);
    return '' +
      '<td class="cotacoes-col-supplier cotacoes-price-cell" data-preco-celula="' + escapar(chave) + '" data-best="' + menor + '">' +
        '<label class="cotacoes-money-input">' +
          '<span aria-hidden="true">R$</span>' +
          '<input type="text" inputmode="decimal" autocomplete="off" ' +
            'data-preco-chave="' + escapar(chave) + '" data-produto-id="' + escapar(produto.id) + '" ' +
            'data-fornecedor-id="' + escapar(fornecedor.id) + '" value="' + escapar(Financeiro.formatarMoedaInput(preco)) + '" ' +
            'aria-label="' + escapar(rotuloPreco(produto, fornecedor, menor)) + '">' +
        '</label>' +
        '<span class="cotacoes-best-marker"' + (menor ? '' : ' hidden') + '>Menor</span>' +
      '</td>' +
      '<td class="cotacoes-col-supplier cotacoes-readonly-money" data-total-chave="' + escapar(chave) + '">' +
        Financeiro.formatarMoeda(calculado && calculado.valorTotalCentavos, '') +
      '</td>';
  }

  function linhaProdutoHtml(produto, indice) {
    var calculado = produtoCalculadoPorId(produto.id);
    var fornecedoresHtml = estado.fornecedores.map(function (fornecedor) {
      return celulaPrecoHtml(produto, fornecedor, calculado && calculado.porFornecedor[fornecedor.id]);
    }).join('');
    return '' +
      '<tr data-produto-linha="' + escapar(produto.id) + '">' +
        '<th scope="row" class="cotacoes-col-number">' + (indice + 1) + '</th>' +
        '<td class="cotacoes-col-item">' +
          '<label class="sr-only" for="produto-' + escapar(produto.id) + '">Descrição do produto ' + (indice + 1) + '</label>' +
          '<input id="produto-' + escapar(produto.id) + '" class="cotacoes-product-input" type="text" maxlength="240" ' +
            'data-produto-descricao="' + escapar(produto.id) + '" value="' + escapar(produto.descricao) + '" placeholder="Descrição do produto" autocomplete="off">' +
          '<span class="cotacoes-row-actions">' +
            '<button type="button" data-acao="duplicar-produto" data-produto-id="' + escapar(produto.id) + '">Duplicar</button>' +
            '<button type="button" data-acao="remover-produto" data-produto-id="' + escapar(produto.id) + '">Remover</button>' +
          '</span>' +
        '</td>' +
        '<td class="cotacoes-col-quantity">' +
          '<label class="sr-only" for="quantidade-' + escapar(produto.id) + '">Quantidade de ' + escapar(produto.descricao || 'produto ' + (indice + 1)) + '</label>' +
          '<input id="quantidade-' + escapar(produto.id) + '" class="cotacoes-quantity-input" type="text" inputmode="decimal" autocomplete="off" ' +
            'data-produto-quantidade="' + escapar(produto.id) + '" value="' + escapar(Financeiro.formatarQuantidade(produto.quantidadeMillesimos, '')) + '" aria-label="Quantidade do produto ' + (indice + 1) + '">' +
        '</td>' +
        fornecedoresHtml +
        '<td class="cotacoes-col-ideal cotacoes-readonly-money" data-ideal-unitario="' + escapar(produto.id) + '">' +
          Financeiro.formatarMoeda(calculado && calculado.menorValorUnitarioCentavos, '') +
        '</td>' +
        '<td class="cotacoes-col-ideal cotacoes-readonly-money" data-ideal-total="' + escapar(produto.id) + '">' +
          Financeiro.formatarMoeda(calculado && calculado.custoIdealTotalCentavos, '') +
        '</td>' +
      '</tr>';
  }

  function cabecalhoFornecedorHtml(fornecedor) {
    return '' +
      '<th class="cotacoes-col-supplier cotacoes-supplier-group" colspan="2" scope="colgroup">' +
        '<div class="cotacoes-supplier-head">' +
          '<label class="sr-only" for="fornecedor-' + escapar(fornecedor.id) + '">Nome do fornecedor</label>' +
          '<input id="fornecedor-' + escapar(fornecedor.id) + '" class="cotacoes-supplier-name" type="text" maxlength="160" value="' + escapar(fornecedor.nome) + '" ' +
            'data-fornecedor-nome="' + escapar(fornecedor.id) + '" aria-label="Nome do fornecedor ' + escapar(fornecedor.nome) + '">' +
          '<button type="button" data-acao="remover-fornecedor" data-fornecedor-id="' + escapar(fornecedor.id) + '" aria-label="Remover fornecedor ' + escapar(fornecedor.nome) + '">Remover</button>' +
          '<label class="cotacoes-supplier-term" for="prazo-fornecedor-' + escapar(fornecedor.id) + '">' +
            '<span>Prazo</span>' +
            '<input id="prazo-fornecedor-' + escapar(fornecedor.id) + '" type="text" maxlength="120" autocomplete="off" ' +
              'data-fornecedor-prazo="' + escapar(fornecedor.id) + '" value="' + escapar(fornecedor.prazoEntrega || '') + '" ' +
              'placeholder="Prazo não informado">' +
          '</label>' +
        '</div>' +
      '</th>';
  }

  function rodapeFornecedorHtml(fornecedor) {
    var calculado = fornecedorCalculadoPorId(fornecedor.id);
    var completo = Boolean(calculado && calculado.completo);
    var pendencia = calculado && calculado.faltantes
      ? calculado.faltantes + (calculado.faltantes === 1 ? ' preço pendente' : ' preços pendentes')
      : 'Cotação completa';
    return '' +
      '<td class="cotacoes-supplier-total" colspan="2">' +
        '<strong data-total-fornecedor="' + escapar(fornecedor.id) + '">' + Financeiro.formatarMoeda(calculado && calculado.totalCentavos, 'R$ 0,00') + '</strong>' +
        '<small data-completude-fornecedor="' + escapar(fornecedor.id) + '" data-complete="' + completo + '">' + escapar(pendencia) + '</small>' +
      '</td>';
  }

  function renderizarTabela(foco) {
    if (!elementos.tabela || !estado) return;
    calculos = Modelo.calcular(estado);
    var fornecedoresCabecalho = estado.fornecedores.map(cabecalhoFornecedorHtml).join('');
    var subcabecalhos = estado.fornecedores.map(function () {
      return '<th class="cotacoes-col-supplier" scope="col">Valor unitário</th><th class="cotacoes-col-supplier" scope="col">Valor total</th>';
    }).join('');
    var quantidadeColunas = 5 + estado.fornecedores.length * 2;
    var corpo = estado.produtos.length
      ? estado.produtos.map(linhaProdutoHtml).join('')
      : '<tr><td class="cotacoes-empty-row" colspan="' + quantidadeColunas + '">Adicione um produto para começar a comparação.</td></tr>';
    var totais = estado.fornecedores.map(rodapeFornecedorHtml).join('');

    elementos.tabela.innerHTML = '' +
      '<table class="cotacoes-sheet-table">' +
        '<caption class="sr-only">Planilha temporária de comparação de preços por produto e fornecedor</caption>' +
        '<thead>' +
          '<tr>' +
            '<th class="cotacoes-col-number" rowspan="2" scope="col">Nº</th>' +
            '<th class="cotacoes-col-item" rowspan="2" scope="col">Produto</th>' +
            '<th class="cotacoes-col-quantity" rowspan="2" scope="col">Quantidade</th>' +
            fornecedoresCabecalho +
            '<th class="cotacoes-col-ideal" colspan="2" scope="colgroup">Custo ideal</th>' +
          '</tr>' +
          '<tr>' + subcabecalhos +
            '<th class="cotacoes-col-ideal" scope="col">Valor unitário</th>' +
            '<th class="cotacoes-col-ideal" scope="col">Valor total</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + corpo + '</tbody>' +
        '<tfoot><tr class="cotacoes-totals-row">' +
          '<th colspan="3" scope="row">Totais</th>' + totais +
          '<td class="cotacoes-ideal-total" colspan="2"><strong data-custo-ideal-total>' +
            Financeiro.formatarMoeda(calculos.custoIdealTotalCentavos, '') +
          '</strong><small>Custo ideal total</small></td>' +
        '</tr></tfoot>' +
      '</table>';

    renderizarResumo();
    atualizarStatusContagem();
    if (foco) {
      window.requestAnimationFrame(function () {
        var seletor = foco.tipo === 'produto'
          ? '[data-produto-descricao="' + escaparSeletor(foco.id) + '"]'
          : '[data-fornecedor-nome="' + escaparSeletor(foco.id) + '"]';
        var alvo = elementos.tabela.querySelector(seletor);
        if (alvo) {
          alvo.focus();
          if (typeof alvo.select === 'function') alvo.select();
        }
      });
    }
  }

  function nomesFornecedores(ids) {
    return ids.map(function (id) {
      var fornecedor = fornecedorPorId(id);
      return fornecedor ? fornecedor.nome : '';
    }).filter(Boolean).join(', ');
  }

  function renderizarResumo() {
    if (!elementos.resumo || !calculos) return;
    var recomendados = nomesFornecedores(calculos.fornecedoresRecomendados);
    var textoRecomendado = recomendados || 'Nenhum fornecedor possui preços para todos os produtos.';
    elementos.resumo.innerHTML = '' +
      '<div class="cotacoes-summary-item cotacoes-summary-recommended"><span>Fornecedor recomendado</span><strong>' + escapar(textoRecomendado) + '</strong></div>' +
      '<div class="cotacoes-summary-item"><span>Total recomendado</span><strong>' + Financeiro.formatarMoeda(calculos.totalRecomendadoCentavos) + '</strong></div>' +
      '<div class="cotacoes-summary-item cotacoes-summary-discount"><span>Desconto sugerido</span><strong>' + Financeiro.formatarMoeda(calculos.descontoSugeridoCentavos) + '</strong></div>' +
      '<div class="cotacoes-summary-item"><span>Percentual de negociação</span><strong>' + Financeiro.formatarPercentualBasisPoints(calculos.percentualNegociacaoBasisPoints) + '</strong></div>';
  }

  function atualizarProdutoNaTabela(produto) {
    var produtoEstado = estado.produtos.find(function (registro) {
      return registro.id === produto.produtoId;
    });

    estado.fornecedores.forEach(function (fornecedor) {
      var chave = Modelo.chavePreco(produto.produtoId, fornecedor.id);
      var seletorChave = escaparSeletor(chave);
      var preco = produto.porFornecedor[fornecedor.id];
      var celula = elementos.tabela.querySelector('[data-preco-celula="' + seletorChave + '"]');
      var total = elementos.tabela.querySelector('[data-total-chave="' + seletorChave + '"]');
      var input = elementos.tabela.querySelector('[data-preco-chave="' + seletorChave + '"]');
      if (celula) {
        celula.dataset.best = String(Boolean(preco.menorPreco));
        var marcador = celula.querySelector('.cotacoes-best-marker');
        if (marcador) marcador.hidden = !preco.menorPreco;
      }
      if (total) total.textContent = Financeiro.formatarMoeda(preco.valorTotalCentavos, '');
      if (input) {
        input.setAttribute('aria-label', rotuloPreco(produtoEstado || {}, fornecedor, preco.menorPreco));
      }
    });

    var idealUnitario = elementos.tabela.querySelector('[data-ideal-unitario="' + escaparSeletor(produto.produtoId) + '"]');
    var idealTotal = elementos.tabela.querySelector('[data-ideal-total="' + escaparSeletor(produto.produtoId) + '"]');
    if (idealUnitario) idealUnitario.textContent = Financeiro.formatarMoeda(produto.menorValorUnitarioCentavos, '');
    if (idealTotal) idealTotal.textContent = Financeiro.formatarMoeda(produto.custoIdealTotalCentavos, '');
  }

  function atualizarFornecedorNaTabela(fornecedor) {
    var seletorId = escaparSeletor(fornecedor.fornecedorId);
    var total = elementos.tabela.querySelector('[data-total-fornecedor="' + seletorId + '"]');
    var completude = elementos.tabela.querySelector('[data-completude-fornecedor="' + seletorId + '"]');
    if (total) total.textContent = Financeiro.formatarMoeda(fornecedor.totalCentavos, 'R$ 0,00');
    if (completude) {
      completude.dataset.complete = String(fornecedor.completo);
      completude.textContent = fornecedor.completo
        ? 'Cotação completa'
        : fornecedor.faltantes + (fornecedor.faltantes === 1 ? ' preço pendente' : ' preços pendentes');
    }
  }

  function atualizarCalculosNaTabela(alteracao) {
    calculos = Modelo.calcular(estado);
    alteracao = alteracao || {};

    var produtosAfetados = alteracao.produtoId
      ? calculos.produtos.filter(function (produto) { return produto.produtoId === alteracao.produtoId; })
      : calculos.produtos;
    produtosAfetados.forEach(atualizarProdutoNaTabela);

    var fornecedoresAfetados = alteracao.fornecedorId
      ? calculos.fornecedores.filter(function (fornecedor) {
        return fornecedor.fornecedorId === alteracao.fornecedorId;
      })
      : calculos.fornecedores;
    fornecedoresAfetados.forEach(atualizarFornecedorNaTabela);

    var custoIdeal = elementos.tabela.querySelector('[data-custo-ideal-total]');
    if (custoIdeal) custoIdeal.textContent = Financeiro.formatarMoeda(calculos.custoIdealTotalCentavos, '');
    renderizarResumo();
  }

  function adicionarProduto() {
    if (!autorizarOuNegar()) return;
    var produto = Modelo.adicionarProduto(estado, { quantidadeMillesimos: 1000 });
    renderizarTabela({ tipo: 'produto', id: produto.id });
    mostrarStatus('Produto adicionado. Preencha a descrição e a quantidade.', 'success', true);
  }

  function inserirFornecedorNaCotacao(nome) {
    nome = (nome || '').trim();
    if (!nome) return false;
    var duplicado = estado.fornecedores.some(function (fornecedor) {
      return fornecedor.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR');
    });
    if (duplicado) {
      mostrarStatus('Esse fornecedor já está nesta cotação.', 'error', true);
      return false;
    }
    var fornecedor = Modelo.adicionarFornecedor(estado, nome);
    renderizarTabela({ tipo: 'fornecedor', id: fornecedor.id });
    mostrarStatus('Fornecedor adicionado à planilha.', 'success', true);
    return true;
  }

  function nomeFornecedorCadastrado(fornecedor) {
    return (fornecedor.apelido || fornecedor.nome || '').trim();
  }

  function renderizarFornecedoresCadastrados() {
    if (!fornecedoresCadastrados.length) {
      elementos.fornecedorLista.innerHTML = '<p class="cotacoes-supplier-empty">Nenhum fornecedor cadastrado. Cadastre o primeiro abaixo.</p>';
      return;
    }
    elementos.fornecedorLista.innerHTML = fornecedoresCadastrados.map(function (fornecedor) {
      return '<button type="button" class="cotacoes-supplier-option" data-selecionar-fornecedor="' + escapar(fornecedor.id) + '">' +
        '<strong>' + escapar(nomeFornecedorCadastrado(fornecedor)) + '</strong>' +
        '<small>' + escapar(fornecedor.forma_pagamento || 'PIX') + '</small></button>';
    }).join('');
  }

  async function carregarFornecedoresCadastrados() {
    var resposta = await window.fetch('/api/fornecedores-pagamento', {
      headers: { 'Authorization': 'Bearer ' + window.localStorage.getItem('token') }
    });
    if (resposta.status === 401) {
      window.localStorage.removeItem('token');
      window.localStorage.removeItem('user');
      window.location.href = 'login.html';
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    if (!resposta.ok) throw new Error('Não foi possível carregar os fornecedores.');
    fornecedoresCadastrados = (await resposta.json()).fornecedores || [];
    renderizarFornecedoresCadastrados();
  }

  function fecharModalFornecedor() {
    elementos.fornecedorModal.hidden = true;
    elementos.fornecedorForm.hidden = true;
    elementos.fornecedorNovo.hidden = false;
    elementos.fornecedorErro.textContent = '';
  }

  async function adicionarFornecedor() {
    if (!autorizarOuNegar()) return;
    elementos.fornecedorModal.hidden = false;
    elementos.fornecedorLista.innerHTML = '<p class="cotacoes-supplier-empty">Carregando fornecedores...</p>';
    try {
      await carregarFornecedoresCadastrados();
    } catch (erro) {
      elementos.fornecedorLista.innerHTML = '<p class="cotacoes-supplier-error">' + escapar(erro.message) + '</p>';
    }
  }

  function selecionarFornecedorCadastrado(evento) {
    var botao = evento.target.closest('[data-selecionar-fornecedor]');
    if (!botao) return;
    var fornecedor = fornecedoresCadastrados.find(function (item) {
      return item.id === botao.dataset.selecionarFornecedor;
    });
    if (fornecedor && inserirFornecedorNaCotacao(nomeFornecedorCadastrado(fornecedor))) fecharModalFornecedor();
  }

  function atualizarCamposPixFornecedor() {
    var usaPix = elementos.fornecedorForma.value === 'PIX';
    elementos.fornecedorCamposPix.hidden = !usaPix;
    elementos.fornecedorTipo.required = usaPix;
    elementos.fornecedorChave.required = usaPix;
  }

  async function salvarNovoFornecedor(evento) {
    evento.preventDefault();
    elementos.fornecedorErro.textContent = '';
    var body = {
      nome: elementos.fornecedorNome.value.trim(),
      apelido: elementos.fornecedorApelido.value.trim(),
      forma_pagamento: elementos.fornecedorForma.value,
      tipo_pix: elementos.fornecedorForma.value === 'PIX' ? elementos.fornecedorTipo.value : '',
      chave_pix: elementos.fornecedorForma.value === 'PIX' ? elementos.fornecedorChave.value.trim() : ''
    };
    try {
      var resposta = await window.fetch('/api/fornecedores-pagamento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + window.localStorage.getItem('token')
        },
        body: JSON.stringify(body)
      });
      var data = await resposta.json();
      if (!resposta.ok) throw new Error(data.error || 'Não foi possível salvar o fornecedor.');
      fornecedoresCadastrados.push(data.fornecedor);
      inserirFornecedorNaCotacao(nomeFornecedorCadastrado(data.fornecedor));
      elementos.fornecedorForm.reset();
      atualizarCamposPixFornecedor();
      fecharModalFornecedor();
    } catch (erro) {
      elementos.fornecedorErro.textContent = erro.message;
    }
  }

  function removerFornecedor(fornecedorId) {
    var fornecedor = fornecedorPorId(fornecedorId);
    if (!fornecedor) return;
    var possuiPrecos = estado.produtos.some(function (produto) {
      return Number.isSafeInteger(estado.precos[Modelo.chavePreco(produto.id, fornecedorId)]) &&
        estado.precos[Modelo.chavePreco(produto.id, fornecedorId)] > 0;
    });
    if (possuiPrecos && !window.confirm('Remover ' + fornecedor.nome + '? Todos os preços informados para ele serão removidos.')) return;
    Modelo.removerFornecedor(estado, fornecedorId);
    renderizarTabela();
    mostrarStatus('Fornecedor removido.', 'success', true);
  }

  function removerProduto(produtoId) {
    Modelo.removerProduto(estado, produtoId);
    renderizarTabela();
    mostrarStatus('Produto removido.', 'success', true);
  }

  function duplicarProduto(produtoId) {
    var duplicado = Modelo.duplicarProduto(estado, produtoId);
    renderizarTabela({ tipo: 'produto', id: duplicado.id });
    mostrarStatus('Produto duplicado com seus preços.', 'success', true);
  }

  function limparTabela() {
    if (!autorizarOuNegar()) return;
    if (!window.confirm('Limpar toda a tabela? Produtos, fornecedores, preços e dados de impressão serão perdidos.')) return;
    Modelo.limparEstado(estado);
    sincronizarCamposImpressao();
    renderizarTabela();
    mostrarStatus('Tabela limpa.', 'success', true);
  }

  function sincronizarCamposImpressao() {
    var mapa = {
      numero: elementos.numero,
      descricao: elementos.descricao,
      elaboradoPor: elementos.elaboradoPor,
      aprovadoPor: elementos.aprovadoPor,
      data: elementos.data
    };
    Object.keys(mapa).forEach(function (campo) {
      if (mapa[campo]) mapa[campo].value = estado.impressao[campo] || '';
    });
  }

  function abrirPrevia() {
    if (!autorizarOuNegar()) return;
    if (!estado.produtos.length || !estado.fornecedores.length) {
      mostrarStatus('Adicione ao menos um produto e um fornecedor antes de imprimir.', 'error', true);
      return;
    }
    calculos = Modelo.calcular(estado);
    focoAntesDaPrevia = document.activeElement;
    elementos.documentoImpressao.innerHTML = PrintView.renderizar(estado, {
      emitidoEm: new Date().toISOString()
    });
    elementos.previa.hidden = false;
    document.body.classList.add('cotacoes-preview-open');
    elementos.fecharPrevia.focus();
  }

  function fecharPrevia() {
    if (!elementos.previa || elementos.previa.hidden) return;
    elementos.previa.hidden = true;
    document.body.classList.remove('cotacoes-preview-open', 'cotacoes-printing');
    if (focoAntesDaPrevia && typeof focoAntesDaPrevia.focus === 'function') focoAntesDaPrevia.focus();
    focoAntesDaPrevia = null;
  }

  function imprimir() {
    if (!autorizarOuNegar()) return;
    document.body.classList.add('cotacoes-printing');
    window.print();
  }

  function focaveisPrevia() {
    return Array.prototype.slice.call(elementos.previa.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (elemento) { return !elemento.hidden; });
  }

  function aoDigitarTabela(evento) {
    if (!possuiAcesso()) {
      mostrarAcessoNegado();
      return;
    }
    var alvo = evento.target;
    if (alvo.matches('[data-produto-descricao]')) {
      Modelo.definirProduto(estado, alvo.dataset.produtoDescricao, { descricao: alvo.value });
      atualizarRotulosPrecos(alvo.dataset.produtoDescricao, null);
      return;
    }
    if (alvo.matches('[data-produto-quantidade]')) {
      var quantidade = Financeiro.parseQuantidadeMillesimos(alvo.value);
      var quantidadeValida = Number.isSafeInteger(quantidade) && quantidade > 0;
      alvo.setAttribute('aria-invalid', String(Boolean(alvo.value.trim()) && !quantidadeValida));
      Modelo.definirProduto(estado, alvo.dataset.produtoQuantidade, {
        quantidadeMillesimos: quantidadeValida ? quantidade : null
      });
      atualizarCalculosNaTabela({ produtoId: alvo.dataset.produtoQuantidade });
      return;
    }
    if (alvo.matches('[data-preco-chave]')) {
      var centavos = Financeiro.parseMoedaCentavos(alvo.value);
      var invalido = Boolean(alvo.value.trim()) && centavos === null;
      alvo.setAttribute('aria-invalid', String(invalido));
      Modelo.definirPreco(
        estado,
        alvo.dataset.produtoId,
        alvo.dataset.fornecedorId,
        Number.isSafeInteger(centavos) && centavos > 0 ? centavos : null
      );
      atualizarCalculosNaTabela({
        produtoId: alvo.dataset.produtoId,
        fornecedorId: alvo.dataset.fornecedorId
      });
      return;
    }
    if (alvo.matches('[data-fornecedor-prazo]')) {
      Modelo.definirPrazoEntrega(estado, alvo.dataset.fornecedorPrazo, alvo.value);
      return;
    }
    if (alvo.matches('[data-fornecedor-nome]') && alvo.value.trim()) {
      Modelo.renomearFornecedor(estado, alvo.dataset.fornecedorNome, alvo.value);
      atualizarRotulosPrecos(null, alvo.dataset.fornecedorNome);
      renderizarResumo();
    }
  }

  function aoSairDaCelula(evento) {
    if (!possuiAcesso()) {
      mostrarAcessoNegado();
      return;
    }
    var alvo = evento.target;
    if (alvo.matches('[data-preco-chave]')) {
      var centavos = Financeiro.parseMoedaCentavos(alvo.value);
      if (centavos !== null) alvo.value = Financeiro.formatarMoedaInput(centavos);
    } else if (alvo.matches('[data-produto-quantidade]')) {
      var quantidade = Financeiro.parseQuantidadeMillesimos(alvo.value);
      if (quantidade !== null && quantidade > 0) alvo.value = Financeiro.formatarQuantidade(quantidade, '');
    } else if (alvo.matches('[data-fornecedor-prazo]')) {
      var fornecedorPrazo = fornecedorPorId(alvo.dataset.fornecedorPrazo);
      if (fornecedorPrazo) {
        Modelo.definirPrazoEntrega(estado, fornecedorPrazo.id, alvo.value);
        alvo.value = fornecedorPrazo.prazoEntrega;
      }
    } else if (alvo.matches('[data-fornecedor-nome]')) {
      var fornecedor = fornecedorPorId(alvo.dataset.fornecedorNome);
      if (!alvo.value.trim() && fornecedor) {
        alvo.value = fornecedor.nome;
        mostrarStatus('O fornecedor precisa ter um nome.', 'error', true);
      } else if (fornecedor) {
        Modelo.renomearFornecedor(estado, fornecedor.id, alvo.value);
        alvo.value = fornecedor.nome;
        atualizarRotulosPrecos(null, fornecedor.id);
      }
    }
  }

  function aoClicarTabela(evento) {
    if (!possuiAcesso()) {
      evento.preventDefault();
      mostrarAcessoNegado();
      return;
    }
    var botao = evento.target.closest('button[data-acao]');
    if (!botao) return;
    if (botao.dataset.acao === 'remover-produto') removerProduto(botao.dataset.produtoId);
    if (botao.dataset.acao === 'duplicar-produto') duplicarProduto(botao.dataset.produtoId);
    if (botao.dataset.acao === 'remover-fornecedor') removerFornecedor(botao.dataset.fornecedorId);
  }

  function aoPressionarTeclaTabela(evento) {
    if (!possuiAcesso()) {
      evento.preventDefault();
      mostrarAcessoNegado();
      return;
    }
    var alvo = evento.target;
    if (evento.key !== 'Enter' || !alvo.matches('[data-preco-chave]')) return;
    evento.preventDefault();
    var proxima = Modelo.proximaChavePreco(estado, alvo.dataset.produtoId, alvo.dataset.fornecedorId);
    if (proxima) {
      var proximoInput = elementos.tabela.querySelector('[data-preco-chave="' + escaparSeletor(proxima) + '"]');
      if (proximoInput) {
        proximoInput.focus();
        proximoInput.select();
      }
    } else {
      elementos.adicionarProduto.focus();
    }
  }

  function aoEditarMetadados(evento) {
    if (!possuiAcesso()) {
      mostrarAcessoNegado();
      return;
    }
    var campo = evento.target.dataset.impressaoCampo;
    if (campo && Object.prototype.hasOwnProperty.call(estado.impressao, campo)) {
      estado.impressao[campo] = evento.target.value;
    }
  }

  function aoPressionarTeclaDocumento(evento) {
    if (!elementos.previa || elementos.previa.hidden) return;
    if (evento.key === 'Escape') {
      evento.preventDefault();
      fecharPrevia();
      return;
    }
    if (evento.key !== 'Tab') return;
    var focaveis = focaveisPrevia();
    if (!focaveis.length) return;
    var primeiro = focaveis[0];
    var ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  function registrarEventos() {
    elementos.adicionarProduto.addEventListener('click', adicionarProduto);
    elementos.adicionarFornecedor.addEventListener('click', adicionarFornecedor);
    elementos.fornecedorFechar.addEventListener('click', fecharModalFornecedor);
    elementos.fornecedorCancelar.addEventListener('click', fecharModalFornecedor);
    elementos.fornecedorNovo.addEventListener('click', function () {
      elementos.fornecedorNovo.hidden = true;
      elementos.fornecedorForm.hidden = false;
      atualizarCamposPixFornecedor();
      elementos.fornecedorNome.focus();
    });
    elementos.fornecedorLista.addEventListener('click', selecionarFornecedorCadastrado);
    elementos.fornecedorForma.addEventListener('change', atualizarCamposPixFornecedor);
    elementos.fornecedorForm.addEventListener('submit', salvarNovoFornecedor);
    elementos.fornecedorModal.addEventListener('click', function (evento) {
      if (evento.target === elementos.fornecedorModal) fecharModalFornecedor();
    });
    elementos.limpar.addEventListener('click', limparTabela);
    elementos.imprimir.addEventListener('click', abrirPrevia);
    elementos.fecharPrevia.addEventListener('click', fecharPrevia);
    elementos.executarImpressao.addEventListener('click', imprimir);
    elementos.tabela.addEventListener('input', aoDigitarTabela);
    elementos.tabela.addEventListener('change', aoSairDaCelula);
    elementos.tabela.addEventListener('click', aoClicarTabela);
    elementos.tabela.addEventListener('keydown', aoPressionarTeclaTabela);
    elementos.app.addEventListener('input', aoEditarMetadados);
    document.addEventListener('keydown', aoPressionarTeclaDocumento);
    window.addEventListener('afterprint', function () { document.body.classList.remove('cotacoes-printing'); });
  }

  function inicializar() {
    if (inicializado) return true;
    elementos = {
      acessoNegado: porId('cotacoes-acesso-negado'),
      app: porId('cotacoes-app'),
      adicionarProduto: porId('cotacoes-adicionar-item'),
      adicionarFornecedor: porId('cotacoes-adicionar-fornecedor'),
      fornecedorModal: porId('cotacoes-fornecedor-modal'),
      fornecedorFechar: porId('cotacoes-fornecedor-fechar'),
      fornecedorLista: porId('cotacoes-fornecedor-lista'),
      fornecedorNovo: porId('cotacoes-fornecedor-novo'),
      fornecedorForm: porId('cotacoes-fornecedor-form'),
      fornecedorNome: porId('cotacoes-fornecedor-nome'),
      fornecedorApelido: porId('cotacoes-fornecedor-apelido'),
      fornecedorForma: porId('cotacoes-fornecedor-forma'),
      fornecedorCamposPix: porId('cotacoes-fornecedor-campos-pix'),
      fornecedorTipo: porId('cotacoes-fornecedor-tipo'),
      fornecedorChave: porId('cotacoes-fornecedor-chave'),
      fornecedorErro: porId('cotacoes-fornecedor-erro'),
      fornecedorCancelar: porId('cotacoes-fornecedor-cancelar'),
      limpar: porId('cotacoes-limpar'),
      imprimir: porId('cotacoes-imprimir'),
      status: porId('cotacoes-sheet-status'),
      tabela: porId('cotacoes-tabela-wrap'),
      resumo: porId('cotacoes-resumo'),
      numero: porId('cotacao-numero'),
      descricao: porId('cotacao-descricao'),
      elaboradoPor: porId('cotacao-elaborado-por'),
      aprovadoPor: porId('cotacao-aprovado-por'),
      data: porId('cotacao-data'),
      previa: porId('cotacoes-print-preview'),
      fecharPrevia: porId('cotacoes-print-fechar'),
      executarImpressao: porId('cotacoes-print-executar'),
      documentoImpressao: porId('cotacoes-print-document')
    };
    if (!Financeiro || !Modelo || !PrintView || !elementos.app || !elementos.tabela) return false;
    registrarEventos();
    sincronizarCamposImpressao();
    renderizarTabela();
    inicializado = true;
    return true;
  }

  function abrir() {
    if (!inicializar()) return false;
    return autorizarOuNegar();
  }

  window.CotacoesApp = Object.freeze({ abrir: abrir });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar);
  else inicializar();
})(window, document);
