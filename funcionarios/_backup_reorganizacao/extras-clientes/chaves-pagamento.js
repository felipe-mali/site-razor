// ============================================================
// CHAVES PAGAMENTO.JS - GERENCIAMENTO DE CHAVES PIX
// ============================================================

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

// Verificar permissao (admin ou quem pode gerenciar permissoes)
if (!user || !token || (!user.pode_gerenciar_permissoes && user.cargo !== 'admin')) {
  window.location.href = 'funcionario.html';
}

// Sair
document.getElementById('btn-sair').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

// Estado
let funcionarios = [];
let idParaExcluir = null;
let fornecedores = [];

// Sanitizacao basica para prevenir XSS
function escapar(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Formatar data para exibicao
function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Exibir nome: apelido se existir, senao nome completo
function nomeExibicao(f) {
  return f.apelido && f.apelido.trim() ? f.apelido.trim() : f.funcionario;
}

// Validacao de chave conforme tipo
function validarChave(tipo, chave) {
  if (!chave || !chave.trim()) return 'Chave PIX e obrigatoria.';
  const val = chave.trim();
  switch (tipo) {
    case 'CPF':
      if (!/^\d{11}$/.test(val)) return 'CPF deve conter exatamente 11 numeros.';
      break;
    case 'CNPJ':
      if (!/^\d{14}$/.test(val)) return 'CNPJ deve conter exatamente 14 numeros.';
      break;
    case 'Telefone':
      if (!/^\d{10,11}$/.test(val)) return 'Telefone deve conter 10 ou 11 numeros.';
      break;
    case 'Email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Formato de email invalido.';
      break;
    case 'Aleatoria':
      // chave aleatoria: qualquer coisa com 1+ caracteres
      if (val.length < 1) return 'Chave aleatoria nao pode ser vazia.';
      break;
  }
  return null;
}

// Carregar chaves
async function carregarChaves() {
  try {
    const resp = await fetch('/api/chaves-pagamento', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Erro ao carregar');
    const data = await resp.json();
    funcionarios = data.funcionarios || [];
    renderizarTabela(funcionarios);
  } catch (err) {
    console.error(err);
  }
}

// Renderizar tabela
function renderizarTabela(lista) {
  const tbody = document.getElementById('tabela-chaves');
  const msgVazio = document.getElementById('msg-vazio');

  if (lista.length === 0) {
    tbody.innerHTML = '';
    msgVazio.style.display = '';
    return;
  }
  msgVazio.style.display = 'none';

  tbody.innerHTML = lista.map(f => `
    <tr>
      <td>${escapar(nomeExibicao(f))}</td>
      <td>${escapar(f.tipo_pix)}</td>
      <td>${escapar(f.chave_pix)}</td>
      <td>
        <button class="btn-editar" onclick="editarChave('${f.id}')">Editar</button>
        <button class="btn-excluir" onclick="abrirModalConfirm('${f.id}')">Excluir</button>
      </td>
    </tr>
  `).join('');
}

// Busca instantanea
document.getElementById('busca').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtrados = funcionarios.filter(f =>
    f.funcionario.toLowerCase().includes(q) ||
    (f.apelido && f.apelido.toLowerCase().includes(q))
  );
  renderizarTabela(filtrados);
});

// Modal cadastro/edicao
function abrirModal(id) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const msgErro = document.getElementById('msg-erro');
  msgErro.style.display = 'none';

  document.getElementById('edit-id').value = '';
  document.getElementById('input-funcionario').value = '';
  document.getElementById('input-apelido').value = '';
  document.getElementById('input-tipo').value = '';
  document.getElementById('input-chave').value = '';

  if (id) {
    title.textContent = 'Editar Funcionario';
    const f = funcionarios.find(x => x.id === id);
    if (f) {
      document.getElementById('edit-id').value = f.id;
      document.getElementById('input-funcionario').value = f.funcionario;
      document.getElementById('input-apelido').value = f.apelido || '';
      document.getElementById('input-tipo').value = f.tipo_pix;
      document.getElementById('input-chave').value = f.chave_pix;
    }
  } else {
    title.textContent = 'Novo Funcionario';
  }

  modal.classList.add('active');
}

function fecharModal() {
  document.getElementById('modal').classList.remove('active');
}

function editarChave(id) {
  abrirModal(id);
}

// Modal confirmacao exclusao
function abrirModalConfirm(id) {
  idParaExcluir = id;
  document.getElementById('modal-confirm').classList.add('active');
}

function fecharModalConfirm() {
  idParaExcluir = null;
  document.getElementById('modal-confirm').classList.remove('active');
}

async function confirmarExclusao() {
  if (!idParaExcluir) return;
  try {
    const resp = await fetch('/api/chaves-pagamento/' + idParaExcluir, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (resp.ok) {
      fecharModalConfirm();
      await carregarChaves();
    }
  } catch (err) {
    console.error(err);
  }
}

// Salvar (criar ou editar)
document.getElementById('chave-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgErro = document.getElementById('msg-erro');
  msgErro.style.display = 'none';

  const editId = document.getElementById('edit-id').value;
  const funcionario = document.getElementById('input-funcionario').value.trim();
  const apelido = document.getElementById('input-apelido').value.trim();
  const tipo_pix = document.getElementById('input-tipo').value;
  const chave_pix = document.getElementById('input-chave').value.trim();

  // Validacoes
  if (!funcionario) {
    msgErro.textContent = 'Nome do funcionario e obrigatorio.';
    msgErro.style.display = '';
    return;
  }

  if (!tipo_pix) {
    msgErro.textContent = 'Selecione o tipo da chave.';
    msgErro.style.display = '';
    return;
  }

  const erroChave = validarChave(tipo_pix, chave_pix);
  if (erroChave) {
    msgErro.textContent = erroChave;
    msgErro.style.display = '';
    return;
  }

  // Verificar nome duplicado
  const nomeDuplicado = funcionarios.find(f =>
    f.funcionario.toLowerCase() === funcionario.toLowerCase() && f.id !== editId
  );
  if (nomeDuplicado) {
    msgErro.textContent = 'Ja existe um funcionario com este nome.';
    msgErro.style.display = '';
    return;
  }

  // Verificar chave duplicada
  const chaveDuplicada = funcionarios.find(f =>
    f.chave_pix === chave_pix && f.id !== editId
  );
  if (chaveDuplicada) {
    msgErro.textContent = 'Esta chave PIX ja esta cadastrada.';
    msgErro.style.display = '';
    return;
  }

  const body = { funcionario, apelido, tipo_pix, chave_pix };

  try {
    let resp;
    if (editId) {
      resp = await fetch('/api/chaves-pagamento/' + editId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body)
      });
    } else {
      resp = await fetch('/api/chaves-pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body)
      });
    }

    if (resp.ok) {
      fecharModal();
      await carregarChaves();
    } else {
      const data = await resp.json();
      msgErro.textContent = data.error || 'Erro ao salvar.';
      msgErro.style.display = '';
    }
  } catch (err) {
    msgErro.textContent = 'Erro de conexao.';
    msgErro.style.display = '';
  }
});

// Inicializar
async function carregarFornecedores() {
  try {
    const resp = await fetch('/api/fornecedores-pagamento', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (resp.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return;
    }
    if (!resp.ok) throw new Error('Erro ao carregar fornecedores');
    fornecedores = (await resp.json()).fornecedores || [];
    const tbody = document.getElementById('tabela-fornecedores');
    const vazio = document.getElementById('msg-fornecedores-vazio');
    tbody.innerHTML = fornecedores.map(f => `
      <tr>
        <td>${escapar(f.apelido || f.nome)}</td>
        <td>${escapar(f.forma_pagamento || 'PIX')}</td>
        <td>${(f.forma_pagamento || 'PIX') === 'PIX' ? escapar(f.tipo_pix + ' · ' + f.chave_pix) : 'Pagamento por boleto'}</td>
        <td>
          <button class="btn-editar" onclick="abrirModalFornecedor('${f.id}')">Editar</button>
          <button class="btn-excluir" onclick="excluirFornecedor('${f.id}')">Excluir</button>
        </td>
      </tr>`).join('');
    vazio.style.display = fornecedores.length ? 'none' : '';
  } catch (err) {
    console.error(err);
  }
}

function abrirModalFornecedor(id) {
  const fornecedor = fornecedores.find(f => f.id === id);
  document.getElementById('fornecedor-edit-id').value = fornecedor ? fornecedor.id : '';
  document.getElementById('fornecedor-nome').value = fornecedor ? fornecedor.nome : '';
  document.getElementById('fornecedor-apelido').value = fornecedor ? (fornecedor.apelido || '') : '';
  document.getElementById('fornecedor-forma').value = fornecedor ? (fornecedor.forma_pagamento || 'PIX') : 'PIX';
  document.getElementById('fornecedor-tipo').value = fornecedor ? fornecedor.tipo_pix : '';
  document.getElementById('fornecedor-chave').value = fornecedor ? fornecedor.chave_pix : '';
  document.getElementById('modal-fornecedor-title').textContent = fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor';
  document.getElementById('fornecedor-msg-erro').style.display = 'none';
  document.getElementById('modal-fornecedor').classList.add('active');
  atualizarCamposPix();
}

function fecharModalFornecedor() {
  document.getElementById('modal-fornecedor').classList.remove('active');
}

async function excluirFornecedor(id) {
  const fornecedor = fornecedores.find(f => f.id === id);
  if (!fornecedor || !window.confirm('Excluir ' + (fornecedor.apelido || fornecedor.nome) + '?')) return;
  const resp = await fetch('/api/fornecedores-pagamento/' + id, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (resp.ok) carregarFornecedores();
}

document.getElementById('fornecedor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = document.getElementById('fornecedor-msg-erro');
  erro.style.display = 'none';
  const id = document.getElementById('fornecedor-edit-id').value;
  const body = {
    nome: document.getElementById('fornecedor-nome').value.trim(),
    apelido: document.getElementById('fornecedor-apelido').value.trim(),
    forma_pagamento: document.getElementById('fornecedor-forma').value,
    tipo_pix: document.getElementById('fornecedor-forma').value === 'PIX' ? document.getElementById('fornecedor-tipo').value : '',
    chave_pix: document.getElementById('fornecedor-forma').value === 'PIX' ? document.getElementById('fornecedor-chave').value.trim() : ''
  };
  const usaPix = body.forma_pagamento === 'PIX';
  const erroChave = usaPix ? validarChave(body.tipo_pix, body.chave_pix) : null;
  if (!body.nome || (usaPix && !body.tipo_pix) || erroChave) {
    erro.textContent = !body.nome ? 'Nome do fornecedor é obrigatório.' : (!body.tipo_pix ? 'Selecione o tipo da chave.' : erroChave);
    erro.style.display = '';
    return;
  }
  try {
    const resp = await fetch('/api/fornecedores-pagamento' + (id ? '/' + id : ''), {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao salvar.');
    fecharModalFornecedor();
    carregarFornecedores();
  } catch (err) {
    erro.textContent = err.message;
    erro.style.display = '';
  }
});

function atualizarCamposPix() {
  const usaPix = document.getElementById('fornecedor-forma').value === 'PIX';
  document.getElementById('fornecedor-campos-pix').style.display = usaPix ? '' : 'none';
  document.getElementById('fornecedor-tipo').required = usaPix;
  document.getElementById('fornecedor-chave').required = usaPix;
}

document.getElementById('fornecedor-forma').addEventListener('change', atualizarCamposPix);

carregarChaves();
carregarFornecedores();
