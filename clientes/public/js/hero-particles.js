// Three.js Hero Particles — Razor Indústria
(function () {
  'use strict';

  // Only run on public site
  if (!document.body.classList.contains('public-site')) return;

  // Skip if Three.js not loaded
  if (typeof THREE === 'undefined') return;

  // Respect reduced motion
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  var hero = canvas.closest('.hero');
  if (!hero) return;

  // ─── SCENE SETUP ───
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    60,
    hero.offsetWidth / hero.offsetHeight,
    0.1,
    1000
  );
  camera.position.z = 30;

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: false,
  });
  renderer.setSize(hero.offsetWidth, hero.offsetHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // ─── PARTICLES ───
  var PARTICLE_COUNT = 25;
  var positions = new Float32Array(PARTICLE_COUNT * 3);
  var velocities = [];
  var sizes = new Float32Array(PARTICLE_COUNT);

  for (var i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

    velocities.push({
      x: (Math.random() - 0.5) * 0.005,
      y: (Math.random() - 0.5) * 0.005 + 0.003,
      z: (Math.random() - 0.5) * 0.002,
    });

    sizes[i] = Math.random() * 2 + 0.5;
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  var material = new THREE.PointsMaterial({
    color: 0xf4a41c,
    size: 0.15,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  var particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // ─── MOUSE PARALLAX ───
  var mouseX = 0;
  var mouseY = 0;
  var targetMouseX = 0;
  var targetMouseY = 0;

  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  // ─── ANIMATION ───
  var animationId;
  var isVisible = true;

  // Pause when hero not visible
  var observer = new IntersectionObserver(function (entries) {
    isVisible = entries[0].isIntersecting;
  }, { threshold: 0 });
  observer.observe(hero);

  function animate() {
    animationId = requestAnimationFrame(animate);

    if (!isVisible) return;

    // Smooth mouse follow
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Move particles
    var pos = geometry.attributes.position.array;
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] += velocities[i].x;
      pos[i * 3 + 1] += velocities[i].y;
      pos[i * 3 + 2] += velocities[i].z;

      // Wrap around
      if (pos[i * 3 + 1] > 20) pos[i * 3 + 1] = -20;
      if (pos[i * 3] > 30) pos[i * 3] = -30;
      if (pos[i * 3] < -30) pos[i * 3] = 30;
    }
    geometry.attributes.position.needsUpdate = true;

    // Mouse parallax on camera
    camera.position.x = mouseX * 2;
    camera.position.y = -mouseY * 1.5;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  if (!prefersReduced) {
    animate();
  } else {
    // Static render for reduced motion
    renderer.render(scene, camera);
  }

  // ─── RESIZE ───
  var resizeTimeout;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      camera.aspect = hero.offsetWidth / hero.offsetHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(hero.offsetWidth, hero.offsetHeight);
    }, 150);
  });

  // ─── CLEANUP ON PAGE UNLOAD ───
  window.addEventListener('beforeunload', function () {
    cancelAnimationFrame(animationId);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  });
})();
