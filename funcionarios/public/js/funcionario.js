/* ========================================
   CALCULADORAS RAZOR INDUSTRIAL — app.js (consolidado)
   ======================================== */

'use strict';

/* ========================================
   AUTENTICAÃ‡ÃƒO E PERMISSÃ•ES
   ======================================== */
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !user || !user.pode_ver_funcionario) {
  window.location.href = 'login.html';
}

/* ========================================
   SENHA ADMINISTRATIVA
   ======================================== */
const SENHA_ADMIN = "M@lima1980";

/* ========================================
   UTILITÁRIOS
   ======================================== */

/* ========================================
   CONTROLE DE ACESSO POR CARGO - SIDEBAR
   ======================================== */

function podeAcessarModuloCotacoes(usuario) {
  return Boolean(window.CotacoesModelo && window.CotacoesModelo.podeAcessar(usuario));
}

function podeAcessarModuloComprovanteEntrega(usuario) {
  // O comprovante integra a mesma área e reutiliza a permissão já existente
  // da Logística, sem criar campos novos no cadastro de usuários.
  return podeAcessarModuloCotacoes(usuario);
}

window.podeAcessarModuloCotacoes = podeAcessarModuloCotacoes;
window.usuarioAtualPodeAcessarCotacoes = function () {
  return podeAcessarModuloCotacoes(user);
};
window.podeAcessarModuloComprovanteEntrega = podeAcessarModuloComprovanteEntrega;
window.usuarioAtualPodeEmitirComprovanteEntrega = function () {
  return podeAcessarModuloComprovanteEntrega(user);
};

function aplicarPermissoesSidebar() {
  var cargo = user ? user.cargo : '';
  var grupos = document.querySelectorAll('.sidebar-grupo');

  // Menu e tela usam a mesma regra central de acesso da calculadora local.
  var menuCotacoes = document.getElementById('menu-cotacoes');
  var menuComprovante = document.getElementById('menu-comprovante-entrega');
  var podeAcessarCotacoes = podeAcessarModuloCotacoes(user);
  if (menuCotacoes) {
    menuCotacoes.hidden = !podeAcessarCotacoes;
    menuCotacoes.style.display = podeAcessarCotacoes ? '' : 'none';
  }
  if (menuComprovante) {
    menuComprovante.hidden = !podeAcessarModuloComprovanteEntrega(user);
    menuComprovante.style.display = podeAcessarModuloComprovanteEntrega(user) ? '' : 'none';
  }

  for (var i = 0; i < grupos.length; i++) {
    var grupo = grupos[i];
    var group = grupo.getAttribute('data-group');
    if (!group) continue;

    if (group === 'admin' && cargo !== 'admin' && !user.pode_gerenciar_permissoes) {
      grupo.style.display = 'none';
      continue;
    }

    if (cargo === 'vendedor') {
      grupo.style.display = (
        group === 'comercial' ||
        group === 'calculadoras' ||
        (group === 'logistica' && podeAcessarCotacoes)
      ) ? '' : 'none';
    } else if (cargo === 'logistica') {
      grupo.style.display = (group === 'logistica' || group === 'calculadoras') ? '' : 'none';
    } else {
      grupo.style.display = '';
    }
  }

  // Mostrar link Chaves na navbar para admin ou quem gerencia permissoes
  var linkChaves = document.getElementById('link-chaves');
  if (linkChaves && (cargo === 'admin' || user.pode_gerenciar_permissoes)) linkChaves.style.display = '';

  var telaAtual = localStorage.getItem('calc-tela-atual');
  var telasVendedor = ['crm','cancelamentos','fotos','dashboard','producao','conversor','mureta','malha'];
  var telasLogistica = ['fotos','cotacoes','comprovante-entrega','producao','conversor','mureta','malha'];

  if (cargo === 'vendedor' && telasVendedor.indexOf(telaAtual) === -1 &&
      !(telaAtual === 'cotacoes' && podeAcessarCotacoes) &&
      !(telaAtual === 'comprovante-entrega' && podeAcessarModuloComprovanteEntrega(user))) {
    trocarTela('crm');
  }
  if (cargo === 'logistica' && telasLogistica.indexOf(telaAtual) === -1) {
    trocarTela('fotos');
  }
}

// Fuso horario Brasil (UTC-3)
function agora() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

function parseNum(str) {
  if (str === undefined || str === null || str === '') return NaN;
  return parseFloat(String(str).replace(',', '.'));
}

function fmt(n, dec = 2) {
  if (isNaN(n) || n === null) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtHoras(n) {
  if (isNaN(n) || n === null) return '—';
  const h = Math.floor(n);
  const m = Math.floor((n - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function fmtInt(n) {
  if (isNaN(n) || n === null) return '—';
  return Math.ceil(n).toLocaleString('pt-BR');
}

function setErro(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (msg) {
    el.textContent = '⚠ ' + msg;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
    el.textContent = '';
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ========================================
   NAVEGAÃ‡ÃƒO ENTRE TELAS
   ======================================== */

function trocarTela(tela) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('ativo'));
  document.querySelectorAll('.btn-menu').forEach(b => b.classList.remove('ativo'));
  const textoRodape = document.querySelector('.rodape span');
  if (textoRodape) {
    if (!textoRodape.dataset.textoPadrao) textoRodape.dataset.textoPadrao = textoRodape.textContent;
    textoRodape.textContent = tela === 'comprovante-entrega'
      ? 'Calculadoras Industriais - Razor Industrial | Os dados deste comprovante não são salvos.'
      : textoRodape.dataset.textoPadrao;
  }

  if (tela === 'cotacoes' && !podeAcessarModuloCotacoes(user)) {
    const telaCotacoes = document.getElementById('tela-cotacoes');
    const appCotacoes = document.getElementById('cotacoes-app');
    const acessoNegado = document.getElementById('cotacoes-acesso-negado');

    telaCotacoes?.classList.add('ativa');
    if (appCotacoes) appCotacoes.hidden = true;
    if (acessoNegado) {
      acessoNegado.hidden = false;
      acessoNegado.innerHTML = `
        <div class="cotacoes-access-card" role="alert">
          <div class="cotacoes-access-icon" aria-hidden="true">!</div>
          <p class="cotacoes-eyebrow">Permissão necessária</p>
          <h2>ACESSO NEGADO</h2>
          <p>Você não possui permissão para acessar o módulo de Cotação de Preços.</p>
        </div>`;
    }
    return false;
  }

  if (tela === 'comprovante-entrega' && !podeAcessarModuloComprovanteEntrega(user)) {
    const telaComprovante = document.getElementById('tela-comprovante-entrega');
    const appComprovante = document.getElementById('ce-app');
    const acessoNegado = document.getElementById('ce-acesso-negado');

    telaComprovante?.classList.add('ativa');
    if (appComprovante) appComprovante.hidden = true;
    if (acessoNegado) {
      acessoNegado.hidden = false;
      acessoNegado.innerHTML = `
        <div class="ce-access-card" role="alert">
          <div class="ce-access-icon" aria-hidden="true">!</div>
          <p class="ce-eyebrow">Permissão necessária</p>
          <h2>ACESSO NEGADO</h2>
          <p>Você não possui permissão para emitir comprovantes no módulo de Logística.</p>
        </div>`;
    }
    return false;
  }

  const mapa = {
    producao:  'tela-producao',
    conversor: 'tela-conversor',
    mureta:    'tela-mureta',
    malha:     'tela-malha',
    fotos:     'tela-fotos',
    crm:       'tela-crm',
    cancelamentos: 'tela-cancelamentos',
    cotacoes:   'tela-cotacoes',
    'comprovante-entrega': 'tela-comprovante-entrega',
    dashboard: 'tela-dashboard'
  };

  const id = mapa[tela];
  if (id) {
    document.getElementById(id)?.classList.add('ativa');
    document.getElementById('menu-' + tela)?.classList.add('ativo');
    if (tela === 'cotacoes') {
      const appCotacoes = document.getElementById('cotacoes-app');
      const acessoNegado = document.getElementById('cotacoes-acesso-negado');
      if (appCotacoes) appCotacoes.hidden = false;
      if (acessoNegado) acessoNegado.hidden = true;
      if (window.CotacoesApp && typeof window.CotacoesApp.abrir === 'function') {
        window.CotacoesApp.abrir();
      }
    }
    if (tela === 'comprovante-entrega') {
      const appComprovante = document.getElementById('ce-app');
      const acessoNegado = document.getElementById('ce-acesso-negado');
      if (appComprovante) appComprovante.hidden = false;
      if (acessoNegado) acessoNegado.hidden = true;
      if (window.ComprovanteEntregaApp && typeof window.ComprovanteEntregaApp.abrir === 'function') {
        window.ComprovanteEntregaApp.abrir();
      }
    }
  }

  localStorage.setItem('calc-tela-atual', tela);
  salvarEstado();
  return Boolean(id);
}

/* ========================================
   TELA 1 — PRAZO DE PRODUÃ‡ÃƒO
   ======================================== */

let producaoM2h = {};
let csvFileHandle = null;

function calcularProducao() {
  const malha       = parseNum(document.getElementById('prod-malha').value);
  const comprimento = parseNum(document.getElementById('prod-comprimento').value);
  const altura      = parseNum(document.getElementById('prod-altura').value);
  const quantidade  = parseNum(document.getElementById('prod-quantidade').value);
  const diasFila    = parseNum(document.getElementById('prod-dias-fila').value);

  if (isNaN(comprimento) || comprimento <= 0) {
    setErro('erro-producao', 'Informe o comprimento em metros.');
    limparResultadosProducao(); return;
  }
  if (isNaN(altura) || altura <= 0) {
    setErro('erro-producao', 'Informe a altura em metros.');
    limparResultadosProducao(); return;
  }
  if (isNaN(quantidade) || quantidade <= 0) {
    setErro('erro-producao', 'Informe a quantidade.');
    limparResultadosProducao(); return;
  }
  setErro('erro-producao', '');

  const areaTotalM2      = comprimento * altura * quantidade;
  const metroLinear      = comprimento * quantidade;
  const prodPorHora      = producaoM2h[malha] ?? null;

  if (!prodPorHora) {
    setErro('erro-producao', 'Malha sem produtividade cadastrada. Desbloqueie as configuracoes para ajustar.');
    limparResultadosProducao(); return;
  }

  const horasFabricacao  = areaTotalM2 / prodPorHora;
  const diasFabricacao   = Math.ceil(horasFabricacao / 8);
  const previsaoEntrega  = Math.ceil(diasFabricacao * 1.12) + (isNaN(diasFila) ? 0 : Math.ceil(diasFila));

  setVal('res-metro-linear', fmt(metroLinear, 2));
  setVal('res-m2-total',     fmt(areaTotalM2, 2));
  setVal('res-horas-fab',    fmtHoras(horasFabricacao));
  setVal('res-dias-fab',     fmtInt(diasFabricacao));
  setVal('res-previsao',     fmtInt(previsaoEntrega));

  salvarEstado();
}

function limparResultadosProducao() {
  ['res-metro-linear','res-m2-total','res-horas-fab','res-dias-fab','res-previsao']
    .forEach(id => setVal(id, '—'));
}

function limparProducao() {
  ['prod-comprimento','prod-altura','prod-quantidade','prod-dias-fila']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('prod-malha').value = '2.5';
  limparResultadosProducao();
  setErro('erro-producao', '');
  salvarEstado();
}

/* ========================================
   TABELA DE PRODUTIVIDADE — ÁREA PROTEGIDA
   ======================================== */

let areaDesbloqueada = false;

function desbloquearConfiguracoes() {
  const senha = prompt('Digite a senha para desbloquear as configuracoes:');
  if (senha === null) return;
  if (senha === SENHA_ADMIN) {
    areaDesbloqueada = true;
    mostrarAreaAdmin();
  } else {
    alert('Senha incorreta. Acesso negado.');
  }
}

function mostrarAreaAdmin() {
  const area       = document.getElementById('area-admin');
  const btnDesbloq = document.getElementById('btn-desbloquear');
  const btnBloquear = document.getElementById('btn-bloquear');

  if (areaDesbloqueada) {
    area.classList.remove('hidden');
    btnDesbloq.classList.add('hidden');
    btnBloquear.classList.remove('hidden');
    renderizarTabelaProducao();
  } else {
    area.classList.add('hidden');
    btnDesbloq.classList.remove('hidden');
    btnBloquear.classList.add('hidden');
  }
}

function bloquearConfiguracoes() {
  areaDesbloqueada = false;
  mostrarAreaAdmin();
}

function renderizarTabelaProducao() {
  const tbody = document.getElementById('corpo-tabela-producao');
  if (!tbody) return;
  tbody.innerHTML = '';

  Object.entries(producaoM2h).forEach(([malha, prod]) => {
    const tr = document.createElement('tr');
    const malhaDisplay = String(malha).replace('.', ',');
    tr.innerHTML = `
      <td>
        <input type="text" value="${malhaDisplay}" placeholder="Ex: 2,5"
               style="width:80px"
               onchange="editarMalhaProducao(this, '${malha}', 'malha')" />
      </td>
      <td>
        <input type="text" value="${String(prod).replace('.', ',')}" placeholder="mÂ²/h"
               oninput="editarMalhaProducao(this, '${malha}', 'producao')" />
      </td>
      <td>
        <button class="btn-remover-fator" onclick="removerMalhaProducao('${malha}')">&#10005;</button>
      </td>`;
    tbody.appendChild(tr);
  });

  sincronizarSelectMalha();
}

function editarMalhaProducao(input, chaveOriginal, campo) {
  if (campo === 'producao') {
    const novaProd = parseNum(input.value);
    if (!isNaN(novaProd) && novaProd > 0) {
      producaoM2h[chaveOriginal] = novaProd;
      sincronizarSelectMalha();
      document.getElementById('btn-salvar-producao').disabled = false;
    }
  }
  if (campo === 'malha') {
    const novaChave = parseNum(input.value);
    if (!isNaN(novaChave) && novaChave > 0 && String(novaChave) !== chaveOriginal) {
      const valorAtual = producaoM2h[chaveOriginal];
      const novoObj = {};
      Object.entries(producaoM2h).forEach(([k, v]) => {
        novoObj[k === chaveOriginal ? novaChave : k] = v;
      });
      producaoM2h = novoObj;
      renderizarTabelaProducao();
      document.getElementById('btn-salvar-producao').disabled = false;
    }
  }
}

function removerMalhaProducao(malha) {
  if (Object.keys(producaoM2h).length <= 1) {
    alert('Ã‰ necessário manter ao menos uma malha cadastrada.');
    return;
  }
  delete producaoM2h[malha];
  renderizarTabelaProducao();
  document.getElementById('btn-salvar-producao').disabled = false;
}

function adicionarMalhaProducao() {
  const chaves = Object.keys(producaoM2h).map(Number).filter(n => !isNaN(n));
  const novaChave = chaves.length > 0 ? Math.max(...chaves) + 1 : 1;
  producaoM2h[novaChave] = 1;
  renderizarTabelaProducao();
  document.getElementById('btn-salvar-producao').disabled = false;
}

function sincronizarSelectMalha() {
  const sel = document.getElementById('prod-malha');
  if (!sel) return;
  const valorAtual = sel.value;
  sel.innerHTML = '';
  Object.keys(producaoM2h).forEach(malha => {
    const opt = document.createElement('option');
    opt.value = malha;
    opt.textContent = String(malha).replace('.', ',');
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === valorAtual)) {
    sel.value = valorAtual;
  }
}

/* ========================================
   CSV — CARREGAR / GRAVAR
   ======================================== */

function parseCSVProducao(texto) {
  const dados = {};
  const linhas = texto.split('\n').filter(l => l.trim());
  linhas.forEach((linha, i) => {
    if (i === 0 && linha.toLowerCase().includes('malha')) return;
    const partes = linha.split(';');
    if (partes.length >= 2) {
      const malha = parseFloat(partes[0].trim().replace(',', '.'));
      const prod = parseFloat(partes[1].trim().replace(',', '.'));
      if (!isNaN(malha) && !isNaN(prod)) {
        dados[malha] = prod;
      }
    }
  });
  return dados;
}

function gerarCSVProducao() {
  let csv = 'Malha;Producao (mÂ²/hora)\n';
  Object.entries(producaoM2h).forEach(([malha, prod]) => {
    csv += `${String(malha).replace('.', ',')};${String(prod).replace('.', ',')}\n`;
  });
  return csv;
}

async function carregarCSV() {
  try {
    const resp = await fetch('dados/producao.csv?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const texto = await resp.text();
    const dados = parseCSVProducao(texto);
    if (Object.keys(dados).length > 0) {
      producaoM2h = dados;
    }
  } catch (e) {
    console.warn('Nao foi possÃ­vel carregar producao.csv:', e.message);
    const fallback = localStorage.getItem('calc-estado');
    if (fallback) {
      const estado = JSON.parse(fallback);
      if (estado.producaoM2h) {
        const obj = {};
        Object.entries(estado.producaoM2h).forEach(([k, v]) => { obj[Number(k)] = v; });
        producaoM2h = obj;
      }
    }
    if (Object.keys(producaoM2h).length === 0) {
      producaoM2h = { 2.5: 8.75, 5: 16.25, 8: 25.00, 10: 28.75 };
    }
  }
}

async function selecionarArquivoCSV() {
  if (!('showOpenFilePicker' in window)) return null;
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'Arquivo CSV',
        accept: { 'text/csv': ['.csv'] }
      }],
      excludeAcceptAllOption: true
    });
    csvFileHandle = handle;
    return handle;
  } catch (e) {
    return null;
  }
}

async function gravarCSVArquivo() {
  if (!csvFileHandle) return false;
  if (!(await csvFileHandle.queryPermission({ mode: 'readwrite' }) === 'granted')) {
    try {
      await csvFileHandle.requestPermission({ mode: 'readwrite' });
    } catch (e) {
      return false;
    }
  }
  const writable = await csvFileHandle.createWritable();
  await writable.write(gerarCSVProducao());
  await writable.close();
  return true;
}

/* ========================================
   TABELA DE PRODUTIVIDADE — SALVAR / EXPORTAR
   ======================================== */

async function salvarTabelaProducao() {
  const btn = document.getElementById('btn-salvar-producao');
  if (btn) btn.disabled = true;

  if (csvFileHandle) {
    const sucesso = await gravarCSVArquivo();
    if (sucesso) {
      mostrarFeedbackProducao('Salvo no arquivo CSV!');
    } else {
      mostrarFeedbackProducao('Salvo no navegador (erro ao gravar arquivo).');
    }
  } else if ('showOpenFilePicker' in window) {
    const handle = await selecionarArquivoCSV();
    if (handle) {
      csvFileHandle = handle;
      await gravarCSVArquivo();
      mostrarFeedbackProducao('Arquivo vinculado! Proximos salvamentos serao automáticos.');
    } else {
      mostrarFeedbackProducao('Salvo no navegador.');
    }
  } else {
    mostrarFeedbackProducao('Salvo no navegador.');
  }

  calcularProducao();
}

function mostrarFeedbackProducao(msg) {
  const el = document.getElementById('feedback-salvar-producao');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

/* ========================================
   TABELA DE PRODUTIVIDADE — EXPORTAR / IMPORTAR
   ======================================== */

function exportarProducaoJSON() {
  const dados = {
    producaoM2h,
    exportadoEm: agora().toISOString(),
    origem: 'Calculadora Razor Industrial - Prazo de Producao'
  };
  const json = JSON.stringify(dados, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tabela-produtividade.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportarProducaoCSV() {
  const blob = new Blob([gerarCSVProducao()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tabela-produtividade.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportarProducaoTXT() {
  let txt = 'TABELA DE PRODUTIVIDADE - RAZOR INDUSTRIAL\n';
  txt += '==========================================\n\n';
  txt += 'Malha\tProducao (mÂ²/hora)\n';
  txt += '-----\t------------------\n';
  Object.entries(producaoM2h).forEach(([malha, prod]) => {
    txt += `${String(malha).replace('.', ',')}\t${String(prod).replace('.', ',')}\n`;
  });
  txt += '\nExportado em: ' + new Date().toLocaleString('pt-BR');
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tabela-produtividade.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function importarProducaoJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.csv,.txt';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const conteudo = ev.target.result;
        let novoDado;

        if (file.name.endsWith('.json')) {
          const dados = JSON.parse(conteudo);
          novoDado = dados.producaoM2h || dados;
        } else if (file.name.endsWith('.csv')) {
          novoDado = {};
          const linhas = conteudo.split('\n').filter(l => l.trim());
          linhas.forEach((linha, i) => {
            if (i === 0 && linha.toLowerCase().includes('malha')) return;
            const partes = linha.split(';');
            if (partes.length >= 2) {
              const malha = parseFloat(partes[0].trim().replace(',', '.'));
              const prod = parseFloat(partes[1].trim().replace(',', '.'));
              if (!isNaN(malha) && !isNaN(prod)) {
                novoDado[malha] = prod;
              }
            }
          });
        } else if (file.name.endsWith('.txt')) {
          novoDado = {};
          const linhas = conteudo.split('\n');
          linhas.forEach(linha => {
            const partes = linha.split('\t');
            if (partes.length >= 2) {
              const malha = parseFloat(partes[0].trim().replace(',', '.'));
              const prod = parseFloat(partes[1].trim().replace(',', '.'));
              if (!isNaN(malha) && !isNaN(prod)) {
                novoDado[malha] = prod;
              }
            }
          });
        }

        if (typeof novoDado !== 'object' || novoDado === null || Object.keys(novoDado).length === 0) {
          alert('Arquivo com formato inválido ou vazio.');
          return;
        }

        producaoM2h = {};
        Object.entries(novoDado).forEach(([k, v]) => {
          producaoM2h[Number(k)] = v;
        });

        renderizarTabelaProducao();
        sincronizarSelectMalha();
        calcularProducao();
        document.getElementById('btn-salvar-producao').disabled = false;
        mostrarFeedbackProducao('Dados importados! Clique em Salvar para confirmar.');
      } catch (err) {
        alert('Erro ao ler o arquivo: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ========================================
   TELA 2 — CONVERSOR DE MEDIDAS
   ======================================== */

function converterMedidas() {
  const unidade = document.getElementById('conv-unidade').value;
  const val = parseNum(document.getElementById('conv-valor').value);

  const ids = ['res-mm', 'res-cm', 'res-m', 'res-km'];
  const fatores = { km: 0.001, m: 1, cm: 100, mm: 1000 };

  if (isNaN(val)) {
    ids.forEach(id => setVal(id, '—'));
    return;
  }

  const metros = val / fatores[unidade];
  ids.forEach(id => {
    const un = id.replace('res-', '');
    const resultado = metros * fatores[un];
    setVal(id, fmtConv(resultado));
  });
}

function fmtConv(n) {
  if (isNaN(n) || n === null) return '—';
  let str = n.toFixed(4);
  str = str.replace(/0+$/, '').replace(/\.$/, '');
  str = str.replace('.', ',');
  return str || '0';
}

/* ========================================
   TELA 3 — MATERIAIS PARA MURETA
   ======================================== */

function calcularMureta() {
  const metros      = parseNum(document.getElementById('mur-metros').value);
  const fiadasBloco = parseNum(document.getElementById('mur-fiada-bloco').value);
  const fiadasCan   = parseNum(document.getElementById('mur-fiada-canaleta').value);

  if (isNaN(metros) || metros <= 0) {
    setErro('erro-mureta', 'Informe os metros lineares.');
    limparResultadosMureta(); return;
  }
  if (isNaN(fiadasBloco) || fiadasBloco < 0) {
    setErro('erro-mureta', 'Informe a fiada do bloco.');
    limparResultadosMureta(); return;
  }
  if (isNaN(fiadasCan) || fiadasCan < 0) {
    setErro('erro-mureta', 'Informe a fiada da canaleta.');
    limparResultadosMureta(); return;
  }
  setErro('erro-mureta', '');

  const blocos       = metros * 2.5 * fiadasBloco;
  const meioBloco    = Math.ceil(blocos * 0.15);
  const canaleta     = metros * 2.5 * fiadasCan;
  const meiaCanaleta = Math.ceil(canaleta * 0.15);
  const cimento      = Math.ceil(metros * 0.13);
  const areia        = metros * 0.03;
  const pedrisco     = metros * 0.015;

  setVal('res-bloco',         fmtInt(blocos));
  setVal('res-meio-bloco',    fmtInt(meioBloco));
  setVal('res-canaleta',      fmtInt(canaleta));
  setVal('res-meia-canaleta', fmtInt(meiaCanaleta));
  setVal('res-cimento',       fmtInt(cimento));
  setVal('res-areia',         fmt(areia, 1));
  setVal('res-pedrisco',      fmt(pedrisco, 2));

  salvarEstado();
}

function limparResultadosMureta() {
  ['res-bloco','res-meio-bloco','res-canaleta','res-meia-canaleta',
   'res-cimento','res-areia','res-pedrisco'].forEach(id => setVal(id, '—'));
}

function limparMureta() {
  ['mur-metros','mur-altura'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('mur-fiada-bloco').value = '1';
  document.getElementById('mur-fiada-canaleta').value = '1';
  limparResultadosMureta();
  setErro('erro-mureta', '');
  salvarEstado();
}

/* ========================================
   TELA 4 — PESO DA MALHA / BOBINA
   ======================================== */

const VERSAO_TABELA = 2;

const TABELA_PESO_PADRAO = {
  malha2_5: { bwg12: 4.00, bwg14: 2.38, bwg16: 1.40 },
  malha5:   { bwg12: 2.85, bwg14: 1.15, bwg16: 0.80 },
  malha8:   { bwg12: 1.35, bwg14: 0.90 },
  malha10:  { bwg12: 1.00, bwg14: 0.65 }
};

let tabelaPeso = JSON.parse(JSON.stringify(TABELA_PESO_PADRAO));

const MALHAS_LABELS = {
  malha2_5: 'Malha 2,5', malha5: 'Malha 5',
  malha8:   'Malha 8',   malha10: 'Malha 10'
};
const BWG_LABELS = {
  bwg10: 'BWG 10', bwg12: 'BWG 12', bwg14: 'BWG 14', bwg16: 'BWG 16'
};

function atualizarBwgOptions() {
  const malha = document.getElementById('malha-tipo').value;
  const sel = document.getElementById('malha-bwg');
  if (!sel) return;
  const valorAtual = sel.value;
  sel.innerHTML = '<option value="">— Selecione —</option>';

  if (malha && tabelaPeso[malha]) {
    Object.keys(tabelaPeso[malha]).forEach(bwg => {
      const opt = document.createElement('option');
      opt.value = bwg;
      opt.textContent = BWG_LABELS[bwg] ?? bwg;
      sel.appendChild(opt);
    });
  }

  if ([...sel.options].some(o => o.value === valorAtual)) {
    sel.value = valorAtual;
  }
}

function calcularMalha() {
  const malha   = document.getElementById('malha-tipo').value;
  const bwg     = document.getElementById('malha-bwg').value;
  const metros  = parseNum(document.getElementById('malha-metros').value);
  const altura  = parseNum(document.getElementById('malha-altura').value);
  const bobinas = parseNum(document.getElementById('malha-bobinas').value);

  atualizarBwgOptions();

  if (!malha || !bwg) {
    setErro('erro-malha', '');
    setVal('res-peso-bobina', '—');
    setVal('res-peso-total', '—');
    return;
  }
  if (isNaN(metros) || metros <= 0) {
    setErro('erro-malha', 'Informe os metros lineares.');
    setVal('res-peso-bobina', '—');
    setVal('res-peso-total', '—');
    return;
  }

  const pesoPorMetro = tabelaPeso[malha]?.[bwg] ?? null;
  if (pesoPorMetro === null) {
    setErro('erro-malha', 'Peso nao definido para esta combinacao. Desbloqueie a tabela de pesos para ajustar.');
    setVal('res-peso-bobina', '—');
    setVal('res-peso-total', '—');
    return;
  }

  setErro('erro-malha', '');

  const alt        = (!isNaN(altura)  && altura  > 0) ? altura  : 1;
  const qtdBobinas = (!isNaN(bobinas) && bobinas > 0) ? bobinas : 1;

  const pesoBobina = pesoPorMetro * metros * alt;
  const pesoTotal  = pesoBobina * qtdBobinas;

  setVal('res-peso-bobina', fmt(pesoBobina, 2));
  setVal('res-peso-total',  fmt(pesoTotal, 2));

  salvarEstado();
}

function limparMalha() {
  ['malha-metros','malha-altura','malha-bobinas'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('malha-tipo').value = '';
  document.getElementById('malha-bwg').value  = '';
  setVal('res-peso-bobina', '—');
  setVal('res-peso-total',  '—');
  setErro('erro-malha', '');
  atualizarBwgOptions();
  salvarEstado();
}

/* ========================================
   TABELA DE PESOS — PROTEÃ‡ÃƒO POR SENHA
   ======================================== */

let areaPesosDesbloqueada = false;

function desbloquearPesos() {
  const senha = prompt('Digite a senha para desbloquear a tabela de pesos:');
  if (senha === null) return;
  if (senha === SENHA_ADMIN) {
    areaPesosDesbloqueada = true;
    mostrarAreaPesos();
  } else {
    alert('Senha incorreta. Acesso negado.');
  }
}

function bloquearPesos() {
  areaPesosDesbloqueada = false;
  mostrarAreaPesos();
}

function mostrarAreaPesos() {
  const area        = document.getElementById('area-admin-pesos');
  const btnDesbloq  = document.getElementById('btn-desbloquear-pesos');
  const btnBloquear = document.getElementById('btn-bloquear-pesos');
  const badge       = document.getElementById('badge-pesos');

  if (areaPesosDesbloqueada) {
    area.classList.remove('hidden');
    btnDesbloq.classList.add('hidden');
    btnBloquear.classList.remove('hidden');
    if (badge) badge.textContent = 'Desbloqueado';
    renderizarTabelaPesos();
  } else {
    area.classList.add('hidden');
    btnDesbloq.classList.remove('hidden');
    btnBloquear.classList.add('hidden');
    if (badge) badge.textContent = 'Bloqueado';
  }
}

function renderizarTabelaPesos() {
  const tbody = document.getElementById('corpo-tabela-pesos');
  if (!tbody) return;
  tbody.innerHTML = '';

  Object.entries(tabelaPeso).forEach(([malha, bwgs]) => {
    Object.entries(bwgs).forEach(([bwg, peso]) => {
      const tr = document.createElement('tr');
      const pesoStr = peso !== null ? String(peso).replace('.', ',') : '';
      tr.innerHTML = `
        <td>${MALHAS_LABELS[malha] ?? malha}</td>
        <td>${BWG_LABELS[bwg] ?? bwg}</td>
        <td>
          <input type="text" value="${pesoStr}" placeholder="Ex: 1,25"
                 oninput="editarPesoTemp(this, '${malha}', '${bwg}')" />
        </td>
        <td>
          <button class="btn-remover-fator" onclick="removerPeso('${malha}', '${bwg}')">&#10005;</button>
        </td>`;
      tbody.appendChild(tr);
    });
  });
}

function editarPesoTemp(input, malha, bwg) {
  const val = parseNum(input.value);
  tabelaPeso[malha][bwg] = isNaN(val) ? null : val;
  document.getElementById('btn-salvar-pesos').disabled = false;
}

function removerPeso(malha, bwg) {
  delete tabelaPeso[malha][bwg];
  if (Object.keys(tabelaPeso[malha]).length === 0) {
    delete tabelaPeso[malha];
  }
  renderizarTabelaPesos();
  document.getElementById('btn-salvar-pesos').disabled = false;
}

function salvarTabelaPesos() {
  salvarEstado();
  calcularMalha();
  const btn = document.getElementById('btn-salvar-pesos');
  if (btn) btn.disabled = true;
  mostrarFeedback('Salvo com sucesso!');
}

function mostrarFeedback(msg) {
  const el = document.getElementById('feedback-salvar');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

function exportarPesosJSON() {
  const dados = {
    tabelaPeso,
    exportadoEm: agora().toISOString(),
    origem: 'Calculadora Razor Industrial'
  };
  const json = JSON.stringify(dados, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tabela-pesos-malha.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importarPesosJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        const novoPeso = dados.tabelaPeso || dados;
        if (typeof novoPeso !== 'object' || novoPeso === null) {
          alert('Arquivo JSON com formato inválido.');
          return;
        }
        tabelaPeso = novoPeso;
        renderizarTabelaPesos();
        atualizarBwgOptions();
        calcularMalha();
        document.getElementById('btn-salvar-pesos').disabled = false;
        mostrarFeedback('Dados importados! Clique em Salvar para confirmar.');
      } catch (err) {
        alert('Erro ao ler o arquivo: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ========================================
   TELA 5 — FOTOS (Servidor)
   ======================================== */

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONFIGURAÃ‡ÃƒO: Pasta onde as fotos serao salvas no servidor
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const FOTOS_PASTA_SERVIDOR = './rede/fotos_clientes';
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function fotosCarregarPastas() {
  try {
    const resp = await fetch('/api/fotos/pastas', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Erro ao carregar pastas');
    return await resp.json();
  } catch (err) {
    console.warn('Erro ao carregar pastas:', err);
    return [];
  }
}

async function fotosCarregarFotos() {
  try {
    const resp = await fetch('/api/fotos/listar', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Erro ao carregar fotos');
    return await resp.json();
  } catch (err) {
    console.warn('Erro ao carregar fotos:', err);
    return [];
  }
}

async function fotosSalvarPasta(pasta) {
  const resp = await fetch('/api/fotos/pastas', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(pasta)
  });
  if (!resp.ok) throw new Error('Erro ao salvar pasta');
}

async function fotosExcluirPasta(nomePasta) {
  const resp = await fetch(`/api/fotos/pastas/${encodeURIComponent(nomePasta)}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!resp.ok) throw new Error('Erro ao excluir pasta');
}

async function fotosExcluirFoto(nomePasta, nomeArquivo) {
  const resp = await fetch(`/api/fotos/${encodeURIComponent(nomePasta)}/${encodeURIComponent(nomeArquivo)}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!resp.ok) throw new Error('Erro ao excluir foto');
}

async function fotosMoverFoto(nomeArquivo, pastaOrigem, pastaDestino) {
  const resp = await fetch('/api/fotos/mover', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ nomeArquivo, pastaOrigem, pastaDestino })
  });
  if (!resp.ok) throw new Error('Erro ao mover foto');
}

async function fotosCriarPasta(nome) {
  const pasta = { nome, dataCriacao: agora().toISOString() };
  await fotosSalvarPasta(pasta);
  return pasta;
}

async function fotosAdicionarArquivos(files, nomePasta) {
  for (const file of files) {
    const formData = new FormData();
    formData.append('pasta', nomePasta || '');
    formData.append('foto', file);

    const resp = await fetch('/api/fotos/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });
    if (!resp.ok) throw new Error('Erro ao enviar foto');
  }
}

async function fotosRenderizar() {
  const pastas = await fotosCarregarPastas();
  const fotos = await fotosCarregarFotos();
  const container = document.getElementById('fotos-conteudo');
  if (!container) return;

  // Organizar fotos por pasta
  const fotosPorPasta = {};
  fotos.forEach(f => {
    const pasta = f.pasta || 'sem_pasta';
    if (!fotosPorPasta[pasta]) fotosPorPasta[pasta] = [];
    fotosPorPasta[pasta].push(f);
  });

  let html = '';
  const podeEditar = user?.pode_editar_imagens;

  // Renderizar pastas
  pastas.forEach(pasta => {
    const fotosPasta = fotosPorPasta[pasta.nome] || [];
    html += `
      <div class="pasta-section" data-pasta="${pasta.nome}">
        <div class="pasta-header">
          <span class="pasta-nome">📁 ${pasta.nome} <span class="pasta-count">(${fotosPasta.length})</span></span>
          <div class="pasta-actions"${podeEditar ? '' : ' style="display:none"'}>
            <button class="pasta-btn btn-excluir" onclick="fotosExcluirPastaUI('${pasta.nome}')">Excluir</button>
          </div>
        </div>
        <div class="fotos-grid">
          ${fotosPasta.map(f => fotosItemHTML(f)).join('')}
        </div>
      </div>`;
  });

  // Fotos sem pasta
  const fotosSemPasta = fotosPorPasta['sem_pasta'] || [];
  if (fotosSemPasta.length > 0) {
    html += `
      <div class="pasta-section">
        <div class="pasta-header">
          <span class="pasta-nome">📷 Sem pasta <span class="pasta-count">(${fotosSemPasta.length})</span></span>
        </div>
        <div class="fotos-grid">
          ${fotosSemPasta.map(f => fotosItemHTML(f)).join('')}
        </div>
      </div>`;
  }

  if (pastas.length === 0 && fotos.length === 0) {
    html = `
      <div class="fotos-vazio">
        <div class="fotos-vazio-icone">📷</div>
        <p>Nenhuma foto cadastrada.</p>
        <p>Clique em "Adicionar Foto" para comecar.</p>
      </div>`;
  }

  container.innerHTML = html;
}

function fotosItemHTML(foto) {
  const url = `/api/fotos/visualizar/${encodeURIComponent(foto.pasta || 'sem_pasta')}/${encodeURIComponent(foto.nome)}`;
  const podeEditar = user?.pode_editar_imagens;
  return `
    <div class="foto-item" data-foto="${foto.nome}">
      <img src="${url}" alt="${foto.nome}" loading="lazy" />
      <span class="foto-nome">${foto.nome}</span>
      ${podeEditar ? `<button class="foto-excluir" onclick="fotosExcluirFotoUI('${foto.pasta || 'sem_pasta'}', '${foto.nome}')" title="Excluir">&#10005;</button>` : ''}
      ${podeEditar ? `<button class="foto-mover" onclick="fotosAbrirModalMover('${foto.nome}', '${foto.pasta || 'sem_pasta'}')" title="Mover">📁</button>` : ''}
    </div>`;
}

async function fotosExcluirFotoUI(pasta, nomeArquivo) {
  if (!confirm('Excluir esta foto?')) return;
  await fotosExcluirFoto(pasta, nomeArquivo);
  fotosRenderizar();
}

async function fotosExcluirPastaUI(nomePasta) {
  if (!confirm('Excluir esta pasta e todas as fotos dentro dela?')) return;
  await fotosExcluirPasta(nomePasta);
  fotosRenderizar();
}

async function fotosMoverFotoUI(nomeArquivo, pastaOrigem, pastaDestino) {
  await fotosMoverFoto(nomeArquivo, pastaOrigem, pastaDestino);
  document.getElementById('modal-mover')?.remove();
  fotosRenderizar();
}

async function fotosAbrirModalMover(nomeArquivo, pastaOrigem) {
  const pastas = await fotosCarregarPastas();
  if (pastas.length === 0) {
    alert('Crie uma pasta primeiro.');
    return;
  }

  let html = `
    <div class="modal-overlay" id="modal-mover" onclick="if(event.target===this)this.remove()">
      <div class="modal">
        <div class="modal-cabecalho">
          <h3>Mover foto para...</h3>
          <button class="modal-fechar" onclick="document.getElementById('modal-mover').remove()">&#10005;</button>
        </div>
        <div class="modal-corpo">
          <ul class="modal-lista">
            <li onclick="fotosMoverFotoUI('${nomeArquivo}', '${pastaOrigem}', 'sem_pasta')">📷 Sem pasta</li>
            ${pastas.map(p => `<li onclick="fotosMoverFotoUI('${nomeArquivo}', '${pastaOrigem}', '${p.nome}');document.getElementById('modal-mover').remove()">📁 ${p.nome}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

function fotosAdicionarFotoUI() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Perguntar em qual pasta salvar
    const pastas = await fotosCarregarPastas();
    let pastaDestino = '';

    if (pastas.length > 0) {
      const opcoes = pastas.map(p => p.nome).join(', ');
      const escolha = prompt(`Em qual pasta deseja salvar?\n\nPastas disponÃ­veis: ${opcoes}\n\n(Digite "raiz" para salvar sem pasta)`);

      if (escolha === null) return;
      pastaDestino = escolha.toLowerCase() === 'raiz' ? '' : escolha;
    }

    await fotosAdicionarArquivos(files, pastaDestino);
    fotosRenderizar();
  };
  input.click();
}

async function fotosCriarPastaUI() {
  const nome = prompt('Nome da nova pasta:');
  if (!nome || !nome.trim()) return;
  await fotosCriarPasta(nome.trim());
  fotosRenderizar();
}

/* ========================================
   TELA 6 — CRM (servidor + migracao legada)
   ======================================== */

const CRM_DB_NAME = 'razor-crm';
const CRM_DB_VERSION = 1;
const CRM_STORE = 'clientes';
const DadosBrasileirosCRM = window.DadosBrasileiros;
let crmFiltroVendedor = '';
let crmBusca = '';
let crmMigracaoLegadoVerificada = false;

function crmEscaparHTML(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function crmDataIsoValida(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toISOString();
}

function crmTelefoneExibicao(valor, vazio) {
  return DadosBrasileirosCRM.formatarTelefone(valor) || (vazio || '—');
}

function crmTelefoneFormulario(valor) {
  const analise = DadosBrasileirosCRM.analisarTelefone(valor);
  return {
    telefone: analise.valido
      ? analise.formatado
      : DadosBrasileirosCRM.mascararTelefoneEntrada(valor),
    ramal: analise.ramal || ''
  };
}

function crmTelefoneNormalizado(telefone, ramal) {
  const base = DadosBrasileirosCRM.textoSeguro(telefone);
  const extensao = DadosBrasileirosCRM.somenteNumeros(ramal, 10);
  if (!base) return '';
  const completo = base + (extensao ? ' ramal ' + extensao : '');
  return DadosBrasileirosCRM.normalizarTelefone(completo);
}

function crmCabecalhosApi(comJson) {
  const headers = { 'Authorization': 'Bearer ' + token };
  if (comJson) headers['Content-Type'] = 'application/json';
  return headers;
}

async function crmRequisicaoApi(caminho, opcoes) {
  const configuracao = opcoes || {};
  const resposta = await fetch(caminho, {
    ...configuracao,
    headers: {
      ...crmCabecalhosApi(Object.prototype.hasOwnProperty.call(configuracao, 'body')),
      ...(configuracao.headers || {})
    }
  });

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (e) {
    dados = null;
  }

  if (!resposta.ok) {
    if (resposta.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
    throw new Error((dados && dados.error) || ('Erro HTTP ' + resposta.status));
  }

  return dados;
}

function abrirDBCRMLegado() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(CRM_DB_NAME, CRM_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CRM_STORE)) {
        const store = db.createObjectStore(CRM_STORE, { keyPath: 'id' });
        store.createIndex('vendedor', 'vendedor', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function crmCarregarClientesLegados() {
  const db = await abrirDBCRMLegado();
  if (!db || !db.objectStoreNames.contains(CRM_STORE)) {
    if (db) db.close();
    return [];
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRM_STORE, 'readonly');
    const store = tx.objectStore(CRM_STORE);
    const req = store.getAll();
    let clientes = [];
    req.onsuccess = () => {
      clientes = Array.isArray(req.result) ? req.result : [];
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => {
      db.close();
      resolve(clientes);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function crmCarregarClientes() {
  const dados = await crmRequisicaoApi('/api/crm');
  return Array.isArray(dados) ? dados : [];
}

async function crmSalvarCliente(cliente, idExistente) {
  const id = DadosBrasileirosCRM.textoSeguro(idExistente);
  const corpo = {
    nome: DadosBrasileirosCRM.textoSeguro(cliente && cliente.nome),
    empresa: DadosBrasileirosCRM.textoSeguro(cliente && cliente.empresa),
    telefone: DadosBrasileirosCRM.textoSeguro(cliente && cliente.telefone),
    email: DadosBrasileirosCRM.textoSeguro(cliente && cliente.email),
    vendedor: DadosBrasileirosCRM.textoSeguro(cliente && cliente.vendedor),
    observacoes: DadosBrasileirosCRM.textoSeguro(cliente && cliente.observacoes)
  };
  if (!id) {
    const legacyId = DadosBrasileirosCRM.textoSeguro(cliente && cliente.legacyId);
    const dataCriacao = crmDataIsoValida(cliente && cliente.dataCriacao);
    const dataAtualizacao = crmDataIsoValida(cliente && cliente.dataAtualizacao);
    if (legacyId) corpo.legacyId = legacyId;
    if (dataCriacao) corpo.dataCriacao = dataCriacao;
    if (dataAtualizacao) corpo.dataAtualizacao = dataAtualizacao;
  }
  return crmRequisicaoApi('/api/crm' + (id ? '/' + encodeURIComponent(id) : ''), {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(corpo)
  });
}

async function crmExcluirCliente(id) {
  return crmRequisicaoApi('/api/crm/' + encodeURIComponent(id), {
    method: 'DELETE'
  });
}

function crmTextoComparavel(valor) {
  return DadosBrasileirosCRM.textoSeguro(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function crmChaveDeduplicacao(cliente) {
  const identidade = DadosBrasileirosCRM.textoSeguro(
    cliente && (cliente.legacyId || cliente.id)
  );
  if (identidade) return 'id|' + crmTextoComparavel(identidade);
  return crmChaveCampos(cliente);
}

function crmChaveCampos(cliente) {
  return [
    'campos',
    crmTextoComparavel(cliente && cliente.nome),
    crmTextoComparavel(cliente && cliente.empresa),
    DadosBrasileirosCRM.normalizarTelefone(cliente && cliente.telefone),
    crmTextoComparavel(cliente && cliente.email)
  ].join('|');
}

function crmPrepararClienteImportacao(cliente, opcoes) {
  if (!cliente || typeof cliente !== 'object' || Array.isArray(cliente)) {
    return { erro: 'registro invalido' };
  }

  const nome = DadosBrasileirosCRM.textoSeguro(cliente.nome);
  if (!nome) return { erro: 'nome ausente' };

  const telefoneOriginal = DadosBrasileirosCRM.textoSeguro(cliente.telefone);
  let telefone = telefoneOriginal
    ? DadosBrasileirosCRM.normalizarTelefone(telefoneOriginal)
    : '';
  let observacoes = DadosBrasileirosCRM.textoSeguro(cliente.observacoes);
  let ajustado = false;
  if (telefoneOriginal && !telefone) {
    if (!(opcoes && opcoes.preservarTelefoneInvalido)) {
      return { erro: 'telefone invalido' };
    }
    const notaLegada = 'Telefone legado não validado: ' + telefoneOriginal;
    observacoes = observacoes ? observacoes + '\n' + notaLegada : notaLegada;
    telefone = '';
    ajustado = true;
  }

  return {
    cliente: {
      nome,
      empresa: DadosBrasileirosCRM.textoSeguro(cliente.empresa),
      telefone,
      email: DadosBrasileirosCRM.textoSeguro(cliente.email),
      vendedor: DadosBrasileirosCRM.textoSeguro(cliente.vendedor),
      observacoes,
      legacyId: DadosBrasileirosCRM.textoSeguro(cliente.legacyId || cliente.id),
      dataCriacao: crmDataIsoValida(cliente.dataCriacao),
      dataAtualizacao: crmDataIsoValida(cliente.dataAtualizacao)
    },
    ajustado
  };
}

function crmPlanejarImportacao(lista, existentes, opcoes) {
  const identidadesExistentes = new Set();
  const camposExistentes = new Set();
  (existentes || []).forEach(cliente => {
    const identidade = DadosBrasileirosCRM.textoSeguro(
      cliente && (cliente.legacyId || cliente.id)
    );
    if (identidade) identidadesExistentes.add(crmTextoComparavel(identidade));
    camposExistentes.add(crmChaveCampos(cliente));
  });
  const identidadesCandidatas = new Set();
  const camposCandidatosSemId = new Set();
  const candidatos = [];
  let duplicados = 0;
  let invalidos = 0;
  let ajustados = 0;

  (lista || []).forEach((registro) => {
    const preparado = crmPrepararClienteImportacao(registro, opcoes);
    if (!preparado.cliente) {
      invalidos++;
      return;
    }
    const identidade = DadosBrasileirosCRM.textoSeguro(preparado.cliente.legacyId);
    const identidadeComparavel = crmTextoComparavel(identidade);
    const chaveCampos = crmChaveCampos(preparado.cliente);
    const duplicado = identidade
      ? (
        identidadesExistentes.has(identidadeComparavel) ||
        identidadesCandidatas.has(identidadeComparavel) ||
        camposExistentes.has(chaveCampos)
      )
      : (
        camposExistentes.has(chaveCampos) ||
        camposCandidatosSemId.has(chaveCampos)
      );
    if (duplicado) {
      duplicados++;
      return;
    }
    if (identidade) identidadesCandidatas.add(identidadeComparavel);
    else camposCandidatosSemId.add(chaveCampos);
    candidatos.push(preparado.cliente);
    if (preparado.ajustado) ajustados++;
  });

  return { candidatos, duplicados, invalidos, ajustados };
}

async function crmExecutarImportacao(lista, opcoes) {
  const existentes = await crmCarregarClientes();
  const plano = crmPlanejarImportacao(lista, existentes, opcoes);
  let importados = 0;
  let falhas = 0;

  for (const cliente of plano.candidatos) {
    try {
      await crmSalvarCliente(cliente);
      importados++;
    } catch (erro) {
      console.error('Erro ao importar cliente no CRM:', erro);
      falhas++;
    }
  }

  return {
    importados,
    duplicados: plano.duplicados,
    invalidos: plano.invalidos,
    ajustados: plano.ajustados,
    falhas
  };
}

function crmResumoImportacao(resultado, origem) {
  const partes = [
    resultado.importados + ' importado(s)',
    resultado.duplicados + ' duplicado(s) ignorado(s)',
    resultado.invalidos + ' invalido(s) ignorado(s)'
  ];
  if (resultado.ajustados) {
    partes.push(resultado.ajustados + ' telefone(s) legado(s) preservado(s) nas observacoes');
  }
  if (resultado.falhas) partes.push(resultado.falhas + ' falha(s) de envio');
  return (origem || 'Importacao') + ': ' + partes.join(', ') + '.';
}

async function crmMigrarLegadoSeConfirmado() {
  if (crmMigracaoLegadoVerificada) return;
  crmMigracaoLegadoVerificada = true;

  let legados;
  try {
    legados = await crmCarregarClientesLegados();
  } catch (erro) {
    console.warn('Nao foi possivel verificar o CRM legado do navegador:', erro);
    return;
  }
  if (!legados.length) return;

  let existentes;
  try {
    existentes = await crmCarregarClientes();
  } catch (erro) {
    console.warn('Nao foi possivel comparar o CRM legado com o servidor:', erro);
    return;
  }

  const opcoesMigracao = { preservarTelefoneInvalido: true };
  const plano = crmPlanejarImportacao(legados, existentes, opcoesMigracao);
  if (!plano.candidatos.length) return;

  const mensagem =
    'Foram encontrados ' + plano.candidatos.length +
    ' cliente(s) no CRM antigo deste navegador que ainda nao estao no servidor.\n\n' +
    'Deseja copia-los agora para o CRM central?\n\n' +
    'Os dados antigos permanecerao intactos neste navegador.';
  if (!window.confirm(mensagem)) return;

  try {
    const resultado = await crmExecutarImportacao(legados, opcoesMigracao);
    window.alert(crmResumoImportacao(resultado, 'Migracao do CRM antigo'));
  } catch (erro) {
    console.error('Erro ao migrar o CRM antigo:', erro);
    window.alert('Nao foi possivel concluir a migracao do CRM antigo: ' + erro.message);
  }
}

async function crmRenderizar() {
  const container = document.getElementById('crm-tabela-conteudo');
  if (!container) return;
  let clientes;
  try {
    clientes = await crmCarregarClientes();
  } catch (erro) {
    console.error('Erro ao carregar o CRM do servidor:', erro);
    container.innerHTML = '<div class="crm-vazio"><p>Nao foi possivel carregar o CRM do servidor.</p></div>';
    return;
  }

  let filtrados = clientes;

  if (crmFiltroVendedor) {
    filtrados = filtrados.filter(c => c.vendedor === crmFiltroVendedor);
  }

  if (crmBusca) {
    const busca = crmBusca.toLowerCase();
    filtrados = filtrados.filter(c =>
      String(c.nome || '').toLowerCase().includes(busca) ||
      String(c.empresa || '').toLowerCase().includes(busca)
    );
  }

  // Carregar vendedores da API para o filtro
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
    // Fallback: usar vendedores dos clientes cadastrados
    vendedoresNomes = [...new Set(clientes.map(c => c.vendedor).filter(Boolean))];
  }
  // Adicionar vendedores de clientes que possam nao estar na API
  clientes.forEach(c => {
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
    container.innerHTML = `
      <div class="crm-vazio">
        <div class="crm-vazio-icone">👥</div>
        <p>${clientes.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado com os filtros atuais.'}</p>
      </div>`;
    return;
  }

  let html = `
    <table class="crm-tabela">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Empresa</th>
          <th>Telefone</th>
          <th>E-mail</th>
          <th>Vendedor</th>
          <th>Acoes</th>
        </tr>
      </thead>
      <tbody>
        ${filtrados.map(c => `
          <tr>
            <td>${crmEscaparHTML(c.nome || '—')}</td>
            <td>${crmEscaparHTML(c.empresa || '—')}</td>
            <td>${crmEscaparHTML(crmTelefoneExibicao(c.telefone, '—'))}</td>
            <td>${crmEscaparHTML(c.email || '—')}</td>
            <td>${crmEscaparHTML(c.vendedor || '—')}</td>
            <td class="col-acoes">
              <button class="crm-btn-editar" data-crm-acao="editar" data-crm-id="${crmEscaparHTML(c.id)}">Editar</button>
              <button class="crm-btn-excluir" data-crm-acao="excluir" data-crm-id="${crmEscaparHTML(c.id)}">Excluir</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

  container.innerHTML = html;
  container.querySelectorAll('[data-crm-acao]').forEach(botao => {
    botao.addEventListener('click', () => {
      const id = botao.dataset.crmId || '';
      if (botao.dataset.crmAcao === 'editar') crmEditarUI(id);
      if (botao.dataset.crmAcao === 'excluir') crmExcluirUI(id);
    });
  });
}

async function crmExcluirUI(id) {
  if (!confirm('Excluir este cliente?')) return;
  try {
    await crmExcluirCliente(id);
    await crmRenderizar();
  } catch (erro) {
    console.error('Erro ao excluir cliente do CRM:', erro);
    alert('Nao foi possivel excluir o cliente: ' + erro.message);
  }
}

function crmNovoUI() {
  crmAbrirModal(null);
}

async function crmEditarUI(id) {
  try {
    const clientes = await crmCarregarClientes();
    const cliente = clientes.find(c => c.id === id);
    if (cliente) crmAbrirModal(cliente);
  } catch (erro) {
    console.error('Erro ao abrir cliente do CRM:', erro);
    alert('Nao foi possivel carregar o cliente: ' + erro.message);
  }
}

function crmAbrirModal(cliente) {
  const eEdicao = !!cliente;
  const titulo = eEdicao ? 'Editar Cliente' : 'Cadastrar Cliente';
  const clienteId = cliente?.id || '';
  const telefoneFormulario = crmTelefoneFormulario(cliente?.telefone);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay modal-crm';
  modal.id = 'modal-crm';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
      <div class="modal-crm-box">
        <div class="modal-cabecalho">
          <h3>${titulo}</h3>
          <button class="modal-fechar" id="btn-fechar-modal-crm">&#10005;</button>
        </div>
        <div class="modal-corpo">
          <div class="campo-grupo">
            <label>Nome *</label>
            <input type="text" id="crm-nome" value="${crmEscaparHTML(cliente?.nome)}" maxlength="200" placeholder="Nome do cliente" />
          </div>
          <div class="campo-grupo">
            <label>Empresa</label>
            <input type="text" id="crm-empresa" value="${crmEscaparHTML(cliente?.empresa)}" maxlength="200" placeholder="Empresa" />
          </div>
          <div class="campo-grupo">
            <label>Telefone</label>
            <input type="tel" id="crm-telefone" value="${crmEscaparHTML(telefoneFormulario.telefone)}" inputmode="tel" autocomplete="tel" maxlength="19" placeholder="(00) 00000-0000" />
          </div>
          <div class="campo-grupo">
            <label>Ramal</label>
            <input type="text" id="crm-ramal" value="${crmEscaparHTML(telefoneFormulario.ramal)}" inputmode="numeric" maxlength="10" placeholder="Opcional" />
          </div>
          <div class="campo-grupo">
            <label>E-mail</label>
            <input type="email" id="crm-email" value="${crmEscaparHTML(cliente?.email)}" maxlength="320" placeholder="email@exemplo.com" />
          </div>
          <div class="campo-grupo">
            <label>Vendedor</label>
                        <select id="crm-vendedor">
              <option value="">Selecione o vendedor</option>
            </select>
          </div>
          <div class="campo-grupo">
            <label>Observacoes</label>
            <textarea id="crm-obs" rows="3" maxlength="5000" placeholder="Notas sobre o cliente...">${crmEscaparHTML(cliente?.observacoes)}</textarea>
          </div>
        </div>
        <div class="modal-rodape">
          <button class="btn-modal-cancelar" id="btn-cancelar-modal-crm">Cancelar</button>
          <button class="btn-modal-confirmar" id="btn-salvar-modal-crm">Salvar</button>
        </div>
      </div>`;

  document.body.appendChild(modal);

  document.getElementById('btn-fechar-modal-crm').onclick = () => modal.remove();
  document.getElementById('btn-cancelar-modal-crm').onclick = () => modal.remove();
  document.getElementById('btn-salvar-modal-crm').onclick = () => crmSalvarUI(clienteId);
  const campoTelefone = document.getElementById('crm-telefone');
  const campoRamal = document.getElementById('crm-ramal');
  campoTelefone.addEventListener('input', () => {
    campoTelefone.value = DadosBrasileirosCRM.mascararTelefoneEntrada(campoTelefone.value);
    campoTelefone.setCustomValidity('');
  });
  campoRamal.addEventListener('input', () => {
    campoRamal.value = DadosBrasileirosCRM.somenteNumeros(campoRamal.value, 10);
  });

  document.getElementById('crm-nome')?.focus();

  // Carregar vendedores do servidor
  carregarVendedoresSelect(cliente?.vendedor);
}

async function carregarVendedoresSelect(vendedorAtual) {
  var select = document.getElementById('crm-vendedor');
  if (!select) return;

  try {
    var resp = await fetch('/api/vendedores', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var vendedores = await resp.json();

    crmPreencherSelectVendedores(
      select,
      vendedores.map(function(v) {
        return { valor: v.login, rotulo: v.nome || v.login };
      }),
      vendedorAtual
    );
  } catch (err) {
    console.warn('Erro ao carregar vendedores da API:', err);
    // Fallback: usar vendedores dos clientes cadastrados no CRM
    try {
      var clientes = await crmCarregarClientes();
      var vendedoresUnicos = [];
      clientes.forEach(function(c) { if (c.vendedor && vendedoresUnicos.indexOf(c.vendedor) === -1) vendedoresUnicos.push(c.vendedor); });
      crmPreencherSelectVendedores(
        select,
        vendedoresUnicos.map(function(v) { return { valor: v, rotulo: v }; }),
        vendedorAtual
      );
    } catch (e2) {
      console.warn('Fallback CRM tambem falhou:', e2);
    }
  }
}
async function crmSalvarUI(idExistente) {
  try {
    const nome = document.getElementById('crm-nome')?.value?.trim();
    if (!nome) {
      alert('O campo Nome e obrigatorio.');
      return;
    }

    const campoTelefone = document.getElementById('crm-telefone');
    const telefone = crmTelefoneNormalizado(
      campoTelefone?.value,
      document.getElementById('crm-ramal')?.value
    );
    if (
      !DadosBrasileirosCRM.valorAusente(campoTelefone?.value) &&
      !telefone
    ) {
      campoTelefone.setCustomValidity('Informe um telefone brasileiro válido ou deixe o campo vazio.');
      campoTelefone.reportValidity();
      campoTelefone.focus();
      return;
    }

    const cliente = {
      nome,
      empresa:    document.getElementById('crm-empresa')?.value?.trim() || '',
      telefone,
      email:      document.getElementById('crm-email')?.value?.trim() || '',
      vendedor:   document.getElementById('crm-vendedor')?.value?.trim() || '',
      observacoes: document.getElementById('crm-obs')?.value?.trim() || ''
    };

    await crmSalvarCliente(cliente, idExistente);
    document.getElementById('modal-crm')?.remove();
    crmRenderizar();
  } catch (err) {
    console.error('Erro ao salvar cliente:', err);
    alert('Erro ao salvar cliente: ' + err.message);
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
  try {
    const clientes = await crmCarregarClientes();
    const dados = {
      clientes,
      exportadoEm: agora().toISOString(),
      origem: 'CRM Razor Industrial'
    };
    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientes-razor.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch (erro) {
    console.error('Erro ao exportar o CRM:', erro);
    alert('Nao foi possivel exportar os clientes: ' + erro.message);
  }
}

function crmPreencherSelectVendedores(select, vendedores, vendedorAtual) {
  select.replaceChildren();
  const opcaoInicial = document.createElement('option');
  opcaoInicial.value = '';
  opcaoInicial.textContent = 'Selecione o vendedor';
  select.appendChild(opcaoInicial);

  const valores = new Set();
  (vendedores || []).forEach(function(vendedor) {
    const valor = DadosBrasileirosCRM.textoSeguro(vendedor && vendedor.valor);
    if (!valor || valores.has(valor)) return;
    valores.add(valor);
    const opcao = document.createElement('option');
    opcao.value = valor;
    opcao.textContent = DadosBrasileirosCRM.textoSeguro(vendedor.rotulo) || valor;
    opcao.selected = valor === vendedorAtual;
    select.appendChild(opcao);
  });

  if (vendedorAtual && !valores.has(vendedorAtual)) {
    const opcaoAtual = document.createElement('option');
    opcaoAtual.value = vendedorAtual;
    opcaoAtual.textContent = vendedorAtual;
    opcaoAtual.selected = true;
    select.appendChild(opcaoAtual);
  }
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
          alert('Arquivo JSON com formato inválido ou vazio.');
          return;
        }
        const resultado = await crmExecutarImportacao(lista, {
          preservarTelefoneInvalido: true
        });
        await crmRenderizar();
        alert(crmResumoImportacao(resultado, 'Importacao do arquivo'));
      } catch (err) {
        alert('Erro ao ler o arquivo: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ========================================
   BIBLIOTECA DE IMAGENS (SERVER-SIDE)
   ======================================== */

let biblioCategorias = [];
let biblioCategoriaAtual = null;

async function carregarImagens() {
  const container = document.getElementById('biblio-conteudo');
  if (!container) return;

  try {
    const resp = await fetch('/api/categories', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!resp.ok) throw new Error('Erro ao carregar categorias');
    biblioCategorias = await resp.json();

    if (biblioCategorias.length === 0) {
      container.innerHTML = `
        <div class="fotos-vazio">
          <div class="fotos-vazio-icone">🖼️</div>
          <p>Nenhuma categoria encontrada no servidor.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="biblio-grid">
        ${biblioCategorias.map(cat => `
          <div class="biblio-categoria" onclick="biblioAbrirCategoria('${cat}')">
            <div class="biblio-categoria-icone">📁</div>
            <div class="biblio-categoria-nome">${cat}</div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = `
      <div class="fotos-vazio">
        <div class="fotos-vazio-icone">⚠️</div>
        <p>Erro ao carregar biblioteca: ${err.message}</p>
      </div>`;
  }
}

async function biblioAbrirCategoria(categoria) {
  biblioCategoriaAtual = categoria;
  const container = document.getElementById('biblio-conteudo');
  if (!container) return;

  try {
    const resp = await fetch(`/api/images/${encodeURIComponent(categoria)}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!resp.ok) throw new Error('Erro ao carregar imagens');
    const imagens = await resp.json();

    container.innerHTML = `
      <button class="biblio-voltar" onclick="carregarImagens()">← Voltar</button>
      <h3 style="margin-bottom:16px;color:var(--texto-principal)">${categoria}</h3>
      <div class="biblio-imagens-grid">
        ${imagens.map(img => `
          <div class="biblio-imagem" onclick="window.open('/api/image/${encodeURIComponent(categoria)}/${encodeURIComponent(img)}', '_blank')">
            <img src="/api/image/${encodeURIComponent(categoria)}/${encodeURIComponent(img)}" alt="${img}" loading="lazy" />
          </div>
        `).join('')}
      </div>
      ${imagens.length === 0 ? '<p style="color:var(--texto-terciario);text-align:center;padding:40px">Nenhuma imagem nesta categoria.</p>' : ''}
    `;
  } catch (err) {
    container.innerHTML = `
      <button class="biblio-voltar" onclick="carregarImagens()">← Voltar</button>
      <p style="color:#ef4444;text-align:center;padding:40px">Erro: ${err.message}</p>`;
  }
}

/* ========================================
   IMPRESSÃƒO / PDF
   ======================================== */

function imprimirOrcamento(tela) {
  trocarTela(tela);
  setTimeout(() => window.print(), 200);
}

/* ========================================
   PERSISTÃŠNCIA — LOCAL STORAGE
   ======================================== */

// Debounce para salvar estado no servidor
let salvarEstadoTimer = null;
function salvarEstado() {
  // Debounce: aguarda 500ms após última mudança antes de enviar ao servidor
  if (salvarEstadoTimer) clearTimeout(salvarEstadoTimer);
  salvarEstadoTimer = setTimeout(() => {
    try {
      const estado = {
        producaoM2h,
        producao: {
          malha:       document.getElementById('prod-malha')?.value,
          comprimento: document.getElementById('prod-comprimento')?.value,
          altura:      document.getElementById('prod-altura')?.value,
          quantidade:  document.getElementById('prod-quantidade')?.value,
          diasFila:    document.getElementById('prod-dias-fila')?.value
        },
        conversor: {
          valor:   document.getElementById('conv-valor')?.value,
          unidade: document.getElementById('conv-unidade')?.value
        },
        mureta: {
          metros:        document.getElementById('mur-metros')?.value,
          fiadaBloco:    document.getElementById('mur-fiada-bloco')?.value,
          fiadaCanaleta: document.getElementById('mur-fiada-canaleta')?.value,
          altura:        document.getElementById('mur-altura')?.value
        },
        malha: {
          tipo:    document.getElementById('malha-tipo')?.value,
          bwg:     document.getElementById('malha-bwg')?.value,
          metros:  document.getElementById('malha-metros')?.value,
          altura:  document.getElementById('malha-altura')?.value,
          bobinas: document.getElementById('malha-bobinas')?.value
        },
        versaoTabela: VERSAO_TABELA,
        tabelaPeso,
        telaAtual: localStorage.getItem('calc-tela-atual') || 'producao'
      };
      fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(estado)
      }).catch(() => {});
    } catch (e) {
      console.warn('Erro ao salvar estado:', e);
    }
  }, 500);
}

async function carregarEstado() {
  try {
    const resp = await fetch('/api/configuracoes', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Erro ao carregar');
    const estado = await resp.json();
    if (!estado || Object.keys(estado).length === 0) return;

    if (estado.producaoM2h && typeof estado.producaoM2h === 'object') {
      const obj = {};
      Object.entries(estado.producaoM2h).forEach(([k, v]) => { obj[Number(k)] = v; });
      producaoM2h = obj;
    }

    const p = estado.producao || {};
    if (p.malha)       document.getElementById('prod-malha').value        = p.malha;
    if (p.comprimento) document.getElementById('prod-comprimento').value  = p.comprimento;
    if (p.altura)      document.getElementById('prod-altura').value       = p.altura;
    if (p.quantidade)  document.getElementById('prod-quantidade').value   = p.quantidade;
    if (p.diasFila)    document.getElementById('prod-dias-fila').value    = p.diasFila;

    const c = estado.conversor || {};
    if (c.valor)   document.getElementById('conv-valor').value   = c.valor;
    if (c.unidade) document.getElementById('conv-unidade').value = c.unidade;

    const m = estado.mureta || {};
    if (m.metros)        document.getElementById('mur-metros').value         = m.metros;
    if (m.fiadaBloco)    document.getElementById('mur-fiada-bloco').value    = m.fiadaBloco;
    if (m.fiadaCanaleta) document.getElementById('mur-fiada-canaleta').value = m.fiadaCanaleta;
    if (m.altura)        document.getElementById('mur-altura').value         = m.altura;

    const b = estado.malha || {};
    if (b.tipo)    document.getElementById('malha-tipo').value    = b.tipo;
    if (b.bwg)     document.getElementById('malha-bwg').value     = b.bwg;
    if (b.metros)  document.getElementById('malha-metros').value  = b.metros;
    if (b.altura)  document.getElementById('malha-altura').value  = b.altura;
    if (b.bobinas) document.getElementById('malha-bobinas').value = b.bobinas;

    const versaoSalva = estado.versaoTabela || 1;
    if (versaoSalva < VERSAO_TABELA) {
      // Tabela de pesos desatualizada — manter padrao
    } else if (estado.tabelaPeso) {
      tabelaPeso = estado.tabelaPeso;
    }

    // Restaurar tela salva
    if (estado.telaAtual) {
      localStorage.setItem('calc-tela-atual', estado.telaAtual);
    }

  } catch (e) {
    console.warn('Erro ao restaurar estado:', e);
  }
}

/* ========================================
   INICIALIZAÃ‡ÃƒO
   ======================================== */

document.addEventListener('DOMContentLoaded', async () => {

  aplicarPermissoesSidebar();

  // Exibir nome do usuário
  const userNameEl = document.getElementById('user-name');
  if (userNameEl && user) userNameEl.textContent = user.nome || user.usuario;

  // Logout
  const btnSair = document.getElementById('btn-sair');
  if (btnSair) {
    btnSair.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    });
  }

  // Permissoes condicionais
  if (user?.pode_gerenciar_permissoes) {
    const linkPerm = document.getElementById('link-permissoes');
    if (linkPerm) linkPerm.style.display = '';
  }

  // Esconder botoes de fotos para usuários sem permissao
  if (!user?.pode_editar_imagens) {
    const toolbar = document.getElementById('fotos-toolbar');
    if (toolbar) toolbar.style.display = 'none';
  }

  // Restaurar aba ativa
  const telaSalva = localStorage.getItem('calc-tela-atual') || 'producao';
  trocarTela(telaSalva);

  // 1. Carregar CSV em background (nao bloqueia a UI)
  carregarCSV().then(() => {
    sincronizarSelectMalha();
    calcularProducao();
  }).catch(() => {});

  // 2. Restaurar estado do servidor
  await carregarEstado();
  sincronizarSelectMalha();
  areaDesbloqueada = false;
  mostrarAreaAdmin();
  calcularProducao();
  converterMedidas();

  // Tela 4
  atualizarBwgOptions();
  areaPesosDesbloqueada = false;
  mostrarAreaPesos();
  calcularMalha();

  // Tela 5 — Fotos
  fotosRenderizar();

  // Tela 6 — CRM
  await crmMigrarLegadoSeConfirmado();
  crmRenderizar();
});

