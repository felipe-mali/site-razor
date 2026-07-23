/* ========================================
   SIDEBAR — Controles
   ======================================== */

'use strict';

let sidebarColapsada = false;

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Mobile: toggle aberta/fechada
    sidebar.classList.toggle('aberta');
    let overlay = document.querySelector('.sidebar-mobile-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-mobile-overlay';
      overlay.onclick = () => {
        sidebar.classList.remove('aberta');
        overlay.classList.remove('ativo');
      };
      document.body.appendChild(overlay);
    }
    overlay.classList.toggle('ativo', sidebar.classList.contains('aberta'));
  } else {
    // Desktop: toggle colapsada
    sidebarColapsada = !sidebarColapsada;
    sidebar.classList.toggle('colapsada', sidebarColapsada);
    localStorage.setItem('sidebar-colapsada', sidebarColapsada);
  }
}

function toggleGrupo(el) {
  const grupo = el.closest('.sidebar-grupo');
  if (grupo) grupo.classList.toggle('fechar');
}

// Restaurar estado da sidebar
document.addEventListener('DOMContentLoaded', () => {
  const salvo = localStorage.getItem('sidebar-colapsada');
  if (salvo === 'true') {
    sidebarColapsada = true;
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth > 768) {
      sidebar.classList.add('colapsada');
    }
  }
});
