(function carregarComprovanteEntregaPdf(root, factory) {
  'use strict';

  var config;
  var modelo;
  var dadosBrasileiros;
  var pdfMake;

  if (typeof module === 'object' && module.exports) {
    config = require('./comprovante-entrega-config');
    modelo = require('./comprovante-entrega-modelo');
    dadosBrasileiros = require('./dados-brasileiros');
    pdfMake = require('pdfmake/build/pdfmake');
    pdfMake.addVirtualFileSystem(require('pdfmake/build/vfs_fonts'));
  } else {
    config = root && root.ComprovanteEntregaConfig;
    modelo = root && root.ComprovanteEntregaModelo;
    dadosBrasileiros = root && root.DadosBrasileiros;
    pdfMake = root && root.pdfMake;
  }

  var api = factory(config, modelo, dadosBrasileiros, function obterPdfMake() {
    return pdfMake || (root && root.pdfMake);
  });

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ComprovanteEntregaPdf = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function criarComprovanteEntregaPdf(
  Config,
  Modelo,
  DadosBrasileiros,
  obterPdfMake
) {
  'use strict';

  if (!Config || !Modelo || !DadosBrasileiros) {
    throw new Error('Configuração, modelo e utilitário de dados do comprovante são obrigatórios.');
  }

  var CORES = Object.freeze({
    preto: '#111111',
    amarelo: '#F6BE00',
    cinzaTexto: '#5A5A5A',
    cinzaBorda: '#C7C7C7',
    cinzaFundo: '#F5F5F5',
    amareloSuave: '#FFF8D8',
    branco: '#FFFFFF'
  });

  function texto(valor) {
    return String(valor === undefined || valor === null ? '' : valor).trim();
  }

  function listaValida(valores) {
    return valores.map(texto).filter(Boolean);
  }

  function juntar(valores, separador) {
    return listaValida(valores).join(separador || ' • ');
  }

  function formatarData(valor) {
    return Modelo.mascararData(valor) || '';
  }

  function enderecoCompleto(destinatario) {
    var logradouro = juntar([
      destinatario.endereco,
      destinatario.numero
    ], ', ');
    var local = juntar([
      destinatario.bairro,
      destinatario.cidade,
      destinatario.estado
    ], ' • ');
    var cep = destinatario.cep ? 'CEP ' + destinatario.cep : '';
    return juntar([logradouro, local, cep], ' • ');
  }

  function rotuloValor(rotulo, valor, opcoes) {
    opcoes = opcoes || {};
    return {
      stack: [
        {
          text: rotulo,
          color: CORES.cinzaTexto,
          bold: true,
          fontSize: 6.2,
          characterSpacing: 0.25,
          margin: [0, 0, 0, 2]
        },
        {
          text: texto(valor) || '—',
          color: CORES.preto,
          bold: Boolean(opcoes.destaque),
          fontSize: opcoes.fontSize || 8.2,
          noWrap: Boolean(opcoes.noWrap)
        }
      ],
      margin: [1, 1, 1, 1]
    };
  }

  function tituloSecao(titulo) {
    return {
      columns: [
        {
          width: 4,
          canvas: [{
            type: 'rect',
            x: 0,
            y: 0,
            w: 4,
            h: 12,
            color: CORES.amarelo
          }]
        },
        {
          width: '*',
          text: titulo,
          bold: true,
          fontSize: 8.2,
          color: CORES.preto,
          margin: [6, 1, 0, 0]
        }
      ],
      margin: [0, 0, 0, 6]
    };
  }

  function layoutCard(corFundo) {
    return {
      fillColor: function () { return corFundo || CORES.branco; },
      hLineColor: function () { return CORES.cinzaBorda; },
      vLineColor: function () { return CORES.cinzaBorda; },
      hLineWidth: function () { return 0.65; },
      vLineWidth: function () { return 0.65; },
      paddingLeft: function () { return 9; },
      paddingRight: function () { return 9; },
      paddingTop: function () { return 8; },
      paddingBottom: function () { return 8; }
    };
  }

  function card(conteudo, corFundo, margem) {
    return {
      table: {
        widths: ['*'],
        body: [[{ stack: Array.isArray(conteudo) ? conteudo : [conteudo] }]]
      },
      layout: layoutCard(corFundo),
      margin: margem || [0, 0, 0, 8]
    };
  }

  function cabecalho(logoDataUrl) {
    var empresa = Config.EMPRESA;
    var cnpj = DadosBrasileiros.formatarCnpj(empresa.cnpj);
    var telefone = DadosBrasileiros.formatarTelefone(empresa.telefone);
    var informacoesEmpresa = [{
      text: texto(empresa.razaoSocial),
      bold: true,
      color: CORES.branco,
      fontSize: 9,
      margin: [0, 1, 0, 4]
    }];
    if (cnpj) {
      informacoesEmpresa.push({
        text: 'CNPJ ' + cnpj,
        color: CORES.branco,
        fontSize: 6.8,
        margin: [0, 0, 0, 2]
      });
    }
    if (texto(empresa.endereco)) {
      informacoesEmpresa.push({
        text: texto(empresa.endereco),
        color: CORES.branco,
        fontSize: 6.8,
        margin: [0, 0, 0, 2]
      });
    }
    var cidadeCep = juntar([
      empresa.cidade,
      texto(empresa.cep) ? 'CEP ' + texto(empresa.cep) : ''
    ], ' • ');
    if (cidadeCep) {
      informacoesEmpresa.push({
        text: cidadeCep,
        color: CORES.branco,
        fontSize: 6.8,
        margin: [0, 0, 0, 2]
      });
    }
    if (telefone) {
      informacoesEmpresa.push({
        text: 'Telefone ' + telefone,
        color: CORES.branco,
        fontSize: 6.8
      });
    }
    var logo = texto(logoDataUrl)
      ? {
          image: logoDataUrl,
          fit: [154, 54],
          alignment: 'left',
          margin: [2, 3, 0, 1]
        }
      : {
          text: 'RAZOR',
          color: CORES.amarelo,
          bold: true,
          fontSize: 24,
          characterSpacing: 1.5,
          margin: [5, 15, 0, 0]
        };

    return {
      margin: [40, 18, 40, 0],
      stack: [
        {
          table: {
            widths: [172, '*'],
            heights: [72],
            body: [[
              { stack: [logo], border: [false, false, false, false] },
              {
                stack: informacoesEmpresa,
                alignment: 'right',
                margin: [0, 7, 2, 0],
                border: [false, false, false, false]
              }
            ]]
          },
          layout: {
            fillColor: function () { return CORES.preto; },
            hLineWidth: function () { return 0; },
            vLineWidth: function () { return 0; },
            paddingLeft: function () { return 8; },
            paddingRight: function () { return 8; },
            paddingTop: function () { return 0; },
            paddingBottom: function () { return 0; }
          }
        },
        {
          canvas: [{
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 2.2,
            lineColor: CORES.amarelo
          }]
        }
      ]
    };
  }

  function rodape(paginaAtual, totalPaginas) {
    return {
      margin: [40, 0, 40, 12],
      stack: [
        {
          canvas: [{
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1.1,
            lineColor: CORES.amarelo
          }],
          margin: [0, 0, 0, 4]
        },
        {
          columns: [
            {
              width: '*',
              text: 'Este documento comprova exclusivamente o recebimento físico da mercadoria e não constitui quitação financeira.',
              color: CORES.cinzaTexto,
              fontSize: 6
            },
            {
              width: 118,
              text: Config.EMPRESA.razaoSocial + '  •  ' + paginaAtual + '/' + totalPaginas,
              alignment: 'right',
              bold: true,
              color: CORES.cinzaTexto,
              fontSize: 6
            }
          ],
          columnGap: 10
        }
      ]
    };
  }

  function resumoVenda(dados) {
    var nfe = juntar([
      dados.numeroNfe ? 'Nº ' + dados.numeroNfe : '',
      dados.serieNfe ? 'Série ' + dados.serieNfe : ''
    ], ' / ');

    return {
      table: {
        widths: ['*', '*', '*', '*'],
        body: [[
          rotuloValor('VENDA MARKETPLACE', dados.numeroVenda, { destaque: true, fontSize: 8 }),
          rotuloValor('PEDIDO INTERNO', dados.numeroPedido, { fontSize: 8 }),
          rotuloValor('NF-e / SÉRIE', nfe, { fontSize: 8 }),
          rotuloValor('DATA DA ENTREGA', formatarData(dados.dataEntrega), { fontSize: 8, noWrap: true })
        ]]
      },
      layout: layoutCard(CORES.cinzaFundo),
      margin: [0, 0, 0, 8]
    };
  }

  function blocoDestinatario(dados) {
    var destinatario = dados.destinatario;
    var documentos = juntar([
      destinatario.documento ? 'CNPJ/CPF: ' + destinatario.documento : '',
      destinatario.inscricaoEstadual ? 'IE: ' + destinatario.inscricaoEstadual : '',
      destinatario.contato ? 'Contato: ' + destinatario.contato : ''
    ]);

    var linhas = [
      tituloSecao('DESTINATÁRIO E LOCAL DA ENTREGA'),
      {
        text: destinatario.nome,
        bold: true,
        fontSize: 8,
        color: CORES.preto,
        margin: [0, 0, 0, 3]
      }
    ];
    if (documentos) linhas.push({ text: documentos, fontSize: 7, color: CORES.cinzaTexto, margin: [0, 0, 0, 3] });
    linhas.push({ text: enderecoCompleto(destinatario), fontSize: 7.2, color: CORES.preto });

    return card(linhas);
  }

  function tabelaMercadorias(dados) {
    var corpo = [[
      { text: 'CÓDIGO', style: 'cabecalhoTabela' },
      { text: 'DESCRIÇÃO', style: 'cabecalhoTabela' },
      { text: 'UN.', style: 'cabecalhoTabela', alignment: 'center' },
      { text: 'QUANTIDADE', style: 'cabecalhoTabela', alignment: 'right' },
      { text: 'VALOR UNIT.', style: 'cabecalhoTabela', alignment: 'right' },
      { text: 'VALOR TOTAL', style: 'cabecalhoTabela', alignment: 'right' }
    ]];

    dados.itens.forEach(function (item) {
      corpo.push([
        { text: item.codigo || '', style: 'celulaTabela' },
        { text: item.descricao || '', style: 'celulaTabela' },
        { text: item.unidade || '', style: 'celulaTabela', alignment: 'center' },
        { text: Modelo.formatarQuantidade(item.quantidadeMillesimos, ''), style: 'celulaTabela', alignment: 'right' },
        { text: Modelo.formatarMoeda(item.valorUnitarioCentavos, ''), style: 'celulaTabela', alignment: 'right' },
        { text: Modelo.formatarMoeda(item.valorTotalCentavos, ''), style: 'celulaTabela', alignment: 'right', bold: true }
      ]);
    });

    return [
      tituloSecao('MERCADORIAS'),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
          widths: [52, '*', 27, 48, 59, 62],
          body: corpo
        },
        layout: {
          fillColor: function (linha) {
            return linha === 0 ? CORES.preto : (linha % 2 === 0 ? CORES.cinzaFundo : CORES.branco);
          },
          hLineColor: function () { return CORES.cinzaBorda; },
          vLineColor: function () { return CORES.cinzaBorda; },
          hLineWidth: function () { return 0.55; },
          vLineWidth: function () { return 0.55; },
          paddingLeft: function () { return 4; },
          paddingRight: function () { return 4; },
          paddingTop: function () { return 4; },
          paddingBottom: function () { return 4; }
        },
        margin: [0, 0, 0, 4]
      },
      {
        table: {
          widths: ['*', 91, 91, 91],
          body: [[
            { text: '', border: [false, false, false, false] },
            rotuloValor('PRODUTOS', Modelo.formatarMoeda(dados.totalProdutosCentavos), { destaque: true, fontSize: 7.2 }),
            rotuloValor('FRETE', Modelo.formatarMoeda(dados.freteCentavos), { destaque: true, fontSize: 7.2 }),
            {
              stack: [
                { text: 'TOTAL GERAL', bold: true, color: CORES.preto, fontSize: 6.2, margin: [0, 0, 0, 2] },
                { text: Modelo.formatarMoeda(dados.totalGeralCentavos), bold: true, color: CORES.preto, fontSize: 8.2 }
              ],
              fillColor: CORES.amarelo,
              margin: [1, 1, 1, 1]
            }
          ]]
        },
        layout: {
          hLineColor: function () { return CORES.cinzaBorda; },
          vLineColor: function () { return CORES.cinzaBorda; },
          hLineWidth: function () { return 0.55; },
          vLineWidth: function () { return 0.55; },
          paddingLeft: function () { return 6; },
          paddingRight: function () { return 6; },
          paddingTop: function () { return 5; },
          paddingBottom: function () { return 5; }
        },
        margin: [0, 0, 0, 8]
      }
    ];
  }

  function blocoEntrega(dados) {
    var linhas = [tituloSecao('DADOS FISCAIS E FORMA DE ENTREGA')];
    if (dados.chaveAcessoNfe) {
      linhas.push({
        text: [
          { text: 'Chave de acesso da NF-e: ', bold: true },
          { text: dados.chaveAcessoNfe }
        ],
        fontSize: 6.8,
        color: CORES.preto,
        margin: [0, 0, 0, 4]
      });
    }
    linhas.push({
      text: [
        { text: 'Forma de entrega: ', bold: true },
        { text: dados.textoFormaEntrega }
      ],
      fontSize: 7,
      color: CORES.preto
    });
    return card(linhas, CORES.cinzaFundo);
  }

  function blocoDeclaracao(dados) {
    return card([
      tituloSecao('DECLARAÇÃO DE RECEBIMENTO'),
      {
        text: Modelo.comporDeclaracao(dados) +
          ' Confirmo que tive a oportunidade de conferir os volumes e o estado aparente das mercadorias no ato da entrega.',
        fontSize: 7.3,
        lineHeight: 1.25,
        color: CORES.preto,
        alignment: 'justify'
      }
    ], CORES.amareloSuave);
  }

  function opcoesRecebimento() {
    var opcoes = [
      'Recebimento integral, sem ressalvas aparentes',
      'Recebimento com ressalvas',
      'Recebimento parcial: _____ unidades'
    ];
    function opcao(rotulo) {
      return {
        columns: [
          {
            width: 11,
            canvas: [{
              type: 'rect',
              x: 0,
              y: 1,
              w: 7,
              h: 7,
              lineWidth: 0.7,
              lineColor: CORES.preto
            }]
          },
          { width: '*', text: rotulo, fontSize: 7.1 }
        ],
        columnGap: 1,
        margin: [2, 2, 2, 2]
      };
    }
    return {
      table: {
        widths: ['*', '*', '*'],
        body: [[
          opcao(opcoes[0]),
          opcao(opcoes[1]),
          opcao(opcoes[2])
        ]]
      },
      layout: layoutCard(CORES.branco),
      margin: [0, 0, 0, 8]
    };
  }

  function observacoes() {
    return {
      table: {
        widths: ['*'],
        heights: [43],
        body: [[{
          stack: [
            { text: 'RESSALVAS E OBSERVAÇÕES', bold: true, fontSize: 6.5, color: CORES.cinzaTexto, margin: [0, 0, 0, 9] },
            { text: '________________________________________________________________________________________', color: CORES.cinzaBorda, fontSize: 6, margin: [0, 0, 0, 7] },
            { text: '________________________________________________________________________________________', color: CORES.cinzaBorda, fontSize: 6 }
          ]
        }]]
      },
      layout: layoutCard(CORES.branco),
      margin: [0, 0, 0, 8]
    };
  }

  function conteudoAssinatura(titulo, campos) {
    var linhas = [{
      table: {
        widths: ['*'],
        body: [[{
          text: titulo,
          bold: true,
          color: CORES.amarelo,
          fillColor: CORES.preto,
          fontSize: 7.3,
          alignment: 'center',
          margin: [3, 4, 3, 4]
        }]]
      },
      layout: 'noBorders',
      margin: [-7, -6, -7, 7]
    }];

    campos.forEach(function (campo) {
      linhas.push({
        text: campo + ': __________________________________________',
        fontSize: 6.7,
        color: CORES.preto,
        margin: [0, 0, 0, 7]
      });
    });
    linhas.push({
      text: 'Assinatura / carimbo: __________________________________',
      fontSize: 6.7,
      color: CORES.preto,
      margin: [0, 5, 0, 0]
    });
    return linhas;
  }

  function assinaturas() {
    return {
      id: 'assinaturas-finais',
      table: {
        widths: ['*', 8, '*'],
        dontBreakRows: true,
        body: [[
          {
            stack: conteudoAssinatura(
              'RECEBEDOR AUTORIZADO',
              ['Nome', 'CPF/RG', 'Cargo', 'Data', 'Horário']
            )
          },
          { text: '', border: [false, false, false, false] },
          {
            stack: conteudoAssinatura(
              'TRANSPORTADOR / RESPONSÁVEL PELA ENTREGA',
              ['Nome', 'CPF/RG', 'Empresa', 'Data', 'Horário']
            )
          }
        ]]
      },
      layout: {
        hLineColor: function () { return CORES.cinzaBorda; },
        vLineColor: function () { return CORES.cinzaBorda; },
        hLineWidth: function () { return 0.65; },
        vLineWidth: function () { return 0.65; },
        paddingLeft: function () { return 7; },
        paddingRight: function () { return 7; },
        paddingTop: function () { return 6; },
        paddingBottom: function () { return 7; }
      },
      margin: [0, 0, 0, 0]
    };
  }

  function criarDefinicao(entrada, logoDataUrl) {
    var dados = Modelo.normalizarDados(entrada);
    var mercadorias = tabelaMercadorias(dados);
    var conteudo = [
      {
        text: 'TERMO DE RECEBIMENTO E COMPROVANTE DE ENTREGA',
        style: 'tituloDocumento'
      },
      {
        text: 'Documento emitido em duas vias para comprovação do recebimento físico das mercadorias.',
        style: 'subtituloDocumento'
      },
      resumoVenda(dados),
      blocoDestinatario(dados)
    ];

    mercadorias.forEach(function (bloco) { conteudo.push(bloco); });
    conteudo.push(blocoEntrega(dados));
    conteudo.push(blocoDeclaracao(dados));
    conteudo.push(opcoesRecebimento());
    conteudo.push(observacoes());
    conteudo.push(assinaturas());

    return {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, 111, 40, 47],
      compress: true,
      info: {
        title: 'Termo de recebimento e comprovante de entrega',
        author: Config.EMPRESA.razaoSocial,
        subject: 'Comprovante de recebimento físico de mercadorias',
        creator: 'Sistema interno Razor'
      },
      header: function () { return cabecalho(logoDataUrl); },
      footer: rodape,
      content: conteudo,
      defaultStyle: {
        font: 'Roboto',
        fontSize: 7.2,
        color: CORES.preto,
        lineHeight: 1.15
      },
      styles: {
        tituloDocumento: {
          fontSize: 13.5,
          bold: true,
          alignment: 'center',
          color: CORES.preto,
          margin: [0, 0, 0, 3]
        },
        subtituloDocumento: {
          fontSize: 6.8,
          alignment: 'center',
          color: CORES.cinzaTexto,
          margin: [0, 0, 0, 10]
        },
        cabecalhoTabela: {
          color: CORES.amarelo,
          bold: true,
          fontSize: 6.2
        },
        celulaTabela: {
          color: CORES.preto,
          fontSize: 6.8,
          lineHeight: 1.12
        }
      }
    };
  }

  function criarDocumento(entrada, logoDataUrl) {
    var biblioteca = obterPdfMake();
    if (!biblioteca || typeof biblioteca.createPdf !== 'function') {
      throw new Error('A biblioteca de PDF não está disponível. Recarregue a página e tente novamente.');
    }
    return biblioteca.createPdf(criarDefinicao(entrada, logoDataUrl));
  }

  async function obterBlob(entrada, logoDataUrl) {
    return criarDocumento(entrada, logoDataUrl).getBlob();
  }

  async function baixar(entrada, logoDataUrl) {
    var nomeArquivo = Modelo.gerarNomeArquivo(entrada);
    await criarDocumento(entrada, logoDataUrl).download(nomeArquivo);
    return nomeArquivo;
  }

  async function obterBuffer(entrada, logoDataUrl) {
    return criarDocumento(entrada, logoDataUrl).getBuffer();
  }

  return Object.freeze({
    CORES: CORES,
    criarDefinicao: criarDefinicao,
    criarDocumento: criarDocumento,
    obterBlob: obterBlob,
    baixar: baixar,
    obterBuffer: obterBuffer
  });
});
