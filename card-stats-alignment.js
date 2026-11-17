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
      if (!image.getClientRects().length || !container.getClientRects().length) return;
      // As coordenadas precisam estar no MESMO espaço CSS do overlay.
      // getBoundingClientRect mede pixels após zoom/transform e causava
      // deslocamento duplo em navegadores e WebViews com escala diferente.
      if (image.offsetParent === container) {
        if (image.offsetWidth <= 0 || image.offsetHeight <= 0) return;
        layer.style.left = image.offsetLeft + 'px';
        layer.style.top = image.offsetTop + 'px';
        layer.style.width = image.offsetWidth + 'px';
        layer.style.height = image.offsetHeight + 'px';
      } else {
        // Fallback para alterações futuras no layout do scanner.
        const img = image.getBoundingClientRect();
        const box = container.getBoundingClientRect();
        if (img.width <= 0 || img.height <= 0) return;
        const scaleX = box.width / (container.offsetWidth || box.width);
        const scaleY = box.height / (container.offsetHeight || box.height);
        layer.style.left = ((img.left - box.left) / (scaleX || 1)) + 'px';
        layer.style.top = ((img.top - box.top) / (scaleY || 1)) + 'px';
        layer.style.width = (img.width / (scaleX || 1)) + 'px';
        layer.style.height = (img.height / (scaleY || 1)) + 'px';
      }
    }
    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(sync);
    }
    image.addEventListener('load', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
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
