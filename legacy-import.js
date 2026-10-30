// Importação voluntária do Firebase antigo. Nunca apaga cartas ou decks atuais.
import {initializeApp, getApps, getApp} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {getAuth, setPersistence, inMemoryPersistence, signInWithEmailAndPassword, signOut} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {getDatabase, ref as oldRef, get as oldGet} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import {mergeAlbum,selectMissingDecks} from "./legacy-merge-core.js?v=release-7";
import * as cloud from "./supabase-game-bridge.js?v=release-7";

const firebaseConfig={
  apiKey:"AIzaSyD9o1B06TShDaO--6-DQsS8abutVXuU_jo",
  authDomain:"chaotic-go.firebaseapp.com",
  databaseURL:"https://chaotic-go-default-rtdb.firebaseio.com",
  projectId:"chaotic-go",storageBucket:"chaotic-go.firebasestorage.app",
  messagingSenderId:"394870191188",
  appId:"1:394870191188:web:5e6040097ec0a4a4d7e9c1"
};
const app=getApps().some(x=>x.name==="chaoticLegacyReadOnly")
  ?getApp("chaoticLegacyReadOnly"):initializeApp(firebaseConfig,"chaoticLegacyReadOnly");
const legacyAuth=getAuth(app), oldDb=getDatabase(app);
let pending=null,loading=false;
const el=id=>document.getElementById(id);
function notice(s,bad=false){
  const x=el("legacy-message");
  if(x){x.textContent=s;x.style.color=bad?"#ff9999":"#bdfdcc";}
}
function path(node){
  const owner=window.ChaoticAuthUser?.id;
  if(!owner)throw Error("Faça login no Supabase antes da migração.");
  return cloud.ref(cloud.db,"jogadores/"+owner+"/"+node);
}
async function current(){
  return {album:(await cloud.get(path("album"))).val(),
          decks:(await cloud.get(path("decks"))).val()};
}
async function preview(){
  if(loading)return;
  loading=true;el("legacy-check").disabled=true;el("legacy-import").hidden=true;
  const email=el("legacy-email").value.trim(),password=el("legacy-password").value;
  el("legacy-password").value="";pending=null;
  try{
    if(!email||!password)throw Error("Informe o e-mail e a senha da conta Firebase antiga.");
    notice("Autenticando com o Firebase original...");
    await setPersistence(legacyAuth,inMemoryPersistence);
    const signed=await signInWithEmailAndPassword(legacyAuth,email,password);
    const uid=signed.user.uid;
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))throw Error("Conta antiga inválida.");
    const old=(await oldGet(oldRef(oldDb,"jogadores/"+uid))).val();
    if(!old || typeof old!=="object")throw Error("Nenhuma coleção encontrada nessa conta antiga.");
    const now=await current(),album=mergeAlbum(now.album,old.album);
    const decks=selectMissingDecks(old.decks,now.decks);
    pending={uid,old:{album:old.album||[],decks:old.decks||{},profile:old.profile||null}};
    notice("Encontrei "+album.legacyCount+" registros antigos: "+album.added+
      " cartas a acrescentar e "+Object.keys(decks.missing).length+
      " decks em slots livres. "+decks.skipped+" decks existentes serão mantidos. Nenhum dado foi alterado.");
    el("legacy-import").hidden=false;
  }catch(err){notice("Falha na verificação: "+(err?.message||String(err)),true);}
  finally{
    try{await signOut(legacyAuth);}catch(_){}
    loading=false;el("legacy-check").disabled=false;
  }
}
async function migrate(){
  if(!pending||loading)return;
  loading=true;el("legacy-import").disabled=true;
  try{
    notice("Salvando cópia da coleção antiga...");
    const {uid,old}=pending,snapshot=path("legacy-snapshots/"+uid);
    if(!(await cloud.get(snapshot)).exists()){
      await cloud.set(snapshot,{album:old.album,decks:old.decks,profile:old.profile,
                                importedAt:new Date().toISOString()});
    }
    const state=await current(),album=mergeAlbum(state.album,old.album);
    const decks=selectMissingDecks(old.decks,state.decks);
    if(album.added)await cloud.set(path("album"),album.cards);
    let saved=0;
    for(const [slot,deck] of Object.entries(decks.missing)){
      const key=path("decks/"+slot);
      if(!(await cloud.get(key)).exists()){await cloud.set(key,deck);saved++;}
    }
    pending=null;el("legacy-import").hidden=true;
    notice("Concluído! "+album.added+" cartas acrescentadas, "+saved+
      " decks copiados. O progresso atual e a cópia antiga foram preservados.");
  }catch(err){
    notice("Importação incompleta: "+(err?.message||String(err))+
       ". Os dados já gravados não foram apagados; você pode repetir.",true);
  }finally{loading=false;el("legacy-import").disabled=false;}
}
export function openLegacyImporter(){
  const profile=el("tela-perfil");
  if(!profile)throw Error("Abra Perfil primeiro.");
  let panel=el("legacy-import-panel");
  if(panel){panel.hidden=false;panel.scrollIntoView({block:"nearest"});return;}
  panel=document.createElement("section");
  panel.id="legacy-import-panel";
  panel.className="conta-perfil legacy-import-panel";
  panel.innerHTML=[
    '<h4>IMPORTAR MINHAS CARTAS ANTIGAS</h4>',
    '<p>Use seu login do Firebase original. Primeiro verificamos a coleção; só importamos depois de sua confirmação.</p>',
    '<label for="legacy-email">E-mail antigo</label>',
    '<input id="legacy-email" type="email" autocomplete="username" placeholder="E-mail da conta antiga">',
    '<label for="legacy-password">Senha do antigo jogo</label>',
    '<input id="legacy-password" type="password" autocomplete="off" placeholder="Senha antiga">',
    '<button id="legacy-check" type="button" class="botao-conta">Verificar coleção</button>',
    '<button id="legacy-import" type="button" class="botao-conta" hidden>Importar sem sobrescrever</button>',
    '<button id="legacy-close" type="button" class="botao-conta botao-conta-sair">Fechar</button>',
    '<p id="legacy-message" role="status" aria-live="polite">Sua senha não será salva ou enviada ao Supabase.</p>'
  ].join("");
  const anchor=el("btn-importar-legado")?.closest(".conta-perfil")||profile;
  anchor.insertAdjacentElement("afterend",panel);
  el("legacy-check").onclick=preview;
  el("legacy-import").onclick=migrate;
  el("legacy-close").onclick=()=>{
    pending=null;el("legacy-password").value="";panel.hidden=true;
  };
  panel.scrollIntoView({block:"nearest"});
}
