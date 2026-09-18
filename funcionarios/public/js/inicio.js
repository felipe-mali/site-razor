'use strict';

function prepararInicio() {
  if (!user) return;
  const nomesCargos = { admin: 'Administrador', engenheiro: 'Engenharia', producao: 'Produção', vendedor: 'Comercial', logistica: 'Logística', funcionario: 'Colaborador' };
  const nome = String(user.nome || user.usuario || '').trim();
  document.getElementById('inicio-saudacao').textContent = nome ? `Bem-vindo, ${nome}.` : 'Bem-vindo ao seu espaço de trabalho.';
  document.getElementById('inicio-cargo').textContent = nomesCargos[user.cargo] || 'Colaborador';
  const data = document.getElementById('inicio-data');
  data.dateTime = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  data.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
  if (user.cargo === 'producao') {
    document.getElementById('inicio-fila-descricao').textContent = 'Receba as ordens da equipe, organize a fabricação e atualize cada etapa.';
    document.getElementById('inicio-fila-acao').textContent = 'Ver ordens recebidas';
  }
  // Reutiliza a visibilidade aplicada ao menu, sem conceder novos acessos.
  document.querySelectorAll('[data-home-menu]').forEach(atalho => {
    atalho.hidden = !atalho.dataset.homeMenu.split(',').some(id => {
      const menu = document.getElementById(id);
      const grupo = menu?.closest('.sidebar-grupo');
      return menu && !menu.hidden && menu.style.display !== 'none' && grupo?.style.display !== 'none';
    });
  });
  const permissoes = Boolean(user.pode_gerenciar_permissoes);
  const chaves = user.cargo === 'admin' || permissoes;
  document.getElementById('inicio-permissoes').hidden = !permissoes;
  document.getElementById('inicio-chaves').hidden = !chaves;
  document.getElementById('inicio-admin').hidden = !permissoes && !chaves;
}

document.addEventListener('DOMContentLoaded', prepararInicio);
