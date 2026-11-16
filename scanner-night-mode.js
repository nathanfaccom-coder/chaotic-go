/* Optional scanner map night mode; affects map tiles only, never markers or game state. */
(() => {
  'use strict';
  const KEY = 'chaotic-go-scanner-night-mode';
  const style = document.createElement('style');
  style.textContent = `
    #painel-botoes-fisicos { position: relative; width: 140px; max-width: calc(100vw - 90px); box-sizing: border-box; padding-right: 8px; overflow: visible; }
    .scanner-theme-toggle { position:absolute; right:-54px; top:50%; transform:translateY(-50%); display:flex; align-items:center; justify-content:center; width:44px; height:44px; min-width:44px; min-height:44px; padding:0; border:1px solid #55bc62; border-radius:12px; background:#190b0b; color:white; cursor:pointer; z-index:3; }
    .scanner-theme-toggle[aria-pressed="true"] { box-shadow:0 0 8px #53c961; }
    .scanner-theme-toggle .theme-icon { font-size:25px; line-height:1; }
    .scanner-theme-toggle .theme-label { display:none; }
    #tela-mapa.scanner-map-night .leaflet-tile-pane, #meu-mapa.scanner-map-night .leaflet-tile-pane { filter:invert(1) hue-rotate(180deg) brightness(.78) contrast(1.1) saturate(.65); }
      `;
  document.head.appendChild(style);
  const setup = () => {
    const panel = document.getElementById('painel-botoes-fisicos');
    const map = document.getElementById('meu-mapa');
    if (!panel || !map) return;
    const button = document.getElementById('scanner-theme-toggle') || document.createElement('button');
    button.type = 'button';
    button.id = 'scanner-theme-toggle';
    button.className = 'scanner-theme-toggle';
    button.setAttribute('aria-label','Alternar modo noturno do mapa');
    button.innerHTML = '<span class="theme-icon" aria-hidden="true">☾</span><span class="theme-label">Noite</span>';
    const mapButton = document.getElementById("scanner-map-theme-toggle");
    const apply = (enabled) => {
      map.classList.toggle('scanner-map-night', enabled);
      map.closest('#tela-mapa')?.classList.toggle('scanner-map-night', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      button.querySelector('.theme-label').textContent = enabled ? 'Dia' : 'Noite';
      button.querySelector('.theme-icon').textContent = enabled ? '☀' : '☾';
      button.title = enabled ? 'Ativar mapa claro' : 'Ativar mapa noturno';
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
    button.addEventListener('click', toggle);
    if (mapButton) mapButton.addEventListener('click', toggle);
    if (!button.isConnected) panel.appendChild(button);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once:true});
  else setup();
})();
