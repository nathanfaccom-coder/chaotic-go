(async () => {
  const status=document.getElementById("cloud-status");
  const alertBox=document.getElementById("cloud-alert");
  const alertText=document.getElementById("cloud-alert-text");
  const retry=document.getElementById("btn-alert-logout");
  const logout=document.getElementById("btn-sair-conta");
  const importer=document.getElementById("btn-importar-legado");
  function inform(msg,error=false) {
    status.textContent=msg;
    alertBox.hidden=!error;
    alertBox.classList.toggle("erro",error);
    alertText.textContent=msg;
    retry.hidden=!error;
  }
  async function signOut() {
    try {const {error}=await ChaoticAuth.getClient().auth.signOut();if(error)throw error;location.replace("login-v2.html");}
    catch(e){inform("Erro ao sair: "+e.message,true);}
  }
  logout.onclick=signOut; retry.onclick=signOut;
  window.addEventListener("chaotic-cloud-error",e=>inform("Sincronização: "+e.detail,true));
  try {
    inform("Conectando conta Supabase...");
    const user=await ChaoticAuth.requireUser();
    if(!user)return;
    window.ChaoticAuthUser=user;
    localStorage.setItem("chaoticUID",user.id); // legado: compatibilidade com entrada-drome
    const bridge=await import("./supabase-game-bridge.js");
    await bridge.migratePreviousTest();
    // O jogo completo utiliza rotinas que dependem do antigo Firebase para multiplayer;
    // apenas os dados privados do jogador e decks são migrados nesta etapa.
    importer.hidden=true;
    await import("./script.js");
    await import("./batalha.js");
    inform("Conta conectada. Decks e coleção sincronizados.");
  }catch(e){console.error(e);inform("Falha na inicialização: "+e.message,true);}
})();
