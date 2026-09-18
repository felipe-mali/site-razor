/* Feedback comum: preserva os contratos de fetch e a validação dos formulários. */
(() => {
  'use strict';
  if (window.RazorFeedback) return;
  let ultimoTexto = '';
  let ultimoHorario = 0;
  function mostrar(texto, tipo = 'erro') {
    if (!document.body) { document.addEventListener('DOMContentLoaded', () => mostrar(texto, tipo), { once: true }); return; }
    const destino = document.querySelector('dialog[open]') || document.body;
    let aviso = destino.querySelector(':scope > .razor-aviso');
    if (texto === ultimoTexto && Date.now() - ultimoHorario < 4000 && aviso) return;
    ultimoTexto = texto; ultimoHorario = Date.now();
    if (!aviso) {
      aviso = document.createElement('div'); aviso.className = 'razor-aviso';
      aviso.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;max-width:min(520px,calc(100% - 40px));padding:16px 48px 16px 18px;background:#241617;color:#fff;border:1px solid #ee9494;border-radius:8px;box-shadow:0 8px 32px #0008;font:15px/1.5 Arial,sans-serif;white-space:normal;overflow-wrap:anywhere;text-align:left';
      const mensagem = document.createElement('span');
      const fechar = document.createElement('button'); fechar.type = 'button'; fechar.textContent = '×'; fechar.setAttribute('aria-label', 'Fechar aviso');
      fechar.style.cssText = 'position:absolute;top:6px;right:8px;background:transparent;color:inherit;border:0;font-size:25px;cursor:pointer;padding:2px 8px;min-height:0';
      fechar.addEventListener('click', () => aviso.remove());
      aviso.append(mensagem, fechar); destino.append(aviso);
    }
    aviso.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    aviso.style.borderColor = tipo === 'erro' ? '#ee9494' : '#92c5a6';
    aviso.firstChild.textContent = String(texto);
  }
  function mensagemHTTP(status, detalhe) {
    if (status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (status === 403) return detalhe || 'Você não tem permissão para esta ação.';
    if (status === 404) return 'O recurso solicitado não foi encontrado. Se acabou de atualizar o site, reinicie o servidor.';
    if (status >= 500) return 'O servidor não conseguiu concluir a operação. Tente novamente; se persistir, avise o responsável pelo sistema.';
    return detalhe || `Não foi possível concluir a operação (erro ${status}).`;
  }
  window.RazorFeedback = { mostrar, mensagemHTTP };
  window.addEventListener('error', event => {
    if (event.message) mostrar('Ocorreu um erro nesta tela. Atualize a página e tente novamente. Se persistir, informe qual ação estava realizando.');
    else if (event.target?.tagName === 'SCRIPT') mostrar('Não foi possível carregar uma função do site. Verifique a conexão e atualize a página.');
  }, true);
  window.addEventListener('unhandledrejection', event => {
    if (event.reason?.name !== 'AbortError') mostrar('Não foi possível concluir a ação. Verifique sua conexão e tente novamente.');
  });
  document.addEventListener('invalid', event => {
    const campo = event.target;
    const rotulo = campo.labels?.[0]?.textContent?.replace(/\*/g, '').trim() || campo.name || 'Campo';
    mostrar(`${rotulo}: ${campo.validationMessage || 'Confira o valor informado.'}`);
  }, true);
  window.addEventListener('offline', () => mostrar('Você está sem conexão. Os envios podem falhar até a conexão voltar.'));
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    // A fila trata seus erros no próprio formulário, inclusive dentro do modal.
    const entrada = args[0];
    const url = new URL(typeof entrada === 'string' ? entrada : entrada.url || String(entrada), location.href);
    const fila = url.origin === location.origin && url.pathname.startsWith('/api/fila-producao/');
    try {
      const resposta = await originalFetch(...args);
      if (!resposta.ok && !fila) {
        let detalhe;
        if (url.origin === location.origin && resposta.headers.get('content-type')?.includes('application/json')) {
          const corpo = await resposta.clone().json().catch(() => null);
          detalhe = typeof corpo?.error === 'string' ? corpo.error : typeof corpo?.message === 'string' ? corpo.message : undefined;
        }
        mostrar(mensagemHTTP(resposta.status, detalhe));
      }
      return resposta;
    } catch (erro) {
      if (!fila && erro.name !== 'AbortError') mostrar('Não foi possível conectar ao servidor. Verifique a conexão e se o sistema está iniciado.');
      throw erro;
    }
  };
})();
