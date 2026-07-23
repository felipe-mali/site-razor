// GSAP ScrollTrigger — Razor Indústria
(function () {
  'use strict';

  // Only run on public site
  if (!document.body.classList.contains('public-site')) return;

  // Respect reduced motion
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  gsap.registerPlugin(ScrollTrigger);

  if (prefersReduced) {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('visible');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  // ─── HERO ENTRANCE ───
  var heroTl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  heroTl
    .from('.hero-badge', { opacity: 0, y: 16, duration: 0.4, delay: 0.05 })
    .from('.hero h1', { opacity: 0, y: 20, duration: 0.5 }, '-=0.2')
    .from('.hero-desc', { opacity: 0, y: 16, duration: 0.4 }, '-=0.3')
    .from('.hero-buttons', { opacity: 0, y: 16, duration: 0.4 }, '-=0.2')
    .from('.hero-stats .stat-item', { opacity: 0, y: 12, duration: 0.3, stagger: 0.08 }, '-=0.1');

  // ─── SECTION REVEALS (simplified) ───
  var revealElements = document.querySelectorAll(
    '.produto-card, .feature-card, .processo-step, .depoimento-card, .departamento-card, .sobre-feature, .section-header'
  );

  revealElements.forEach(function (el) {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
      opacity: 0,
      y: 24,
      duration: 0.5,
      ease: 'power2.out',
    });
  });

  // ─── CTA BANNER ───
  gsap.from('.cta-banner-content', {
    scrollTrigger: {
      trigger: '.cta-banner',
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
    opacity: 0,
    y: 20,
    duration: 0.5,
    ease: 'power2.out',
  });
})();
