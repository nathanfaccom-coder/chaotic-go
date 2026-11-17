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
  let boundMap = null;
  let applyCurrentTheme = null;
  const readPreference = () => {
    try { return localStorage.getItem(KEY) === 'true'; } catch (_) { return false; }
  };
  const setup = () => {
    const map = document.getElementById('meu-mapa');
    if (!map) return;
    boundMap = map;
    // Remove the obsolete control next to the directional pad, if present.
    document.getElementById('scanner-theme-toggle')?.remove();
    let mapButton = document.getElementById("scanner-map-theme-toggle");
    // Some legacy scanner layouts omit the map control: create it inside the map.
    if (!mapButton) {
      mapButton = document.createElement("button");
      mapButton.id = "scanner-map-theme-toggle";
      mapButton.type = "button";
      mapButton.className = "scanner-theme-toggle";
      mapButton.setAttribute("aria-label", "Alternar modo dia e noite do mapa");
      map.appendChild(mapButton);
    }
    // Keep the sole theme control inside the Leaflet map, above its panes.
    if (mapButton && mapButton.parentElement !== map) map.appendChild(mapButton);
    if (mapButton) {
      mapButton.style.cssText = 'position:absolute;top:12px;right:12px;z-index:2000;display:flex;align-items:center;justify-content:center;background:#151515;color:#fff;border:2px solid #4caf50;border-radius:10px;min-height:44px;min-width:82px;padding:7px;font-weight:bold;cursor:pointer;pointer-events:auto';
      // The map can initialize after this module; native event guards work
      // regardless of when Leaflet becomes available.
      if (!mapButton.__chaoticMapEventGuards) {
        const stop = (event) => event.stopPropagation();
        for (const type of ['click', 'dblclick', 'mousedown', 'touchstart', 'pointerdown', 'wheel']) {
          mapButton.addEventListener(type, stop, { passive: true });
        }
        mapButton.__chaoticMapEventGuards = true;
      }
    }
    const apply = (enabled) => {
      map.classList.toggle('scanner-map-night', enabled);
      map.closest('#tela-mapa')?.classList.toggle('scanner-map-night', enabled);
      if (mapButton) { mapButton.setAttribute('aria-pressed', String(enabled)); mapButton.textContent = enabled ? '☀️ Dia' : '🌙 Noite'; }
    };
    let enabled = readPreference();
    apply(enabled);
    // A single active callback always targets the current map after navigation.
    applyCurrentTheme = (next) => { enabled = next; apply(enabled); };
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
  const start = () => {
    setup();
    // Keep the installed app in sync if the preference changes in another tab.
    window.addEventListener('storage', (event) => {
      if (event.key === KEY && applyCurrentTheme) applyCurrentTheme(readPreference());
    });
    // Some mobile scanner flows replace the map node after initialization.
    // Rebind only when the node/control changes; never reset on tile updates.
    if (typeof MutationObserver !== 'undefined' && document.body) {
      const observer = new MutationObserver(() => {
        const map = document.getElementById('meu-mapa');
        if (map && (map !== boundMap ||
          !map.contains(document.getElementById('scanner-map-theme-toggle')))) setup();
      });
      observer.observe(document.body, {childList:true,subtree:true});
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
