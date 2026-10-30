(async function () {
  "use strict";
  const status=document.getElementById("cloud-status");
  const show=message=>{status.textContent=message;};
  window.addEventListener("chaotic-save-error",event=>show("Erro ao salvar no servidor: "+event.detail));
  document.getElementById("btn-sair-conta").onclick=async()=>{await ChaoticAuth.getClient().auth.signOut();location.replace("login.html");};
  try {
    show("Conectando ao servidor...");
    if(!(await ChaoticState.init()))return;
    const legacy=["chaoticAlbum","chaoticPerfil","chaoticAmigos"].some(key=>localStorage.getItem(key));
    const imp=document.getElementById("btn-importar-legado");
    imp.style.display=legacy?"block":"none";
    imp.onclick=async()=>{try {if(await ChaoticState.importLegacy())location.reload();}catch(e){show("Erro na importação: "+e.message);}};
    const code=document.createElement("script");
    code.src="script.js";
    code.onload=()=>show("Conta conectada — progresso salvo no servidor.");
    code.onerror=()=>show("Erro ao carregar o jogo.");
    document.body.appendChild(code);
  }catch(e){
    show("Erro de conexão: "+e.message+". O progresso não foi carregado para evitar substituição acidental.");
  }
})();