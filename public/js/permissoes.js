// ============================================================
// PERMISSOES.JS - GERENCIAMENTO DE USUÁRIOS
// ============================================================

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

// Verificar permissão
if (!user || !token || !user.pode_gerenciar_permissoes) {
  window.location.href = 'funcionario.html';
}

// Sair
document.getElementById('btn-sair').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

// Labels dos cargos
const CARGOS_LABELS = {
  admin: 'Administrador',
  engenheiro: 'Engenheiro',
  logistica: 'Logística',
  vendedor: 'Vendedor',
  funcionario: 'Funcionário'
};

// Carregar usuários
async function carregarUsuarios() {
  const tbody = document.getElementById('tabela-usuarios');
  let response;
  try {
    response = await fetch('/api/usuarios', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return;
    }
    if (!response.ok) throw new Error('Não foi possível carregar os usuários.');
  } catch (erro) {
    tbody.innerHTML = `<tr><td colspan="9">${erro.message}</td></tr>`;
    return;
  }
  const usuarios = await response.json();

  tbody.innerHTML = Object.entries(usuarios).map(([key, u]) => `
    <tr>
      <td>${key}</td>
      <td>${u.nome}</td>
      <td>${CARGOS_LABELS[u.cargo] || u.cargo || '—'}</td>
      <td>${u.ativo !== false ? '✅' : '❌'}</td>
      <td>${u.pode_ver_funcionario ? '✅' : '❌'}</td>
      <td>${u.pode_editar_imagens ? '✅' : '❌'}</td>
      <td>${u.pode_gerenciar_permissoes ? '✅' : '❌'}</td>
      <td>${(u.cargo === 'logistica' || u.cargo === 'admin' || u.pode_gerenciar_permissoes || u.pode_acessar_cotacoes) ? '✅' : '❌'}</td>
      <td>
        <button class="btn-editar" onclick="editarUsuario('${key}')">Editar</button>
        <button class="btn-excluir" onclick="excluirUsuario('${key}')">Excluir</button>
      </td>
    </tr>
  `).join('');
}

// Modal
function abrirModal(id = null) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');

  document.getElementById('edit-id').value = '';
  document.getElementById('input-usuario').value = '';
  document.getElementById('input-nome').value = '';
  document.getElementById('input-senha').value = '';
  document.getElementById('input-cargo').value = 'funcionario';
  document.getElementById('input-ativo').checked = true;
  document.getElementById('perm-func').checked = false;
  document.getElementById('perm-editar').checked = false;
  document.getElementById('perm-admin').checked = false;
  document.getElementById('perm-cotacoes').checked = false;
  document.getElementById('input-usuario').disabled = false;

  if (id) {
    title.textContent = 'Editar Usuário';
    // Carregar dados do usuário
    fetch('/api/usuarios', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(usuarios => {
        const u = usuarios[id];
        document.getElementById('edit-id').value = id;
        document.getElementById('input-usuario').value = id;
        document.getElementById('input-nome').value = u.nome;
        document.getElementById('input-cargo').value = u.cargo || 'funcionario';
        document.getElementById('input-ativo').checked = u.ativo !== false;
        document.getElementById('perm-func').checked = u.pode_ver_funcionario;
        document.getElementById('perm-editar').checked = u.pode_editar_imagens;
        document.getElementById('perm-admin').checked = u.pode_gerenciar_permissoes;
        document.getElementById('perm-cotacoes').checked = u.pode_acessar_cotacoes;
        document.getElementById('input-usuario').disabled = true;
      });
  } else {
    title.textContent = 'Novo Usuário';
  }

  modal.classList.add('active');
}

function fecharModal() {
  document.getElementById('modal').classList.remove('active');
}

function editarUsuario(id) {
  abrirModal(id);
}

async function excluirUsuario(id) {
  if (!confirm('Excluir este usuário?')) return;
  await fetch(`/api/usuarios/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  carregarUsuarios();
}

// Salvar
document.getElementById('usuario-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('edit-id').value;
  const usuario = document.getElementById('input-usuario').value;
  const nome = document.getElementById('input-nome').value;
  const senha = document.getElementById('input-senha').value;
  const cargo = document.getElementById('input-cargo').value;
  const ativo = document.getElementById('input-ativo').checked;

  const body = {
    usuario,
    nome,
    cargo,
    ativo,
    permissoes: {
      pode_ver_funcionario: document.getElementById('perm-func').checked,
      pode_ver_imagens: document.getElementById('perm-func').checked,
      pode_editar_imagens: document.getElementById('perm-editar').checked,
      pode_gerenciar_permissoes: document.getElementById('perm-admin').checked,
      pode_acessar_cotacoes: document.getElementById('perm-cotacoes').checked
    }
  };

  if (senha) body.senha = senha;

  if (editId) {
    await fetch(`/api/usuarios/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  } else {
    await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  }

  fecharModal();
  carregarUsuarios();
});

carregarUsuarios();
