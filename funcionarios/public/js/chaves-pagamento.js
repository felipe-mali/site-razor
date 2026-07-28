// ============================================================
// CHAVES PAGAMENTO.JS - GERENCIAMENTO DE CHAVES PIX
// ============================================================

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));
const DadosBrasileiros = window.DadosBrasileiros;

if (!DadosBrasileiros) {
  throw new Error('O utilitario de dados brasileiros nao foi carregado.');
}

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

function tipoPixNumerico(tipo) {
  const normalizado = DadosBrasileiros.normalizarTipoChavePix(tipo);
  return normalizado === 'CPF' || normalizado === 'CNPJ' || normalizado === 'Telefone';
}

function limiteDigitosChave(tipo) {
  const normalizado = DadosBrasileiros.normalizarTipoChavePix(tipo);
  if (normalizado === 'CPF') return 11;
  if (normalizado === 'CNPJ') return 14;
  if (normalizado === 'Telefone') return 13;
  return null;
}

function formatarChaveParaEntrada(tipo, valor) {
  const normalizado = DadosBrasileiros.normalizarTipoChavePix(tipo);
  if (!tipoPixNumerico(normalizado)) return DadosBrasileiros.textoLiteral(valor);
  if (normalizado === 'Telefone') {
    return DadosBrasileiros.mascararTelefoneEntrada(valor);
  }

  const numeros = DadosBrasileiros.somenteNumeros(valor, limiteDigitosChave(normalizado));
  if (!numeros) return '';
  return DadosBrasileiros.formatarChavePix(normalizado, numeros, '') || numeros;
}

function configurarCampoChave(tipo, campo, reformatar) {
  if (!campo) return;
  const normalizado = DadosBrasileiros.normalizarTipoChavePix(tipo);
  const numerico = tipoPixNumerico(normalizado);
  campo.inputMode = numerico ? 'numeric' : (normalizado === 'Email' ? 'email' : 'text');
  campo.autocomplete = normalizado === 'Email'
    ? 'email'
    : (normalizado === 'Telefone' ? 'tel' : 'off');
  campo.maxLength = normalizado === 'CPF'
    ? 14
    : (normalizado === 'CNPJ' ? 18 : (normalizado === 'Telefone' ? 19 : 180));
  if (reformatar) campo.value = formatarChaveParaEntrada(normalizado, campo.value);
}

function definirErroChave(mensagemElemento, campo, mensagem) {
  if (!mensagemElemento) return;
  mensagemElemento.textContent = mensagem || '';
  mensagemElemento.style.display = mensagem ? '' : 'none';
  if (campo) {
    if (mensagem) campo.setAttribute('aria-invalid', 'true');
    else campo.removeAttribute('aria-invalid');
  }
}

function validarCampoChave(tipo, campo, mensagemElemento) {
  const erro = DadosBrasileiros.erroChavePix(tipo, campo ? campo.value : '');
  definirErroChave(mensagemElemento, campo, erro);
  if (!erro && campo) campo.value = formatarChaveParaEntrada(tipo, campo.value);
  return !erro;
}

function exibirTipoPix(tipo) {
  return DadosBrasileiros.normalizarTipoChavePix(tipo) ||
    DadosBrasileiros.textoSeguro(tipo) ||
    '—';
}

function exibirChavePix(tipo, valor) {
  const normalizado = DadosBrasileiros.normalizarTipoChavePix(tipo);
  if (!normalizado) return '—';
  const texto = tipoPixNumerico(normalizado)
    ? DadosBrasileiros.textoSeguro(valor)
    : DadosBrasileiros.textoLiteral(valor);
  if (!texto) return '—';
  if (tipoPixNumerico(normalizado)) {
    return DadosBrasileiros.formatarChavePix(normalizado, texto, '—');
  }
  return DadosBrasileiros.formatarChavePix(normalizado, texto, '') || texto;
}

function dadosPagamentoFornecedor(fornecedor) {
  if ((fornecedor.forma_pagamento || 'PIX') !== 'PIX') return 'Pagamento por boleto';
  const tipo = exibirTipoPix(fornecedor.tipo_pix);
  const chave = exibirChavePix(fornecedor.tipo_pix, fornecedor.chave_pix);
  if (tipo === '—' || chave === '—') return '—';
  return tipo + ' · ' + chave;
}

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
  return DadosBrasileiros.erroChavePix(tipo, chave);
}

// Carregar chaves
async function carregarChaves() {
  try {
    const resp = await fetch('/api/chaves-pagamento', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Erro ao carregar');
    const data = await resp.json();
    funcionarios = Array.isArray(data.funcionarios)
      ? data.funcionarios.filter(item => item && typeof item === 'object')
      : [];
    renderizarTabela(funcionarios);
  } catch (err) {
    console.error(err);
  }
}

// Renderizar tabela
function renderizarTabela(lista) {
  const tbody = document.getElementById('tabela-chaves');
  const msgVazio = document.getElementById('msg-vazio');
  lista = [...lista].sort((a, b) =>
    nomeExibicao(a).localeCompare(nomeExibicao(b), 'pt-BR', { sensitivity: 'base' })
  );

  if (lista.length === 0) {
    tbody.innerHTML = '';
    msgVazio.style.display = '';
    return;
  }
  msgVazio.style.display = 'none';

  tbody.innerHTML = lista.map(f => `
    <tr>
      <td>${escapar(nomeExibicao(f))}</td>
      <td>${escapar(exibirTipoPix(f.tipo_pix))}</td>
      <td>${escapar(exibirChavePix(f.tipo_pix, f.chave_pix))}</td>
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
  definirErroChave(msgErro, document.getElementById('input-chave'), '');

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
      document.getElementById('input-tipo').value =
        DadosBrasileiros.normalizarTipoChavePix(f.tipo_pix);
      document.getElementById('input-chave').value = f.chave_pix;
    }
  } else {
    title.textContent = 'Novo Funcionario';
  }

  configurarCampoChave(
    document.getElementById('input-tipo').value,
    document.getElementById('input-chave'),
    true
  );
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
  const campoChave = document.getElementById('input-chave');
  definirErroChave(msgErro, campoChave, '');

  const editId = document.getElementById('edit-id').value;
  const funcionario = document.getElementById('input-funcionario').value.trim();
  const apelido = document.getElementById('input-apelido').value.trim();
  const tipo_pix = DadosBrasileiros.normalizarTipoChavePix(
    document.getElementById('input-tipo').value
  );
  const chaveInformada = campoChave.value;

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

  const erroChave = validarChave(tipo_pix, chaveInformada);
  if (erroChave) {
    definirErroChave(msgErro, campoChave, erroChave);
    return;
  }
  const chave_pix = DadosBrasileiros.normalizarChavePix(tipo_pix, chaveInformada);

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
  const chaveComparavel = DadosBrasileiros.chavePixComparavel(tipo_pix, chave_pix);
  const chaveDuplicada = funcionarios.find(f =>
    DadosBrasileiros.chavePixComparavel(f.tipo_pix, f.chave_pix) === chaveComparavel &&
    f.id !== editId
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
    const data = await resp.json();
    fornecedores = (Array.isArray(data.fornecedores)
      ? data.fornecedores.filter(item => item && typeof item === 'object')
      : []).sort((a, b) =>
      String(a.apelido || a.nome || '').localeCompare(
        String(b.apelido || b.nome || ''),
        'pt-BR',
        { sensitivity: 'base' }
      )
    );
    const tbody = document.getElementById('tabela-fornecedores');
    const vazio = document.getElementById('msg-fornecedores-vazio');
    tbody.innerHTML = fornecedores.map(f => `
      <tr>
        <td>${escapar(f.apelido || f.nome)}</td>
        <td>${escapar(f.forma_pagamento || 'PIX')}</td>
        <td>${escapar(dadosPagamentoFornecedor(f))}</td>
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
  document.getElementById('fornecedor-tipo').value = fornecedor
    ? DadosBrasileiros.normalizarTipoChavePix(fornecedor.tipo_pix)
    : '';
  document.getElementById('fornecedor-chave').value = fornecedor ? fornecedor.chave_pix : '';
  document.getElementById('modal-fornecedor-title').textContent = fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor';
  definirErroChave(
    document.getElementById('fornecedor-msg-erro'),
    document.getElementById('fornecedor-chave'),
    ''
  );
  document.getElementById('modal-fornecedor').classList.add('active');
  atualizarCamposPix();
  configurarCampoChave(
    document.getElementById('fornecedor-tipo').value,
    document.getElementById('fornecedor-chave'),
    true
  );
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
  const campoChave = document.getElementById('fornecedor-chave');
  definirErroChave(erro, campoChave, '');
  const id = document.getElementById('fornecedor-edit-id').value;
  const body = {
    nome: document.getElementById('fornecedor-nome').value.trim(),
    apelido: document.getElementById('fornecedor-apelido').value.trim(),
    forma_pagamento: document.getElementById('fornecedor-forma').value,
    tipo_pix: document.getElementById('fornecedor-forma').value === 'PIX'
      ? DadosBrasileiros.normalizarTipoChavePix(document.getElementById('fornecedor-tipo').value)
      : '',
    chave_pix: document.getElementById('fornecedor-forma').value === 'PIX'
      ? campoChave.value
      : ''
  };
  const usaPix = body.forma_pagamento === 'PIX';
  const erroChave = usaPix ? validarChave(body.tipo_pix, body.chave_pix) : null;
  if (!body.nome || (usaPix && !body.tipo_pix) || erroChave) {
    erro.textContent = !body.nome ? 'Nome do fornecedor é obrigatório.' : (!body.tipo_pix ? 'Selecione o tipo da chave.' : erroChave);
    erro.style.display = '';
    if (erroChave) campoChave.setAttribute('aria-invalid', 'true');
    return;
  }
  if (usaPix) {
    body.chave_pix = DadosBrasileiros.normalizarChavePix(body.tipo_pix, body.chave_pix);
    const chaveComparavel = DadosBrasileiros.chavePixComparavel(body.tipo_pix, body.chave_pix);
    const chaveDuplicada = fornecedores.find(f =>
      f.id !== id &&
      DadosBrasileiros.chavePixComparavel(f.tipo_pix, f.chave_pix) === chaveComparavel
    );
    if (chaveDuplicada) {
      definirErroChave(erro, campoChave, 'Esta chave PIX ja esta cadastrada.');
      return;
    }
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
  if (!usaPix) {
    definirErroChave(
      document.getElementById('fornecedor-msg-erro'),
      document.getElementById('fornecedor-chave'),
      ''
    );
  }
}

document.getElementById('fornecedor-forma').addEventListener('change', atualizarCamposPix);

function registrarEventosCampoChave(tipoId, chaveId, erroId) {
  const tipo = document.getElementById(tipoId);
  const campo = document.getElementById(chaveId);
  const erro = document.getElementById(erroId);
  if (!tipo || !campo || !erro) return;

  tipo.addEventListener('change', () => {
    configurarCampoChave(tipo.value, campo, true);
    definirErroChave(erro, campo, '');
  });
  campo.addEventListener('input', () => {
    if (tipoPixNumerico(tipo.value)) {
      campo.value = formatarChaveParaEntrada(tipo.value, campo.value);
    }
    definirErroChave(erro, campo, '');
  });
  campo.addEventListener('blur', () => {
    if (!campo.required && DadosBrasileiros.valorAusente(campo.value)) return;
    validarCampoChave(tipo.value, campo, erro);
  });
}

registrarEventosCampoChave('input-tipo', 'input-chave', 'msg-erro');
registrarEventosCampoChave('fornecedor-tipo', 'fornecedor-chave', 'fornecedor-msg-erro');

carregarChaves();
carregarFornecedores();
