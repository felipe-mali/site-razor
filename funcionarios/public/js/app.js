// APP.JS - Razor Indústria

document.addEventListener('DOMContentLoaded', () => {
  // ─── MENU MOBILE ───
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('header nav');
  const overlay = document.querySelector('.nav-overlay');

  function openMenu() {
    toggle?.classList.add('active');
    nav?.classList.add('active');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    toggle?.classList.remove('active');
    nav?.classList.remove('active');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggle?.addEventListener('click', () => {
    nav?.classList.contains('active') ? closeMenu() : openMenu();
  });

  overlay?.addEventListener('click', closeMenu);
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  // ─── NAV SCROLL EFFECT ───
  window.addEventListener('scroll', () => {
    const header = document.getElementById('navbar');
    if (header) {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  // ─── SMOOTH SCROLL ───
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ══════════════════════════════════════════════
  //  CATÁLOGO DE PRODUTOS
  // ══════════════════════════════════════════════
  const PRODUTOS = [
    {
      id: 'concertina',
      nome: 'Concertina',
      tag: 'Segurança perimetral',
      campos: [
        {
          id: 'conc_tipo', label: 'Tipo de concertina', tipo: 'select',
          opcoes: ['','Simples','Dupla','Concertina Eletrificada']
        },
        {
          id: 'conc_modelo', label: 'Modelo (diâmetro)', tipo: 'select',
          opcoes: ['','CD30 (300mm)','CD35 (350mm)','CD45 (450mm)']
        },
        {
          id: 'conc_laminas', label: 'Quantidade de lâminas', tipo: 'select',
          opcoes: ['','7 lâminas','10 lâminas','12 lâminas']
        },
        {
          id: 'conc_fio', label: 'Bitola do fio (BWG)', tipo: 'select',
          opcoes: ['','BWG 12 (2,77mm)','BWG 14 (2,11mm)','BWG 16 (1,65mm)']
        },
        {
          id: 'conc_metragem', label: 'Metragem linear estimada', tipo: 'range',
          min: 5, max: 2000, step: 5, valor: 50, unidade: 'm'
        },
        {
          id: 'conc_instalacao', label: 'Instalação sobre', tipo: 'select',
          opcoes: ['','Muro existente','Mourão / poste','Gradil / alambrado','Estrutura metálica','Outro']
        }
      ]
    },
    {
      id: 'alambrado',
      nome: 'Tela Alambrado',
      tag: 'Cercamento',
      campos: [
        {
          id: 'alam_altura', label: 'Altura da tela', tipo: 'select',
          opcoes: ['','1m','1,5m','2m','2,5m','3m','3,5m','4m','4,5m','5m','5,5m','6m','Personalizado']
        },
        {
          id: 'alam_malha', label: 'Abertura de malha', tipo: 'select',
          opcoes: ['','1"(2,5cm)','2"(5cm)','3"(8cm)','4"(10cm)']
        },
        {
          id: 'alam_fio', label: 'Bitola do fio (BWG)', tipo: 'select',
          opcoes: ['','BWG 12 (2,77mm)','BWG 14 (2,11mm)','BWG 16 (1,65mm)']
        },
        {
          id: 'alam_acabamento', label: 'Acabamento', tipo: 'select',
          opcoes: ['','Galvanizado','PVC colorido']
        },
        {
          id: 'alam_metragem', label: 'Metragem linear estimada', tipo: 'range',
          min: 1, max: 5000, step: 1, valor: 10, unidade: 'm'
        },
        {
          id: 'alam_postes', label: 'Incluir postes/mourões?', tipo: 'select',
          opcoes: ['','Sim — incluir postes','Não — somente tela']
        }
      ]
    },
    {
      id: 'rede_laminada',
      nome: 'Rede Laminada',
      tag: 'Rural / decorativo',
      campos: [
        {
          id: 'hex_altura', label: 'Altura do rolo', tipo: 'select',
          opcoes: ['','50cm','1m']
        },
        {
          id: 'hex_malha', label: 'Abertura da malha', tipo: 'select',
          opcoes: ['','2,5cm','5cm','8cm','10cm']
        },
        {
          id: 'hex_fio', label: 'Bitola do fio (BWG)', tipo: 'select',
          opcoes: ['','BWG 12 (2,77mm)','BWG 14 (2,11mm)','BWG 16 (1,65mm)']
        },
        {
          id: 'hex_metragem', label: 'Metragem estimada', tipo: 'range',
          min: 1, max: 2000, step: 1, valor: 50, unidade: 'm'
        }
      ]
    },
    {
      id: 'tela_soldada',
      nome: 'Tela Eletrosoldada',
      tag: 'Industrial',
      campos: [
        {
          id: 'sold_fio', label: 'Bitola do fio (mm)', tipo: 'select',
          opcoes: ['','2,70mm','2,30mm','2,10mm','1,90mm']
        },
        {
          id: 'sold_malha', label: 'Espaçamento da malha', tipo: 'select',
          opcoes: ['','5x5cm','5x10cm','5x15cm']
        },
        {
          id: 'sold_altura', label: 'Altura da peça', tipo: 'select',
          opcoes: ['','1m','1,2m','1,5m','1,8m','2m']
        },
        {
          id: 'sold_metragem', label: 'Rendimento por bobina', tipo: 'select',
          opcoes: ['','15m','25m']
        }
      ]
    },
    {
      id: 'gradil',
      nome: 'Gradil',
      tag: 'Anti-escalada',
      campos: [
        {
          id: 'grad_altura', label: 'Altura do gradil', tipo: 'select',
          opcoes: ['','1m','1,5m','2m','2,5m']
        },
        {
          id: 'grad_modulo', label: 'Comprimento do módulo', tipo: 'select',
          opcoes: ['','2,5m']
        },
        {
          id: 'grad_fio', label: 'Bitola do fio (BWG)', tipo: 'select',
          opcoes: ['','BWG 10 (3,40mm)','BWG 12 (2,77mm)','BWG 14 (2,11mm)']
        },
        {
          id: 'grad_acabamento', label: 'Acabamento', tipo: 'select',
          opcoes: ['','Galvanizado','PVC preto','PVC verde','PVC branco']
        },
        {
          id: 'grad_metragem', label: 'Metragem linear estimada', tipo: 'range',
          min: 10, max: 2000, step: 10, valor: 50, unidade: 'm'
        },
        {
          id: 'grad_postes', label: 'Incluir postes e acessórios?', tipo: 'select',
          opcoes: ['','Sim — kit completo','Não — somente gradil']
        }
      ]
    },
    {
      id: 'lanca',
      nome: 'Lança Protetora',
      tag: 'Proteção de muro',
      campos: [
        {
          id: 'lanc_modelo', label: 'Modelo de lança', tipo: 'select',
          opcoes: ['','Dupla (V)','Simples']
        },
        {
          id: 'lanc_material', label: 'Material', tipo: 'select',
          opcoes: ['','Aço galvanizado','Inox']
        },
        {
          id: 'lanc_comp', label: 'Comprimento da lança', tipo: 'select',
          opcoes: ['','0,5m','0,8m','1m','1,2m']
        },
        {
          id: 'lanc_espac', label: 'Espaçamento entre lanças', tipo: 'select',
          opcoes: ['','3cm','4cm','5cm']
        },
        {
          id: 'lanc_metragem', label: 'Metragem de muro estimada', tipo: 'range',
          min: 1, max: 1000, step: 1, valor: 30, unidade: 'm'
        }
      ]
    },
    {
      id: 'tela_artistica',
      nome: 'Tela Artística',
      tag: 'Arquitetônico',
      campos: [
        {
          id: 'art_material', label: 'Material', tipo: 'select',
          opcoes: ['','Aço galvanizado','Alumínio','Inox']
        },
        {
          id: 'art_fio', label: 'Bitola do fio (mm)', tipo: 'select',
          opcoes: ['','3mm','4mm','5mm','6mm','8mm']
        },
        {
          id: 'art_aplicacao', label: 'Aplicação', tipo: 'select',
          opcoes: ['','Portão','Fachada','Muro / painel','Grade de janela','Decorativo interno','Outro']
        },
        {
          id: 'art_acabamento', label: 'Acabamento', tipo: 'select',
          opcoes: ['','Galvanizado','Pintado eletrostático','Patinado']
        },
        {
          id: 'art_medidas', label: 'Medidas (L × A)', tipo: 'text',
          placeholder: 'Ex: 3m × 2m ou "a definir"'
        },
        {
          id: 'art_qtd', label: 'Quantidade de painéis / unidades', tipo: 'text',
          placeholder: 'Ex: 5 painéis'
        }
      ]
    },
    {
      id: 'outro',
      nome: 'Outro produto / consulta',
      tag: 'Outro',
      campos: [
        {
          id: 'outro_desc', label: 'Descreva o produto ou necessidade', tipo: 'textarea',
          placeholder: 'Detalhe o produto, dimensões, finalidade e qualquer informação relevante.'
        }
      ]
    }
  ];

  // ══════════════════════════════════════════════
  //  GERAÇÃO DINÂMICA DOS CARDS DE PRODUTO
  // ══════════════════════════════════════════════
  function buildProductSelector() {
    const container = document.getElementById('productSelector');
    if (!container) return;

    const list = document.createElement('div');
    list.className = 'prod-selector-list';

    PRODUTOS.forEach(produto => {
      const item = document.createElement('div');
      item.className = 'prod-item';
      item.id = 'proditem_' + produto.id;

      // Cabeçalho clicável
      const header = document.createElement('div');
      header.className = 'prod-item-header';
      header.onclick = () => toggleProduto(produto.id);
      header.innerHTML = `
        <div class="prod-checkbox">
          <svg class="prod-checkbox-inner" viewBox="0 0 10 10" fill="none">
            <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="prod-item-name">${produto.nome}</div>
        <div class="prod-item-tag">${produto.tag}</div>
        <div class="prod-item-toggle">▼</div>
      `;

      // Campos específicos
      const fields = document.createElement('div');
      fields.className = 'prod-item-fields';

      const fieldGrid = document.createElement('div');
      fieldGrid.className = 'prod-fields-grid';

      produto.campos.forEach(campo => {
        const fg = document.createElement('div');
        fg.className = 'form-group';
        if (campo.tipo === 'textarea' || campo.tipo === 'range') {
          fg.style.gridColumn = '1 / -1';
        }

        const lbl = document.createElement('label');
        lbl.setAttribute('for', campo.id);
        lbl.textContent = campo.label;
        fg.appendChild(lbl);

        let input;
        if (campo.tipo === 'select') {
          input = document.createElement('select');
          input.id = campo.id;
          campo.opcoes.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op;
            opt.textContent = op || 'Selecione';
            input.appendChild(opt);
          });
        } else if (campo.tipo === 'range') {
          const wrapper = document.createElement('div');
          const rangeLabel = document.createElement('div');
          rangeLabel.className = 'range-label';

          const valSpan = document.createElement('span');
          valSpan.className = 'range-value';
          valSpan.id = campo.id + '_val';
          valSpan.textContent = campo.valor + campo.unidade;

          rangeLabel.appendChild(lbl);
          rangeLabel.appendChild(valSpan);

          input = document.createElement('input');
          input.type = 'range';
          input.id = campo.id;
          input.min = campo.min;
          input.max = campo.max;
          input.step = campo.step;
          input.value = campo.valor;
          input.oninput = function() {
            const v = parseInt(this.value);
            valSpan.textContent = (v >= campo.max ? v + '+' : v) + campo.unidade;
            atualizarPreview();
          };

          const labels = document.createElement('div');
          labels.className = 'range-labels';
          labels.innerHTML = `<span>${campo.min}${campo.unidade}</span><span>${Math.round((campo.min + campo.max) / 2)}${campo.unidade}</span><span>${campo.max}${campo.unidade}+</span>`;

          wrapper.appendChild(input);
          wrapper.appendChild(labels);
          fg.innerHTML = '';
          fg.appendChild(rangeLabel);
          fg.appendChild(wrapper);
          fieldGrid.appendChild(fg);
          return;
        } else if (campo.tipo === 'textarea') {
          input = document.createElement('textarea');
          input.id = campo.id;
          input.placeholder = campo.placeholder || '';
          input.rows = 3;
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.id = campo.id;
          input.placeholder = campo.placeholder || '';
        }

        input.oninput = atualizarPreview;
        input.onchange = atualizarPreview;
        fg.appendChild(input);
        fieldGrid.appendChild(fg);
      });

      fields.appendChild(fieldGrid);
      item.appendChild(header);
      item.appendChild(fields);
      list.appendChild(item);
    });

    container.appendChild(list);
  }

  function toggleProduto(id) {
    const item = document.getElementById('proditem_' + id);
    if (item) {
      item.classList.toggle('selected');
      atualizarPreview();
    }
  }

  function getProdutosSelecionados() {
    return PRODUTOS.filter(p => {
      const el = document.getElementById('proditem_' + p.id);
      return el && el.classList.contains('selected');
    });
  }

  // ══════════════════════════════════════════════
  //  GERAÇÃO DA MENSAGEM
  // ══════════════════════════════════════════════
  function montarMensagem() {
    const nome = document.getElementById('nome')?.value?.trim() || '';
    const empresa = document.getElementById('empresa')?.value?.trim() || '';
    const cidade = document.getElementById('cidade')?.value?.trim() || '';
    const aplicacao = document.getElementById('aplicacao')?.value || '';
    const prazo = document.getElementById('prazo')?.value || '';
    const obs = document.getElementById('obs')?.value?.trim() || '';
    const selecionados = getProdutosSelecionados();

    let msg = '🔧 *SOLICITAÇÃO DE COTAÇÃO — RAZOR INDÚSTRIA*\n\n';
    if (nome) msg += `👤 *Nome:* ${nome}\n`;
    if (empresa) msg += `🏢 *Empresa:* ${empresa}\n`;
    if (cidade) msg += `📍 *Cidade/Estado:* ${cidade}\n`;

    selecionados.forEach(produto => {
      msg += `\n━━━━━━━━━━━━━━━━\n`;
      msg += `📦 *${produto.nome.toUpperCase()}*\n`;
      produto.campos.forEach(campo => {
        const el = document.getElementById(campo.id);
        if (!el) return;
        const val = el.value ? el.value.trim() : '';
        if (!val || val === '') return;
        const labelText = campo.label.replace(/:$/, '');
        if (campo.tipo === 'range') {
          const span = document.getElementById(campo.id + '_val');
          msg += `  • ${labelText}: ${span ? span.textContent : val}\n`;
        } else {
          msg += `  • ${labelText}: ${val}\n`;
        }
      });
    });

    if (aplicacao || prazo) {
      msg += `\n📐 *Informações gerais:*\n`;
      if (aplicacao) msg += `  • Aplicação: ${aplicacao}\n`;
      if (prazo) msg += `  • Prazo: ${prazo}\n`;
    }

    if (obs) msg += `\n💬 *Observações:*\n${obs}\n`;
    msg += '\n_Mensagem gerada pelo site razor.ind.br_';
    return msg;
  }

  // ─── PREVIEW ───
  function atualizarPreview() {
    const nome = document.getElementById('nome')?.value?.trim() || '';
    const selecionados = getProdutosSelecionados();
    const preview = document.getElementById('previewBox');

    if (!preview) return;

    if (!nome && selecionados.length === 0) {
      preview.classList.remove('visible');
      return;
    }

    document.getElementById('previewText').textContent = montarMensagem();
    preview.classList.add('visible');
  }

  // ─── ENVIAR WHATSAPP ───
  function enviarWhatsApp() {
    const nome = document.getElementById('nome')?.value?.trim() || '';
    if (!nome) {
      alert('Por favor, preencha seu nome antes de enviar.');
      document.getElementById('nome')?.focus();
      return;
    }
    if (getProdutosSelecionados().length === 0) {
      alert('Por favor, selecione ao menos um produto de interesse.');
      return;
    }
    const url = 'https://wa.me/5516993561603?text=' + encodeURIComponent(montarMensagem());
    window.open(url, '_blank');
  }

  // ─── INIT PRODUTOS ───
  buildProductSelector();

  // Expor funções globalmente para o onclick do botão WhatsApp
  window.enviarWhatsApp = enviarWhatsApp;
  window.atualizarPreview = atualizarPreview;
});
