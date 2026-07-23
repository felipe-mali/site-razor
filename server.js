const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const busboy = require('busboy');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const IMAGES_PATH = process.env.IMAGES_PATH || 'rede';
const USUARIOS_PATH = process.env.USUARIOS_PATH || path.join(__dirname, 'data', 'usuarios.json');

// Sessões em memória
const sessions = new Map();

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));

// Normalizar permissões aninhadas para flat (executa uma vez no startup)
function normalizarUsuarios() {
  try {
    if (!fs.existsSync(USUARIOS_PATH)) return;
    const users = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
    let mudou = false;
    for (const [key, val] of Object.entries(users)) {
      if (val.permissoes && typeof val.permissoes === 'object') {
        const p = val.permissoes;
        val.pode_ver_funcionario = p.pode_ver_funcionario ?? false;
        val.pode_ver_imagens = p.pode_ver_imagens ?? false;
        val.pode_editar_imagens = p.pode_editar_imagens ?? false;
        val.pode_gerenciar_permissoes = p.pode_gerenciar_permissoes ?? false;
        val.pode_acessar_cotacoes = p.pode_acessar_cotacoes ?? false;
        delete val.permissoes;
        mudou = true;
      }
    }
    if (mudou) {
      fs.writeFileSync(USUARIOS_PATH, JSON.stringify(users, null, 2));
      console.log('Permissões de usuários normalizadas (flat).');
    }
  } catch (e) {
    console.warn('Erro ao normalizar usuários:', e.message);
  }
}
normalizarUsuarios();

// Tags em memória
let tags = [];
const TAGS_PATH = path.join(__dirname, 'data', 'tags.json');
try {
  if (fs.existsSync(TAGS_PATH)) {
    tags = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
  }
} catch {
  tags = [];
}

// Middleware de autenticação
function authenticate(req, res, next) {
  // O painel usa Authorization. Priorizá-lo evita que um cookie antigo invalide
  // uma sessão recém-criada pelo login.
  const tokenHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = tokenHeader || req.cookies.token;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  req.user = sessions.get(token);
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user.pode_gerenciar_permissoes) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

function requireCotacoes(req, res, next) {
  if (
    req.user.ativo === false ||
    !(
      req.user.cargo === 'admin' ||
      req.user.cargo === 'logistica' ||
      req.user.pode_gerenciar_permissoes ||
      req.user.pode_acessar_cotacoes
    )
  ) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

// Login
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  const users = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  if (users[usuario] && users[usuario].senha === senha) {
    // Verificar se o usuário está ativo
    if (users[usuario].ativo === false) {
      return res.status(403).json({ error: 'Usuário desativado. Contate o administrador.' });
    }
    const token = Math.random().toString(36).substring(7);
    sessions.set(token, { ...users[usuario], usuario });
    res.clearCookie('token');
    res.json({ success: true, token, user: { nome: users[usuario].nome, ...users[usuario] } });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.cookies.token;
  if (token) sessions.delete(token);
  res.clearCookie('token');
  res.json({ success: true });
});

// Usuário atual
app.get('/api/me', authenticate, (req, res) => {
  res.json(req.user);
});

// CRUD Usuários
app.get('/api/usuarios', authenticate, requireAdmin, (req, res) => {
  const users = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  const result = {};
  for (const [key, val] of Object.entries(users)) {
    const perm = val.permissoes || {};
    result[key] = {
      nome: val.nome,
      senha: val.senha,
      cargo: val.cargo,
      ativo: val.ativo,
      pode_ver_funcionario: val.pode_ver_funcionario ?? perm.pode_ver_funcionario ?? false,
      pode_ver_imagens: val.pode_ver_imagens ?? perm.pode_ver_imagens ?? false,
      pode_editar_imagens: val.pode_editar_imagens ?? perm.pode_editar_imagens ?? false,
      pode_gerenciar_permissoes: val.pode_gerenciar_permissoes ?? perm.pode_gerenciar_permissoes ?? false,
      pode_acessar_cotacoes: val.pode_acessar_cotacoes ?? perm.pode_acessar_cotacoes ?? false
    };
  }
  res.json(result);
});

app.post('/api/usuarios', authenticate, requireAdmin, (req, res) => {
  const { usuario, nome, senha, cargo, ativo, permissoes } = req.body;
  const users = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  const p = permissoes || {};
  users[usuario] = {
    nome,
    senha,
    cargo: cargo || 'funcionario',
    ativo: ativo || false,
    pode_ver_funcionario: p.pode_ver_funcionario || false,
    pode_ver_imagens: p.pode_ver_imagens || false,
    pode_editar_imagens: p.pode_editar_imagens || false,
    pode_gerenciar_permissoes: p.pode_gerenciar_permissoes || false,
    pode_acessar_cotacoes: p.pode_acessar_cotacoes || false
  };
  fs.writeFileSync(USUARIOS_PATH, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

app.put('/api/usuarios/:id', authenticate, requireAdmin, (req, res) => {
  const users = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  const { nome, senha, cargo, ativo, permissoes } = req.body;
  if (users[req.params.id]) {
    const p = permissoes || {};
    users[req.params.id] = {
      ...users[req.params.id],
      ...(nome && { nome }),
      ...(senha && { senha }),
      ...(cargo && { cargo }),
      ...(ativo !== undefined && { ativo }),
      ...(permissoes && {
        pode_ver_funcionario: p.pode_ver_funcionario ?? false,
        pode_ver_imagens: p.pode_ver_imagens ?? false,
        pode_editar_imagens: p.pode_editar_imagens ?? false,
        pode_gerenciar_permissoes: p.pode_gerenciar_permissoes ?? false,
        pode_acessar_cotacoes: p.pode_acessar_cotacoes ?? users[req.params.id].pode_acessar_cotacoes ?? false
      })
    };
    fs.writeFileSync(USUARIOS_PATH, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Usuário não encontrado' });
  }
});

app.delete('/api/usuarios/:id', authenticate, requireAdmin, (req, res) => {
  const users = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  if (users[req.params.id]) {
    delete users[req.params.id];
    fs.writeFileSync(USUARIOS_PATH, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Usuário não encontrado' });
  }
});

// Vendedores (usuários com cargo vendedor e ativos)
app.get('/api/vendedores', authenticate, (req, res) => {
  const users = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  const vendedores = Object.entries(users)
    .filter(([u]) => users[u].cargo === 'vendedor' && users[u].ativo !== false)
    .map(([login, u]) => ({ login, nome: u.nome }));
  res.json(vendedores);
});

// Categorias de imagens
app.get('/api/categories', authenticate, (req, res) => {
  try {
    if (!fs.existsSync(IMAGES_PATH)) fs.mkdirSync(IMAGES_PATH, { recursive: true });
    const categories = fs.readdirSync(IMAGES_PATH).filter(f =>
      fs.statSync(path.join(IMAGES_PATH, f)).isDirectory()
    );
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const { name } = req.body;
  const dir = path.join(IMAGES_PATH, name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  res.json({ success: true });
});

app.delete('/api/categories/:name', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const dir = path.join(IMAGES_PATH, req.params.name);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  res.json({ success: true });
});

// Imagens
app.get('/api/images/:category', authenticate, (req, res) => {
  const dir = path.join(IMAGES_PATH, req.params.category);
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.startsWith('img_'));
  res.json(files);
});

app.get('/api/image/:cat/:file', (req, res) => {
  const filePath = path.join(IMAGES_PATH, req.params.cat, req.params.file);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).json({ error: 'Imagem não encontrada' });
});

app.post('/api/upload/:category', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const dir = path.join(IMAGES_PATH, req.params.category);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const bb = busboy({ headers: req.headers });
  bb.on('file', (name, file, info) => {
    const filepath = path.join(dir, info.filename);
    file.pipe(fs.createWriteStream(filepath));
  });
  bb.on('finish', () => {
    res.json({ success: true });
  });
  req.pipe(bb);
});

app.delete('/api/image/:cat/:file', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const filepath = path.join(IMAGES_PATH, req.params.cat, req.params.file);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    res.json({ success: true });
  }
});

// ═══════════════════════════════════════════
// FOTOS DOS CLIENTES — Configuração
// ═══════════════════════════════════════════
const FOTOS_CLIENTES_PATH = process.env.FOTOS_CLIENTES_PATH || path.join(__dirname, 'rede', 'fotos_clientes');

// Garantir que a pasta existe
if (!fs.existsSync(FOTOS_CLIENTES_PATH)) {
  fs.mkdirSync(FOTOS_CLIENTES_PATH, { recursive: true });
}

// Listar pastas de fotos
app.get('/api/fotos/pastas', authenticate, (req, res) => {
  try {
    if (!fs.existsSync(FOTOS_CLIENTES_PATH)) {
      return res.json([]);
    }
    const pastas = fs.readdirSync(FOTOS_CLIENTES_PATH)
      .filter(f => fs.statSync(path.join(FOTOS_CLIENTES_PATH, f)).isDirectory())
      .map(nome => ({
        nome,
        dataCriacao: fs.statSync(path.join(FOTOS_CLIENTES_PATH, nome)).birthtime
      }));
    res.json(pastas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar pasta
app.post('/api/fotos/pastas', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
  }
  const nomeLimpo = nome.trim().replace(/[^a-zA-Z0-9áéíóúãõçÁÉÍÓÚÃÕÇ _-]/g, '');
  const pastaPath = path.join(FOTOS_CLIENTES_PATH, nomeLimpo);
  if (fs.existsSync(pastaPath)) {
    return res.status(400).json({ error: 'Pasta já existe' });
  }
  fs.mkdirSync(pastaPath, { recursive: true });
  res.json({ success: true, nome: nomeLimpo });
});

// Excluir pasta
app.delete('/api/fotos/pastas/:nome', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const nomePasta = decodeURIComponent(req.params.nome);
  const pastaPath = path.join(FOTOS_CLIENTES_PATH, nomePasta);
  if (!fs.existsSync(pastaPath)) {
    return res.status(404).json({ error: 'Pasta não encontrada' });
  }
  fs.rmSync(pastaPath, { recursive: true, force: true });
  res.json({ success: true });
});

// Listar fotos (todas ou de uma pasta específica)
app.get('/api/fotos/listar', authenticate, (req, res) => {
  try {
    const fotos = [];
    const extensoes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

    // Listar fotos na raiz
    if (fs.existsSync(FOTOS_CLIENTES_PATH)) {
      fs.readdirSync(FOTOS_CLIENTES_PATH)
        .filter(f => {
          const ext = path.extname(f).toLowerCase();
          return extensoes.includes(ext) &&
            fs.statSync(path.join(FOTOS_CLIENTES_PATH, f)).isFile();
        })
        .forEach(nome => {
          fotos.push({ nome, pasta: 'sem_pasta' });
        });
    }

    // Listar fotos nas pastas
    if (fs.existsSync(FOTOS_CLIENTES_PATH)) {
      fs.readdirSync(FOTOS_CLIENTES_PATH)
        .filter(f => fs.statSync(path.join(FOTOS_CLIENTES_PATH, f)).isDirectory())
        .forEach(pasta => {
          const pastaPath = path.join(FOTOS_CLIENTES_PATH, pasta);
          fs.readdirSync(pastaPath)
            .filter(f => {
              const ext = path.extname(f).toLowerCase();
              return extensoes.includes(ext) &&
                fs.statSync(path.join(pastaPath, f)).isFile();
            })
            .forEach(nome => {
              fotos.push({ nome, pasta });
            });
        });
    }
    res.json(fotos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload de foto
app.post('/api/fotos/upload', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const bb = busboy({ headers: req.headers });
  let pasta = '';
  const fileBuffers = [];

  bb.on('field', (name, value) => {
    if (name === 'pasta') pasta = value;
  });

  bb.on('file', (name, file, info) => {
    const chunks = [];
    file.on('data', chunk => chunks.push(chunk));
    file.on('end', () => {
      fileBuffers.push({ filename: info.filename, data: Buffer.concat(chunks) });
    });
  });

  bb.on('finish', () => {
    let pastaPath = FOTOS_CLIENTES_PATH;
    if (pasta && pasta !== 'sem_pasta') {
      pastaPath = path.join(FOTOS_CLIENTES_PATH, pasta);
      if (!fs.existsSync(pastaPath)) {
        fs.mkdirSync(pastaPath, { recursive: true });
      }
    }
    for (const file of fileBuffers) {
      const filepath = path.join(pastaPath, file.filename);
      fs.writeFileSync(filepath, file.data);
    }
    res.json({ success: true });
  });

  req.pipe(bb);
});

// Visualizar foto
app.get('/api/fotos/visualizar/:pasta/:arquivo', (req, res) => {
  const pasta = decodeURIComponent(req.params.pasta);
  const arquivo = decodeURIComponent(req.params.arquivo);
  let filePath;
  if (pasta === 'sem_pasta') {
    filePath = path.join(FOTOS_CLIENTES_PATH, arquivo);
  } else {
    filePath = path.join(FOTOS_CLIENTES_PATH, pasta, arquivo);
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Foto não encontrada' });
  }
});

// Excluir foto
app.delete('/api/fotos/:pasta/:arquivo', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const pasta = decodeURIComponent(req.params.pasta);
  const arquivo = decodeURIComponent(req.params.arquivo);
  let filePath;
  if (pasta === 'sem_pasta') {
    filePath = path.join(FOTOS_CLIENTES_PATH, arquivo);
  } else {
    filePath = path.join(FOTOS_CLIENTES_PATH, pasta, arquivo);
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  }
});

// Mover foto
app.post('/api/fotos/mover', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const { nomeArquivo, pastaOrigem, pastaDestino } = req.body;

  let origemPath;
  if (pastaOrigem === 'sem_pasta') {
    origemPath = path.join(FOTOS_CLIENTES_PATH, nomeArquivo);
  } else {
    origemPath = path.join(FOTOS_CLIENTES_PATH, pastaOrigem, nomeArquivo);
  }

  let destinoPath;
  if (!pastaDestino || pastaDestino === 'sem_pasta') {
    destinoPath = path.join(FOTOS_CLIENTES_PATH, nomeArquivo);
  } else {
    const pastaDestinoPath = path.join(FOTOS_CLIENTES_PATH, pastaDestino);
    if (!fs.existsSync(pastaDestinoPath)) {
      fs.mkdirSync(pastaDestinoPath, { recursive: true });
    }
    destinoPath = path.join(pastaDestinoPath, nomeArquivo);
  }

  if (fs.existsSync(origemPath)) {
    fs.renameSync(origemPath, destinoPath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Foto não encontrada' });
  }
});

// ═══════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════
app.get('/api/tags/all', authenticate, (req, res) => {
  res.json([...new Set(tags.map(t => t.tag))]);
});

app.post('/api/tags', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  const { image, category, tag } = req.body;
  tags.push({ image, category, tag });
  fs.writeFileSync(TAGS_PATH, JSON.stringify(tags));
  res.json({ success: true });
});

app.delete('/api/tags/:id', authenticate, (req, res) => {
  if (!req.user.pode_editar_imagens) return res.status(403).json({ error: 'Sem permissão' });
  tags.splice(parseInt(req.params.id), 1);
  fs.writeFileSync(TAGS_PATH, JSON.stringify(tags));
  res.json({ success: true });
});

app.get('/api/search', authenticate, (req, res) => {
  const q = req.query.q.toLowerCase();
  const results = tags.filter(t =>
    t.tag.toLowerCase().includes(q) ||
    t.image.toLowerCase().includes(q)
  );
  res.json(results);
});

// ═══════════════════════════════════════════
// CANCELAMENTOS DE ORÇAMENTO
// ═══════════════════════════════════════════
const CANCELAMENTOS_PATH = path.join(__dirname, 'data', 'cancelamentos.json');

function carregarCancelamentos() {
  try {
    if (!fs.existsSync(CANCELAMENTOS_PATH)) {
      fs.writeFileSync(CANCELAMENTOS_PATH, '[]');
      return [];
    }
    return JSON.parse(fs.readFileSync(CANCELAMENTOS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function salvarCancelamentos(lista) {
  fs.writeFileSync(CANCELAMENTOS_PATH, JSON.stringify(lista, null, 2));
}

app.get('/api/cancelamentos', authenticate, (req, res) => {
  res.json(carregarCancelamentos());
});

app.post('/api/cancelamentos', authenticate, (req, res) => {
  if (req.user.cargo !== 'vendedor' && !req.user.pode_gerenciar_permissoes) {
    return res.status(403).json({ error: 'Apenas vendedores e administradores podem criar cancelamentos' });
  }
  const lista = carregarCancelamentos();
  const novo = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    solicitante: req.body.solicitante,
    numeroOrcamento: req.body.numeroOrcamento,
    data: req.body.data || new Date().toISOString(),
    canal: req.body.canal,
    motivo: req.body.motivo,
    motivoSubstituto: req.body.motivoSubstituto,
    observacoes: req.body.observacoes,
    criadoPor: req.user.usuario,
    criadoEm: new Date().toISOString()
  };
  lista.push(novo);
  salvarCancelamentos(lista);
  res.json({ success: true, cancelamento: novo });
});

app.put('/api/cancelamentos/:id', authenticate, (req, res) => {
  const lista = carregarCancelamentos();
  const idx = lista.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Cancelamento não encontrado' });
  lista[idx] = { ...lista[idx], ...req.body, id: lista[idx].id, criadoPor: lista[idx].criadoPor, criadoEm: lista[idx].criadoEm };
  salvarCancelamentos(lista);
  res.json({ success: true, cancelamento: lista[idx] });
});

app.delete('/api/cancelamentos/:id', authenticate, (req, res) => {
  if (!req.user.pode_gerenciar_permissoes) {
    return res.status(403).json({ error: 'Apenas administradores podem excluir cancelamentos' });
  }
  let lista = carregarCancelamentos();
  const idx = lista.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Cancelamento não encontrado' });
  lista.splice(idx, 1);
  salvarCancelamentos(lista);
  res.json({ success: true });
});

// ═══════════════════════════════════════════
// CHAVES PAGAMENTO (PIX)
// ═══════════════════════════════════════════
const CHAVES_PATH = path.join(__dirname, 'data', 'pagamento_chaves.json');

function carregarChaves() {
  try {
    if (!fs.existsSync(CHAVES_PATH)) {
      fs.writeFileSync(CHAVES_PATH, JSON.stringify({ funcionarios: [] }, null, 2));
      return [];
    }
    const data = JSON.parse(fs.readFileSync(CHAVES_PATH, 'utf8'));
    return data.funcionarios || [];
  } catch {
    return [];
  }
}

function salvarChaves(lista) {
  fs.writeFileSync(CHAVES_PATH, JSON.stringify({ funcionarios: lista }, null, 2));
}

const FORNECEDORES_PATH = path.join(__dirname, 'data', 'fornecedores_pagamento.json');

function carregarFornecedoresPagamento() {
  try {
    if (!fs.existsSync(FORNECEDORES_PATH)) {
      fs.writeFileSync(FORNECEDORES_PATH, JSON.stringify({ fornecedores: [] }, null, 2));
      return [];
    }
    const data = JSON.parse(fs.readFileSync(FORNECEDORES_PATH, 'utf8'));
    return Array.isArray(data.fornecedores) ? data.fornecedores : [];
  } catch {
    return [];
  }
}

function salvarFornecedoresPagamento(lista) {
  fs.writeFileSync(FORNECEDORES_PATH, JSON.stringify({ fornecedores: lista }, null, 2));
}

function normalizarFormaPagamento(valor) {
  const forma = String(valor || '').trim().toLocaleLowerCase('pt-BR');
  return forma === 'boleto' ? 'Boleto' : 'PIX';
}

// Sanitizacao basica
function sanitizar(str) {
  if (!str) return '';
  return str.trim().replace(/[<>]/g, '');
}

// Validacao de formato de chave conforme tipo
function validarFormatoChave(tipo, chave) {
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
      if (val.length < 1) return 'Chave aleatoria nao pode ser vazia.';
      break;
    default:
      return 'Tipo de chave invalido.';
  }
  return null;
}

const TIPOS_CHAVE_VALIDOS = ['CPF', 'CNPJ', 'Telefone', 'Email', 'Aleatoria'];

app.get('/api/chaves-pagamento', authenticate, requireAdmin, (req, res) => {
  const lista = carregarChaves();
  res.json({ funcionarios: lista });
});

app.post('/api/chaves-pagamento', authenticate, requireAdmin, (req, res) => {
  let { funcionario, apelido, tipo_pix, chave_pix } = req.body;

  funcionario = sanitizar(funcionario);
  apelido = sanitizar(apelido);
  tipo_pix = (tipo_pix || '').trim();
  chave_pix = (chave_pix || '').trim();

  if (!funcionario) return res.status(400).json({ error: 'Nome do funcionario e obrigatorio.' });
  if (!tipo_pix || !TIPOS_CHAVE_VALIDOS.includes(tipo_pix)) return res.status(400).json({ error: 'Tipo de chave invalido.' });

  const erroFormato = validarFormatoChave(tipo_pix, chave_pix);
  if (erroFormato) return res.status(400).json({ error: erroFormato });

  const lista = carregarChaves();

  // Verificar nome duplicado
  if (lista.some(f => f.funcionario.toLowerCase() === funcionario.toLowerCase())) {
    return res.status(400).json({ error: 'Ja existe um funcionario com este nome.' });
  }

  // Verificar chave duplicada
  if (lista.some(f => f.chave_pix === chave_pix)) {
    return res.status(400).json({ error: 'Esta chave PIX ja esta cadastrada.' });
  }

  const agora = new Date().toISOString();
  const novo = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    funcionario,
    apelido: apelido || '',
    tipo_pix,
    chave_pix,
    created_at: agora,
    updated_at: agora
  };

  lista.push(novo);
  salvarChaves(lista);
  res.json({ success: true, funcionario: novo });
});

app.put('/api/chaves-pagamento/:id', authenticate, requireAdmin, (req, res) => {
  let { funcionario, apelido, tipo_pix, chave_pix } = req.body;

  funcionario = sanitizar(funcionario);
  apelido = sanitizar(apelido);
  tipo_pix = (tipo_pix || '').trim();
  chave_pix = (chave_pix || '').trim();

  if (!funcionario) return res.status(400).json({ error: 'Nome do funcionario e obrigatorio.' });
  if (!tipo_pix || !TIPOS_CHAVE_VALIDOS.includes(tipo_pix)) return res.status(400).json({ error: 'Tipo de chave invalido.' });

  const erroFormato = validarFormatoChave(tipo_pix, chave_pix);
  if (erroFormato) return res.status(400).json({ error: erroFormato });

  const lista = carregarChaves();
  const idx = lista.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Funcionario nao encontrado.' });

  // Verificar nome duplicado (excluindo o registro atual)
  if (lista.some((f, i) => i !== idx && f.funcionario.toLowerCase() === funcionario.toLowerCase())) {
    return res.status(400).json({ error: 'Ja existe um funcionario com este nome.' });
  }

  // Verificar chave duplicada (excluindo o registro atual)
  if (lista.some((f, i) => i !== idx && f.chave_pix === chave_pix)) {
    return res.status(400).json({ error: 'Esta chave PIX ja esta cadastrada.' });
  }

  lista[idx] = {
    ...lista[idx],
    funcionario,
    apelido: apelido || '',
    tipo_pix,
    chave_pix,
    updated_at: new Date().toISOString()
  };

  salvarChaves(lista);
  res.json({ success: true, funcionario: lista[idx] });
});

app.delete('/api/chaves-pagamento/:id', authenticate, requireAdmin, (req, res) => {
  const lista = carregarChaves();
  const idx = lista.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Funcionario nao encontrado.' });
  lista.splice(idx, 1);
  salvarChaves(lista);
  res.json({ success: true });
});

// Cadastro compartilhado: o Admin consulta as chaves e a Logistica usa os
// mesmos fornecedores na calculadora de cotacoes.
app.get('/api/fornecedores-pagamento', authenticate, requireCotacoes, (req, res) => {
  const fornecedores = carregarFornecedoresPagamento();
  if (!req.user.pode_gerenciar_permissoes) {
    return res.json({
      fornecedores: fornecedores.map(({ id, nome, apelido, forma_pagamento }) => ({
        id,
        nome,
        apelido,
        forma_pagamento: forma_pagamento || 'PIX'
      }))
    });
  }
  res.json({ fornecedores });
});

app.post('/api/fornecedores-pagamento', authenticate, requireCotacoes, (req, res) => {
  let { nome, apelido, forma_pagamento, tipo_pix, chave_pix } = req.body;
  nome = sanitizar(nome);
  apelido = sanitizar(apelido);
  forma_pagamento = normalizarFormaPagamento(forma_pagamento);
  tipo_pix = (tipo_pix || '').trim();
  chave_pix = (chave_pix || '').trim();

  if (!nome) return res.status(400).json({ error: 'Nome do fornecedor e obrigatorio.' });
  if (forma_pagamento === 'PIX') {
    if (!TIPOS_CHAVE_VALIDOS.includes(tipo_pix)) return res.status(400).json({ error: 'Tipo de chave invalido.' });
    const erroFormato = validarFormatoChave(tipo_pix, chave_pix);
    if (erroFormato) return res.status(400).json({ error: erroFormato });
  } else {
    tipo_pix = '';
    chave_pix = '';
  }

  const lista = carregarFornecedoresPagamento();
  if (lista.some(f => f.nome.toLowerCase() === nome.toLowerCase())) {
    return res.status(400).json({ error: 'Ja existe um fornecedor com este nome.' });
  }
  if (chave_pix && lista.some(f => f.chave_pix === chave_pix)) {
    return res.status(400).json({ error: 'Esta chave PIX ja esta cadastrada.' });
  }

  const agora = new Date().toISOString();
  const fornecedor = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nome,
    apelido: apelido || '',
    forma_pagamento,
    tipo_pix,
    chave_pix,
    created_at: agora,
    updated_at: agora
  };
  lista.push(fornecedor);
  salvarFornecedoresPagamento(lista);
  res.json({ success: true, fornecedor });
});

app.put('/api/fornecedores-pagamento/:id', authenticate, requireAdmin, (req, res) => {
  let { nome, apelido, forma_pagamento, tipo_pix, chave_pix } = req.body;
  nome = sanitizar(nome);
  apelido = sanitizar(apelido);
  forma_pagamento = normalizarFormaPagamento(forma_pagamento);
  tipo_pix = (tipo_pix || '').trim();
  chave_pix = (chave_pix || '').trim();

  if (!nome) return res.status(400).json({ error: 'Nome do fornecedor e obrigatorio.' });
  if (forma_pagamento === 'PIX') {
    if (!TIPOS_CHAVE_VALIDOS.includes(tipo_pix)) return res.status(400).json({ error: 'Tipo de chave invalido.' });
    const erroFormato = validarFormatoChave(tipo_pix, chave_pix);
    if (erroFormato) return res.status(400).json({ error: erroFormato });
  } else {
    tipo_pix = '';
    chave_pix = '';
  }

  const lista = carregarFornecedoresPagamento();
  const idx = lista.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Fornecedor nao encontrado.' });
  if (lista.some((f, i) => i !== idx && f.nome.toLowerCase() === nome.toLowerCase())) {
    return res.status(400).json({ error: 'Ja existe um fornecedor com este nome.' });
  }
  if (chave_pix && lista.some((f, i) => i !== idx && f.chave_pix === chave_pix)) {
    return res.status(400).json({ error: 'Esta chave PIX ja esta cadastrada.' });
  }
  lista[idx] = { ...lista[idx], nome, apelido: apelido || '', forma_pagamento, tipo_pix, chave_pix, updated_at: new Date().toISOString() };
  salvarFornecedoresPagamento(lista);
  res.json({ success: true, fornecedor: lista[idx] });
});

app.delete('/api/fornecedores-pagamento/:id', authenticate, requireAdmin, (req, res) => {
  const lista = carregarFornecedoresPagamento();
  const idx = lista.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Fornecedor nao encontrado.' });
  lista.splice(idx, 1);
  salvarFornecedoresPagamento(lista);
  res.json({ success: true });
});

// ═══════════════════════════════════════════
// CRM — CLIENTES
// ═══════════════════════════════════════════
const CRM_PATH = path.join(__dirname, 'data', 'crm.json');

function carregarCRM() {
  try {
    if (!fs.existsSync(CRM_PATH)) {
      fs.writeFileSync(CRM_PATH, '[]');
      return [];
    }
    return JSON.parse(fs.readFileSync(CRM_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function salvarCRM(lista) {
  fs.writeFileSync(CRM_PATH, JSON.stringify(lista, null, 2));
}

app.get('/api/crm', authenticate, (req, res) => {
  res.json(carregarCRM());
});

app.post('/api/crm', authenticate, (req, res) => {
  const lista = carregarCRM();
  const novo = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    nome: req.body.nome,
    empresa: req.body.empresa || '',
    telefone: req.body.telefone || '',
    email: req.body.email || '',
    vendedor: req.body.vendedor || '',
    observacoes: req.body.observacoes || '',
    dataCriacao: new Date().toISOString(),
    dataAtualizacao: new Date().toISOString()
  };
  lista.push(novo);
  salvarCRM(lista);
  res.json({ success: true, cliente: novo });
});

app.put('/api/crm/:id', authenticate, (req, res) => {
  const lista = carregarCRM();
  const idx = lista.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Cliente nao encontrado' });
  lista[idx] = {
    ...lista[idx],
    ...req.body,
    id: lista[idx].id,
    dataCriacao: lista[idx].dataCriacao,
    dataAtualizacao: new Date().toISOString()
  };
  salvarCRM(lista);
  res.json({ success: true, cliente: lista[idx] });
});

app.delete('/api/crm/:id', authenticate, (req, res) => {
  let lista = carregarCRM();
  const idx = lista.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Cliente nao encontrado' });
  lista.splice(idx, 1);
  salvarCRM(lista);
  res.json({ success: true });
});

// ═══════════════════════════════════════════
// CONFIGURACOES POR USUARIO
// ═══════════════════════════════════════════
const CONFIG_PATH = path.join(__dirname, 'data', 'configuracoes.json');

function carregarConfiguracoes() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, '{}');
      return {};
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function salvarConfiguracoes(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// GET /api/configuracoes — retorna as configuracoes do usuario logado
app.get('/api/configuracoes', authenticate, (req, res) => {
  const todas = carregarConfiguracoes();
  res.json(todas[req.user.usuario] || {});
});

// PUT /api/configuracoes — salva as configuracoes do usuario logado
app.put('/api/configuracoes', authenticate, (req, res) => {
  const todas = carregarConfiguracoes();
  todas[req.user.usuario] = req.body;
  salvarConfiguracoes(todas);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
