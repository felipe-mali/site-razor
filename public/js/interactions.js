// Motion.dev Microinteractions — Razor Indústria
(function () {
  'use strict';

  // Only run on public site
  if (!document.body.classList.contains('public-site')) return;

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Skip if Motion not loaded
  if (typeof Motion === 'undefined' || !Motion.animate) return;

  var animate = Motion.animate;

  // ─── BUTTON HOVER EFFECTS ───
  document.querySelectorAll('.btn:not(.btn-secondary):not(.btn-ghost)').forEach(function (btn) {
    btn.addEventListener('mouseenter', function () {
      animate(btn, { scale: 1.02 }, { duration: 0.2 });
    });
    btn.addEventListener('mouseleave', function () {
      animate(btn, { scale: 1 }, { duration: 0.2 });
    });
    btn.addEventListener('mousedown', function () {
      animate(btn, { scale: 0.98 }, { duration: 0.1 });
    });
    btn.addEventListener('mouseup', function () {
      animate(btn, { scale: 1.02 }, { duration: 0.1 });
    });
  });

  // ─── PRODUCT CARD HOVER ───
  document.querySelectorAll('.produto-card').forEach(function (card) {
    card.addEventListener('mouseenter', function () {
      animate(card, { y: -8 }, { duration: 0.3, easing: 'ease-out' });
    });
    card.addEventListener('mouseleave', function () {
      animate(card, { y: 0 }, { duration: 0.3, easing: 'ease-out' });
    });
  });

  // ─── FEATURE CARD ICON PULSE ───
  document.querySelectorAll('.feature-card').forEach(function (card) {
    var icon = card.querySelector('.feature-icon');
    if (!icon) return;
    card.addEventListener('mouseenter', function () {
      animate(icon, { scale: 1.1 }, { duration: 0.2 });
    });
    card.addEventListener('mouseleave', function () {
      animate(icon, { scale: 1 }, { duration: 0.2 });
    });
  });

  // ─── DEPARTAMENTO CARD HOVER ───
  document.querySelectorAll('.departamento-card').forEach(function (card) {
    card.addEventListener('mouseenter', function () {
      animate(card, { y: -10 }, { duration: 0.3, easing: 'ease-out' });
    });
    card.addEventListener('mouseleave', function () {
      animate(card, { y: 0 }, { duration: 0.3, easing: 'ease-out' });
    });
  });

  // ─── FORM INPUT FOCUS GLOW ───
  document.querySelectorAll('.cotacao-form input, .cotacao-form select, .cotacao-form textarea').forEach(function (input) {
    input.addEventListener('focus', function () {
      animate(input, {
        boxShadow: '0 0 0 3px rgba(244, 164, 28, 0.15), 0 4px 12px rgba(0,0,0,0.2)',
      }, { duration: 0.2 });
    });
    input.addEventListener('blur', function () {
      animate(input, {
        boxShadow: 'none',
      }, { duration: 0.2 });
    });
  });

  // ─── STAT ITEM HOVER ───
  document.querySelectorAll('.stat-item').forEach(function (item) {
    item.addEventListener('mouseenter', function () {
      animate(item, { y: -4 }, { duration: 0.2 });
    });
    item.addEventListener('mouseleave', function () {
      animate(item, { y: 0 }, { duration: 0.2 });
    });
  });

})();
