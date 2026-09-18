'use strict';

window.Producao = (() => {
  const nomesStatus = { aguardando: 'Aguardando', producao: 'Em produção', pausada: 'Pausada', concluida: 'Concluída', cancelada: 'Cancelada' };
  const transicoes = { iniciar: ['aguardando', 'producao'], pausar: ['producao', 'pausada'], retomar: ['pausada', 'producao'], finalizar: ['producao', 'concluida'] };
  const acoesStatus = { aguardando: [['iniciar', 'Iniciar produção']], producao: [['pausar', 'Pausar'], ['finalizar', 'Finalizar']], pausada: [['retomar', 'Retomar']], concluida: [], cancelada: [] };
  const porId = id => ordens.find(ordem => ordem.id === id);
  const $ = seletor => document.querySelector(seletor);
  const fila = $('#ordens-producao');
  const busca = $('#busca-producao');
  const status = $('#status-producao');
  const prioridade = $('#prioridade-producao');
  const detalhes = $('#detalhes-ordem');
  const pausa = $('#pausar-ordem');
  const finalizacao = $('#finalizar-ordem');
  const formPausa = $('#form-pausa');
  let ordens = [];
  let idDetalhes = null;
  let idPausa = null;
  let idFinalizacao = null;

  function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }
  function normalizar(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function data(valor, horario = false) {
    if (!valor) return 'Não informado';
    const date = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
    if (Number.isNaN(date.getTime())) return 'Não informado';
    return horario ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : date.toLocaleDateString('pt-BR');
  }
  function quantidade(ordem) { return `${Number(ordem.quantidade).toLocaleString('pt-BR')} ${ordem.unidade}`; }
  function emAberto(ordem) { return !['concluida', 'cancelada'].includes(ordem.status); }
  function atrasada(ordem) { return emAberto(ordem) && ordem.atrasada === true; }
  function informar(texto) {
    $('#retorno-producao').textContent = texto;
    $('#retorno-producao').hidden = false;
  }
  function adicionarDado(lista, rotulo, valor, amplo = false) {
    const grupo = elemento('div', amplo ? 'linha-inteira' : '');
    grupo.append(elemento('dt', '', rotulo), elemento('dd', '', valor || 'Não informado'));
    lista.append(grupo);
  }
  function botao(acao, rotulo, ordem, secundario = false) {
    const el = elemento('button', `botao${secundario ? ' secundario' : ''}`, rotulo);
    el.type = 'button';
    el.dataset.acao = acao;
    el.dataset.ordemId = ordem.id;
    el.setAttribute('aria-label', `${rotulo} — ${ordem.numeroOP}`);
    if (['detalhes', 'pausar', 'finalizar'].includes(acao)) el.setAttribute('aria-haspopup', 'dialog');
    return el;
  }
  function filtrarOrdens() {
    const termo = normalizar(busca.value);
    // Mantém a sequência recebida; a ordenação definitiva será responsabilidade do servidor.
    return ordens.filter(ordem => normalizar(`${ordem.numeroOP} ${ordem.produto} ${ordem.cliente}`).includes(termo)
      && (!status.value || (status.value === 'nao-concluidas' ? ordem.status !== 'concluida' : ordem.status === status.value))
      && (!prioridade.value || ordem.prioridade === prioridade.value));
  }
  function renderizarOrdens() {
    const foco = document.activeElement;
    const focoNaFila = fila.contains(foco);
    const idFoco = foco?.dataset.ordemId;
    const acaoFoco = foco?.dataset.acao;
    const visiveis = filtrarOrdens();
    const fragmento = document.createDocumentFragment();
    for (const ordem of visiveis) {
      const card = elemento('article', `ordem-card${ordem.prioridade === 'urgente' ? ' ordem-urgente' : ''}${ordem.status === 'producao' ? ' ordem-ativa' : ''}`);
      card.dataset.ordemId = ordem.id;
      const topo = elemento('div', 'ordem-topo');
      const numero = elemento('h3');
      const link = botao('detalhes', ordem.numeroOP, ordem, true);
      link.className = 'numero-op';
      link.setAttribute('aria-label', `Ver detalhes da ${ordem.numeroOP}`);
      numero.append(link);
      const badges = elemento('div', 'ordem-badges');
      if (ordem.prioridade === 'urgente') badges.append(elemento('span', 'badge urgente', 'Urgente'));
      if (atrasada(ordem)) badges.append(elemento('span', 'badge atrasada', 'Atrasada'));
      topo.append(numero, badges);
      const situacao = elemento('div', 'ordem-situacao');
      situacao.append(elemento('span', `badge status ${ordem.status}`, nomesStatus[ordem.status] || ordem.status));
      const dados = elemento('dl', 'dados-card');
      adicionarDado(dados, 'Cliente', ordem.cliente);
      adicionarDado(dados, 'Setor solicitante', ordem.setorSolicitante);
      adicionarDado(dados, 'Solicitada em', data(ordem.dataSolicitacao));
      adicionarDado(dados, 'Prazo', data(ordem.prazo));
      card.append(topo, situacao, elemento('h4', 'produto-ordem', ordem.produto), elemento('p', 'quantidade-ordem', quantidade(ordem)), dados);
      if (ordem.status === 'producao') card.append(elemento('p', 'atividade-ordem', ordem.dataInicio ? `Iniciada em ${data(ordem.dataInicio, true)}` : 'Produção ativa · início não informado'));
      if (ordem.status === 'pausada') card.append(elemento('p', 'atividade-ordem', `Pausa: ${ordem.motivoPausa || 'Motivo não informado'}`));
      if (ordem.observacoes) card.append(elemento('p', 'observacao-ordem', `Observação: ${ordem.observacoes}`));
      const acoes = elemento('div', 'acoes acoes-ordem');
      acoes.append(botao('detalhes', 'Ver detalhes', ordem, true));
      for (const [acao, rotulo] of acoesStatus[ordem.status] || []) acoes.append(botao(acao, rotulo, ordem, acao === 'pausar'));
      card.append(acoes);
      fragmento.append(card);
    }
    fila.replaceChildren(fragmento);
    $('#fila-vazia').hidden = visiveis.length > 0;
    $('#contagem-producao').textContent = `${visiveis.length} de ${ordens.length} ordens`;
    for (const valor of ['aguardando', 'producao', 'pausada', 'concluida']) $(`#total-${valor}`).textContent = ordens.filter(ordem => ordem.status === valor).length;
    $('#total-urgentes').textContent = ordens.filter(ordem => emAberto(ordem) && ordem.prioridade === 'urgente').length;
    $('#total-atrasadas').textContent = ordens.filter(atrasada).length;
    if (focoNaFila) {
      const botoes = Array.from(fila.querySelectorAll('button'));
      const destino = botoes.find(el => el.dataset.ordemId === idFoco && el.dataset.acao === acaoFoco)
        || botoes.find(el => el.dataset.ordemId === idFoco) || $('#titulo-fila');
      destino.focus({ preventScroll: true });
    }
  }
  function preencherDetalhes(ordem) {
    $('#titulo-detalhes').textContent = ordem.numeroOP;
    const dados = $('#dados-ordem');
    dados.replaceChildren();
    const campos = [
      ['Produto', ordem.produto], ['Quantidade', Number(ordem.quantidade).toLocaleString('pt-BR')], ['Unidade', ordem.unidade],
      ['Medidas', ordem.medida], ['Cor', ordem.cor], ['Cliente', ordem.cliente], ['Prazo', data(ordem.prazo)],
      ['Prioridade', ordem.prioridade === 'urgente' ? 'Urgente' : 'Normal'], ['Solicitante', ordem.solicitante],
      ['Setor solicitante', ordem.setorSolicitante], ['Data da solicitação', data(ordem.dataSolicitacao, true)],
      ['Status atual', `${nomesStatus[ordem.status] || ordem.status}${atrasada(ordem) ? ' · Atrasada' : ''}`],
      ['Início', data(ordem.dataInicio, true)], ['Conclusão', data(ordem.dataFinalizacao, true)], ['Responsável', ordem.responsavel]
    ];
    campos.forEach(([rotulo, valor]) => adicionarDado(dados, rotulo, valor));
    if (ordem.motivoPausa) adicionarDado(dados, ordem.status === 'pausada' ? 'Motivo da pausa' : 'Último motivo de pausa', ordem.motivoPausa);
    if (ordem.observacaoPausa) adicionarDado(dados, 'Observação da pausa', ordem.observacaoPausa, true);
    adicionarDado(dados, 'Observações', ordem.observacoes || 'Sem observações.', true);
  }
  function abrirDetalhes(id, acionador) {
    const ordem = porId(id);
    if (!ordem) return;
    idDetalhes = id;
    preencherDetalhes(ordem);
    Modais.abrir(detalhes, acionador);
  }
  function pausarOrdem(id, acionador) {
    const ordem = porId(id);
    if (ordem?.status !== 'producao') return;
    idPausa = id;
    formPausa.reset();
    pausa.querySelector('.erro-envio')?.remove();
    $('#descricao-pausa').textContent = `${ordem.numeroOP} · ${ordem.produto}`;
    Modais.abrir(pausa, acionador);
  }
  function finalizarOrdem(id, acionador) {
    const ordem = porId(id);
    if (ordem?.status !== 'producao') return;
    idFinalizacao = id;
    finalizacao.querySelector('.erro-envio')?.remove();
    $('#titulo-finalizacao').textContent = `Finalizar ${ordem.numeroOP}?`;
    $('#quantidade-finalizacao').textContent = quantidade(ordem);
    Modais.abrir(finalizacao, acionador);
  }
  // Alteracoes persistidas pelo backend; sem mutacoes demonstrativas.
  let enviando = false;
  let revisaoOrdens = 0;
  async function executarAcao(id, acao, dados = {}) {
    const ordem = porId(id);
    const transicao = transicoes[acao];
    if (!ordem || !transicao || ordem.status !== transicao[0]) {
      informar('A ordem mudou ou esta ação não está disponível. Confira o status atual.');
      return false;
    }
    if (Api.ativa) {
      if (enviando) return false;
      enviando = true;
      revisaoOrdens++;
      const controles = document.querySelectorAll('.acoes-ordem button, dialog button[type="submit"]');
      controles.forEach(el => el.disabled = true);
      try {
        const atualizada = await Api.requisitar(`/api/ordens/${id}/${acao}`, 'POST', { ...dados, versao: ordem.versao });
        atualizarOrdem(atualizada);
        informar(`${atualizada.numeroOP}: ${nomesStatus[atualizada.status]}. Alteração salva.${filtrarOrdens().some(o => o.id === id) ? '' : ' A ordem não corresponde mais aos filtros selecionados.'}`);
        return true;
      } catch (erro) {
        const dialog = document.querySelector('dialog[open]');
        if (dialog) {
          let mensagem = dialog.querySelector('.erro-envio');
          if (!mensagem) { mensagem = elemento('p', 'retorno erro-envio'); mensagem.setAttribute('role', 'alert'); dialog.append(mensagem); }
          mensagem.textContent = erro.message;
        } else informar(erro.message);
        return false;
      } finally { enviando = false; controles.forEach(el => el.disabled = false); }
    }
    return false;
  }
  function iniciarOrdem(id) { return executarAcao(id, 'iniciar'); }
  function retomarOrdem(id) { return executarAcao(id, 'retomar'); }
  // Pontos de entrada para respostas do ASP.NET Core e eventos SignalR futuros.
  // Espera objetos completos com os campos documentados em README.md.
  function atualizarOrdem(ordem) {
    const indice = ordens.findIndex(item => item.id === ordem.id);
    if (indice === -1) ordens.push({ ...ordem });
    else ordens[indice] = { ...ordem };
    atualizarTela();
  }
  function definirOrdens(recebidas) {
    ordens = recebidas.map(ordem => ({ ...ordem }));
    atualizarTela();
  }
  function atualizarTela() {
    renderizarOrdens();
    if (detalhes.open) {
      const ordem = porId(idDetalhes);
      if (ordem) preencherDetalhes(ordem);
      else detalhes.close();
    }
    for (const [dialog, id] of [[pausa, idPausa], [finalizacao, idFinalizacao]]) {
      if (dialog.open && porId(id)?.status !== 'producao') {
        dialog.close();
        informar('A ordem foi atualizada. Confira o status na fila antes de continuar.');
      }
    }
    if (finalizacao.open) $('#quantidade-finalizacao').textContent = quantidade(porId(idFinalizacao));
  }

  fila.addEventListener('click', event => {
    const botao = event.target.closest('button[data-acao]');
    if (!botao || !fila.contains(botao)) return;
    const id = Number(botao.dataset.ordemId);
    const acoes = { detalhes: abrirDetalhes, iniciar: iniciarOrdem, pausar: pausarOrdem, retomar: retomarOrdem, finalizar: finalizarOrdem };
    acoes[botao.dataset.acao]?.(id, botao);
  });
  busca.addEventListener('input', renderizarOrdens);
  status.addEventListener('change', renderizarOrdens);
  prioridade.addEventListener('change', renderizarOrdens);
  formPausa.addEventListener('submit', async event => {
    event.preventDefault();
    if (!formPausa.reportValidity()) return;
    const dados = { motivoPausa: $('#motivo-pausa').value, observacaoPausa: $('#observacao-pausa').value.trim() };
    if (await executarAcao(idPausa, 'pausar', dados)) pausa.close();
  });
  $('#form-finalizacao').addEventListener('submit', async event => {
    event.preventDefault();
    if (await executarAcao(idFinalizacao, 'finalizar')) finalizacao.close();
  });
  definirOrdens([]);
  if (Api.ativa) {
    $('#detalhes-ordem .rodape-formulario p').textContent = 'Informações registradas no sistema.';
    let carregando = false;
    async function carregarOrdens() {
      if (carregando || enviando) return;
      carregando = true;
      const revisao = revisaoOrdens;
      try {
        const recebidas = await Api.requisitar('/api/ordens');
        if (!enviando && revisao === revisaoOrdens) definirOrdens(recebidas);
      } catch (erro) { informar(erro.message); }
      finally { carregando = false; }
    }
    Api.sessao().then(async () => { await carregarOrdens(); setInterval(carregarOrdens, 15000); }).catch(erro => informar(erro.message));
  }
  return { definirOrdens, atualizarOrdem, renderizarOrdens };
})();
