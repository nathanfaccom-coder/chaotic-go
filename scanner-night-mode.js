/* Optional scanner map night mode; affects map tiles only, never markers or game state. */
(() => {
  'use strict';
  const KEY = 'chaotic-go-scanner-night-mode';
  const style = document.createElement('style');
  style.textContent = `
    #painel-botoes-fisicos { position: relative; width: 235px; max-width: calc(100vw - 56px); box-sizing: border-box; padding-right: 78px; }
    .scanner-theme-toggle { position:absolute; right:7px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-width:64px; min-height:58px; padding:5px; border:1px solid #55bc62; border-radius:10px; background:#190b0b; color:white; font:600 10px system-ui,sans-serif; cursor:pointer; z-index:3; }
    .scanner-theme-toggle[aria-pressed="true"] { box-shadow:0 0 8px #53c961; }
    .scanner-theme-toggle .theme-icon { font-size:20px; }
    #meu-mapa.scanner-map-night .leaflet-tile-pane { filter:invert(1) hue-rotate(180deg) brightness(.78) contrast(1.1) saturate(.65); }
    @media(max-width:420px) { #painel-botoes-fisicos { width: 218px; padding-right: 65px; } .scanner-theme-toggle { right:5px; min-width:53px; width:53px; font-size:9px; } }
  `;
  document.head.appendChild(style);
  const setup = () => {
    const panel = document.getElementById('painel-botoes-fisicos');
    const map = document.getElementById('meu-mapa');
    if (!panel || !map || document.getElementById('scanner-theme-toggle')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'scanner-theme-toggle';
    button.className = 'scanner-theme-toggle';
    button.setAttribute('aria-label','Alternar modo noturno do mapa');
    button.innerHTML = '<span class="theme-icon" aria-hidden="true">☾</span><span class="theme-label">Noite</span>';
    const apply = (enabled) => {
      map.classList.toggle('scanner-map-night', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      button.querySelector('.theme-label').textContent = enabled ? 'Dia' : 'Noite';
      button.title = enabled ? 'Ativar mapa claro' : 'Ativar mapa noturno';
    };
    let enabled = false;
    try { enabled = localStorage.getItem(KEY) === 'true'; } catch (_) {}
    apply(enabled);
    button.addEventListener('click', () => {
      enabled = !enabled;
      apply(enabled);
      try { localStorage.setItem(KEY, String(enabled)); } catch (_) {}
    });
    panel.appendChild(button);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once:true});
  else setup();
})();
