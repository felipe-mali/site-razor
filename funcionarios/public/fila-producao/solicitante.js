'use strict';

// Dados recebidos da API; a persistência pertence ao servidor Razor.
const ordens = [];
let podeExcluir = false;
const nomesStatus = { aguardando: 'Aguardando', producao: 'Em produção', pausada: 'Pausada', concluida: 'Concluída', cancelada: 'Cancelada' };
const form = document.querySelector('#form-solicitacao');
const busca = document.querySelector('#busca');
const filtroStatus = document.querySelector('#filtro-status');
const filtroPrioridade = document.querySelector('#filtro-prioridade');
const prioridade = document.querySelector('#prioridade');
const prazo = document.querySelector('#prazo');
const produto = document.querySelector('#produto');
const lista = document.querySelector('#lista-ordens');
const retorno = document.querySelector('#retorno-formulario');
const modal = document.querySelector('#nova-solicitacao');

function erroFormulario(texto) {
  const mensagem = document.getElementById('erro-solicitacao');
  mensagem.textContent = texto;
  if (texto.includes('sessão expirou')) {
    const login = document.createElement('a');
    login.href = '../login.html'; login.target = '_blank'; login.rel = 'noopener';
    login.textContent = ' Abrir login em outra aba';
    login.style.textDecoration = 'underline';
    mensagem.append(login);
  }
  mensagem.hidden = false;
  mensagem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function abrirSolicitacao(acionador) {
  if (modal.open) return;
  prazo.min = dataLocalHoje();
  Modais.abrir(modal, acionador);
}
document.querySelectorAll('[data-abrir-solicitacao]').forEach(botao => {
  botao.addEventListener('click', () => abrirSolicitacao(botao));
});
function abrirPeloLink() {
  if (location.hash !== '#nova-solicitacao') return;
  abrirSolicitacao(document.querySelector('.acoes [data-abrir-solicitacao]'));
  history.replaceState(null, '', location.pathname + location.search);
}
window.addEventListener('hashchange', abrirPeloLink);

function dataLocalHoje() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
function normalizar(valor) {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function formatarData(valor) {
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR');
}
function criarCelula(linha, texto, tag) {
  const celula = document.createElement('td');
  if (tag) {
    const elemento = document.createElement(tag);
    elemento.textContent = texto;
    celula.append(elemento);
  } else {
    celula.textContent = texto;
  }
  linha.append(celula);
  return celula;
}
function criarBadge(celula, texto, classe) {
  const badge = document.createElement('span');
  badge.className = `badge ${classe}`;
  badge.textContent = texto;
  celula.append(badge);
}
function renderizarOrdens() {
  const termo = normalizar(busca.value);
  const visiveis = ordens.filter(ordem =>
    normalizar(`${ordem.op} ${ordem.produto} ${ordem.cliente}`).includes(termo) &&
    (!filtroStatus.value || ordem.status === filtroStatus.value) &&
    (!filtroPrioridade.value || ordem.prioridade === filtroPrioridade.value)
  );
  lista.replaceChildren();
  for (const ordem of visiveis) {
    const linha = document.createElement('tr');
    criarCelula(linha, ordem.op, 'strong');
    const celulaProduto = criarCelula(linha, ordem.produto, 'strong');
    const cliente = document.createElement('small');
    cliente.textContent = ordem.cliente || 'Destino interno';
    celulaProduto.append(cliente);
    criarCelula(linha, `${ordem.quantidade.toLocaleString('pt-BR')} ${ordem.unidade}`);
    criarCelula(linha, ordem.solicitante);
    criarCelula(linha, formatarData(ordem.data));
    criarCelula(linha, formatarData(ordem.prazo));
    criarBadge(criarCelula(linha, ''), ordem.prioridade === 'urgente' ? 'Urgente' : 'Normal', ordem.prioridade);
    criarBadge(criarCelula(linha, ''), nomesStatus[ordem.status], `status ${ordem.status}`);
    if (podeExcluir) {
      const botao = document.createElement('button');
      botao.type = 'button'; botao.className = 'botao secundario';
      botao.textContent = 'Excluir';
      botao.setAttribute('aria-label', `Excluir solicitação ${ordem.op}`);
      botao.disabled = enviando;
      botao.addEventListener('click', () => excluirSolicitacao(ordem));
      criarCelula(linha, '').append(botao);
    }
    lista.append(linha);
  }
  if (!visiveis.length) {
    const linha = document.createElement('tr');
    const celula = criarCelula(linha, 'Nenhuma solicitação encontrada. Ajuste a busca ou os filtros.');
    celula.colSpan = podeExcluir ? 9 : 8;
    celula.className = 'vazio';
    lista.append(linha);
  }
  document.querySelector('#contagem').textContent = `${visiveis.length} de ${ordens.length} solicitações`;
}
function atualizarPrioridade() {
  prioridade.classList.toggle('prioridade-urgente', prioridade.value === 'urgente');
}

busca.addEventListener('input', renderizarOrdens);
filtroStatus.addEventListener('change', renderizarOrdens);
filtroPrioridade.addEventListener('change', renderizarOrdens);
prioridade.addEventListener('change', atualizarPrioridade);
form.addEventListener('invalid', event => event.target.setAttribute('aria-invalid', 'true'), true);
form.addEventListener('input', event => event.target.removeAttribute('aria-invalid'));
produto.addEventListener('input', () => produto.setCustomValidity(produto.value.trim() ? '' : 'Informe o produto.'));
prazo.min = dataLocalHoje();

let enviando = false;
let revisaoOrdens = 0;
async function excluirSolicitacao(ordem) {
  if (!podeExcluir || enviando) return;
  if (!window.confirm(`Excluir a solicitação ${ordem.op} — ${ordem.produto}? Ela será removida da fila de produção de todos os usuários.`)) return;
  enviando = true;
  revisaoOrdens++;
  renderizarOrdens();
  try {
    await Api.requisitar(`/api/ordens/${ordem.id}`, 'DELETE', { versao: ordem.versao });
    const indice = ordens.findIndex(item => item.id === ordem.id);
    if (indice >= 0) ordens.splice(indice, 1);
    retorno.textContent = `${ordem.op} excluída da fila de produção.`;
    retorno.hidden = false;
    window.RazorFeedback?.mostrar(retorno.textContent, 'sucesso');
  } catch (erro) {
    Api.mostrarErro(erro.message);
  } finally { enviando = false; renderizarOrdens(); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  prazo.min = dataLocalHoje();
  produto.setCustomValidity(produto.value.trim() ? '' : 'Informe o produto.');
  if (!form.checkValidity()) {
    const invalidos = Array.from(form.elements).filter(campo => campo.willValidate && !campo.validity.valid);
    erroFormulario('Confira os campos: ' + invalidos.map(campo => `${campo.labels?.[0]?.textContent.replace(/\*/g, '').trim() || campo.name}: ${campo.validationMessage}`).join(' • '));
    invalidos[0]?.focus();
    return;
  }
  if (enviando) return;
  const dados = Object.fromEntries(new FormData(form));
  let op;
  if (Api.ativa) {
    enviando = true;
    revisaoOrdens++;
    const botao = form.querySelector('[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Enviando solicitação…';
    form.setAttribute('aria-busy', 'true');
    document.getElementById('erro-solicitacao').hidden = true;
    try {
      const ordem = await Api.requisitar('/api/ordens', 'POST', { ...dados, quantidade: Number(dados.quantidade) });
      op = ordem.numeroOP;
      ordens.unshift(adaptarOrdem(ordem));
    } catch (erro) {
      erroFormulario(erro.message);
      return;
    } finally { enviando = false; botao.disabled = false; botao.textContent = 'Solicitar produção'; form.removeAttribute('aria-busy'); }
  }
  document.getElementById('erro-solicitacao').hidden = true;
  form.reset();
  form.querySelectorAll('[aria-invalid]').forEach(campo => campo.removeAttribute('aria-invalid'));
  atualizarPrioridade();
  busca.value = '';
  filtroStatus.value = '';
  filtroPrioridade.value = '';
  renderizarOrdens();
  retorno.textContent = `${op} salva e enviada para a fila de produção.`;
  retorno.hidden = false;
  modal.close();
  window.RazorFeedback?.mostrar(retorno.textContent, 'sucesso');
});
renderizarOrdens();

abrirPeloLink();

function adaptarOrdem(ordem) {
  const dia = new Date(ordem.dataSolicitacao);
  const data = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
  return { ...ordem, op: ordem.numeroOP, data };
}
if (Api.ativa) {
  document.querySelector('.rodape-formulario p').textContent = 'A ordem será enviada para a fila de produção.';
  document.querySelector('caption').textContent = 'Minhas ordens de produção';
  let carregando = false;
  async function carregarOrdens() {
    if (carregando || enviando) return;
    carregando = true;
    const revisao = revisaoOrdens;
    try {
      const recebidas = await Api.requisitar('/api/ordens');
      if (!enviando && revisao === revisaoOrdens) { ordens.splice(0, ordens.length, ...recebidas.map(adaptarOrdem)); renderizarOrdens(); }
    } catch (erro) { Api.mostrarErro(erro.message); }
    finally { carregando = false; }
  }
  Api.sessao().then(async usuario => {
    podeExcluir = usuario.podeExcluir === true;
    document.getElementById('coluna-excluir').hidden = !podeExcluir;
    if (podeExcluir) {
      document.querySelector('caption').textContent = 'Todas as ordens de produção';
      document.getElementById('titulo-lista').textContent = 'Solicitações de todos os setores';
    }
    await carregarOrdens(); setInterval(carregarOrdens, 15000);
  }).catch(erro => Api.mostrarErro(erro.message));
}
