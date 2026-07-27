(function carregarComprovanteEntregaApp(root) {
  'use strict';

  var Config = root.ComprovanteEntregaConfig;
  var Modelo = root.ComprovanteEntregaModelo;
  var Pdf = root.ComprovanteEntregaPdf;
  var estado = {
    inicializado: false,
    carregando: false,
    sequenciaItem: 0,
    logoDataUrlPromise: null,
    bibliotecaPdfPromise: null,
    bibliotecaPdfPronta: false,
    previewUrl: ''
  };
  var refs = {};

  function porId(id) {
    return root.document ? root.document.getElementById(id) : null;
  }

  function podeAcessar() {
    return typeof root.usuarioAtualPodeEmitirComprovanteEntrega === 'function' &&
      root.usuarioAtualPodeEmitirComprovanteEntrega() === true;
  }

  function hojeLocal() {
    var agora = new Date();
    return [
      agora.getFullYear(),
      String(agora.getMonth() + 1).padStart(2, '0'),
      String(agora.getDate()).padStart(2, '0')
    ].join('-');
  }

  function valorCampo(nome) {
    var campo = refs.form && refs.form.querySelector('[data-name="' + nome + '"]');
    return campo ? campo.value : '';
  }

  function mostrarStatus(mensagem, tipo) {
    if (!refs.status) return;
    refs.status.hidden = !mensagem;
    refs.status.textContent = mensagem || '';
    refs.status.className = 'ce-status' + (tipo ? ' is-' + tipo : '');
  }

  function definirCarregando(carregando, mensagem) {
    estado.carregando = carregando;
    if (refs.form) refs.form.classList.toggle('is-loading', carregando);
    [refs.gerar, refs.visualizar, refs.baixar, refs.limpar, refs.adicionar].forEach(function (botao) {
      if (botao) botao.disabled = carregando;
    });
    if (refs.gerar) {
      var rotulo = refs.gerar.querySelector('.ce-btn-label');
      if (rotulo) rotulo.textContent = carregando ? 'Gerando PDF…' : 'Gerar PDF';
    }
    if (carregando && mensagem) mostrarStatus(mensagem, 'loading');
  }

  function criarElemento(tag, classe, conteudo) {
    var elemento = root.document.createElement(tag);
    if (classe) elemento.className = classe;
    if (conteudo !== undefined) elemento.textContent = conteudo;
    return elemento;
  }

  function renderizarEmitente() {
    if (!refs.emitente || !Config || !Config.EMPRESA) return;
    var empresa = Config.EMPRESA;
    refs.emitente.replaceChildren();

    var nome = criarElemento('strong', 'ce-issuer-name', empresa.razaoSocial);
    var detalhes = criarElemento('div', 'ce-issuer-details');
    [
      'CNPJ ' + empresa.cnpj,
      empresa.endereco,
      empresa.cidade + ' • CEP ' + empresa.cep,
      'Telefone ' + empresa.telefone
    ].forEach(function (linha) {
      detalhes.appendChild(criarElemento('span', '', linha));
    });
    refs.emitente.appendChild(nome);
    refs.emitente.appendChild(detalhes);
  }

  function atualizarIndicesItens() {
    var itens = Array.from(refs.itens.querySelectorAll('.ce-item'));
    itens.forEach(function (item, indice) {
      item.dataset.index = String(indice);
      var marcador = item.querySelector('.ce-item-index');
      if (marcador) marcador.textContent = String(indice + 1).padStart(2, '0');
      var remover = item.querySelector('[data-action="remover-item"]');
      if (remover) {
        remover.disabled = itens.length === 1;
        remover.setAttribute('aria-label', 'Remover mercadoria ' + (indice + 1));
      }
      item.querySelectorAll('label').forEach(function (label) {
        var campo = label.parentElement && label.parentElement.querySelector('[data-item-field]');
        if (!campo) return;
        var id = 'ce-item-' + item.dataset.itemId + '-' + campo.dataset.itemField;
        campo.id = id;
        label.htmlFor = id;
      });
    });
  }

  function adicionarItem(opcoes) {
    opcoes = opcoes || {};
    if (!refs.template || !refs.itens) return null;
    var fragmento = refs.template.content.cloneNode(true);
    var item = fragmento.querySelector('.ce-item');
    estado.sequenciaItem += 1;
    item.dataset.itemId = String(estado.sequenciaItem);
    var unidade = item.querySelector('[data-item-field="unidade"]');
    if (unidade) unidade.value = opcoes.unidade === undefined ? 'UN' : opcoes.unidade;
    refs.itens.appendChild(fragmento);
    atualizarIndicesItens();
    recalcular();
    if (opcoes.focar) {
      var descricao = item.querySelector('[data-item-field="descricao"]');
      if (descricao) descricao.focus();
    }
    return item;
  }

  function itemBruto(item) {
    function campo(nome) {
      var entrada = item.querySelector('[data-item-field="' + nome + '"]');
      return entrada ? entrada.value : '';
    }
    return {
      codigo: campo('codigo'),
      descricao: campo('descricao'),
      unidade: campo('unidade'),
      quantidade: campo('quantidade'),
      valorUnitario: campo('valorUnitario')
    };
  }

  function coletarFormulario() {
    return {
      dadosVenda: {
        vendaMarketplace: valorCampo('vendaMarketplace'),
        pedidoInterno: valorCampo('pedidoInterno'),
        numeroNfe: valorCampo('nfeNumero'),
        serieNfe: valorCampo('nfeSerie'),
        chaveAcessoNfe: valorCampo('nfeChave'),
        dataEntrega: valorCampo('dataEntrega')
      },
      destinatario: {
        nome: valorCampo('destinatario'),
        documento: valorCampo('documento'),
        inscricaoEstadual: valorCampo('inscricaoEstadual'),
        contato: valorCampo('contato'),
        endereco: valorCampo('endereco'),
        numero: valorCampo('numero'),
        bairro: valorCampo('bairro'),
        cidade: valorCampo('cidade'),
        estado: valorCampo('estado'),
        cep: valorCampo('cep')
      },
      itens: Array.from(refs.itens.querySelectorAll('.ce-item')).map(itemBruto),
      frete: valorCampo('frete'),
      formaEntrega: valorCampo('formaEntrega'),
      descricaoOutraForma: valorCampo('outraForma')
    };
  }

  function moedaOuZero(centavos) {
    return Modelo.formatarMoeda(
      Number.isSafeInteger(centavos) && centavos >= 0 ? centavos : 0,
      'R$\u00a00,00'
    );
  }

  function recalcular() {
    if (!refs.itens || !Modelo) return;
    var itensNormalizados = Array.from(refs.itens.querySelectorAll('.ce-item')).map(function (item) {
      var normalizado = Modelo.normalizarItem(itemBruto(item));
      var total = item.querySelector('[data-item-total]');
      if (total) total.textContent = moedaOuZero(normalizado.valorTotalCentavos);
      return normalizado;
    });
    var frete = Modelo.parseMoedaCentavos(valorCampo('frete'));
    var totais = Modelo.calcularTotais(itensNormalizados, frete === null ? 0 : frete);
    if (refs.totalProdutos) refs.totalProdutos.textContent = moedaOuZero(totais.totalProdutosCentavos);
    if (refs.totalFrete) refs.totalFrete.textContent = moedaOuZero(totais.freteCentavos);
    if (refs.totalGeral) refs.totalGeral.textContent = moedaOuZero(totais.totalGeralCentavos);
  }

  function limparErroCampo(campo) {
    if (!campo) return;
    campo.removeAttribute('aria-invalid');
    campo.classList.remove('is-invalid');
    var envoltorio = campo.closest('.ce-field, .ce-item-field, .ce-item');
    if (!envoltorio) return;
    envoltorio.classList.remove('has-error');
    envoltorio.querySelectorAll('.ce-field-error').forEach(function (erro) {
      erro.remove();
    });
  }

  function limparErros() {
    if (!refs.form) return;
    refs.form.querySelectorAll('[aria-invalid="true"]').forEach(function (campo) {
      campo.removeAttribute('aria-invalid');
      campo.classList.remove('is-invalid');
    });
    refs.form.querySelectorAll('.has-error').forEach(function (elemento) {
      elemento.classList.remove('has-error');
    });
    refs.form.querySelectorAll('.ce-field-error').forEach(function (erro) {
      erro.remove();
    });
  }

  function campoDoErro(caminho) {
    var mapa = {
      'destinatario.nome': '[data-name="destinatario"]',
      'destinatario.endereco': '[data-name="endereco"]',
      dataEntrega: '[data-name="dataEntrega"]',
      frete: '[data-name="frete"]',
      totais: '[data-name="frete"]',
      descricaoOutraForma: '[data-name="outraForma"]'
    };
    if (mapa[caminho]) return refs.form.querySelector(mapa[caminho]);
    var item = caminho.match(/^itens\.(\d+)\.(descricao|quantidade|valorUnitario)$/);
    if (item) {
      var linha = refs.itens.querySelectorAll('.ce-item')[Number(item[1])];
      return linha ? linha.querySelector('[data-item-field="' + item[2] + '"]') : null;
    }
    return null;
  }

  function exibirErros(resultado) {
    limparErros();
    var primeiroCampo = null;
    resultado.erros.forEach(function (erro) {
      var campo = campoDoErro(erro.campo);
      if (!campo) return;
      if (!primeiroCampo) primeiroCampo = campo;
      campo.setAttribute('aria-invalid', 'true');
      campo.classList.add('is-invalid');
      var envoltorio = campo.closest('.ce-field, .ce-item-field') || campo.parentElement;
      if (!envoltorio || envoltorio.querySelector('.ce-field-error')) return;
      envoltorio.classList.add('has-error');
      envoltorio.appendChild(criarElemento('span', 'ce-field-error', erro.mensagem));
    });
    mostrarStatus(
      resultado.erros.length === 1
        ? resultado.erros[0].mensagem
        : 'Revise os ' + resultado.erros.length + ' campos indicados antes de gerar o PDF.',
      'error'
    );
    if (primeiroCampo) primeiroCampo.focus();
  }

  function validarEColetar() {
    var resultado = Modelo.validar(coletarFormulario());
    if (!resultado.valido) {
      exibirErros(resultado);
    } else {
      limparErros();
    }
    return resultado;
  }

  function alternarOutraForma() {
    var outra = valorCampo('formaEntrega') === 'outra';
    if (refs.outraWrapper) refs.outraWrapper.hidden = !outra;
    if (refs.outraForma) {
      refs.outraForma.required = outra;
      if (!outra) {
        refs.outraForma.value = '';
        limparErroCampo(refs.outraForma);
      }
    }
  }

  function aplicarMascara(campo) {
    if (!campo || !campo.dataset) return;
    if (campo.dataset.name === 'documento') campo.value = Modelo.mascararCpfCnpj(campo.value);
    if (campo.dataset.name === 'cep') campo.value = Modelo.mascararCep(campo.value);
    if (campo.dataset.name === 'nfeChave') campo.value = Modelo.mascararChaveAcesso(campo.value);
    if (campo.dataset.name === 'estado') {
      campo.value = campo.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toLocaleUpperCase('pt-BR');
    }
  }

  function formatarCampoAoSair(campo) {
    if (!campo || !campo.value.trim()) return;
    if (campo.dataset.name === 'frete' || campo.dataset.itemField === 'valorUnitario') {
      var centavos = Modelo.parseMoedaCentavos(campo.value);
      if (centavos !== null) campo.value = Modelo.formatarMoeda(centavos, '');
    }
    if (campo.dataset.itemField === 'quantidade') {
      var quantidade = Modelo.parseQuantidadeMillesimos(campo.value);
      if (quantidade !== null) campo.value = Modelo.formatarQuantidadeInput(quantidade);
    }
  }

  function removerItem(botao) {
    var item = botao.closest('.ce-item');
    var itens = refs.itens.querySelectorAll('.ce-item');
    if (!item || itens.length <= 1) return;
    item.remove();
    atualizarIndicesItens();
    recalcular();
  }

  function limparFormulario(confirmar) {
    if (confirmar && !root.confirm('Limpar todos os dados preenchidos neste comprovante?')) return false;
    refs.form.reset();
    refs.itens.replaceChildren();
    estado.sequenciaItem = 0;
    adicionarItem({ unidade: 'UN' });
    var data = refs.form.querySelector('[data-name="dataEntrega"]');
    if (data) data.value = hojeLocal();
    var forma = refs.form.querySelector('[data-name="formaEntrega"]');
    if (forma) forma.value = Config.FORMA_ENTREGA_PADRAO;
    alternarOutraForma();
    limparErros();
    mostrarStatus('', '');
    recalcular();
    return true;
  }

  function carregarLogoComoPng() {
    if (estado.logoDataUrlPromise) return estado.logoDataUrlPromise;
    estado.logoDataUrlPromise = new Promise(function (resolve) {
      var imagem = new Image();
      imagem.onload = function () {
        try {
          var canvas = root.document.createElement('canvas');
          canvas.width = imagem.naturalWidth || imagem.width;
          canvas.height = imagem.naturalHeight || imagem.height;
          var contexto = canvas.getContext('2d');
          contexto.drawImage(imagem, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (erro) {
          resolve('');
        }
      };
      imagem.onerror = function () { resolve(''); };
      imagem.src = Config.EMPRESA.logo;
    });
    return estado.logoDataUrlPromise;
  }

  function carregarScriptLocal(id, origem) {
    return new Promise(function (resolve, reject) {
      var existente = porId(id);
      if (existente && existente.dataset.carregado === 'true') {
        resolve();
        return;
      }

      var script = existente || root.document.createElement('script');
      function aoCarregar() {
        script.dataset.carregado = 'true';
        resolve();
      }
      function aoFalhar() {
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('Não foi possível carregar a biblioteca local de PDF.'));
      }

      script.addEventListener('load', aoCarregar, { once: true });
      script.addEventListener('error', aoFalhar, { once: true });
      if (!existente) {
        script.id = id;
        script.src = origem;
        script.async = true;
        root.document.head.appendChild(script);
      }
    });
  }

  function garantirBibliotecaPdf() {
    if (
      estado.bibliotecaPdfPronta &&
      root.pdfMake &&
      typeof root.pdfMake.createPdf === 'function'
    ) {
      return Promise.resolve(root.pdfMake);
    }
    if (estado.bibliotecaPdfPromise) return estado.bibliotecaPdfPromise;

    estado.bibliotecaPdfPromise = carregarScriptLocal(
      'ce-pdfmake-script',
      'vendor/pdfmake/pdfmake.min.js'
    ).then(function () {
      return carregarScriptLocal(
        'ce-pdfmake-fontes-script',
        'vendor/pdfmake/vfs_fonts.js'
      );
    }).then(function () {
      if (!root.pdfMake || typeof root.pdfMake.createPdf !== 'function') {
        throw new Error('Biblioteca pdfmake indisponível.');
      }
      estado.bibliotecaPdfPronta = true;
      return root.pdfMake;
    }).catch(function (erro) {
      estado.bibliotecaPdfPromise = null;
      throw erro;
    });
    return estado.bibliotecaPdfPromise;
  }

  function mensagemErroGeracao(erro) {
    var mensagem = erro && erro.message ? String(erro.message) : '';
    if (/biblioteca|pdfmake|font/i.test(mensagem)) {
      return 'Não foi possível carregar o gerador de PDF. Recarregue a página e tente novamente.';
    }
    return 'Não foi possível gerar o PDF. Confira os dados e tente novamente.';
  }

  async function baixarPdf() {
    if (estado.carregando) return false;
    var resultado = validarEColetar();
    if (!resultado.valido) return false;
    definirCarregando(true, 'Gerando o comprovante em PDF…');
    try {
      await garantirBibliotecaPdf();
      var logo = await carregarLogoComoPng();
      var nome = await Pdf.baixar(resultado.dados, logo);
      mostrarStatus('PDF gerado com sucesso: ' + nome, 'success');
      return true;
    } catch (erro) {
      mostrarStatus(mensagemErroGeracao(erro), 'error');
      return false;
    } finally {
      definirCarregando(false);
    }
  }

  async function visualizarPdf() {
    if (estado.carregando) return false;
    var resultado = validarEColetar();
    if (!resultado.valido) return false;

    var janela = root.open('', '_blank');
    if (!janela) {
      mostrarStatus('O navegador bloqueou a nova aba. Autorize pop-ups para visualizar o PDF.', 'error');
      return false;
    }
    janela.document.title = 'Gerando comprovante…';
    janela.document.body.textContent = 'Gerando comprovante em PDF…';

    definirCarregando(true, 'Preparando a visualização do PDF…');
    try {
      await garantirBibliotecaPdf();
      var logo = await carregarLogoComoPng();
      var blob = await Pdf.obterBlob(resultado.dados, logo);
      if (estado.previewUrl) root.URL.revokeObjectURL(estado.previewUrl);
      estado.previewUrl = root.URL.createObjectURL(blob);
      janela.location.replace(estado.previewUrl);
      mostrarStatus('PDF aberto em uma nova aba.', 'success');
      return true;
    } catch (erro) {
      janela.close();
      mostrarStatus(mensagemErroGeracao(erro), 'error');
      return false;
    } finally {
      definirCarregando(false);
    }
  }

  function aoDigitar(evento) {
    var campo = evento.target;
    aplicarMascara(campo);
    limparErroCampo(campo);
    if (
      campo.dataset.itemField === 'quantidade' ||
      campo.dataset.itemField === 'valorUnitario' ||
      campo.dataset.name === 'frete'
    ) {
      recalcular();
    }
  }

  function aoAlterar(evento) {
    if (evento.target.dataset.name === 'formaEntrega') alternarOutraForma();
  }

  function aoClicarItens(evento) {
    var remover = evento.target.closest('[data-action="remover-item"]');
    if (remover) removerItem(remover);
  }

  function registrarEventos() {
    refs.adicionar.addEventListener('click', function () { adicionarItem({ focar: true }); });
    refs.itens.addEventListener('click', aoClicarItens);
    refs.form.addEventListener('input', aoDigitar);
    refs.form.addEventListener('change', aoAlterar);
    refs.form.addEventListener('blur', function (evento) {
      formatarCampoAoSair(evento.target);
      recalcular();
    }, true);
    refs.gerar.addEventListener('click', baixarPdf);
    refs.baixar.addEventListener('click', baixarPdf);
    refs.visualizar.addEventListener('click', visualizarPdf);
    refs.limpar.addEventListener('click', function () { limparFormulario(true); });
    root.addEventListener('beforeunload', function () {
      if (estado.previewUrl) root.URL.revokeObjectURL(estado.previewUrl);
    });
  }

  function init() {
    if (estado.inicializado || !root.document || !Config || !Modelo || !Pdf) return false;
    refs.form = porId('ce-form');
    if (!refs.form) return false;
    refs.status = porId('ce-status');
    refs.itens = porId('ce-itens');
    refs.template = porId('ce-item-template');
    refs.adicionar = porId('ce-adicionar-item');
    refs.totalProdutos = porId('ce-total-produtos');
    refs.totalFrete = porId('ce-total-frete');
    refs.totalGeral = porId('ce-total-geral');
    refs.outraWrapper = porId('ce-outra-forma-wrapper');
    refs.outraForma = porId('ce-outra-forma');
    refs.emitente = porId('ce-emitente-resumo');
    refs.gerar = porId('ce-gerar-pdf');
    refs.visualizar = porId('ce-visualizar-pdf');
    refs.baixar = porId('ce-baixar-pdf');
    refs.limpar = porId('ce-limpar');

    renderizarEmitente();
    registrarEventos();
    limparFormulario(false);
    estado.inicializado = true;
    return true;
  }

  function abrir() {
    if (!podeAcessar()) return false;
    init();
    if (!refs.itens || !refs.itens.querySelector('.ce-item')) adicionarItem();
    recalcular();
    return true;
  }

  var api = Object.freeze({
    init: init,
    abrir: abrir,
    podeAcessar: podeAcessar,
    validarEColetar: validarEColetar
  });
  root.ComprovanteEntregaApp = api;

  if (root.document) {
    root.document.addEventListener('DOMContentLoaded', init);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
