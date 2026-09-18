'use strict';
window.Api = (() => {
  async function requisitar(url, metodo = 'GET', dados) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 20000);
    try {
    const resposta = await fetch(url.replace('/api/', '/api/fila-producao/'), {
      method: metodo, cache: 'no-store',
      signal: controle.signal,
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' },
      body: dados === undefined ? undefined : JSON.stringify(dados)
    });
    if (resposta.status === 401) throw new Error('Sua sessão expirou. Abra o login em outra aba, entre novamente e volte aqui para reenviar. Os campos foram mantidos.');
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(window.RazorFeedback?.mensagemHTTP(resposta.status, corpo?.error) || corpo?.error || `Não foi possível concluir a operação (erro ${resposta.status}).`);
    if (!corpo) throw new Error('O servidor retornou uma resposta inválida. Reinicie o servidor e tente novamente.');
    return corpo;
    } catch (erro) {
      if (erro.name === 'AbortError') throw new Error('O servidor demorou para responder. Confira a lista de solicitações antes de reenviar, pois o pedido pode ter sido salvo.');
      if (erro instanceof TypeError) throw new Error('Não foi possível conectar ao servidor. Verifique a conexão e se o sistema está iniciado. Seus campos foram mantidos.');
      throw erro;
    } finally { clearTimeout(limite); }
  }
  async function sessao() {
    const usuario = await requisitar('/api/sessao');
    document.querySelector('.perfil > span').textContent = `${usuario.nome} · ${usuario.setor === 'Producao' ? 'Produção' : usuario.setor}`;
    const pagina = usuario.setor === 'Producao' ? 'producao.html' : 'main.html';
    if (!location.pathname.endsWith('/' + pagina)) { location.replace(pagina); throw new Error('Abrindo sua área…'); }
    document.querySelectorAll('a[href="producao.html"]').forEach(el => { el.hidden = usuario.setor !== 'Producao'; });
    return usuario;
  }
  function mostrarErro(texto) {
    let el = document.getElementById('erro-conexao');
    if (!el) { el = document.createElement('p'); el.id = 'erro-conexao'; el.className = 'retorno'; el.setAttribute('role', 'alert'); document.querySelector('main').prepend(el); }
    el.textContent = texto;
    window.RazorFeedback?.mostrar(texto);
  }
  return { ativa: true, requisitar, sessao, mostrarErro };
})();
