/* ========================================
   CANCELAMENTOS DE ORCAMENTO — Razor Industrial
   ======================================== */

'use strict';
// Fuso horario Brasil (UTC-3)
function agora() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

const SENHA_CANCELAMENTO = "Lim@020707";

let cancelamentosLista = [];
let cancelamentoEditandoId = null;
let cancelamentoAcaoPendente = null; // { tipo: 'editar'|'excluir', id: '' }

/* ========================================
   CARREGAR DADOS
   ======================================== */
async function cancelamentosCarregar() {
  try {
    const resp = await fetch('/api/cancelamentos', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Erro ao carregar');
    cancelamentosLista = await resp.json();
    cancelamentosRenderizar();
  } catch (e) {
    console.error('Erro ao carregar cancelamentos:', e);
  }
}

/* ========================================
   RENDERIZAR LISTA
   ======================================== */
function cancelamentosRenderizar() {
  const container = document.getElementById('cancelamentos-conteudo');
  if (!container) return;

  // Verificar se é vendedor ou pode gerenciar permissões
  if (user.cargo !== 'vendedor' && !user.pode_gerenciar_permissoes) {
    container.innerHTML = `
      <div class="cancelamentos-bloqueado">
        <div class="icone">&#128683;</div>
        <p>Acesso restrito a vendedores e administradores.</p>
      </div>`;
    return;
  }

  if (cancelamentosLista.length === 0) {
    container.innerHTML = `
      <div class="cancelamentos-vazio">
        <div class="icone">&#128196;</div>
        <p>Nenhuma solicitacao de cancelamento registrada.</p>
      </div>`;
    return;
  }

  // Ordenar por data mais recente primeiro
  const ordenados = [...cancelamentosLista].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

  container.innerHTML = ordenados.map(c => {
    const dataFormatada = formatarData(c.data);
    const criadoFormatado = formatarData(c.criadoEm);

    const motivoMap = {
      '1': '1. Preco (nao aprovou o valor)',
      '2': '2. Concorrente — foi para outro fornecedor',
      '3': '3. Desistiu da compra',
      '4': '4. Sem resposta — nao retornou contato',
      '5': '5. Perdeu para prazo / disponibilidade',
      '6': '6. Erro de formatacao ou orcamento duplicado'
    };
    const motivoTexto = motivoMap[c.motivo] || c.motivo;
    const motivoExtra = c.motivo === '6' && c.motivoSubstituto ? ` — Orcamento substituto: ${c.motivoSubstituto}` : '';

    // Botões: editar para vendedores e admins, excluir apenas para admins
    const botoes = user.pode_gerenciar_permissoes
      ? `<button class="btn-cancelamento-editar" onclick="cancelamentoEditarUI('${c.id}')">Editar</button>
         <button class="btn-cancelamento-excluir" onclick="cancelamentoExcluirUI('${c.id}')">Excluir</button>`
      : `<button class="btn-cancelamento-editar" onclick="cancelamentoEditarUI('${c.id}')">Editar</button>`;

    return `
      <div class="cancelamento-card" data-id="${c.id}">
        <div class="cancelamento-header">
          <div class="cancelamento-titulo">SOLICITACAO DE CANCELAMENTO DE ORCAMENTO</div>
        </div>
        <div class="cancelamento-meta">
          <div class="cancelamento-meta-item"><strong>SOLICITANTE:</strong> ${escapeHtml(c.solicitante)}</div>
          <div class="cancelamento-meta-item"><strong>ORCAMENTO:</strong> ${escapeHtml(c.numeroOrcamento || '—')}</div>
          <div class="cancelamento-meta-item"><strong>DATA:</strong> ${dataFormatada}</div>
        </div>
        <div class="cancelamento-secao">
          <div class="cancelamento-secao-titulo">Canal de contato</div>
          <div class="cancelamento-secao-conteudo">${escapeHtml(c.canal)}</div>
        </div>
        <div class="cancelamento-secao">
          <div class="cancelamento-secao-titulo">Motivo</div>
          <div class="cancelamento-secao-conteudo">${escapeHtml(motivoTexto)}${escapeHtml(motivoExtra)}</div>
        </div>
        ${c.observacoes ? `
        <div class="cancelamento-secao">
          <div class="cancelamento-secao-titulo">Observacoes</div>
          <div class="cancelamento-obs">${escapeHtml(c.observacoes)}</div>
        </div>` : ''}
        <div class="cancelamento-botoes">
          ${botoes}
        </div>
      </div>`;
  }).join('');
}

/* ========================================
   MODAL — NOVO / EDITAR
   ======================================== */
function cancelamentoNovoUI() {
  cancelamentoEditandoId = null;
  const solicitante = user.pode_gerenciar_permissoes && user.cargo !== 'vendedor'
    ? user.nome + ' - Razor Admin'
    : user.nome + ' - Razor Comercial';
  cancelamentoAbrirModal({
    solicitante: solicitante,
    numeroOrcamento: '',
    data: formatarDataInput(new Date()),
    canal: '',
    motivo: '',
    motivoSubstituto: '',
    observacoes: ''
  });
}

function cancelamentoEditarUI(id) {
  cancelamentoAcaoPendente = { tipo: 'editar', id };
  senhaModalAbrir();
}

function cancelamentoEditarDados(id) {
  const c = cancelamentosLista.find(x => x.id === id);
  if (!c) return;
  cancelamentoEditandoId = id;
  cancelamentoAbrirModal({
    solicitante: c.solicitante,
    numeroOrcamento: c.numeroOrcamento || '',
    data: formatarDataInput(new Date(c.data)),
    canal: c.canal,
    motivo: c.motivo,
    motivoSubstituto: c.motivoSubstituto || '',
    observacoes: c.observacoes
  });
}

function cancelamentoAbrirModal(dados) {
  const modal = document.getElementById('modal-cancelamento');
  if (!modal) return;

  document.getElementById('cancel-solicitante').value = dados.solicitante || '';
  document.getElementById('cancel-numero-orcamento').value = dados.numeroOrcamento || '';
  document.getElementById('cancel-data').value = dados.data || '';
  document.getElementById('cancel-observacoes').value = dados.observacoes || '';

  // Resetar radios
  modal.querySelectorAll('input[name="cancel-canal"]').forEach(r => r.checked = false);
  modal.querySelectorAll('input[name="cancel-motivo"]').forEach(r => r.checked = false);

  // Selecionar canal
  if (dados.canal) {
    const canalRadio = modal.querySelector(`input[name="cancel-canal"][value="${dados.canal}"]`);
    if (canalRadio) canalRadio.checked = true;
  }

  // Selecionar motivo
  if (dados.motivo) {
    const motivoRadio = modal.querySelector(`input[name="cancel-motivo"][value="${dados.motivo}"]`);
    if (motivoRadio) motivoRadio.checked = true;
    cancelamentoMotivoToggle(dados.motivo);
  }

  // Campo substituto
  document.getElementById('cancel-motivo-substituto').value = dados.motivoSubstituto || '';

  // Titulo
  document.getElementById('cancel-modal-titulo').textContent = cancelamentoEditandoId ? 'EDITAR SOLICITACAO' : 'NOVA SOLICITACAO';

  modal.classList.add('ativo');
}

function cancelamentoFecharModal() {
  const modal = document.getElementById('modal-cancelamento');
  if (modal) modal.classList.remove('ativo');
  cancelamentoEditandoId = null;
}

function cancelamentoMotivoToggle(valor) {
  const campo = document.getElementById('campo-substituto');
  if (campo) {
    if (valor === '6') {
      campo.classList.add('ativo');
    } else {
      campo.classList.remove('ativo');
      document.getElementById('cancel-motivo-substituto').value = '';
    }
  }
}

/* ========================================
   SALVAR
   ======================================== */
async function cancelamentoSalvar() {
  const solicitante = document.getElementById('cancel-solicitante').value.trim();
  const numeroOrcamento = document.getElementById('cancel-numero-orcamento').value.trim();
  const data = document.getElementById('cancel-data').value;
  const canalEl = document.querySelector('input[name="cancel-canal"]:checked');
  const motivoEl = document.querySelector('input[name="cancel-motivo"]:checked');
  const motivoSubstituto = document.getElementById('cancel-motivo-substituto').value.trim();
  const observacoes = document.getElementById('cancel-observacoes').value.trim();

  if (!solicitante) {
    alert('Preencha o campo Solicitante.');
    return;
  }
  if (!numeroOrcamento) {
    alert('Preencha o campo Numero do Orcamento.');
    return;
  }
  if (!canalEl) {
    alert('Selecione o canal de contato.');
    return;
  }
  if (!motivoEl) {
    alert('Selecione o motivo do cancelamento.');
    return;
  }
  if (motivoEl.value === '6' && !motivoSubstituto) {
    alert('Informe o numero do orcamento substituto.');
    return;
  }

  const payload = {
    solicitante,
    numeroOrcamento,
    data: data ? new Date(data).toISOString() : agora().toISOString(),
    canal: canalEl.value,
    motivo: motivoEl.value,
    motivoSubstituto,
    observacoes
  };

  try {
    let resp;
    if (cancelamentoEditandoId) {
      resp = await fetch('/api/cancelamentos/' + cancelamentoEditandoId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });
    } else {
      resp = await fetch('/api/cancelamentos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });
    }

    if (!resp.ok) {
      const err = await resp.json();
      alert(err.error || 'Erro ao salvar');
      return;
    }

    cancelamentoFecharModal();
    await cancelamentosCarregar();
  } catch (e) {
    alert('Erro de conexao: ' + e.message);
  }
}

/* ========================================
   EXCLUIR
   ======================================== */
function cancelamentoExcluirUI(id) {
  cancelamentoAcaoPendente = { tipo: 'excluir', id };
  senhaModalAbrir();
}

async function cancelamentoExcluirConfirmado(id) {
  try {
    const resp = await fetch('/api/cancelamentos/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) {
      const err = await resp.json();
      alert(err.error || 'Erro ao excluir');
      return;
    }
    await cancelamentosCarregar();
  } catch (e) {
    alert('Erro de conexao: ' + e.message);
  }
}

/* ========================================
   MODAL DE SENHA
   ======================================== */
function senhaModalAbrir() {
  const modal = document.getElementById('modal-senha-cancelamento');
  if (!modal) return;
  document.getElementById('senha-cancel-input').value = '';
  document.getElementById('senha-cancel-erro').style.display = 'none';
  modal.classList.add('ativo');
  document.getElementById('senha-cancel-input').focus();
}

function senhaModalFechar() {
  const modal = document.getElementById('modal-senha-cancelamento');
  if (modal) modal.classList.remove('ativo');
  cancelamentoAcaoPendente = null;
}

function senhaModalConfirmar() {
  const input = document.getElementById('senha-cancel-input');
  const erro = document.getElementById('senha-cancel-erro');
  const senha = input.value;

  if (senha !== SENHA_CANCELAMENTO) {
    erro.textContent = 'Senha incorreta.';
    erro.style.display = 'block';
    input.value = '';
    input.focus();
    return;
  }

  // Senha correta — executar acao pendente
  const acao = cancelamentoAcaoPendente;
  senhaModalFechar();

  if (acao.tipo === 'editar') {
    cancelamentoEditarDados(acao.id);
  } else if (acao.tipo === 'excluir') {
    if (confirm('Tem certeza que deseja excluir esta solicitacao de cancelamento?')) {
      cancelamentoExcluirConfirmado(acao.id);
    }
  }
}

/* ========================================
   UTILITARIOS
   ======================================== */
function formatarData(isoString) {
  if (!isoString) return '—';
  var d = new Date(isoString);
  var brt = new Date(d.getTime() - (d.getTimezoneOffset() + 180) * 60000);
  var dia = String(brt.getDate()).padStart(2, '0');
  var mes = String(brt.getMonth() + 1).padStart(2, '0');
  var ano = brt.getFullYear();
  var hora = String(brt.getHours()).padStart(2, '0');
  var min = String(brt.getMinutes()).padStart(2, '0');
  return dia + '/' + mes + '/' + ano + ' ' + hora + ':' + min;
}
function formatarDataInput(d) {
  var brt = new Date(d.getTime() - (d.getTimezoneOffset() + 180) * 60000);
  var ano = brt.getFullYear();
  var mes = String(brt.getMonth() + 1).padStart(2, '0');
  var dia = String(brt.getDate()).padStart(2, '0');
  var hora = String(brt.getHours()).padStart(2, '0');
  var min = String(brt.getMinutes()).padStart(2, '0');
  return ano + '-' + mes + '-' + dia + 'T' + hora + ':' + min;
}
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ========================================
   INICIALIZACAO
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  cancelamentosCarregar();
});
