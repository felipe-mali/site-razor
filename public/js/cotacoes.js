(function iniciarModuloCotacoes(window, document) {
  'use strict';

  var Financeiro = window.CotacoesFinanceiro;
  var PrintView = window.CotacoesPrintView;
  var API_BASE = '/api/cotacoes';
  var LIMITE_PAGINA = 20;
  var AUTOSAVE_MS = 1100;
  var STATUS = {
    em_andamento: 'Em andamento',
    aguardando_aprovacao: 'Aguardando aprovação',
    aprovada: 'Aprovada',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada'
  };
  var estado = {
    inicializado: false,
    autorizado: false,
    carregandoHistorico: false,
    pagina: 1,
    totalPaginas: 1,
    cotacao: null,
    calculos: null,
    sujo: false,
    salvando: false,
    revisao: 0,
    timerAutosave: null,
    frameCalculo: null,
    calculoCompletoPendente: false,
    itensCalculoPendentes: new Set(),
    indicePrecos: new Map(),
    requisicaoLista: 0,
    requisicaoCotacao: 0,
    acaoEmCurso: false,
    vista: 'historico',
    imprimindo: false
  };
  var elementos = {};
  var sequenciaTemporaria = 0;

  function porId(id) { return document.getElementById(id); }

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

  function idTemporario(prefixo) {
    sequenciaTemporaria += 1;
    return 'tmp-' + prefixo + '-' + Date.now().toString(36) + '-' + sequenciaTemporaria.toString(36);
  }

  function usuarioLocal() {
    try {
      var bruto = window.localStorage.getItem('user');
      var usuario = bruto ? JSON.parse(bruto) : null;
      return usuario && typeof usuario === 'object' ? usuario : null;
    } catch (erro) {
      return null;
    }
  }

  function possuiAcesso() {
    var usuario = usuarioLocal();
    if (typeof window.podeAcessarModuloCotacoes === 'function') {
      return window.podeAcessarModuloCotacoes(usuario);
    }
    return Boolean(usuario && usuario.ativo === true && (
      usuario.cargo === 'logistica' ||
      usuario.cargo === 'admin' ||
      usuario.pode_gerenciar_permissoes === true ||
      usuario.pode_acessar_cotacoes === true
    ));
  }

  function mostrarAcessoNegado() {
    estado.autorizado = false;
    if (elementos.app) elementos.app.hidden = true;
    if (elementos.printPreview) elementos.printPreview.hidden = true;
    document.body.classList.remove('cotacoes-printing');
    estado.imprimindo = false;
    if (elementos.acessoNegado) {
      elementos.acessoNegado.hidden = false;
      elementos.acessoNegado.innerHTML =
        '<div class="cotacoes-access-card" role="alert">' +
          '<div class="cotacoes-access-icon" aria-hidden="true">!</div>' +
          '<p class="cotacoes-eyebrow">Permissão necessária</p>' +
          '<h2>ACESSO NEGADO</h2>' +
          '<p>Você não possui permissão para acessar o módulo de Cotação de Preços.</p>' +
        '</div>';
    }
  }

  function autorizarOuNegar() {
    if (!possuiAcesso()) {
      mostrarAcessoNegado();
      return false;
    }
    estado.autorizado = true;
    if (elementos.app) elementos.app.hidden = false;
    if (elementos.acessoNegado) elementos.acessoNegado.hidden = true;
    return true;
  }

  function erroApi(mensagem, status, codigo, detalhes) {
    var erro = new Error(mensagem || 'Não foi possível concluir a operação.');
    erro.status = status || 0;
    erro.codigo = codigo || '';
    erro.detalhes = detalhes;
    return erro;
  }

  async function chamarApi(caminho, opcoes) {
    /* Esta verificação ocorre imediatamente antes de toda chamada HTTP. */
    if (!autorizarOuNegar()) throw erroApi('Permissão de Cotação de Preços necessária.', 403, 'ACESSO_NEGADO');
    var tokenAtual = window.localStorage.getItem('token');
    if (!tokenAtual) throw erroApi('Sessão expirada. Entre novamente.', 401, 'NAO_AUTENTICADO');
    var configuracao = Object.assign({}, opcoes || {});
    configuracao.headers = Object.assign({}, configuracao.headers || {}, {
      Authorization: 'Bearer ' + tokenAtual
    });
    if (configuracao.body !== undefined && typeof configuracao.body !== 'string') {
      configuracao.headers['Content-Type'] = 'application/json';
      configuracao.body = JSON.stringify(configuracao.body);
    }

    var resposta;
    try {
      resposta = await window.fetch(API_BASE + caminho, configuracao);
    } catch (erro) {
      throw erroApi('Servidor indisponível. Verifique a conexão e tente novamente.', 0, 'SEM_CONEXAO');
    }
    var dados = null;
    try { dados = await resposta.json(); } catch (erroJson) { dados = null; }
    if (!resposta.ok) {
      if (resposta.status === 403) mostrarAcessoNegado();
      throw erroApi(
        dados && (dados.error || dados.message) || 'A operação não pôde ser concluída.',
        resposta.status,
        dados && dados.codigo,
        dados && dados.detalhes
      );
    }
    return dados || {};
  }

  function formatarData(valor, hora) {
    if (!valor) return '—';
    var data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    var opcoes = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (hora) { opcoes.hour = '2-digit'; opcoes.minute = '2-digit'; }
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
  }

  function dinheiro(valor) {
    return Financeiro && Financeiro.formatarCentavos(valor) || '—';
  }

  function dinheiroParaEdicao(valor) {
    if (!Number.isSafeInteger(valor)) return '';
    return Financeiro.formatarCentavos(valor).replace(/^R\$\s*/, '');
  }

  function quantidade(valor) {
    return Financeiro && Financeiro.formatarQuantidade(valor) || '—';
  }

  function nomeResponsavel(responsavel) {
    if (!responsavel) return '—';
    if (typeof responsavel === 'string') return responsavel;
    return responsavel.nome || responsavel.usuario || '—';
  }

  function nomeFornecedor(fornecedor) {
    return fornecedor && (fornecedor.nome || fornecedor.nomeFantasia || fornecedor.razaoSocial || fornecedor.cnpj) || 'Fornecedor sem nome';
  }

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function novaCotacao() {
    var usuario = usuarioLocal() || {};
    return {
      id: null,
      numero: '',
      status: 'em_andamento',
      criadoEm: null,
      atualizadoEm: null,
      responsavel: { usuario: usuario.usuario || '', nome: usuario.nome || usuario.usuario || '' },
      departamento: 'Logística',
      centroCusto: '',
      descricaoCompra: '',
      observacoesInternas: '',
      aprovacao: { elaboradoPor: usuario.nome || usuario.usuario || '', conferidoPor: '', aprovadoPor: '', data: '' },
      itens: [],
      fornecedores: [],
      precos: []
    };
  }

  function novoItem(base) {
    var item = base || {};
    return {
      id: idTemporario('item'),
      codigo: item.codigo || '',
      descricao: item.descricao ? item.descricao + ' (cópia)' : '',
      unidade: item.unidade || 'UN',
      quantidadeMillesimos: Number.isSafeInteger(item.quantidadeMillesimos) ? item.quantidadeMillesimos : 1000,
      observacao: item.observacao || '',
      ordem: 0,
      ativo: item.ativo !== false
    };
  }

  function novoFornecedor(base) {
    var fornecedor = base || {};
    return {
      id: idTemporario('fornecedor'),
      nome: base ? (nomeFornecedor(base) + ' (cópia)') : '',
      nomeFantasia: '',
      razaoSocial: '',
      cnpj: '',
      contato: fornecedor.contato || '',
      telefone: fornecedor.telefone || '',
      email: fornecedor.email || '',
      formaPagamento: fornecedor.formaPagamento || '',
      prazoEntrega: fornecedor.prazoEntrega || '',
      freteCentavos: Number.isSafeInteger(fornecedor.freteCentavos) ? fornecedor.freteCentavos : 0,
      validadeProposta: fornecedor.validadeProposta || '',
      observacoes: fornecedor.observacoes || '',
      ordem: 0,
      ativoComparacao: fornecedor.ativoComparacao !== false
    };
  }

  function normalizarEstadoCotacao(cotacao) {
    var normalizada = Object.assign(novaCotacao(), cotacao || {});
    normalizada.itens = Array.isArray(normalizada.itens) ? normalizada.itens : [];
    normalizada.fornecedores = Array.isArray(normalizada.fornecedores) ? normalizada.fornecedores : [];
    normalizada.precos = Array.isArray(normalizada.precos) ? normalizada.precos : [];
    normalizada.itens.forEach(function (item, indice) {
      if (!item.id) item.id = idTemporario('item');
      if (!Number.isSafeInteger(item.quantidadeMillesimos) && Number.isSafeInteger(item.quantidadeMilesimos)) {
        item.quantidadeMillesimos = item.quantidadeMilesimos;
      }
      item.ordem = indice;
      if (item.ativo === undefined) item.ativo = true;
    });
    normalizada.fornecedores.forEach(function (fornecedor, indice) {
      if (!fornecedor.id) fornecedor.id = idTemporario('fornecedor');
      fornecedor.ordem = indice;
      if (fornecedor.ativoComparacao === undefined) fornecedor.ativoComparacao = true;
      if (!Number.isSafeInteger(fornecedor.freteCentavos)) fornecedor.freteCentavos = 0;
    });
    normalizada.precos = normalizada.precos.filter(function (preco) {
      return preco && preco.itemId && preco.fornecedorId;
    });
    garantirMatriz(normalizada);
    return normalizada;
  }

  function chavePreco(itemId, fornecedorId) {
    return String(itemId) + '::' + String(fornecedorId);
  }

  function mapaPrecos(cotacao) {
    var mapa = new Map();
    (cotacao.precos || []).forEach(function (preco) {
      mapa.set(chavePreco(preco.itemId, preco.fornecedorId), preco);
    });
    return mapa;
  }

  function garantirMatriz(cotacao) {
    var existentes = mapaPrecos(cotacao);
    var matriz = [];
    cotacao.itens.forEach(function (item) {
      cotacao.fornecedores.forEach(function (fornecedor) {
        var chave = chavePreco(item.id, fornecedor.id);
        var preco = existentes.get(chave);
        matriz.push(preco || {
          id: idTemporario('preco'),
          itemId: item.id,
          fornecedorId: fornecedor.id,
          valorUnitarioCentavos: null,
          observacao: '',
          indisponivel: false
        });
      });
    });
    /* A iteração cartesiana já produz um único registro por par e descarta órfãos. */
    cotacao.precos = matriz;
    if (cotacao === estado.cotacao) estado.indicePrecos = mapaPrecos(cotacao);
  }

  function obterPreco(itemId, fornecedorId) {
    var chave = chavePreco(itemId, fornecedorId);
    if (!estado.indicePrecos.size && estado.cotacao.precos.length) estado.indicePrecos = mapaPrecos(estado.cotacao);
    var existente = estado.indicePrecos.get(chave);
    if (existente) return existente;
    var novo = { id: idTemporario('preco'), itemId: itemId, fornecedorId: fornecedorId, valorUnitarioCentavos: null, observacao: '', indisponivel: false };
    estado.cotacao.precos.push(novo);
    estado.indicePrecos.set(chave, novo);
    return novo;
  }

  function chaveRascunho(cotacao) {
    var usuario = usuarioLocal() || {};
    return 'cotacoes:rascunho:' + (usuario.usuario || 'anonimo') + ':' + (cotacao && cotacao.id || 'novo');
  }

  function salvarRascunhoLocal() {
    if (!estado.cotacao || !estado.sujo || estado.cotacao.status !== 'em_andamento') return;
    try {
      window.localStorage.setItem(chaveRascunho(estado.cotacao), JSON.stringify({
        salvoEm: new Date().toISOString(),
        cotacao: estado.cotacao
      }));
    } catch (erro) { /* armazenamento local é uma proteção auxiliar */ }
  }

  function lerRascunhoLocal(cotacao) {
    try {
      var bruto = window.localStorage.getItem(chaveRascunho(cotacao));
      if (!bruto) return null;
      var dados = JSON.parse(bruto);
      return dados && dados.cotacao ? dados : null;
    } catch (erro) { return null; }
  }

  function removerRascunhoLocal(cotacao, incluirNovo) {
    try {
      window.localStorage.removeItem(chaveRascunho(cotacao));
      if (incluirNovo) window.localStorage.removeItem(chaveRascunho({ id: null }));
    } catch (erro) { /* noop */ }
  }

  function definirEstadoSalvamento(tipo, texto) {
    if (!elementos.saveState) return;
    elementos.saveState.dataset.state = tipo;
    elementos.saveState.textContent = texto;
  }

  function marcarSujo() {
    if (!estado.cotacao || estado.cotacao.status !== 'em_andamento') return;
    estado.sujo = true;
    estado.revisao += 1;
    definirEstadoSalvamento('dirty', 'Não salvo');
    salvarRascunhoLocal();
    agendarAutosave();
  }

  function agendarAutosave() {
    window.clearTimeout(estado.timerAutosave);
    estado.timerAutosave = window.setTimeout(function () {
      salvarCotacao({ automatico: true }).catch(function () { /* estado visual já atualizado */ });
    }, AUTOSAVE_MS);
  }

  function cancelarAgendamentosEdicao() {
    window.clearTimeout(estado.timerAutosave);
    estado.timerAutosave = null;
    if (estado.frameCalculo) window.cancelAnimationFrame(estado.frameCalculo);
    estado.frameCalculo = null;
    estado.calculoCompletoPendente = false;
    estado.itensCalculoPendentes.clear();
  }

  function podeEditar() {
    return Boolean(estado.cotacao && estado.cotacao.status === 'em_andamento');
  }

  function capturarFoco() {
    var ativo = document.activeElement;
    if (!ativo || !elementos.editor || !elementos.editor.contains(ativo)) return null;
    return {
      seletor: ativo.dataset && ativo.dataset.focusKey,
      inicio: typeof ativo.selectionStart === 'number' ? ativo.selectionStart : null,
      fim: typeof ativo.selectionEnd === 'number' ? ativo.selectionEnd : null,
      scrollLeft: elementos.tabelaWrap ? elementos.tabelaWrap.scrollLeft : 0,
      scrollTop: elementos.tabelaWrap ? elementos.tabelaWrap.scrollTop : 0
    };
  }

  function restaurarFoco(foco) {
    if (!foco) return;
    if (elementos.tabelaWrap) {
      elementos.tabelaWrap.scrollLeft = foco.scrollLeft;
      elementos.tabelaWrap.scrollTop = foco.scrollTop;
    }
    if (!foco.seletor) return;
    var alvo = elementos.editor.querySelector('[data-focus-key="' + escaparSeletor(foco.seletor) + '"]');
    if (!alvo) return;
    alvo.focus();
    if (foco.inicio !== null && typeof alvo.setSelectionRange === 'function') {
      try { alvo.setSelectionRange(foco.inicio, foco.fim); } catch (erro) { /* noop */ }
    }
  }

  function mostrarVista(nome) {
    estado.vista = nome;
    elementos.historico.hidden = nome !== 'historico';
    elementos.editor.hidden = nome !== 'editor';
  }

  function mostrarErroGeral(erros) {
    if (!elementos.erros) return;
    var lista = Array.isArray(erros) ? erros : [erros];
    lista = lista.filter(Boolean);
    if (!lista.length) {
      elementos.erros.hidden = true;
      elementos.erros.innerHTML = '';
      return;
    }
    elementos.erros.innerHTML = '<strong>Revise a cotação:</strong><ul>' + lista.map(function (erro) {
      return '<li>' + escapar(erro) + '</li>';
    }).join('') + '</ul>';
    elementos.erros.hidden = false;
    elementos.erros.focus();
  }

  function mensagemErro(erro) {
    var mensagens = [erro && erro.message || 'Erro inesperado.'];
    var detalhes = erro && erro.detalhes;
    if (detalhes && Array.isArray(detalhes.problemas)) mensagens = mensagens.concat(detalhes.problemas);
    return mensagens;
  }

  function validarCotacao(paraFinalizar) {
    var cotacao = estado.cotacao;
    var erros = [];
    if (!String(cotacao.descricaoCompra || '').trim()) erros.push('Informe a descrição da compra.');
    if (paraFinalizar && !cotacao.itens.length) erros.push('Adicione pelo menos um item.');
    if (paraFinalizar && !cotacao.fornecedores.length) erros.push('Adicione pelo menos um fornecedor.');
    cotacao.itens.forEach(function (item, indice) {
      if (!String(item.descricao || '').trim()) erros.push('Informe a descrição do item ' + (indice + 1) + '.');
      if (!Number.isSafeInteger(item.quantidadeMillesimos) || item.quantidadeMillesimos <= 0) {
        erros.push('Informe uma quantidade válida para o item ' + (indice + 1) + '.');
      }
    });
    var nomes = new Set();
    var cnpjs = new Set();
    cotacao.fornecedores.forEach(function (fornecedor, indice) {
      var identificacao = String(fornecedor.nome || fornecedor.nomeFantasia || fornecedor.razaoSocial || '').trim();
      if (!identificacao && !fornecedor.cnpj) erros.push('Identifique o fornecedor ' + (indice + 1) + '.');
      var chaveNome = identificacao.toLocaleLowerCase('pt-BR');
      if (chaveNome && nomes.has(chaveNome)) erros.push('Há fornecedores com o mesmo nome.');
      if (chaveNome) nomes.add(chaveNome);
      var cnpj = Financeiro.normalizarCnpj(fornecedor.cnpj);
      if (cnpj && !Financeiro.validarCnpj(cnpj)) erros.push('O CNPJ do fornecedor ' + (indice + 1) + ' é inválido.');
      if (cnpj && cnpjs.has(cnpj)) erros.push('Há fornecedores com o mesmo CNPJ.');
      if (cnpj) cnpjs.add(cnpj);
      if (!Number.isSafeInteger(fornecedor.freteCentavos) || fornecedor.freteCentavos < 0) {
        erros.push('Informe um frete válido para o fornecedor ' + (indice + 1) + '.');
      }
      if (fornecedor.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fornecedor.email).trim())) {
        erros.push('O e-mail do fornecedor ' + (indice + 1) + ' é inválido.');
      }
    });
    cotacao.precos.forEach(function (preco) {
      if (preco.indisponivel === true) return;
      var digitado = String(preco._valorDigitado === undefined ? '' : preco._valorDigitado).trim();
      if ((digitado && preco.valorUnitarioCentavos === null) ||
          (Number.isSafeInteger(preco.valorUnitarioCentavos) && preco.valorUnitarioCentavos <= 0)) {
        erros.push('Os preços informados devem ser valores monetários maiores que zero.');
      }
    });
    if (paraFinalizar) {
      recalcular();
      if (!estado.calculos || !estado.calculos.custoIdealCompleto) erros.push('Todos os itens precisam ter ao menos um preço válido.');
      if (!estado.calculos || !estado.calculos.fornecedorIdsRecomendados.length) erros.push('É necessário ao menos um fornecedor ativo com proposta completa.');
    }
    return Array.from(new Set(erros));
  }

  function cotacaoValidaParaAutosave() {
    var cotacao = estado.cotacao;
    if (!cotacao || cotacao.status !== 'em_andamento') return false;
    return cotacao.itens.every(function (item) {
      return String(item.descricao || '').trim() && Number.isSafeInteger(item.quantidadeMillesimos) && item.quantidadeMillesimos > 0;
    }) && cotacao.fornecedores.every(function (fornecedor) {
      var identificado = fornecedor.nome || fornecedor.nomeFantasia || fornecedor.razaoSocial || fornecedor.cnpj;
      var cnpj = Financeiro.normalizarCnpj(fornecedor.cnpj);
      return Boolean(String(identificado || '').trim()) && (!cnpj || Financeiro.validarCnpj(cnpj)) &&
        (!fornecedor.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fornecedor.email).trim())) &&
        Number.isSafeInteger(fornecedor.freteCentavos) && fornecedor.freteCentavos >= 0;
    }) && cotacao.precos.every(function (preco) {
      if (preco.indisponivel === true) return true;
      var digitado = String(preco._valorDigitado === undefined ? '' : preco._valorDigitado).trim();
      return !(digitado && preco.valorUnitarioCentavos === null) &&
        !(Number.isSafeInteger(preco.valorUnitarioCentavos) && preco.valorUnitarioCentavos <= 0);
    });
  }

  function prepararPayload(cotacao) {
    garantirMatriz(cotacao);
    cotacao.itens.forEach(function (item, indice) { item.ordem = indice; });
    cotacao.fornecedores.forEach(function (fornecedor, indice) { fornecedor.ordem = indice; });
    return {
      departamento: cotacao.departamento || '',
      centroCusto: cotacao.centroCusto || '',
      descricaoCompra: cotacao.descricaoCompra || '',
      observacoesInternas: cotacao.observacoesInternas || '',
      aprovacao: cotacao.aprovacao || {},
      itens: cotacao.itens.map(function (item) {
        return {
          id: item.id, codigo: item.codigo || '', descricao: item.descricao || '', unidade: item.unidade || 'UN',
          quantidadeMillesimos: item.quantidadeMillesimos, observacao: item.observacao || '', ordem: item.ordem, ativo: item.ativo !== false
        };
      }),
      fornecedores: cotacao.fornecedores.map(function (fornecedor) {
        return {
          id: fornecedor.id, nome: fornecedor.nome || '', nomeFantasia: fornecedor.nomeFantasia || '', razaoSocial: fornecedor.razaoSocial || '',
          cnpj: fornecedor.cnpj || '', contato: fornecedor.contato || '', telefone: fornecedor.telefone || '', email: fornecedor.email || '',
          formaPagamento: fornecedor.formaPagamento || '', prazoEntrega: fornecedor.prazoEntrega || '', freteCentavos: fornecedor.freteCentavos,
          validadeProposta: fornecedor.validadeProposta || '', observacoes: fornecedor.observacoes || '', ordem: fornecedor.ordem,
          ativoComparacao: fornecedor.ativoComparacao !== false
        };
      }),
      precos: cotacao.precos.map(function (preco) {
        return {
          id: preco.id, itemId: preco.itemId, fornecedorId: preco.fornecedorId,
          valorUnitarioCentavos: preco.valorUnitarioCentavos, observacao: preco.observacao || '', indisponivel: preco.indisponivel === true
        };
      })
    };
  }

  function sincronizarMetadadosSalvos(edicaoAtual, salvo) {
    /*
     * Se o usuário continuou digitando durante a requisição, os IDs temporários
     * permanecem até o próximo autosave. Assim os data-attributes da matriz não
     * ficam obsoletos no meio da edição; a próxima resposta ociosa reidrata os
     * IDs definitivos do servidor de uma só vez.
     */
    edicaoAtual.id = salvo.id;
    edicaoAtual.numero = salvo.numero;
    edicaoAtual.criadoEm = salvo.criadoEm;
    edicaoAtual.atualizadoEm = salvo.atualizadoEm;
    edicaoAtual.responsavel = salvo.responsavel;
  }

  async function salvarCotacao(opcoes) {
    var automatico = Boolean(opcoes && opcoes.automatico);
    if (!estado.cotacao || !podeEditar() || !estado.sujo) return estado.cotacao;
    if (estado.salvando) return estado.cotacao;
    if (automatico && !cotacaoValidaParaAutosave()) return estado.cotacao;
    if (!automatico) {
      var erros = validarCotacao(false);
      mostrarErroGeral(erros);
      if (erros.length) throw erroApi('Existem campos obrigatórios pendentes.', 422, 'VALIDACAO_LOCAL');
    }

    window.clearTimeout(estado.timerAutosave);
    estado.salvando = true;
    atualizarBotoes();
    definirEstadoSalvamento('saving', 'Salvando…');
    var revisaoEnviada = estado.revisao;
    var cotacaoReferencia = estado.cotacao;
    var cotacaoEnviada = clonar(estado.cotacao);
    var eraNova = !cotacaoEnviada.id;
    try {
      var resposta = eraNova
        ? await chamarApi('', { method: 'POST', body: prepararPayload(cotacaoEnviada) })
        : await chamarApi('/' + encodeURIComponent(cotacaoEnviada.id), { method: 'PUT', body: prepararPayload(cotacaoEnviada) });
      if (estado.cotacao !== cotacaoReferencia) return estado.cotacao;
      var salva = normalizarEstadoCotacao(resposta.cotacao);
      removerRascunhoLocal(cotacaoEnviada, eraNova);
      if (estado.revisao === revisaoEnviada) {
        var foco = capturarFoco();
        estado.cotacao = salva;
        estado.sujo = false;
        renderizarEditor();
        restaurarFoco(foco);
        definirEstadoSalvamento('saved', 'Salvo');
      } else {
        sincronizarMetadadosSalvos(estado.cotacao, salva);
        salvarRascunhoLocal();
        definirEstadoSalvamento('dirty', 'Não salvo');
        agendarAutosave();
      }
      mostrarErroGeral([]);
      return estado.cotacao;
    } catch (erro) {
      if (estado.cotacao !== cotacaoReferencia) return estado.cotacao;
      definirEstadoSalvamento('error', automatico ? 'Erro no autosave' : 'Erro ao salvar');
      salvarRascunhoLocal();
      if (!automatico) mostrarErroGeral(mensagemErro(erro));
      throw erro;
    } finally {
      estado.salvando = false;
      if (estado.cotacao !== cotacaoReferencia && estado.sujo) agendarAutosave();
      atualizarBotoes();
    }
  }

  function opcoesOrdenacao() {
    var valor = elementos.ordenacao.value;
    var mapa = {
      atualizada_desc: ['atualizadoEm', 'desc'],
      criada_desc: ['criadoEm', 'desc'],
      numero_asc: ['numero', 'asc'],
      status_asc: ['status', 'asc']
    };
    return mapa[valor] || mapa.atualizada_desc;
  }

  async function carregarHistorico(pagina) {
    if (!autorizarOuNegar()) return;
    estado.pagina = Math.max(1, Number(pagina) || 1);
    var ordem = opcoesOrdenacao();
    var parametros = new URLSearchParams({
      pagina: String(estado.pagina), limite: String(LIMITE_PAGINA),
      ordenarPor: ordem[0], ordem: ordem[1]
    });
    ['busca', 'status', 'dataInicio', 'dataFim'].forEach(function (nome) {
      var controle = elementos.filtros.elements[nome];
      if (controle && controle.value) parametros.set(nome, controle.value);
    });
    var idLista = ++estado.requisicaoLista;
    estado.carregandoHistorico = true;
    elementos.listaStatus.innerHTML = '<span class="cotacoes-loading">Carregando cotações…</span>';
    elementos.listaCorpo.innerHTML = '';
    try {
      var dados = await chamarApi('?' + parametros.toString());
      if (idLista !== estado.requisicaoLista) return;
      renderizarHistorico(dados.cotacoes || [], dados.paginacao || {});
    } catch (erro) {
      if (idLista !== estado.requisicaoLista || erro.status === 403) return;
      elementos.listaStatus.innerHTML = '<span class="cotacoes-error-state">' + escapar(erro.message) + ' <button type="button" class="cotacoes-btn cotacoes-btn-ghost" data-history-action="retry">Tentar novamente</button></span>';
    } finally {
      if (idLista === estado.requisicaoLista) estado.carregandoHistorico = false;
    }
  }

  function renderizarHistorico(cotacoes, paginacao) {
    estado.totalPaginas = Math.max(1, paginacao.totalPaginas || 1);
    estado.pagina = paginacao.pagina || estado.pagina;
    elementos.listaStatus.textContent = (paginacao.total || 0) + ' cotação(ões) encontrada(s).';
    if (!cotacoes.length) {
      elementos.listaCorpo.innerHTML = '<tr><td colspan="9"><div class="cotacoes-empty">Nenhuma cotação encontrada para estes filtros.</div></td></tr>';
    } else {
      elementos.listaCorpo.innerHTML = cotacoes.map(function (cotacao) {
        var editavel = cotacao.status === 'em_andamento';
        return '<tr>' +
          '<td class="cotacoes-history-number">' + escapar(cotacao.numero) + '</td>' +
          '<td>' + escapar(formatarData(cotacao.criadoEm, false)) + '</td>' +
          '<td>' + escapar(nomeResponsavel(cotacao.responsavel)) + '</td>' +
          '<td><span class="cotacoes-status-badge" data-status="' + escapar(cotacao.status) + '">' + escapar(STATUS[cotacao.status] || cotacao.status) + '</span></td>' +
          '<td>' + escapar(cotacao.quantidadeItens || 0) + ' / ' + escapar(cotacao.quantidadeFornecedores || 0) + '</td>' +
          '<td>' + escapar(dinheiro(cotacao.custoIdealTotalCentavos)) + '</td>' +
          '<td>' + escapar(cotacao.fornecedorRecomendado || '—') + '<br><small>Total: ' + escapar(dinheiro(cotacao.totalRecomendadoCentavos)) + ' · Negociação: ' + escapar(dinheiro(cotacao.descontoSugeridoCentavos)) + '</small></td>' +
          '<td>' + escapar(formatarData(cotacao.atualizadoEm, true)) + '</td>' +
          '<td><div class="cotacoes-history-actions">' +
            '<button type="button" class="cotacoes-btn cotacoes-btn-ghost" data-history-action="open" data-id="' + escapar(cotacao.id) + '">' + (editavel ? 'Editar' : 'Ver') + '</button>' +
            '<button type="button" class="cotacoes-btn cotacoes-btn-ghost" data-history-action="print" data-id="' + escapar(cotacao.id) + '" title="Imprimir">⎙</button>' +
            '<button type="button" class="cotacoes-btn cotacoes-btn-ghost" data-history-action="duplicate" data-id="' + escapar(cotacao.id) + '" title="Duplicar">⧉</button>' +
            (editavel ? '<button type="button" class="cotacoes-btn cotacoes-btn-warning" data-history-action="cancel" data-id="' + escapar(cotacao.id) + '" title="Cancelar">!</button>' : '') +
            (editavel ? '<button type="button" class="cotacoes-btn cotacoes-btn-danger" data-history-action="delete" data-id="' + escapar(cotacao.id) + '" title="Excluir">×</button>' : '') +
          '</div></td>' +
        '</tr>';
      }).join('');
    }
    renderizarPaginacao();
  }

  function renderizarPaginacao() {
    if (estado.totalPaginas <= 1) { elementos.paginacao.innerHTML = ''; return; }
    var inicio = Math.max(1, estado.pagina - 2);
    var fim = Math.min(estado.totalPaginas, inicio + 4);
    inicio = Math.max(1, fim - 4);
    var html = '<button type="button" class="cotacoes-btn cotacoes-btn-ghost" data-page="' + (estado.pagina - 1) + '"' + (estado.pagina === 1 ? ' disabled' : '') + '>Anterior</button>';
    for (var pagina = inicio; pagina <= fim; pagina += 1) {
      html += '<button type="button" class="cotacoes-btn cotacoes-btn-ghost" data-page="' + pagina + '"' + (pagina === estado.pagina ? ' aria-current="page"' : '') + '>' + pagina + '</button>';
    }
    html += '<button type="button" class="cotacoes-btn cotacoes-btn-ghost" data-page="' + (estado.pagina + 1) + '"' + (estado.pagina === estado.totalPaginas ? ' disabled' : '') + '>Próxima</button>';
    elementos.paginacao.innerHTML = html;
  }

  async function abrirCotacao(id, imprimirDireto) {
    if (!autorizarOuNegar()) return;
    cancelarAgendamentosEdicao();
    var requisicaoAtual = ++estado.requisicaoCotacao;
    elementos.listaStatus.innerHTML = '<span class="cotacoes-loading">Abrindo cotação…</span>';
    try {
      var dados = await chamarApi('/' + encodeURIComponent(id) + (imprimirDireto ? '/impressao' : ''));
      if (requisicaoAtual !== estado.requisicaoCotacao) return;
      estado.cotacao = normalizarEstadoCotacao(dados.cotacao);
      estado.sujo = false;
      var rascunho = lerRascunhoLocal(estado.cotacao);
      if (rascunho && Date.parse(rascunho.salvoEm) > Date.parse(estado.cotacao.atualizadoEm || 0)) {
        if (window.confirm('Existe uma versão local mais recente desta cotação. Deseja recuperá-la?')) {
          estado.cotacao = normalizarEstadoCotacao(rascunho.cotacao);
          estado.sujo = true;
        } else {
          removerRascunhoLocal(estado.cotacao);
        }
      }
      renderizarEditor();
      mostrarVista('editor');
      if (imprimirDireto) abrirPreviewImpressao();
    } catch (erro) {
      if (requisicaoAtual !== estado.requisicaoCotacao) return;
      if (erro.status !== 403) elementos.listaStatus.textContent = erro.message;
    }
  }

  function iniciarNovaCotacao() {
    cancelarAgendamentosEdicao();
    estado.requisicaoCotacao += 1;
    var cotacao = novaCotacao();
    var rascunho = lerRascunhoLocal(cotacao);
    if (rascunho) {
      if (window.confirm('Há uma nova cotação não salva neste navegador. Deseja recuperá-la?')) cotacao = rascunho.cotacao;
      else removerRascunhoLocal(cotacao);
    }
    estado.cotacao = normalizarEstadoCotacao(cotacao);
    estado.sujo = Boolean(rascunho && cotacao === rascunho.cotacao);
    renderizarEditor();
    mostrarVista('editor');
  }

  function preencherDadosGerais() {
    var cotacao = estado.cotacao;
    porId('cotacao-numero').value = cotacao.numero || '';
    porId('cotacao-criada-em').value = formatarData(cotacao.criadoEm, true);
    porId('cotacao-atualizada-em').value = formatarData(cotacao.atualizadoEm, true);
    porId('cotacao-responsavel').value = nomeResponsavel(cotacao.responsavel);
    document.querySelectorAll('[data-cotacao-field]').forEach(function (campo) {
      campo.value = cotacao[campo.dataset.cotacaoField] || '';
    });
    document.querySelectorAll('[data-approval-field]').forEach(function (campo) {
      campo.value = cotacao.aprovacao && cotacao.aprovacao[campo.dataset.approvalField] || '';
    });
  }

  function renderizarEditor() {
    if (!estado.cotacao) return;
    garantirMatriz(estado.cotacao);
    preencherDadosGerais();
    elementos.editorTitulo.textContent = estado.cotacao.numero || 'Nova cotação';
    elementos.statusBadge.dataset.status = estado.cotacao.status;
    elementos.statusBadge.textContent = STATUS[estado.cotacao.status] || estado.cotacao.status;
    elementos.fieldset.disabled = !podeEditar();
    renderizarFornecedores();
    renderizarTabela();
    recalcular();
    atualizarCalculosNaTela();
    atualizarBotoes();
    definirEstadoSalvamento(estado.sujo ? 'dirty' : 'saved', estado.sujo ? 'Não salvo' : 'Salvo');
  }

  function campoFornecedor(id, campo, rotulo, tipo, valor, largo) {
    return '<div class="cotacoes-field' + (largo ? ' cotacoes-field-wide' : '') + '">' +
      '<label>' + escapar(rotulo) + '</label>' +
      (tipo === 'textarea'
        ? '<textarea rows="2" maxlength="3000" data-supplier-id="' + escapar(id) + '" data-supplier-field="' + campo + '" data-focus-key="fornecedor-' + escapar(id) + '-' + campo + '">' + escapar(valor || '') + '</textarea>'
        : '<input type="' + tipo + '" value="' + escapar(valor || '') + '" data-supplier-id="' + escapar(id) + '" data-supplier-field="' + campo + '" data-focus-key="fornecedor-' + escapar(id) + '-' + campo + '">') +
    '</div>';
  }

  function renderizarFornecedores() {
    var calculos = estado.calculos || { fornecedores: [] };
    var mapaCalculos = new Map((calculos.fornecedores || []).map(function (f) { return [String(f.fornecedorId), f]; }));
    if (!estado.cotacao.fornecedores.length) {
      elementos.fornecedores.innerHTML = '<div class="cotacoes-empty">Nenhum fornecedor cadastrado. Use “Adicionar fornecedor” para começar.</div>';
      return;
    }
    elementos.fornecedores.innerHTML = estado.cotacao.fornecedores.map(function (fornecedor, indice) {
      var calculo = mapaCalculos.get(String(fornecedor.id)) || {};
      var completo = Boolean(calculo.completo);
      var freteTexto = dinheiroParaEdicao(fornecedor.freteCentavos);
      return '<article class="cotacoes-supplier-card" data-supplier-card="' + escapar(fornecedor.id) + '" data-incomplete="' + (!completo) + '" data-disabled="' + (fornecedor.ativoComparacao === false) + '">' +
        '<div class="cotacoes-supplier-head"><span class="cotacoes-supplier-index">' + (indice + 1) + '</span>' +
          '<span class="cotacoes-supplier-name" data-supplier-name="' + escapar(fornecedor.id) + '">' + escapar(nomeFornecedor(fornecedor)) + '</span>' +
          '<span class="cotacoes-supplier-completeness" data-supplier-completeness="' + escapar(fornecedor.id) + '" data-complete="' + completo + '">' + (completo ? 'Completa' : 'Faltam ' + (calculo.itensFaltantes || estado.cotacao.itens.length)) + '</span>' +
          '<div class="cotacoes-supplier-actions">' +
            '<button class="cotacoes-icon-btn" type="button" data-supplier-action="up" data-id="' + escapar(fornecedor.id) + '" title="Mover para a esquerda"' + (indice === 0 ? ' disabled' : '') + '>←</button>' +
            '<button class="cotacoes-icon-btn" type="button" data-supplier-action="down" data-id="' + escapar(fornecedor.id) + '" title="Mover para a direita"' + (indice === estado.cotacao.fornecedores.length - 1 ? ' disabled' : '') + '>→</button>' +
            '<button class="cotacoes-icon-btn" type="button" data-supplier-action="duplicate" data-id="' + escapar(fornecedor.id) + '" title="Duplicar">⧉</button>' +
            '<button class="cotacoes-icon-btn" type="button" data-supplier-action="delete" data-id="' + escapar(fornecedor.id) + '" title="Excluir">×</button>' +
          '</div></div>' +
        '<div class="cotacoes-supplier-fields">' +
          campoFornecedor(fornecedor.id, 'nome', 'Nome de exibição', 'text', fornecedor.nome, false) +
          campoFornecedor(fornecedor.id, 'cnpj', 'CNPJ', 'text', fornecedor.cnpj, false) +
          campoFornecedor(fornecedor.id, 'nomeFantasia', 'Nome fantasia', 'text', fornecedor.nomeFantasia, false) +
          campoFornecedor(fornecedor.id, 'razaoSocial', 'Razão social', 'text', fornecedor.razaoSocial, false) +
          campoFornecedor(fornecedor.id, 'contato', 'Contato', 'text', fornecedor.contato, false) +
          campoFornecedor(fornecedor.id, 'telefone', 'Telefone', 'tel', fornecedor.telefone, false) +
          campoFornecedor(fornecedor.id, 'email', 'E-mail', 'email', fornecedor.email, false) +
          campoFornecedor(fornecedor.id, 'formaPagamento', 'Forma de pagamento', 'text', fornecedor.formaPagamento, false) +
          campoFornecedor(fornecedor.id, 'prazoEntrega', 'Prazo de entrega', 'text', fornecedor.prazoEntrega, false) +
          campoFornecedor(fornecedor.id, 'validadeProposta', 'Validade da proposta', 'date', fornecedor.validadeProposta, false) +
          '<div class="cotacoes-field"><label>Frete</label><input type="text" inputmode="decimal" value="' + escapar(freteTexto) + '" data-supplier-id="' + escapar(fornecedor.id) + '" data-supplier-field="freteCentavos" data-focus-key="fornecedor-' + escapar(fornecedor.id) + '-freteCentavos"></div>' +
          '<label class="cotacoes-supplier-toggle"><input type="checkbox" data-supplier-id="' + escapar(fornecedor.id) + '" data-supplier-field="ativoComparacao"' + (fornecedor.ativoComparacao !== false ? ' checked' : '') + '> Incluir na comparação</label>' +
          campoFornecedor(fornecedor.id, 'observacoes', 'Observações da proposta', 'textarea', fornecedor.observacoes, true) +
        '</div></article>';
    }).join('');
  }

  function renderizarTabela() {
    var cotacao = estado.cotacao;
    if (!cotacao.itens.length) {
      elementos.tabelaWrap.innerHTML = '<table class="cotacoes-sheet-table"><tbody><tr><td class="cotacoes-sheet-empty">Nenhum item cadastrado. Adicione itens para montar a comparação.</td></tr></tbody></table>';
      elementos.sheetStatus.textContent = '0 itens · ' + cotacao.fornecedores.length + ' fornecedores';
      return;
    }
    var fornecedores = cotacao.fornecedores;
    var precosTabela = mapaPrecos(cotacao);
    var topo = fornecedores.map(function (fornecedor) {
      return '<th class="cotacoes-supplier-group" colspan="2" data-supplier-heading="' + escapar(fornecedor.id) + '" data-disabled="' + (fornecedor.ativoComparacao === false) + '">' + escapar(nomeFornecedor(fornecedor)) + '</th>';
    }).join('');
    var sub = fornecedores.map(function () { return '<th class="cotacoes-col-supplier">Unitário</th><th class="cotacoes-col-supplier">Total</th>'; }).join('');
    var linhas = cotacao.itens.map(function (item, indice) {
      var colunas = fornecedores.map(function (fornecedor) {
        var preco = precosTabela.get(chavePreco(item.id, fornecedor.id));
        var textoPreco = dinheiroParaEdicao(preco.valorUnitarioCentavos);
        var chave = chavePreco(item.id, fornecedor.id);
        return '<td class="cotacoes-price-cell" data-price-cell="' + escapar(chave) + '" data-unavailable="' + (preco.indisponivel === true) + '">' +
            '<input type="text" inputmode="decimal" value="' + escapar(textoPreco) + '" data-price-item="' + escapar(item.id) + '" data-price-supplier="' + escapar(fornecedor.id) + '" data-field="valorUnitarioCentavos" data-focus-key="preco-' + escapar(chave) + '"' + (preco.indisponivel ? ' disabled' : '') + ' aria-label="Preço de ' + escapar(item.descricao || 'item ' + (indice + 1)) + ' em ' + escapar(nomeFornecedor(fornecedor)) + '">' +
            '<label class="cotacoes-unavailable-toggle"><input type="checkbox" data-price-item="' + escapar(item.id) + '" data-price-supplier="' + escapar(fornecedor.id) + '" data-field="indisponivel"' + (preco.indisponivel ? ' checked' : '') + '> indisponível</label>' +
            '<input type="text" value="' + escapar(preco.observacao || '') + '" placeholder="Obs. do preço" maxlength="1000" style="min-height:22px;margin-top:3px;font-size:9px" data-price-item="' + escapar(item.id) + '" data-price-supplier="' + escapar(fornecedor.id) + '" data-field="observacao" data-focus-key="preco-obs-' + escapar(chave) + '" aria-label="Observação do preço">' +
          '</td><td><span class="cotacoes-money-total" data-price-total="' + escapar(chave) + '">—</span></td>';
      }).join('');
      return '<tr data-item-row="' + escapar(item.id) + '">' +
        '<td class="cotacoes-sticky cotacoes-col-number">' + (indice + 1) + '</td>' +
        '<td class="cotacoes-sticky cotacoes-col-item"><div class="cotacoes-item-description">' +
          '<input type="text" value="' + escapar(item.codigo || '') + '" placeholder="Código" data-item-id="' + escapar(item.id) + '" data-item-field="codigo" data-focus-key="item-' + escapar(item.id) + '-codigo">' +
          '<input type="text" value="' + escapar(item.descricao || '') + '" placeholder="Descrição *" data-item-id="' + escapar(item.id) + '" data-item-field="descricao" data-focus-key="item-' + escapar(item.id) + '-descricao">' +
          '<input type="text" value="' + escapar(item.observacao || '') + '" placeholder="Observação" data-item-id="' + escapar(item.id) + '" data-item-field="observacao" data-focus-key="item-' + escapar(item.id) + '-observacao" style="grid-column:1/-1">' +
        '</div></td>' +
        '<td class="cotacoes-sticky cotacoes-col-unit"><input type="text" value="' + escapar(item.unidade || 'UN') + '" maxlength="20" data-item-id="' + escapar(item.id) + '" data-item-field="unidade" data-focus-key="item-' + escapar(item.id) + '-unidade"></td>' +
        '<td class="cotacoes-sticky cotacoes-col-quantity"><input type="text" inputmode="decimal" value="' + escapar(quantidade(item.quantidadeMillesimos).replace(/\./g, '')) + '" data-item-id="' + escapar(item.id) + '" data-item-field="quantidadeMillesimos" data-focus-key="item-' + escapar(item.id) + '-quantidade"></td>' +
        colunas +
        '<td class="cotacoes-col-ideal"><span class="cotacoes-money-total" data-ideal-unit="' + escapar(item.id) + '">—</span></td>' +
        '<td class="cotacoes-col-ideal"><span class="cotacoes-money-total" data-ideal-total="' + escapar(item.id) + '">—</span></td>' +
        '<td class="cotacoes-col-actions"><div class="cotacoes-row-actions">' +
          '<button class="cotacoes-icon-btn" type="button" data-item-action="up" data-id="' + escapar(item.id) + '" title="Mover para cima"' + (indice === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="cotacoes-icon-btn" type="button" data-item-action="down" data-id="' + escapar(item.id) + '" title="Mover para baixo"' + (indice === cotacao.itens.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="cotacoes-icon-btn" type="button" data-item-action="duplicate" data-id="' + escapar(item.id) + '" title="Duplicar">⧉</button>' +
          '<button class="cotacoes-icon-btn" type="button" data-item-action="delete" data-id="' + escapar(item.id) + '" title="Excluir">×</button>' +
        '</div></td></tr>';
    }).join('');
    var totalFornecedor = fornecedores.map(function (fornecedor) {
      return '<td colspan="2"><span class="cotacoes-money-total" data-supplier-total="' + escapar(fornecedor.id) + '">—</span></td>';
    }).join('');
    elementos.tabelaWrap.innerHTML = '<table class="cotacoes-sheet-table"><thead><tr>' +
      '<th rowspan="2" class="cotacoes-sticky cotacoes-col-number">#</th><th rowspan="2" class="cotacoes-sticky cotacoes-col-item">Item</th><th rowspan="2" class="cotacoes-sticky cotacoes-col-unit">Un.</th><th rowspan="2" class="cotacoes-sticky cotacoes-col-quantity">Qtd.</th>' + topo +
      '<th colspan="2" class="cotacoes-col-ideal">Custo ideal</th><th rowspan="2" class="cotacoes-col-actions">Ações</th></tr><tr>' + sub + '<th class="cotacoes-col-ideal">Unitário</th><th class="cotacoes-col-ideal">Total</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody><tfoot><tr class="cotacoes-totals-row"><th colspan="4" class="cotacoes-sticky">Total geral (com frete)</th>' + totalFornecedor + '<td colspan="2" class="cotacoes-col-ideal" data-ideal-grand-total>—</td><td></td></tr></tfoot></table>';
    elementos.sheetStatus.textContent = cotacao.itens.length + ' itens · ' + fornecedores.length + ' fornecedores · ' + (cotacao.itens.length * fornecedores.length) + ' preços possíveis';
  }

  function recalcular() {
    try {
      estado.calculos = Financeiro.calcularCotacao(estado.cotacao || { itens: [], fornecedores: [], precos: [] });
    } catch (erro) {
      estado.calculos = null;
      if (elementos.analise) elementos.analise.textContent = 'Não foi possível calcular: ' + erro.message;
    }
    return estado.calculos;
  }

  function agendarCalculoUI(itemId, calculoCompleto) {
    if (calculoCompleto) estado.calculoCompletoPendente = true;
    else if (itemId !== undefined && itemId !== null) estado.itensCalculoPendentes.add(String(itemId));
    if (estado.frameCalculo) window.cancelAnimationFrame(estado.frameCalculo);
    estado.frameCalculo = window.requestAnimationFrame(function () {
      estado.frameCalculo = null;
      var itensPendentes = estado.calculoCompletoPendente ? null : new Set(estado.itensCalculoPendentes);
      estado.calculoCompletoPendente = false;
      estado.itensCalculoPendentes.clear();
      recalcular();
      atualizarCalculosNaTela(itensPendentes);
    });
  }

  function atualizarCalculosNaTela(idsItens) {
    var calculos = estado.calculos;
    if (!calculos) return;
    var atualizarTudo = idsItens === undefined || idsItens === null;
    var precosOriginais = estado.indicePrecos.size ? estado.indicePrecos : mapaPrecos(estado.cotacao);
    var totaisFornecedores = new Map(Array.from(elementos.tabelaWrap.querySelectorAll('[data-supplier-total]')).map(function (el) { return [el.dataset.supplierTotal, el]; }));
    var completudes = new Map(Array.from(elementos.fornecedores.querySelectorAll('[data-supplier-completeness]')).map(function (el) { return [el.dataset.supplierCompleteness, el]; }));
    var cards = new Map(Array.from(elementos.fornecedores.querySelectorAll('[data-supplier-card]')).map(function (el) { return [el.dataset.supplierCard, el]; }));
    var cabecalhos = new Map(Array.from(elementos.tabelaWrap.querySelectorAll('[data-supplier-heading]')).map(function (el) { return [el.dataset.supplierHeading, el]; }));
    calculos.itens.forEach(function (item) {
      if (!atualizarTudo && !idsItens.has(String(item.itemId))) return;
      var linha = elementos.tabelaWrap.querySelector('[data-item-row="' + escaparSeletor(item.itemId) + '"]');
      if (!linha) return;
      var idealUnit = linha.querySelector('[data-ideal-unit]');
      var idealTotal = linha.querySelector('[data-ideal-total]');
      if (idealUnit) idealUnit.textContent = dinheiro(item.custoIdealUnitarioCentavos);
      if (idealTotal) idealTotal.textContent = dinheiro(item.custoIdealTotalCentavos);
      var celulasPreco = new Map(Array.from(linha.querySelectorAll('[data-price-cell]')).map(function (el) { return [el.dataset.priceCell, el]; }));
      var totaisPreco = new Map(Array.from(linha.querySelectorAll('[data-price-total]')).map(function (el) { return [el.dataset.priceTotal, el]; }));
      item.precos.forEach(function (preco) {
        var chave = chavePreco(item.itemId, preco.fornecedorId);
        var celula = celulasPreco.get(chave);
        var total = totaisPreco.get(chave);
        var original = precosOriginais.get(chave) || {};
        if (celula) {
          celula.dataset.best = String(preco.menorPreco === true);
          celula.dataset.unavailable = String(original.indisponivel === true);
        }
        if (total) total.textContent = dinheiro(preco.valorTotalCentavos);
      });
    });
    calculos.fornecedores.forEach(function (fornecedor) {
      var total = totaisFornecedores.get(String(fornecedor.fornecedorId));
      if (total) total.textContent = dinheiro(fornecedor.totalCentavos);
      var completude = completudes.get(String(fornecedor.fornecedorId));
      var card = cards.get(String(fornecedor.fornecedorId));
      var cabecalho = cabecalhos.get(String(fornecedor.fornecedorId));
      if (completude) {
        completude.dataset.complete = String(fornecedor.completo);
        completude.textContent = fornecedor.completo ? 'Completa' : 'Faltam ' + fornecedor.itensFaltantes;
      }
      if (card) {
        card.dataset.incomplete = String(!fornecedor.completo);
        card.dataset.disabled = String(!fornecedor.ativoComparacao);
      }
      if (cabecalho) cabecalho.dataset.disabled = String(!fornecedor.ativoComparacao);
    });
    var idealGeral = elementos.tabelaWrap.querySelector('[data-ideal-grand-total]');
    if (idealGeral) idealGeral.textContent = dinheiro(calculos.custoIdealTotalCentavos);
    atualizarResumo();
  }

  function atualizarResumo() {
    var calculos = estado.calculos;
    if (!calculos) return;
    var mapa = new Map(estado.cotacao.fornecedores.map(function (f) { return [String(f.id), f]; }));
    var recomendados = calculos.fornecedorIdsRecomendados.map(function (id) { return nomeFornecedor(mapa.get(String(id))); });
    elementos.resumo.innerHTML =
      '<article class="cotacoes-summary-card" data-tone="primary"><span class="cotacoes-summary-label">Custo ideal</span><strong class="cotacoes-summary-value">' + escapar(dinheiro(calculos.custoIdealTotalCentavos)) + '</strong><small class="cotacoes-summary-note">Soma dos menores preços por item</small></article>' +
      '<article class="cotacoes-summary-card" data-tone="success"><span class="cotacoes-summary-label">Fornecedor recomendado</span><strong class="cotacoes-summary-value" title="' + escapar(recomendados.join(' / ')) + '">' + escapar(recomendados.join(' / ') || 'Nenhum completo') + '</strong><small class="cotacoes-summary-note">Menor proposta completa com frete</small></article>' +
      '<article class="cotacoes-summary-card"><span class="cotacoes-summary-label">Total recomendado</span><strong class="cotacoes-summary-value">' + escapar(dinheiro(calculos.totalRecomendadoCentavos)) + '</strong><small class="cotacoes-summary-note">Fornecedor completo de menor total</small></article>' +
      '<article class="cotacoes-summary-card"><span class="cotacoes-summary-label">Potencial de negociação</span><strong class="cotacoes-summary-value">' + escapar(dinheiro(calculos.descontoSugeridoCentavos)) + '</strong><small class="cotacoes-summary-note">' + escapar(Financeiro.formatarBasisPoints(calculos.percentualNegociacaoBasisPoints)) + ' sobre o recomendado</small></article>' +
      '<article class="cotacoes-summary-card"><span class="cotacoes-summary-label">Cobertura da cotação</span><strong class="cotacoes-summary-value">' + escapar(calculos.contadores.itens) + ' itens · ' + escapar(calculos.contadores.fornecedores) + ' fornecedores</strong><small class="cotacoes-summary-note">' + escapar(calculos.contadores.fornecedoresCompletos) + ' completos · ' + escapar(calculos.contadores.fornecedoresIncompletos) + ' incompletos</small></article>';
    elementos.analise.textContent = calculos.analiseTextual || 'Adicione itens, fornecedores e preços para gerar a análise.';
  }

  function atualizarBotoes() {
    var editavel = podeEditar();
    var existe = Boolean(estado.cotacao && estado.cotacao.id);
    var ocupado = estado.salvando || estado.acaoEmCurso;
    elementos.salvar.disabled = !editavel || ocupado;
    elementos.finalizar.disabled = !editavel || ocupado;
    elementos.imprimir.disabled = !estado.cotacao || ocupado;
    elementos.duplicar.disabled = !existe || ocupado;
    elementos.cancelar.disabled = !existe || !editavel || ocupado;
    elementos.excluir.disabled = !existe || !editavel || ocupado;
    elementos.adicionarItem.disabled = !editavel || estado.acaoEmCurso;
    elementos.adicionarFornecedor.disabled = !editavel || estado.acaoEmCurso;
    elementos.voltar.disabled = ocupado;
    elementos.fieldset.disabled = !editavel || estado.acaoEmCurso;
  }

  function iniciarAcao() {
    if (estado.acaoEmCurso) return false;
    estado.acaoEmCurso = true;
    atualizarBotoes();
    return true;
  }

  function encerrarAcao() {
    estado.acaoEmCurso = false;
    atualizarBotoes();
  }

  function alterarOrdem(lista, id, direcao) {
    var indice = lista.findIndex(function (entidade) { return String(entidade.id) === String(id); });
    var destino = indice + direcao;
    if (indice < 0 || destino < 0 || destino >= lista.length) return;
    var temporario = lista[indice];
    lista[indice] = lista[destino];
    lista[destino] = temporario;
    lista.forEach(function (entidade, ordem) { entidade.ordem = ordem; });
  }

  function precosPreenchidosPorItem(id) {
    return estado.cotacao.precos.filter(function (preco) {
      return String(preco.itemId) === String(id) && (Number.isSafeInteger(preco.valorUnitarioCentavos) || preco.indisponivel || preco.observacao);
    }).length;
  }

  function precosPreenchidosPorFornecedor(id) {
    return estado.cotacao.precos.filter(function (preco) {
      return String(preco.fornecedorId) === String(id) && (Number.isSafeInteger(preco.valorUnitarioCentavos) || preco.indisponivel || preco.observacao);
    }).length;
  }

  function acaoItem(acao, id) {
    if (!podeEditar()) return;
    var indice = estado.cotacao.itens.findIndex(function (item) { return String(item.id) === String(id); });
    if (indice < 0) return;
    if (acao === 'up' || acao === 'down') alterarOrdem(estado.cotacao.itens, id, acao === 'up' ? -1 : 1);
    if (acao === 'duplicate') {
      var original = estado.cotacao.itens[indice];
      var duplicado = novoItem(original);
      estado.cotacao.itens.splice(indice + 1, 0, duplicado);
      estado.cotacao.fornecedores.forEach(function (fornecedor) {
        var origem = obterPreco(original.id, fornecedor.id);
        estado.cotacao.precos.push({ id: idTemporario('preco'), itemId: duplicado.id, fornecedorId: fornecedor.id, valorUnitarioCentavos: origem.valorUnitarioCentavos, observacao: origem.observacao || '', indisponivel: origem.indisponivel === true });
      });
    }
    if (acao === 'delete') {
      var preenchidos = precosPreenchidosPorItem(id);
      if (!window.confirm(preenchidos ? 'Este item possui ' + preenchidos + ' preço(s) preenchido(s), que também serão excluídos. Continuar?' : 'Excluir este item?')) return;
      estado.cotacao.itens.splice(indice, 1);
      estado.cotacao.precos = estado.cotacao.precos.filter(function (preco) { return String(preco.itemId) !== String(id); });
    }
    garantirMatriz(estado.cotacao);
    marcarSujo();
    renderizarTabela();
    recalcular();
    atualizarCalculosNaTela();
  }

  function acaoFornecedor(acao, id) {
    if (!podeEditar()) return;
    var indice = estado.cotacao.fornecedores.findIndex(function (f) { return String(f.id) === String(id); });
    if (indice < 0) return;
    if (acao === 'up' || acao === 'down') alterarOrdem(estado.cotacao.fornecedores, id, acao === 'up' ? -1 : 1);
    if (acao === 'duplicate') {
      var original = estado.cotacao.fornecedores[indice];
      var duplicado = novoFornecedor(original);
      estado.cotacao.fornecedores.splice(indice + 1, 0, duplicado);
      estado.cotacao.itens.forEach(function (item) {
        var origem = obterPreco(item.id, original.id);
        estado.cotacao.precos.push({ id: idTemporario('preco'), itemId: item.id, fornecedorId: duplicado.id, valorUnitarioCentavos: origem.valorUnitarioCentavos, observacao: origem.observacao || '', indisponivel: origem.indisponivel === true });
      });
    }
    if (acao === 'delete') {
      var preenchidos = precosPreenchidosPorFornecedor(id);
      if (!window.confirm(preenchidos ? 'Este fornecedor possui ' + preenchidos + ' preço(s) preenchido(s), que também serão excluídos. Continuar?' : 'Excluir este fornecedor?')) return;
      estado.cotacao.fornecedores.splice(indice, 1);
      estado.cotacao.precos = estado.cotacao.precos.filter(function (preco) { return String(preco.fornecedorId) !== String(id); });
    }
    garantirMatriz(estado.cotacao);
    marcarSujo();
    renderizarFornecedores();
    renderizarTabela();
    recalcular();
    atualizarCalculosNaTela();
  }

  async function duplicarAtual() {
    if (!estado.cotacao || !estado.cotacao.id) return;
    if (!iniciarAcao()) return;
    try {
      if (estado.sujo) await salvarCotacao({ automatico: false });
      if (estado.sujo) {
        mostrarErroGeral(['Houve novas alterações durante o salvamento. Aguarde o autosave antes de duplicar.']);
        return;
      }
      if (!window.confirm('Criar uma nova cotação com os mesmos dados?')) return;
      var dados = await chamarApi('/' + encodeURIComponent(estado.cotacao.id) + '/duplicar', { method: 'POST', body: {} });
      estado.requisicaoCotacao += 1;
      estado.cotacao = normalizarEstadoCotacao(dados.cotacao);
      estado.sujo = false;
      renderizarEditor();
      mostrarVista('editor');
    } catch (erro) {
      mostrarErroGeral(mensagemErro(erro));
    } finally {
      encerrarAcao();
    }
  }

  async function finalizarAtual() {
    var erros = validarCotacao(true);
    mostrarErroGeral(erros);
    if (erros.length) return;
    if (!iniciarAcao()) return;
    try {
      if (estado.sujo || !estado.cotacao.id) await salvarCotacao({ automatico: false });
      if (estado.sujo) {
        mostrarErroGeral(['Houve novas alterações durante o salvamento. Aguarde o autosave antes de finalizar.']);
        return;
      }
      if (!window.confirm('Finalizar esta cotação? Depois disso ela ficará somente para leitura e impressão.')) return;
      var dados = await chamarApi('/' + encodeURIComponent(estado.cotacao.id) + '/finalizar', { method: 'POST', body: {} });
      estado.cotacao = normalizarEstadoCotacao(dados.cotacao);
      estado.sujo = false;
      removerRascunhoLocal(estado.cotacao);
      renderizarEditor();
    } catch (erro) {
      mostrarErroGeral(mensagemErro(erro));
    } finally {
      encerrarAcao();
    }
  }

  async function cancelarAtual() {
    if (!estado.cotacao || !estado.cotacao.id || !podeEditar()) return;
    var motivo = window.prompt('Motivo do cancelamento (opcional):', '');
    if (motivo === null || !window.confirm('Confirmar o cancelamento desta cotação?')) return;
    if (!iniciarAcao()) return;
    try {
      var dados = await chamarApi('/' + encodeURIComponent(estado.cotacao.id) + '/cancelar', { method: 'POST', body: { motivo: motivo } });
      estado.cotacao = normalizarEstadoCotacao(dados.cotacao);
      estado.sujo = false;
      removerRascunhoLocal(estado.cotacao);
      renderizarEditor();
    } catch (erro) {
      mostrarErroGeral(mensagemErro(erro));
    } finally {
      encerrarAcao();
    }
  }

  async function excluirPorId(id, voltar) {
    if (!window.confirm('Excluir definitivamente esta cotação em andamento? Esta ação não pode ser desfeita.')) return;
    if (!iniciarAcao()) return;
    try {
      await chamarApi('/' + encodeURIComponent(id), { method: 'DELETE' });
      if (estado.cotacao && String(estado.cotacao.id) === String(id)) removerRascunhoLocal(estado.cotacao);
      if (voltar) {
        estado.requisicaoCotacao += 1;
        estado.cotacao = null;
        estado.sujo = false;
        mostrarVista('historico');
      }
      await carregarHistorico(estado.pagina);
    } catch (erro) {
      if (voltar) mostrarErroGeral(mensagemErro(erro));
      else elementos.listaStatus.textContent = erro.message;
    } finally {
      encerrarAcao();
    }
  }

  function fornecedoresSelecionadosImpressao() {
    return Array.from(elementos.printFornecedores.querySelectorAll('input[type="checkbox"]:checked')).map(function (campo) { return campo.value; });
  }

  function atualizarDocumentoImpressao() {
    if (!estado.cotacao || !PrintView) return;
    elementos.printDocument.innerHTML = PrintView.renderizar(estado.cotacao, {
      fornecedorIds: fornecedoresSelecionadosImpressao(),
      incluirObservacoes: elementos.printObservacoes.checked,
      incluirAssinaturas: elementos.printAssinaturas.checked,
      incluirFornecedoresIncompletos: elementos.printIncompletos.checked
    });
  }

  function abrirPreviewImpressao() {
    if (!estado.cotacao || !PrintView) {
      mostrarErroGeral(['O componente de impressão não está disponível.']);
      return;
    }
    elementos.printFornecedores.innerHTML = estado.cotacao.fornecedores.map(function (fornecedor) {
      return '<label><input type="checkbox" value="' + escapar(fornecedor.id) + '" checked> ' + escapar(nomeFornecedor(fornecedor)) + '</label>';
    }).join('') || '<span>Nenhum fornecedor cadastrado.</span>';
    atualizarDocumentoImpressao();
    elementos.printPreview.hidden = false;
    estado.imprimindo = true;
    elementos.printFechar.focus();
  }

  async function prepararPreviewAtual() {
    if (!estado.cotacao || !iniciarAcao()) return;
    var cotacaoReferencia = estado.cotacao;
    var geracaoCotacao = estado.requisicaoCotacao;
    try {
      if (estado.sujo || !estado.cotacao.id) await salvarCotacao({ automatico: false });
      if (geracaoCotacao !== estado.requisicaoCotacao) return;
      cotacaoReferencia = estado.cotacao;
      if (estado.sujo || !estado.cotacao.id) {
        mostrarErroGeral(['Conclua o salvamento da cotação antes de gerar o documento.']);
        return;
      }
      var dados = await chamarApi('/' + encodeURIComponent(estado.cotacao.id) + '/impressao');
      if (geracaoCotacao !== estado.requisicaoCotacao || estado.cotacao !== cotacaoReferencia) return;
      estado.cotacao = normalizarEstadoCotacao(dados.cotacao);
      estado.sujo = false;
      renderizarEditor();
      abrirPreviewImpressao();
    } catch (erro) {
      mostrarErroGeral(mensagemErro(erro));
    } finally {
      encerrarAcao();
    }
  }

  function fecharPreviewImpressao() {
    elementos.printPreview.hidden = true;
    document.body.classList.remove('cotacoes-printing');
    estado.imprimindo = false;
  }

  function executarImpressao() {
    atualizarDocumentoImpressao();
    document.body.classList.add('cotacoes-printing');
    window.setTimeout(function () { window.print(); }, 30);
  }

  function aoInputEditor(evento) {
    if (!estado.cotacao || !podeEditar()) return;
    var alvo = evento.target;
    if (alvo.dataset.cotacaoField) {
      estado.cotacao[alvo.dataset.cotacaoField] = alvo.value;
      marcarSujo();
      return;
    }
    if (alvo.dataset.approvalField) {
      estado.cotacao.aprovacao = estado.cotacao.aprovacao || {};
      estado.cotacao.aprovacao[alvo.dataset.approvalField] = alvo.value;
      marcarSujo();
      return;
    }
    if (alvo.dataset.itemId) {
      var item = estado.cotacao.itens.find(function (entrada) { return String(entrada.id) === String(alvo.dataset.itemId); });
      if (!item) return;
      if (alvo.dataset.itemField === 'quantidadeMillesimos') {
        item.quantidadeMillesimos = Financeiro.parseQuantidadeParaMillesimos(alvo.value);
        alvo.setAttribute('aria-invalid', String(item.quantidadeMillesimos === null || item.quantidadeMillesimos <= 0));
        agendarCalculoUI(item.id, false);
      } else {
        item[alvo.dataset.itemField] = alvo.value;
      }
      marcarSujo();
      return;
    }
    if (alvo.dataset.supplierId) {
      var fornecedor = estado.cotacao.fornecedores.find(function (entrada) { return String(entrada.id) === String(alvo.dataset.supplierId); });
      if (!fornecedor) return;
      var campo = alvo.dataset.supplierField;
      if (campo === 'freteCentavos') {
        fornecedor[campo] = Financeiro.parseMoedaParaCentavos(alvo.value);
        alvo.setAttribute('aria-invalid', String(fornecedor[campo] === null || fornecedor[campo] < 0));
        agendarCalculoUI(null, false);
      } else if (campo === 'ativoComparacao') {
        fornecedor[campo] = alvo.checked;
        var cabecalho = elementos.tabelaWrap.querySelector('[data-supplier-heading="' + escaparSeletor(fornecedor.id) + '"]');
        if (cabecalho) cabecalho.dataset.disabled = String(!fornecedor[campo]);
        agendarCalculoUI(null, true);
      } else {
        fornecedor[campo] = alvo.value;
        if (campo === 'nome' || campo === 'nomeFantasia' || campo === 'razaoSocial') {
          var nome = nomeFornecedor(fornecedor);
          elementos.editor.querySelectorAll('[data-supplier-name="' + escaparSeletor(fornecedor.id) + '"],[data-supplier-heading="' + escaparSeletor(fornecedor.id) + '"]').forEach(function (el) { el.textContent = nome; });
          atualizarResumo();
        }
      }
      marcarSujo();
      return;
    }
    if (alvo.dataset.priceItem) {
      var preco = obterPreco(alvo.dataset.priceItem, alvo.dataset.priceSupplier);
      if (alvo.dataset.field === 'indisponivel') {
        preco.indisponivel = alvo.checked;
        var celula = alvo.closest('.cotacoes-price-cell');
        var campoPreco = celula && celula.querySelector('[data-field="valorUnitarioCentavos"]');
        if (campoPreco) campoPreco.disabled = preco.indisponivel;
      } else if (alvo.dataset.field === 'observacao') {
        preco.observacao = alvo.value;
      } else {
        preco.valorUnitarioCentavos = Financeiro.parseMoedaParaCentavos(alvo.value);
        preco._valorDigitado = alvo.value;
        alvo.setAttribute('aria-invalid', String(alvo.value.trim() && (preco.valorUnitarioCentavos === null || preco.valorUnitarioCentavos <= 0)));
      }
      marcarSujo();
      if (alvo.dataset.field !== 'observacao') agendarCalculoUI(preco.itemId, false);
    }
  }

  function aoSairEditor(evento) {
    var alvo = evento.target;
    if (!estado.cotacao) return;
    if (alvo.dataset.itemField === 'quantidadeMillesimos') {
      var item = estado.cotacao.itens.find(function (entrada) { return String(entrada.id) === String(alvo.dataset.itemId); });
      if (item && Number.isSafeInteger(item.quantidadeMillesimos)) alvo.value = quantidade(item.quantidadeMillesimos).replace(/\./g, '');
    }
    if (alvo.dataset.supplierField === 'freteCentavos') {
      var fornecedor = estado.cotacao.fornecedores.find(function (entrada) { return String(entrada.id) === String(alvo.dataset.supplierId); });
      if (fornecedor && Number.isSafeInteger(fornecedor.freteCentavos)) alvo.value = dinheiroParaEdicao(fornecedor.freteCentavos);
    }
    if (alvo.dataset.field === 'valorUnitarioCentavos' && alvo.dataset.priceItem) {
      var preco = obterPreco(alvo.dataset.priceItem, alvo.dataset.priceSupplier);
      if (Number.isSafeInteger(preco.valorUnitarioCentavos)) alvo.value = dinheiroParaEdicao(preco.valorUnitarioCentavos);
    }
    if (alvo.dataset.supplierField === 'cnpj') {
      var digitos = Financeiro.normalizarCnpj(alvo.value);
      alvo.setAttribute('aria-invalid', String(Boolean(digitos && !Financeiro.validarCnpj(digitos))));
    }
    if (alvo.dataset.supplierField === 'email') {
      alvo.setAttribute('aria-invalid', String(Boolean(alvo.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alvo.value.trim()))));
    }
  }

  function aoTecladoTabela(evento) {
    if (evento.key !== 'Enter' || evento.shiftKey || !evento.target.matches('[data-field="valorUnitarioCentavos"]')) return;
    evento.preventDefault();
    var campos = Array.from(elementos.tabelaWrap.querySelectorAll('[data-field="valorUnitarioCentavos"]:not(:disabled)'));
    var indice = campos.indexOf(evento.target);
    if (indice >= 0 && campos[indice + 1]) {
      campos[indice + 1].focus();
      campos[indice + 1].select();
    }
  }

  function aoCliqueEditor(evento) {
    var itemBotao = evento.target.closest('[data-item-action]');
    if (itemBotao) { acaoItem(itemBotao.dataset.itemAction, itemBotao.dataset.id); return; }
    var fornecedorBotao = evento.target.closest('[data-supplier-action]');
    if (fornecedorBotao) acaoFornecedor(fornecedorBotao.dataset.supplierAction, fornecedorBotao.dataset.id);
  }

  async function aoCliqueHistorico(evento) {
    var botao = evento.target.closest('[data-history-action]');
    if (!botao) return;
    var acao = botao.dataset.historyAction;
    var id = botao.dataset.id;
    if (acao === 'retry') carregarHistorico(estado.pagina);
    if (acao === 'open') abrirCotacao(id, false);
    if (acao === 'print') abrirCotacao(id, true);
    if (acao === 'delete') excluirPorId(id, false);
    if (acao === 'cancel') {
      var motivo = window.prompt('Motivo do cancelamento (opcional):', '');
      if (motivo === null || !window.confirm('Confirmar o cancelamento desta cotação?')) return;
      if (!iniciarAcao()) return;
      try {
        await chamarApi('/' + encodeURIComponent(id) + '/cancelar', { method: 'POST', body: { motivo: motivo } });
        await carregarHistorico(estado.pagina);
      } catch (erroCancelamento) {
        elementos.listaStatus.textContent = erroCancelamento.message;
      } finally {
        encerrarAcao();
      }
    }
    if (acao === 'duplicate') {
      if (!window.confirm('Duplicar esta cotação?')) return;
      if (!iniciarAcao()) return;
      try {
        var dados = await chamarApi('/' + encodeURIComponent(id) + '/duplicar', { method: 'POST', body: {} });
        estado.requisicaoCotacao += 1;
        estado.cotacao = normalizarEstadoCotacao(dados.cotacao);
        estado.sujo = false;
        renderizarEditor();
        mostrarVista('editor');
      } catch (erro) {
        elementos.listaStatus.textContent = erro.message;
      } finally {
        encerrarAcao();
      }
    }
  }

  function voltarHistorico() {
    if (estado.sujo && !window.confirm('Há alterações não salvas. Voltar ao histórico mesmo assim? O rascunho continuará salvo neste navegador.')) return;
    cancelarAgendamentosEdicao();
    estado.requisicaoCotacao += 1;
    mostrarVista('historico');
    carregarHistorico(estado.pagina);
  }

  function vincularEventos() {
    elementos.nova.addEventListener('click', iniciarNovaCotacao);
    elementos.voltar.addEventListener('click', voltarHistorico);
    elementos.filtros.addEventListener('submit', function (evento) { evento.preventDefault(); carregarHistorico(1); });
    elementos.limparFiltros.addEventListener('click', function () { elementos.filtros.reset(); carregarHistorico(1); });
    elementos.listaCorpo.addEventListener('click', aoCliqueHistorico);
    elementos.listaStatus.addEventListener('click', aoCliqueHistorico);
    elementos.paginacao.addEventListener('click', function (evento) {
      var botao = evento.target.closest('[data-page]');
      if (botao && !botao.disabled) carregarHistorico(Number(botao.dataset.page));
    });
    elementos.form.addEventListener('input', aoInputEditor);
    elementos.form.addEventListener('focusout', aoSairEditor);
    elementos.form.addEventListener('click', aoCliqueEditor);
    elementos.tabelaWrap.addEventListener('keydown', aoTecladoTabela);
    elementos.form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      salvarCotacao({ automatico: false }).catch(function () { /* erro já exibido */ });
    });
    elementos.adicionarItem.addEventListener('click', function () {
      if (!podeEditar() || estado.cotacao.itens.length >= 500) return;
      estado.cotacao.itens.push(novoItem());
      garantirMatriz(estado.cotacao);
      marcarSujo();
      renderizarTabela();
      recalcular();
      atualizarCalculosNaTela();
    });
    elementos.adicionarFornecedor.addEventListener('click', function () {
      if (!podeEditar() || estado.cotacao.fornecedores.length >= 100) return;
      estado.cotacao.fornecedores.push(novoFornecedor());
      garantirMatriz(estado.cotacao);
      marcarSujo();
      renderizarFornecedores();
      renderizarTabela();
      recalcular();
      atualizarCalculosNaTela();
    });
    elementos.finalizar.addEventListener('click', finalizarAtual);
    elementos.duplicar.addEventListener('click', duplicarAtual);
    elementos.cancelar.addEventListener('click', cancelarAtual);
    elementos.excluir.addEventListener('click', function () { if (estado.cotacao && estado.cotacao.id) excluirPorId(estado.cotacao.id, true); });
    elementos.imprimir.addEventListener('click', prepararPreviewAtual);
    elementos.printFechar.addEventListener('click', fecharPreviewImpressao);
    elementos.printExecutar.addEventListener('click', executarImpressao);
    [elementos.printObservacoes, elementos.printAssinaturas, elementos.printIncompletos, elementos.printFornecedores].forEach(function (el) {
      el.addEventListener('change', atualizarDocumentoImpressao);
    });
    elementos.printPreview.addEventListener('keydown', function (evento) { if (evento.key === 'Escape') fecharPreviewImpressao(); });
    window.addEventListener('afterprint', function () { document.body.classList.remove('cotacoes-printing'); });
    window.addEventListener('beforeunload', function (evento) {
      if (!estado.sujo) return;
      salvarRascunhoLocal();
      evento.preventDefault();
      evento.returnValue = '';
    });
    window.addEventListener('storage', function (evento) {
      if (evento.key === 'user' && !possuiAcesso()) mostrarAcessoNegado();
    });
  }

  function inicializar() {
    if (estado.inicializado) return true;
    if (!Financeiro || typeof Financeiro.calcularCotacao !== 'function') return false;
    elementos = {
      acessoNegado: porId('cotacoes-acesso-negado'), app: porId('cotacoes-app'), historico: porId('cotacoes-historico'), editor: porId('cotacoes-editor'),
      nova: porId('cotacoes-nova'), filtros: porId('cotacoes-filtros'), ordenacao: porId('cotacoes-ordenacao'), limparFiltros: porId('cotacoes-limpar-filtros'),
      listaStatus: porId('cotacoes-lista-status'), listaCorpo: porId('cotacoes-lista-corpo'), paginacao: porId('cotacoes-paginacao'),
      voltar: porId('cotacoes-voltar'), editorTitulo: porId('cotacoes-editor-titulo'), statusBadge: porId('cotacoes-status-badge'), saveState: porId('cotacoes-save-state'), erros: porId('cotacoes-erros-gerais'),
      form: porId('cotacoes-form'), fieldset: porId('cotacoes-fieldset'), fornecedores: porId('cotacoes-fornecedores-lista'), adicionarFornecedor: porId('cotacoes-adicionar-fornecedor'),
      tabelaWrap: porId('cotacoes-tabela-wrap'), sheetStatus: porId('cotacoes-sheet-status'), adicionarItem: porId('cotacoes-adicionar-item'), resumo: porId('cotacoes-resumo-cards'), analise: porId('cotacoes-analise'),
      salvar: porId('cotacoes-salvar'), finalizar: porId('cotacoes-finalizar'), imprimir: porId('cotacoes-imprimir'), duplicar: porId('cotacoes-duplicar'), cancelar: porId('cotacoes-cancelar'), excluir: porId('cotacoes-excluir'),
      printPreview: porId('cotacoes-print-preview'), printFechar: porId('cotacoes-print-fechar'), printExecutar: porId('cotacoes-print-executar'), printObservacoes: porId('cotacoes-print-observacoes'), printAssinaturas: porId('cotacoes-print-assinaturas'), printIncompletos: porId('cotacoes-print-incompletos'), printFornecedores: porId('cotacoes-print-fornecedores'), printDocument: porId('cotacoes-print-document')
    };
    if (!elementos.app || !elementos.form) return false;
    vincularEventos();
    estado.inicializado = true;
    return true;
  }

  function abrir() {
    if (!inicializar()) return;
    if (!autorizarOuNegar()) return;
    mostrarVista('historico');
    carregarHistorico(1);
  }

  window.CotacoesApp = Object.freeze({ abrir: abrir });
  if (document.readyState !== 'loading') inicializar();
  else document.addEventListener('DOMContentLoaded', inicializar, { once: true });
}(window, document));
