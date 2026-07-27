(function carregarComprovanteEntregaConfig(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ComprovanteEntregaConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function criarComprovanteEntregaConfig() {
  'use strict';

  function congelarProfundamente(valor) {
    if (!valor || typeof valor !== 'object' || Object.isFrozen(valor)) return valor;
    Object.keys(valor).forEach(function (chave) {
      congelarProfundamente(valor[chave]);
    });
    return Object.freeze(valor);
  }

  return congelarProfundamente({
    EMPRESA: {
      razaoSocial: 'RAZOR COMERCIAL LTDA',
      cnpj: '43.110.625/0001-19',
      endereco: 'Avenida Marechal Costa e Silva, 3360, Vila Brasil',
      cidade: 'Ribeirão Preto/SP',
      cep: '14075-610',
      telefone: '(16) 3969-4234',
      logo: 'fotos/logo-comprovante.png'
    },
    FORMAS_ENTREGA: {
      terceirizado: {
        valor: 'terceirizado',
        rotulo: 'Transporte terceirizado',
        texto: 'Serviço de transporte terceirizado contratado pela RAZOR.'
      },
      proprio: {
        valor: 'proprio',
        rotulo: 'Veículo próprio da Razor',
        texto: 'Entrega realizada por veículo próprio da RAZOR.'
      },
      outra: {
        valor: 'outra',
        rotulo: 'Outra forma de entrega',
        texto: ''
      }
    },
    FORMA_ENTREGA_PADRAO: 'terceirizado'
  });
});
