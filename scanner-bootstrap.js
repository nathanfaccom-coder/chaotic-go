(async function () {
  "use strict";
  const status = document.getElementById("cloud-status");
  const alertBox = document.getElementById("cloud-alert");
  const alertText = document.getElementById("cloud-alert-text");
  const logoutRetry = document.getElementById("btn-alert-logout");
  const importButton = document.getElementById("btn-importar-legado");
  const logoutButton = document.getElementById("btn-sair-conta");

  function show(message, kind = "ok") {
    status.textContent = message;
    if (kind === "ok") {
      alertBox.hidden = true;
      logoutRetry.hidden = true;
      return;
    }
    alertBox.hidden = false;
    alertBox.classList.toggle("erro", kind === "error");
    alertText.textContent = message;
    logoutRetry.hidden = kind !== "error";
  }

  async function signOut() {
    logoutButton.disabled = true;
    try {
      await ChaoticState.save(); // Aguarda a última gravação antes de encerrar a sessão.
      const { error } = await ChaoticAuth.getClient().auth.signOut();
      if (error) throw error;
      window.location.replace("login.html");
    } catch (error) {
      show("Não foi possível sair com segurança: " + error.message, "error");
      logoutButton.disabled = false;
    }
  }

  logoutButton.addEventListener("click", signOut);
  logoutRetry.addEventListener("click", async () => {
    try {
      const { error } = await ChaoticAuth.getClient().auth.signOut();
      if (error) throw error;
      window.location.replace("login.html");
    } catch (error) {
      show("Erro ao encerrar sessão: " + error.message, "error");
    }
  });

  window.addEventListener("chaotic-save-error", event => {
    show("Falha ao sincronizar progresso: " + event.detail, "error");
  });

  try {
    show("Conectando ao servidor...", "loading");
    if (!(await ChaoticState.init())) return;

    const legacy = ["chaoticAlbum","chaoticPerfil","chaoticAmigos"]
      .some(key => localStorage.getItem(key) !== null);
    importButton.hidden = !legacy;
    importButton.addEventListener("click", async () => {
      importButton.disabled = true;
      try {
        if (await ChaoticState.importLegacy()) window.location.reload();
      } catch (error) {
        show("Falha na importação: " + error.message, "error");
      } finally {
        importButton.disabled = false;
      }
    });

    const game = document.createElement("script");
    game.src = "script.js";
    game.onload = () => show("Conta conectada — progresso salvo no servidor.");
    game.onerror = () => show("Erro ao carregar o jogo.", "error");
    document.body.appendChild(game);
  } catch (error) {
    show("Falha na conexão: " + error.message + ". O progresso não foi carregado.", "error");
  }
})();
