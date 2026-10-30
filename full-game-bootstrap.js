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
    try {const {error}=await ChaoticAuth.getClient().auth.signOut();if(error)throw error;location.replace("login-completo.html");}
    catch(e){inform("Erro ao sair: "+e.message,true);}
  }
  logout.onclick=signOut; retry.onclick=signOut;
  window.addEventListener("chaotic-cloud-error",e=>inform("Sincronização: "+e.detail,true));
  try {
    inform("Conectando conta Supabase...");
    const user=await ChaoticAuth.requireUser();
    if(!user)return;
    window.ChaoticAuthUser=user;
    localStorage.setItem("chaoticUID",user.id);
    if(importer){
      importer.hidden=false;
      importer.onclick=async()=>{
        try{
          const {openLegacyImporter}=await import("./legacy-import.js?v=release-5");
          openLegacyImporter();
        }catch(err){inform("Não foi possível abrir a importação: "+err.message,true);}
      };
    }
    const backup=document.getElementById("btn-exportar-backup");
    if(backup){
      backup.onclick=async()=>{
        const previous=backup.textContent;
        backup.disabled=true;backup.textContent="Preparando backup...";
        try{
          const {downloadPlayerBackup}=await import("./player-backup.js?v=release-5");
          const result=await downloadPlayerBackup();
          status.textContent="Backup exportado ("+result.nodes+" registros). Guarde o arquivo em local seguro.";
        }catch(err){inform("Falha ao exportar backup: "+err.message,true);}
        finally{backup.disabled=false;backup.textContent=previous;}
      };
    } // legado: compatibilidade com entrada-drome
    const bridge=await import("./supabase-game-bridge.js?v=release-5");
    try { await bridge.migratePreviousTest(); }
    catch (e) { console.warn("Importação automática não concluída; dados anteriores preservados:",e); }
    // O jogo completo utiliza rotinas que dependem do antigo Firebase para multiplayer;
    // apenas os dados privados do jogador e decks são migrados nesta etapa.
    await import("./script.js?v=release-5");
    await import("./batalha.js?v=release-5");
    await import("./chaotic-lobby.js?v=release-5");
    inform("Conta conectada. Jogo completo e progresso disponíveis; online em migração.");
  }catch(e){console.error(e);inform("Falha na inicialização: "+e.message,true);}
})();
