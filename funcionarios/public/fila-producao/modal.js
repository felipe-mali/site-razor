'use strict';

// Comportamento compartilhado pelos dialogs do solicitante e da produção.
window.Modais = (() => {
  const acionadores = new WeakMap();
  function abrir(dialog, acionador = document.activeElement) {
    if (dialog.open) return;
    acionadores.set(dialog, acionador);
    dialog.showModal();
    document.body.classList.add('modal-aberto');
  }
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelectorAll('[data-fechar-modal]').forEach(botao => {
      botao.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('close', () => {
      document.body.classList.toggle('modal-aberto', !!document.querySelector('dialog[open]'));
      const acionador = acionadores.get(dialog);
      if (acionador?.isConnected) acionador.focus({ preventScroll: true });
      else document.querySelector('[data-foco-retorno]')?.focus({ preventScroll: true });
    });
  });
  return { abrir };
})();
