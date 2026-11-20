(function () {
  "use strict";
  const ids = ["modal-login", "modal-cadastro"];
  let returnFocus = null;
  const active = () => ids.map(id => document.getElementById(id)).find(el => el.classList.contains("modal-ativo"));
  ids.forEach(id => {
    const dialog = document.getElementById(id);
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("tabindex", "-1");
  });
  document.querySelectorAll("#btn-abrir-login, #btn-abrir-cadastro").forEach(button => {
    button.addEventListener("click", () => {
      returnFocus = button;
      active()?.querySelector("input,button")?.focus();
    });
  });
  function restore() {
    if (!active()) return;
    document.getElementById(active().id === "modal-login" ? "btn-fechar-login" : "btn-fechar-cadastro").click();
    returnFocus?.focus();
    returnFocus = null;
  }
  document.addEventListener("keydown", event => {
    const dialog = active();
    if (!dialog) return;
    if (event.key === "Escape") { event.preventDefault(); restore(); return; }
    if (event.key !== "Tab") return;
    const elements = [...dialog.querySelectorAll("input:not([disabled]),button:not([disabled])")].filter(el => el.getClientRects().length);
    if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  ids.forEach(id => document.getElementById(id).addEventListener("click", event => {
    if (event.target === event.currentTarget) restore();
  }));
  [["usuario","btn-entrar"],["senha","btn-entrar"],["nova-senha","btn-cadastrar"]].forEach(([field,button]) => {
    document.getElementById(field).addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); document.getElementById(button).click(); }
    });
  });
})();