/* ========================================
   CRM — Razor Industrial (Server-side)
   ======================================== */

'use strict';

let crmClientes = [];
let crmFiltroVendedor = '';
let crmBusca = '';
let crmEditandoId = null;

async function crmCarregarClientes() {
  const resp = await fetch('/api/crm', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!resp.ok) throw new Error('Erro ao carregar');
  return await resp.json();
}

async function crmSalvarCliente(cliente) {
  const method = cliente._existente ? 'PUT' : 'POST';
  const url = cliente._existente ? `/api/crm/${cliente.id}` : '/api/crm';
  const resp = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(cliente)
  });
  if (!resp.ok) throw new Error('Erro ao salvar');
}

async function crmExcluirCliente(id) {
  const resp = await fetch(`/api/crm/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!resp.ok) throw new Error('Erro ao excluir');
}

function crmGerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function crmRenderizar() {
  try {
    crmClientes = await crmCarregarClientes();
  } catch (e) {
    console.error('Erro ao carregar clientes:', e);
    crmClientes = [];
  }

  const container = document.getElementById('crm-tabela-conteudo');
  if (!container) return;

  let filtrados = crmClientes;
  if (crmFiltroVendedor) {
    filtrados = filtrados.filter(c => c.vendedor === crmFiltroVendedor);
  }
  if (crmBusca) {
    const busca = crmBusca.toLowerCase();
    filtrados = filtrados.filter(c =>
      (c.nome && c.nome.toLowerCase().includes(busca)) ||
      (c.empresa && c.empresa.toLowerCase().includes(busca))
    );
  }

  // Carregar vendedores para o filtro
  let vendedoresNomes = [];
  try {
    const resp = await fetch('/api/vendedores', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (resp.ok) {
      const vendedoresAPI = await resp.json();
      vendedoresNomes = vendedoresAPI.map(v => v.login);
    }
  } catch (e) {
    vendedoresNomes = [...new Set(crmClientes.map(c => c.vendedor).filter(Boolean))];
  }
  crmClientes.forEach(c => {
    if (c.vendedor && !vendedoresNomes.includes(c.vendedor)) {
      vendedoresNomes.push(c.vendedor);
    }
  });

  const selectVendedor = document.getElementById('crm-filtro-vendedor');
  if (selectVendedor) {
    const valAtual = selectVendedor.value;
    selectVendedor.innerHTML = '<option value="">Todos os vendedores</option>';
    vendedoresNomes.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      selectVendedor.appendChild(opt);
    });
    selectVendedor.value = valAtual;
  }

  if (filtrados.length === 0) {
    container.innerHTML = '<div class="crm-vazio"><div class="crm-vazio-icone">&#128100;</div><p>' + (crmClientes.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado com os filtros atuais.') + '</p></div>';
    return;
  }

  let html = '<table class="crm-tabela"><thead><tr><th>Nome</th><th>Empresa</th><th>Telefone</th><th>E-mail</th><th>Vendedor</th><th>Acoes</th></tr></thead><tbody>';
  filtrados.forEach(c => {
    html += '<tr>';
    html += '<td>' + (c.nome || '-') + '</td>';
    html += '<td>' + (c.empresa || '-') + '</td>';
    html += '<td>' + (c.telefone || '-') + '</td>';
    html += '<td>' + (c.email || '-') + '</td>';
    html += '<td>' + (c.vendedor || '-') + '</td>';
    html += '<td class="col-acoes">';
    html += '<button class="crm-btn-editar" onclick="crmEditarUI(\'' + c.id + '\')">Editar</button> ';
    html += '<button class="crm-btn-excluir" onclick="crmExcluirUI(\'' + c.id + '\')">Excluir</button>';
    html += '</td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function crmNovoUI() {
  crmEditandoId = null;
  document.getElementById('crm-modal-titulo').textContent = 'Cadastrar Cliente';
  document.getElementById('crm-nome').value = '';
  document.getElementById('crm-empresa').value = '';
  document.getElementById('crm-telefone').value = '';
  document.getElementById('crm-email').value = '';
  document.getElementById('crm-obs').value = '';
  document.getElementById('crm-vendedor').value = '';
  carregarVendedoresSelectCRM(null);
  document.getElementById('modal-crm').style.display = 'flex';
  document.getElementById('crm-nome').focus();
}

async function crmEditarUI(id) {
  const cliente = crmClientes.find(c => c.id === id);
  if (!cliente) return;
  crmEditandoId = id;
  document.getElementById('crm-modal-titulo').textContent = 'Editar Cliente';
  document.getElementById('crm-nome').value = cliente.nome || '';
  document.getElementById('crm-empresa').value = cliente.empresa || '';
  document.getElementById('crm-telefone').value = cliente.telefone || '';
  document.getElementById('crm-email').value = cliente.email || '';
  document.getElementById('crm-obs').value = cliente.observacoes || '';
  await carregarVendedoresSelectCRM(cliente.vendedor);
  document.getElementById('modal-crm').style.display = 'flex';
  document.getElementById('crm-nome').focus();
}

function fecharModalCRM() {
  document.getElementById('modal-crm').style.display = 'none';
  crmEditandoId = null;
}

async function carregarVendedoresSelectCRM(vendedorAtual) {
  const select = document.getElementById('crm-vendedor');
  if (!select) return;
  try {
    const resp = await fetch('/api/vendedores', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Erro');
    const vendedores = await resp.json();
    select.innerHTML = '<option value="">Selecione o vendedor</option>';
    vendedores.forEach(v => {
      const selected = v.login === vendedorAtual ? 'selected' : '';
      select.innerHTML += '<option value="' + v.login + '" ' + selected + '>' + v.login + '</option>';
    });
    if (vendedorAtual && !vendedores.some(v => v.login === vendedorAtual)) {
      select.innerHTML += '<option value="' + vendedorAtual + '" selected>' + vendedorAtual + '</option>';
    }
  } catch (err) {
    console.warn('Erro ao carregar vendedores:', err);
  }
}

async function crmSalvarDoModal() {
  const nome = document.getElementById('crm-nome').value.trim();
  if (!nome) {
    alert('O campo Nome e obrigatorio.');
    return;
  }
  const cliente = {
    id: crmEditandoId || crmGerarId(),
    nome: nome,
    empresa: document.getElementById('crm-empresa').value.trim() || '',
    telefone: document.getElementById('crm-telefone').value.trim() || '',
    email: document.getElementById('crm-email').value.trim() || '',
    vendedor: document.getElementById('crm-vendedor').value.trim() || '',
    observacoes: document.getElementById('crm-obs').value.trim() || '',
    _existente: !!crmEditandoId
  };
  try {
    await crmSalvarCliente(cliente);
    fecharModalCRM();
    crmRenderizar();
  } catch (err) {
    console.error('Erro ao salvar cliente:', err);
    alert('Erro ao salvar cliente: ' + err.message);
  }
}

async function crmExcluirUI(id) {
  if (!confirm('Excluir este cliente?')) return;
  try {
    await crmExcluirCliente(id);
    crmRenderizar();
  } catch (err) {
    alert('Erro ao excluir: ' + err.message);
  }
}

function crmFiltrarVendedor(valor) {
  crmFiltroVendedor = valor;
  crmRenderizar();
}

function crmBuscar(valor) {
  crmBusca = valor;
  crmRenderizar();
}

async function crmExportarJSON() {
  const clientes = await crmCarregarClientes();
  const dados = { clientes, exportadoEm: new Date().toISOString(), origem: 'CRM Razor Industrial' };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clientes-razor.json';
  a.click();
  URL.revokeObjectURL(url);
}

function crmImportarJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        const lista = dados.clientes || dados;
        if (!Array.isArray(lista) || lista.length === 0) {
          alert('Arquivo JSON com formato invalido ou vazio.');
          return;
        }
        let importados = 0;
        for (const c of lista) {
          if (!c.nome) continue;
          if (!c.id) c.id = crmGerarId();
          await crmSalvarCliente(c);
          importados++;
        }
        crmRenderizar();
        alert(importados + ' clientes importados com sucesso!');
      } catch (err) {
        alert('Erro ao importar: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Inicializar CRM quando a pagina carregar
document.addEventListener('DOMContentLoaded', () => {
  crmRenderizar();
});
