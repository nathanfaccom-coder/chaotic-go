import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const paths=[
 "index.html","login.html","login-v2.html","login-completo.html",
 "login-auth.js","auth-client.js","scanner.html","scanner-completo.html",
 "full-game-bootstrap.js","entrada-drome.js","chaotic-lobby.js",
 "style.css","sw.js","manifest.json","script.js"
];
const [index,login,loginV2,loginFull,authLogin,authClient,scanner,scannerFull,
 boot,entrance,lobby,css,worker,manifest,originalScript]=
 await Promise.all(paths.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));

test("stability v0.1.113: sign-in, scanner and private 3x3 routes remain reachable",()=>{
 for(const page of [login,loginV2,loginFull]){
  for(const script of ["supabase-config.js","auth-client.js","login-auth.js"])
   assert.ok(page.includes(script+"?v=release-113"));
  assert.match(page,/style\.css\?v=release-113/);
  assert.match(page,/id="btn-entrar"/);
  assert.match(page,/id="btn-cadastrar"/);
  assert.match(page,/id="btn-recuperar-senha"/);
  assert.doesNotMatch(page,/user-scalable=no|maximum-scale=1/);
 }
 assert.match(index,/href="login-completo\.html"/);
 assert.match(authClient,/window\.ChaoticAuth\s*=/);
 assert.match(authClient,/async function requireUser\(\)/);
 assert.match(authLogin,/auth\.signInWithPassword/);
 assert.match(authLogin,/scanner-completo\.html/);
 assert.match(originalScript,/window\.abrirEntradaDrome\(\)/);
 assert.match(entrance,/window\.abrirSalaPrivadaDrome\s*&&\s*window\.abrirSalaPrivadaDrome\(\)/);
 assert.match(lobby,/window\.abrirSalaPrivadaDrome\s*=\s*show/);
 for(const action of ["lobby-create-btn","lobby-join-btn","lobby-input-code","lobby-room-code"])
  assert.ok(lobby.includes(action),action);
});
test("stability v0.1.113: experimental training is highlighted without disabling legacy modes",()=>{
 assert.match(entrance,/TREINO 3x3 POR CÓDIGO/);
 assert.match(entrance,/Modos oficiais ainda em desenvolvimento/);
 assert.match(entrance,/selecionarTipoJogo\('online'\)/);
 assert.match(entrance,/selecionarTipoJogo\('amigo'\)/);
 assert.match(lobby,/<option value="3x3" selected>3x3 Rápido \(treino\)<\/option>/);
 assert.match(lobby,/<option value="1x1">1x1 Duelo \(teste\)<\/option>/);
 assert.match(lobby,/<option value="6x6">6x6 Principal \(teste\)<\/option>/);
 assert.match(lobby,/não há recompensas oficiais nem troca de cartas/);
 assert.match(lobby,/navigator\.onLine === false/);
 assert.match(lobby,/Nenhuma ação foi enviada nem pontos gastos/);
});
test("stability v0.1.113: scanner retry reloads without logging out (runtime test)",async()=>{
 let reloads=0,signOuts=0,redirects=[];
 const ids=["cloud-status","cloud-alert","cloud-alert-text","btn-alert-logout",
   "btn-sair-conta","btn-importar-legado"];
 const nodes=new Map(ids.map(id=>[id,{textContent:"",hidden:false,onclick:null,
   classList:{toggle(){}},disabled:false}]));
 const fakeLocation={reload(){reloads++;},replace(path){redirects.push(path);}};
 const window={location:fakeLocation,addEventListener(){}};
 const context={document:{getElementById(id){return nodes.get(id)||null;}},
  window,location:fakeLocation,console,
  ChaoticAuth:{
   requireUser:async()=>null,
   getClient:()=>({auth:{signOut:async()=>{signOuts++;return {error:null};}}})
  }};
 vm.runInNewContext(boot,context,{filename:"full-game-bootstrap.js"});
 await new Promise(resolve=>setImmediate(resolve));
 const retry=nodes.get("btn-alert-logout");
 assert.equal(typeof retry.onclick,"function");
 retry.onclick();
 assert.equal(reloads,1);
 assert.equal(signOuts,0);
 assert.deepEqual(redirects,[]);
 // Explicit user action "Sair" remains independent.
 await nodes.get("btn-sair-conta").onclick();
 assert.equal(signOuts,1);
 assert.deepEqual(redirects,["login-completo.html"]);
});
test("stability v0.1.113: login actually signs in and redirects using the mounted client",async()=>{
 const ids=["auth-feedback","modal-login","modal-cadastro","btn-abrir-login",
 "btn-abrir-cadastro","btn-fechar-login","btn-fechar-cadastro","btn-entrar",
 "usuario","senha","novo-email","novo-usuario","nova-senha","btn-cadastrar",
 "btn-recuperar-senha"];
 const nodes=new Map(ids.map(id=>[id,{onclick:null,className:"",
  value:"",textContent:""}]));
 let args,redirects=[];
 const context={
  document:{getElementById(id){return nodes.get(id)||null;}},
  location:{replace(href){redirects.push(href)}},
  window:{location:{replace(href){redirects.push(href)}}},
  ChaoticAuth:{
   currentUser:async()=>null,
   getClient:()=>({auth:{
    signInWithPassword:async options=>{args=options;return {error:null}},
    signUp:async()=>({data:{session:null},error:null}),
    resetPasswordForEmail:async()=>({error:null})
   }})
  }};
 vm.runInNewContext(authLogin,context,{filename:"login-auth.js"});
 nodes.get("usuario").value=" Player@Example.Com ";
 nodes.get("senha").value="strong-password";
 await nodes.get("btn-entrar").onclick();
 assert.equal(args.email,"player@example.com");
 assert.equal(args.password,"strong-password");
 assert.deepEqual(redirects,["scanner-completo.html"]);
});
test("stability v0.1.113: mobile room scrolls, input taps work and zoom isn't disabled",()=>{
 assert.match(css,/#tela-entrada-drome\s*\{[^}]*overflow-y:\s*auto/s);
 assert.match(css,/#tela-entrada-drome\s*\{[^}]*touch-action:\s*pan-y/s);
 assert.match(css,/#tela-entrada-drome \.lobby-test button,[\s\S]*min-height:\s*44px/);
 assert.match(css,/#btn-alert-logout\s*\{[^}]*min-height:\s*44px/s);
 for(const page of [index,scanner,scannerFull,login,loginFull,loginV2])
  assert.doesNotMatch(page,/user-scalable=no|maximum-scale=1/);
});
test("stability v0.1.113: authenticated JS and all core loaders refresh together",()=>{
 for(const page of [scanner,scannerFull]){
  for(const script of [
   "cartas.js","efeitos.js","entrada-drome.js","supabase-config.js",
   "auth-client.js","full-game-bootstrap.js"
  ])assert.ok(page.includes(script+"?v=release-113"),script);
  assert.ok(page.includes('id="btn-alert-logout" type="button" hidden>Tentar conexão novamente'));
  assert.ok(page.includes("style.css?v=release-113"));
 }
 for(const module of [
  "legacy-import.js","player-backup.js","supabase-game-bridge.js",
  "script.js","batalha.js","chaotic-lobby.js"
 ])assert.ok(boot.includes("./"+module+"?v=release-113"),module);
 assert.ok(index.includes("VERSÃO 0.1.113"));
 assert.match(index,/sw\.js\?v=release-113/);
 assert.match(worker,/chaotic-go-release-20261101-113/);
 assert.match(worker,/request\.mode==='navigate'/);
 assert.match(worker,/\(\?:js\|html\)/);
 assert.match(index,/login e as partidas precisam de internet|acesso rápido no celular/i);
 assert.equal(JSON.parse(manifest).start_url,"index.html");
});
