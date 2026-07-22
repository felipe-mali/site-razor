/* ========================================
   CALCULADORAS RAZOR INDUSTRIAL — app.js (consolidado)
   ======================================== */

'use strict';

/* ========================================
   SENHA ADMINISTRATIVA
   ======================================== */
const SENHA_ADMIN = "M@lima1980";

/* ========================================
   UTILITÁRIOS
   ======================================== */

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
   NAVEGAÇÃO ENTRE TELAS
   ======================================== */

function trocarTela(tela) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.querySelectorAll('.btn-menu').forEach(b => b.classList.remove('ativo'));

  const mapa = {
    producao:  'tela-producao',
    conversor: 'tela-conversor',
    mureta:    'tela-mureta',
    malha:     'tela-malha',
    fotos:     'tela-fotos',
    crm:       'tela-crm'
  };

  const id = mapa[tela];
  if (id) {
    document.getElementById(id)?.classList.add('ativa');
    document.getElementById('menu-' + tela)?.classList.add('ativo');
  }

  localStorage.setItem('calc-tela-atual', tela);
  salvarEstado();
}

/* ========================================
   TELA 1 — PRAZO DE PRODUÇÃO
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
    setErro('erro-producao', 'Malha sem produtividade cadastrada. Desbloqueie as configurações para ajustar.');
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
  const senha = prompt('Digite a senha para desbloquear as configurações:');
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
        <input type="text" value="${String(prod).replace('.', ',')}" placeholder="m²/h"
               oninput="editarMalhaProducao(this, '${malha}', 'producao')" />
      </td>
      <td>
        <button class="btn-remover-fator" onclick="removerMalhaProducao('${malha}')">✕</button>
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
    alert('É necessário manter ao menos uma malha cadastrada.');
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
  let csv = 'Malha;Produção (m²/hora)\n';
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
    console.warn('Não foi possível carregar producao.csv:', e.message);
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
      mostrarFeedbackProducao('Arquivo vinculado! Próximos salvamentos serão automáticos.');
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
    exportadoEm: new Date().toISOString(),
    origem: 'Calculadora Razor Industrial - Prazo de Produção'
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
  txt += 'Malha\tProdução (m²/hora)\n';
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
    setErro('erro-malha', 'Peso não definido para esta combinação. Desbloqueie a tabela de pesos para ajustar.');
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
   TABELA DE PESOS — PROTEÇÃO POR SENHA
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
          <button class="btn-remover-fator" onclick="removerPeso('${malha}', '${bwg}')">✕</button>
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
    exportadoEm: new Date().toISOString(),
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
   TELA 5 — FOTOS (IndexedDB)
   ======================================== */

const FOTOS_DB_NAME = 'razor-fotos';
const FOTOS_DB_VERSION = 1;
const FOTOS_STORE_PASTAS = 'pastas';
const FOTOS_STORE_FOTOS = 'fotos';

function abrirDBFotos() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FOTOS_DB_NAME, FOTOS_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(FOTOS_STORE_PASTAS)) {
        db.createObjectStore(FOTOS_STORE_PASTAS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FOTOS_STORE_FOTOS)) {
        const store = db.createObjectStore(FOTOS_STORE_FOTOS, { keyPath: 'id' });
        store.createIndex('pasta_id', 'pasta_id', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function fotosCarregarPastas() {
  const db = await abrirDBFotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_STORE_PASTAS, 'readonly');
    const store = tx.objectStore(FOTOS_STORE_PASTAS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fotosCarregarFotos() {
  const db = await abrirDBFotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_STORE_FOTOS, 'readonly');
    const store = tx.objectStore(FOTOS_STORE_FOTOS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fotosSalvarPasta(pasta) {
  const db = await abrirDBFotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_STORE_PASTAS, 'readwrite');
    const store = tx.objectStore(FOTOS_STORE_PASTAS);
    const req = store.put(pasta);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function fotosExcluirPasta(id) {
  const db = await abrirDBFotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FOTOS_STORE_PASTAS, FOTOS_STORE_FOTOS], 'readwrite');
    tx.objectStore(FOTOS_STORE_PASTAS).delete(id);
    const fotosStore = tx.objectStore(FOTOS_STORE_FOTOS);
    const idx = fotosStore.index('pasta_id');
    const req = idx.openCursor(IDBKeyRange.only(id));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fotosSalvarFoto(foto) {
  const db = await abrirDBFotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_STORE_FOTOS, 'readwrite');
    const store = tx.objectStore(FOTOS_STORE_FOTOS);
    const req = store.put(foto);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function fotosExcluirFoto(id) {
  const db = await abrirDBFotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_STORE_FOTOS, 'readwrite');
    const store = tx.objectStore(FOTOS_STORE_FOTOS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function fotosMoverFoto(fotoId, novaPastaId) {
  const db = await abrirDBFotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_STORE_FOTOS, 'readwrite');
    const store = tx.objectStore(FOTOS_STORE_FOTOS);
    const req = store.get(fotoId);
    req.onsuccess = () => {
      const foto = req.result;
      if (foto) {
        foto.pasta_id = novaPastaId || null;
        store.put(foto);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fotosCriarPasta(nome) {
  const pasta = { id: gerarId(), nome, dataCriacao: new Date().toISOString() };
  await fotosSalvarPasta(pasta);
  return pasta;
}

async function fotosAdicionarArquivos(files) {
  for (const file of files) {
    const blob = file;
    const reader = new FileReader();
    const dataUrl = await new Promise((res) => {
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(blob);
    });

    const foto = {
      id: gerarId(),
      nome: file.name,
      pasta_id: null,
      dataUrl: dataUrl,
      dataCriacao: new Date().toISOString()
    };
    await fotosSalvarFoto(foto);
  }
}

async function fotosRenderizar() {
  const pastas = await fotosCarregarPastas();
  const fotos = await fotosCarregarFotos();
  const container = document.getElementById('fotos-conteudo');
  if (!container) return;

  const fotosSemPasta = fotos.filter(f => !f.pasta_id);
  const pastasComFotos = pastas.map(p => ({
    ...p,
    fotos: fotos.filter(f => f.pasta_id === p.id)
  }));

  let html = '';

  pastasComFotos.forEach(pasta => {
    html += `
      <div class="pasta-section" data-pasta-id="${pasta.id}">
        <div class="pasta-header">
          <span class="pasta-nome">📁 ${pasta.nome} <span class="pasta-count">(${pasta.fotos.length})</span></span>
          <div class="pasta-actions">
            <button class="pasta-btn btn-excluir" onclick="fotosExcluirPastaUI('${pasta.id}')">Excluir</button>
          </div>
        </div>
        <div class="fotos-grid">
          ${pasta.fotos.map(f => fotosItemHTML(f, pastas)).join('')}
        </div>
      </div>`;
  });

  if (fotosSemPasta.length > 0) {
    html += `
      <div class="pasta-section">
        <div class="pasta-header">
          <span class="pasta-nome">📷 Sem pasta <span class="pasta-count">(${fotosSemPasta.length})</span></span>
        </div>
        <div class="fotos-grid">
          ${fotosSemPasta.map(f => fotosItemHTML(f, pastas)).join('')}
        </div>
      </div>`;
  }

  if (pastas.length === 0 && fotos.length === 0) {
    html = `
      <div class="fotos-vazio">
        <div class="fotos-vazio-icone">📷</div>
        <p>Nenhuma foto cadastrada.</p>
        <p>Clique em "Adicionar Foto" para começar.</p>
      </div>`;
  }

  container.innerHTML = html;
}

function fotosItemHTML(foto, pastas) {
  return `
    <div class="foto-item" data-foto-id="${foto.id}">
      <img src="${foto.dataUrl}" alt="${foto.nome}" loading="lazy" />
      <span class="foto-nome">${foto.nome}</span>
      <button class="foto-excluir" onclick="fotosExcluirFotoUI('${foto.id}')" title="Excluir">✕</button>
      <button class="foto-mover" onclick="fotosAbrirModalMover('${foto.id}')" title="Mover">📁</button>
    </div>`;
}

async function fotosExcluirFotoUI(id) {
  if (!confirm('Excluir esta foto?')) return;
  await fotosExcluirFoto(id);
  fotosRenderizar();
}

async function fotosExcluirPastaUI(id) {
  if (!confirm('Excluir esta pasta e todas as fotos dentro dela?')) return;
  await fotosExcluirPasta(id);
  fotosRenderizar();
}

async function fotosMoverFotoUI(fotoId, pastaId) {
  await fotosMoverFoto(fotoId, pastaId);
  fotosRenderizar();
}

async function fotosAbrirModalMover(fotoId) {
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
          <button class="modal-fechar" onclick="document.getElementById('modal-mover').remove()">✕</button>
        </div>
        <div class="modal-corpo">
          <ul class="modal-lista">
            <li onclick="fotosMoverFotoUI('${fotoId}', null)">📷 Sem pasta</li>
            ${pastas.map(p => `<li onclick="fotosMoverFotoUI('${fotoId}', '${p.id}');document.getElementById('modal-mover').remove()">📁 ${p.nome}</li>`).join('')}
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
    await fotosAdicionarArquivos(files);
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
   TELA 6 — CRM (IndexedDB)
   ======================================== */

const CRM_DB_NAME = 'razor-crm';
const CRM_DB_VERSION = 1;
const CRM_STORE = 'clientes';

function abrirDBCRM() {
  return new Promise((resolve, reject) => {
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

async function crmCarregarClientes() {
  const db = await abrirDBCRM();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRM_STORE, 'readonly');
    const store = tx.objectStore(CRM_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function crmSalvarCliente(cliente) {
  const db = await abrirDBCRM();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRM_STORE, 'readwrite');
    const store = tx.objectStore(CRM_STORE);
    const req = store.put(cliente);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function crmExcluirCliente(id) {
  const db = await abrirDBCRM();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRM_STORE, 'readwrite');
    const store = tx.objectStore(CRM_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

let crmFiltroVendedor = '';
let crmBusca = '';

async function crmRenderizar() {
  const clientes = await crmCarregarClientes();
  const container = document.getElementById('crm-tabela-conteudo');
  if (!container) return;

  let filtrados = clientes;

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

  const vendedores = [...new Set(clientes.map(c => c.vendedor).filter(Boolean))];
  const selectVendedor = document.getElementById('crm-filtro-vendedor');
  if (selectVendedor) {
    const valAtual = selectVendedor.value;
    selectVendedor.innerHTML = '<option value="">Todos os vendedores</option>';
    vendedores.forEach(v => {
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
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${filtrados.map(c => `
          <tr>
            <td>${c.nome || '—'}</td>
            <td>${c.empresa || '—'}</td>
            <td>${c.telefone || '—'}</td>
            <td>${c.email || '—'}</td>
            <td>${c.vendedor || '—'}</td>
            <td class="col-acoes">
              <button class="crm-btn-editar" onclick="crmEditarUI('${c.id}')">Editar</button>
              <button class="crm-btn-excluir" onclick="crmExcluirUI('${c.id}')">Excluir</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

  container.innerHTML = html;
}

async function crmExcluirUI(id) {
  if (!confirm('Excluir este cliente?')) return;
  await crmExcluirCliente(id);
  crmRenderizar();
}

function crmNovoUI() {
  crmAbrirModal(null);
}

async function crmEditarUI(id) {
  const clientes = await crmCarregarClientes();
  const cliente = clientes.find(c => c.id === id);
  if (cliente) crmAbrirModal(cliente);
}

function crmAbrirModal(cliente) {
  const eEdicao = !!cliente;
  const titulo = eEdicao ? 'Editar Cliente' : 'Cadastrar Cliente';

  let html = `
    <div class="modal-overlay modal-crm" id="modal-crm" onclick="if(event.target===this)this.remove()">
      <div class="modal">
        <div class="modal-cabecalho">
          <h3>${titulo}</h3>
          <button class="modal-fechar" onclick="document.getElementById('modal-crm').remove()">✕</button>
        </div>
        <div class="modal-corpo">
          <div class="campo-grupo">
            <label>Nome *</label>
            <input type="text" id="crm-nome" value="${cliente?.nome || ''}" placeholder="Nome do cliente" />
          </div>
          <div class="campo-grupo">
            <label>Empresa</label>
            <input type="text" id="crm-empresa" value="${cliente?.empresa || ''}" placeholder="Empresa" />
          </div>
          <div class="campo-grupo">
            <label>Telefone</label>
            <input type="text" id="crm-telefone" value="${cliente?.telefone || ''}" placeholder="(00) 00000-0000" />
          </div>
          <div class="campo-grupo">
            <label>E-mail</label>
            <input type="text" id="crm-email" value="${cliente?.email || ''}" placeholder="email@exemplo.com" />
          </div>
          <div class="campo-grupo">
            <label>Vendedor</label>
            <input type="text" id="crm-vendedor" value="${cliente?.vendedor || ''}" placeholder="Nome do vendedor" />
          </div>
          <div class="campo-grupo">
            <label>Observações</label>
            <textarea id="crm-obs" rows="3" placeholder="Notas sobre o cliente...">${cliente?.observacoes || ''}</textarea>
          </div>
        </div>
        <div class="modal-rodape">
          <button class="btn-modal-cancelar" onclick="document.getElementById('modal-crm').remove()">Cancelar</button>
          <button class="btn-modal-confirmar" onclick="crmSalvarUI('${cliente?.id || ''}')">Salvar</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('crm-nome')?.focus();
}

async function crmSalvarUI(idExistente) {
  const nome = document.getElementById('crm-nome')?.value?.trim();
  if (!nome) {
    alert('O campo Nome é obrigatório.');
    return;
  }

  const cliente = {
    id: idExistente || gerarId(),
    nome,
    empresa:    document.getElementById('crm-empresa')?.value?.trim() || '',
    telefone:   document.getElementById('crm-telefone')?.value?.trim() || '',
    email:      document.getElementById('crm-email')?.value?.trim() || '',
    vendedor:   document.getElementById('crm-vendedor')?.value?.trim() || '',
    observacoes: document.getElementById('crm-obs')?.value?.trim() || '',
    dataAtualizacao: new Date().toISOString()
  };

  if (!idExistente) {
    cliente.dataCriacao = new Date().toISOString();
  }

  await crmSalvarCliente(cliente);
  document.getElementById('modal-crm')?.remove();
  crmRenderizar();
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
  const dados = {
    clientes,
    exportadoEm: new Date().toISOString(),
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
        for (const c of lista) {
          if (c.nome) {
            await crmSalvarCliente({
              id: c.id || gerarId(),
              nome: c.nome,
              empresa: c.empresa || '',
              telefone: c.telefone || '',
              email: c.email || '',
              vendedor: c.vendedor || '',
              observacoes: c.observacoes || '',
              dataCriacao: c.dataCriacao || new Date().toISOString(),
              dataAtualizacao: new Date().toISOString()
            });
          }
        }
        crmRenderizar();
        alert('Clientes importados com sucesso!');
      } catch (err) {
        alert('Erro ao ler o arquivo: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ========================================
   IMPRESSÃO / PDF
   ======================================== */

function imprimirOrcamento(tela) {
  trocarTela(tela);
  setTimeout(() => window.print(), 200);
}

/* ========================================
   PERSISTÊNCIA — LOCAL STORAGE
   ======================================== */

function salvarEstado() {
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
      tabelaPeso
    };
    const existente = JSON.parse(localStorage.getItem('calc-estado') || '{}');
    const merged = { ...existente, ...estado };
    localStorage.setItem('calc-estado', JSON.stringify(merged));
  } catch (e) {
    console.warn('Erro ao salvar estado:', e);
  }
}

function carregarEstado() {
  try {
    const raw = localStorage.getItem('calc-estado');
    if (!raw) return;
    const estado = JSON.parse(raw);

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
      // Tabela de pesos desatualizada — manter padrão
    } else if (estado.tabelaPeso) {
      tabelaPeso = estado.tabelaPeso;
    }

  } catch (e) {
    console.warn('Erro ao restaurar estado:', e);
  }
}

/* ========================================
   INICIALIZAÇÃO
   ======================================== */

document.addEventListener('DOMContentLoaded', async () => {

  // Restaurar aba ativa
  const telaSalva = localStorage.getItem('calc-tela-atual') || 'producao';
  trocarTela(telaSalva);

  // 1. Carregar CSV primeiro (dados oficiais)
  await carregarCSV();

  // 2. Restaurar estado do localStorage (NÃO sobrescrever producaoM2h do CSV)
  const raw = localStorage.getItem('calc-estado');
  if (raw) {
    try {
      const estado = JSON.parse(raw);
      // Restaurar campos dos formulários (mas NÃO producaoM2h)
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

      if (estado.tabelaPeso) tabelaPeso = estado.tabelaPeso;
    } catch (e) {
      console.warn('Erro ao restaurar estado:', e);
    }
  }

  // 3. Popular select de malhas com os dados carregados
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
  crmRenderizar();
});
