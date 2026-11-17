/* Optional scanner map night mode; affects map tiles only, never markers or game state. */
(() => {
  'use strict';
  const KEY = 'chaotic-go-scanner-night-mode';
  const style = document.createElement('style');
  style.textContent = `
    #scanner-theme-toggle { display:none !important; }
    .scanner-theme-toggle[aria-pressed="true"] { box-shadow:0 0 8px #53c961; }
    .scanner-theme-toggle .theme-icon { font-size:25px; line-height:1; }
    .scanner-theme-toggle .theme-label { display:none; }
    #meu-mapa.scanner-map-night .leaflet-tile-pane { filter:invert(1) hue-rotate(180deg) brightness(.78) contrast(1.1) saturate(.65); }
      `;
  document.head.appendChild(style);
  const setup = () => {
    const map = document.getElementById('meu-mapa');
    if (!map) return;
    // Remove the obsolete control next to the directional pad, if present.
    document.getElementById('scanner-theme-toggle')?.remove();
    const mapButton = document.getElementById("scanner-map-theme-toggle");
    // Keep the sole theme control inside the Leaflet map, above its panes.
    if (mapButton && mapButton.parentElement !== map) map.appendChild(mapButton);
    if (mapButton) {
      mapButton.style.cssText = 'position:absolute;top:12px;right:12px;z-index:2000;display:flex;align-items:center;justify-content:center;background:#151515;color:#fff;border:2px solid #4caf50;border-radius:10px;min-height:44px;min-width:82px;padding:7px;font-weight:bold;cursor:pointer;pointer-events:auto';
      if (window.L) {
        L.DomEvent.disableClickPropagation(mapButton);
        L.DomEvent.disableScrollPropagation(mapButton);
      }
    }
    const apply = (enabled) => {
      map.classList.toggle('scanner-map-night', enabled);
      map.closest('#tela-mapa')?.classList.toggle('scanner-map-night', enabled);
      if (mapButton) { mapButton.setAttribute('aria-pressed', String(enabled)); mapButton.textContent = enabled ? '☀️ Dia' : '🌙 Noite'; }
    };
    let enabled = false;
    try { enabled = localStorage.getItem(KEY) === 'true'; } catch (_) {}
    apply(enabled);
    const toggle = () => {
      enabled = !enabled;
      apply(enabled);
      try { localStorage.setItem(KEY, String(enabled)); } catch (_) {}
    };
    if (mapButton) {
      // Reinitializing the scanner must not register another click handler.
      if (mapButton.__chaoticThemeToggle) mapButton.removeEventListener('click', mapButton.__chaoticThemeToggle);
      mapButton.__chaoticThemeToggle = toggle;
      mapButton.addEventListener('click', toggle);
    }

  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once:true});
  else setup();
})();
