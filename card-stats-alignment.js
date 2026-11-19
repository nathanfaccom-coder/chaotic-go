/* Alinha os atributos à imagem real da carta, não ao painel do scanner.
 * O painel pode ter dimensões diferentes no PWA e no Chrome. */
(function () {
  'use strict';
  function init() {
    const image = document.getElementById('imagem-detalhe');
    const layer = document.getElementById('camada-stats');
    const container = document.querySelector('.container-carta-inspecao');
    if (!image || !layer || !container) return;

    let pending = false;
    function sync() {
      pending = false;
      if (!image.complete || !image.naturalWidth || !image.getClientRects().length || !container.getClientRects().length) {
        layer.style.visibility = 'hidden';
        return;
      }
      // As coordenadas precisam estar no MESMO espaço CSS do overlay.
      // getBoundingClientRect mede pixels após zoom/transform e causava
      // deslocamento duplo em navegadores e WebViews com escala diferente.
      // Use viewport rectangles for BOTH elements, then convert to the
      // container's untransformed CSS coordinate system. This also works
      // when offsetParent differs in installed PWAs and desktop browsers.
      const img = image.getBoundingClientRect();
      const box = container.getBoundingClientRect();
      const sx = box.width / (container.offsetWidth || box.width);
      const sy = box.height / (container.offsetHeight || box.height);
      if (!img.width || !img.height || !box.width || !box.height || !sx || !sy) {
        layer.style.visibility = 'hidden';
        return;
      }
      const computed = getComputedStyle(image);
      const bl = parseFloat(computed.borderLeftWidth) || 0;
      const br = parseFloat(computed.borderRightWidth) || 0;
      const bt = parseFloat(computed.borderTopWidth) || 0;
      const bb = parseFloat(computed.borderBottomWidth) || 0;
      const innerW = img.width / sx - bl - br;
      const innerH = img.height / sy - bt - bb;
      if (innerW <= 0 || innerH <= 0) {
        layer.style.visibility = 'hidden';
        return;
      }
      const fitMode = computed.objectFit;
      // Match the browser's actual object-fit sizing, including scale-down and
      // none. The previous fallback treated both as contain and misplaced stats.
      const contain = Math.min(innerW / image.naturalWidth, innerH / image.naturalHeight);
      const cover = Math.max(innerW / image.naturalWidth, innerH / image.naturalHeight);
      const ratio = fitMode === 'cover' ? cover
        : fitMode === 'none' ? 1
        : fitMode === 'scale-down' ? Math.min(1, contain)
        : fitMode === 'fill' ? null : contain;
      const paintedW = ratio === null ? innerW : image.naturalWidth * ratio;
      const paintedH = ratio === null ? innerH : image.naturalHeight * ratio;
      // object-position is a percentage of the remaining free space.
      const containerStyle = getComputedStyle(container);
      const borderX = parseFloat(containerStyle.borderLeftWidth) || 0;
      const borderY = parseFloat(containerStyle.borderTopWidth) || 0;
      const position = computed.objectPosition.trim().split(/\\s+/);
      function fraction(value) {
        if (value === 'left' || value === 'top') return 0;
        if (value === 'right' || value === 'bottom') return 1;
        if (value === 'center') return 0.5;
        if (/%$/.test(value)) return parseFloat(value) / 100;
        return 0.5;
      }
      const px = fraction(position[0] || '50%');
      const py = fraction(position[1] || '50%');
      const x = (img.left - box.left) / sx - borderX + bl + (innerW - paintedW) * px;
      const y = (img.top - box.top) / sy - borderY + bt + (innerH - paintedH) * py;
      layer.style.left = x + 'px';
      layer.style.top = y + 'px';
      layer.style.width = paintedW + 'px';
      layer.style.height = paintedH + 'px';
      // Scale text from the actual painted card width, including old Android
      // WebViews without container-query units (cqw). Avoid viewport-based
      // fallbacks that shift/oversize values in the installed PWA.
      layer.style.setProperty('--card-attribute-font', (paintedW * 0.04) + 'px');
      layer.style.setProperty('--card-energy-font', (paintedW * 0.072) + 'px');
      layer.style.visibility = 'visible';
    }
    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(sync);
    }
    image.addEventListener('load', schedule);
    image.addEventListener('error', () => { layer.style.visibility = 'hidden'; });
    // Card selection changes src before the next image load; prevent stale stats.
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => { layer.style.visibility = 'hidden'; schedule(); })
        .observe(image, { attributes: true, attributeFilter: ['src', 'srcset'] });
    }
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    // Mobile browser chrome and PWA viewport changes may not fire window.resize.
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedule, { passive: true });
      window.visualViewport.addEventListener('scroll', schedule, { passive: true });
    }
    // Web fonts can change layout after the initial card render.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule).catch(() => {});
    }
    if (typeof ResizeObserver !== 'undefined') {
      const resize = new ResizeObserver(schedule);
      resize.observe(image);
      resize.observe(container);
    }
    // A tela de detalhes começa oculta; recalcular quando ela for exibida.
    const screen = document.getElementById('tela-detalhe-carta');
    if (screen && typeof MutationObserver !== 'undefined') {
      new MutationObserver(schedule).observe(screen, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
