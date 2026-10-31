import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const paths=[
 "chaotic-lobby.js","index.html","sw.js","scanner-completo.html",
 "login-completo.html","login-auth.js","full-game-bootstrap.js",
 ".github/workflows/verify-publication.yml",
 "supabase/tests/chaotic-preview-3x3-two-player-preflight-live.test.sql",
 "supabase/tests/chaotic-preview-3x3-peer-turn-reconnect-live-v0164.test.sql",
 "supabase/tests/chaotic-preview-3x3-three-knockouts-live-v0163.test.sql"
];
const [drome,index,worker,scanner,login,auth,bootstrap,workflow,ready,reconnect,victory]=
 await Promise.all(paths.map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));

test("v0.1.90: a mobile offline tap never attempts an attack or payment",async()=>{
 const start=drome.indexOf("async function action(fn) {");
 const end=drome.indexOf("  // Guard two fast taps/tabs",start);
 assert.ok(start>0 && end>start,"action source");
 const messages=[],ctx={
  busy:false,navigator:{onLine:false},
  note:(message,error)=>messages.push({message,error}),
  document:{querySelectorAll:()=>[]},
  room:null,match:null,viewGeneration:0
 };
 const act=vm.runInNewContext("("+drome.slice(start,end).trim()+")",ctx);
 let calls=0;
 await act(async()=>{calls++;});
 assert.equal(calls,0);
 assert.equal(ctx.busy,false);
 assert.equal(messages.length,1);
 assert.match(messages[0].message,/Sem conexão/);
 assert.match(messages[0].message,/Nenhuma ação foi enviada nem pontos gastos/);
 ctx.navigator.onLine=true;
 await act(async()=>{calls++;});
 assert.equal(calls,1,"online action runs once, never auto-replays offline tap");
 assert.equal(ctx.busy,false);
});
test("v0.1.90: Android going offline warns and returning online only reads server state",()=>{
 assert.ok(drome.includes('window.addEventListener("offline"'));
 assert.ok(drome.includes('window.addEventListener("online", refreshWhenVisible)'));
 assert.ok(drome.includes("sem reenviar ataques automaticamente"));
 const last=drome.slice(drome.indexOf("function refreshWhenVisible()"),drome.indexOf("window.abrirSalaPrivadaDrome = show"));
 assert.ok(last.includes("refreshRoom()"),"on reconnect the room must be refreshed");
 assert.ok(last.includes("restoreLastRoom(viewGeneration)"),"saved room recovered safely");
 assert.ok(!last.includes("chaotic_settle_preview_3x3_borrowed_105_base("));
 assert.ok(!last.includes("chaotic_pass_turn("));
});
test("v0.1.90: splash/login/scanner/bootstrap/DROME chain links to existing files",()=>{
 assert.ok(index.includes('href="login-completo.html"'));
 for(const src of ["auth-client.js","login-auth.js"])assert.ok(login.includes(src),src);
 assert.ok(auth.includes('window.location.replace("scanner-completo.html")'));
 assert.ok(scanner.includes("full-game-bootstrap.js?v=release-"));
 assert.ok(bootstrap.includes('import("./chaotic-lobby.js?v=release-'));
 assert.ok(drome.includes("window.abrirSalaPrivadaDrome = show"));
 assert.doesNotMatch(index,/acesso rápido offline/i,"online-only login should not promise offline access");
});
test("v0.1.90: public publication checks all real route assets, not only index",()=>{
 for(const asset of [
  "index.html","login-completo.html","scanner-completo.html",
  "full-game-bootstrap.js","supabase-config.js","auth-client.js",
  "login-auth.js","supabase-game-bridge.js",
  "script.js","batalha.js","chaotic-lobby.js","manifest.json",
  "entrada-drome.js"
 ])assert.ok(workflow.includes('"'+asset+'"'),asset);
 for(const marker of [
  'href="login-completo.html"',
  "full-game-bootstrap.js?v=release-",
  "chaotic-lobby.js?v=release-",
  "release_tag=",
  "Service Worker não corresponde",
  "dois celulares"
 ])assert.ok(workflow.includes(marker),marker);
});
test("v0.1.90: live SQL preflight/reconnect/three-knockout fixtures cover both players and roll back",()=>{
 for(const fixture of [ready,reconnect,victory]){
  assert.match(fixture,/\bbegin\s*;/i);
  assert.match(fixture,/\brollback\s*;/i);
  assert.doesNotMatch(fixture,/\bcommit\s*;/i);
 }
 for(const marker of ["Both players failed ready check","Stale peer falsely marked connected","Outsider accessed presence RPC"])
  assert.ok(ready.includes(marker),marker);
 for(const marker of ["False same-turn sync after pass","Disconnected guest reported current","Guest did not recover after reconnect"])
  assert.ok(reconnect.includes(marker),marker);
 for(const marker of ["chaotic_preview_3x3_training_outcomes","training_finished","you_won_training","official_match_ended or experience_awarded or currency_awarded"])
  assert.ok(victory.includes(marker),marker);
});
test("v0.1.90: public splash, cache and scanner bootstrap refer to the same release",()=>{
 const display=index.match(/VERSÃO 0\.1\.(\d+)/);
 const reg=index.match(/sw\.js\?v=release-(\d+)/);
 const cache=worker.match(/chaotic-go-release-\d{8}-(\d+)/);
 const scannerLoader=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const dromeLoader=bootstrap.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(display&&reg&&cache&&scannerLoader&&dromeLoader);
 assert.ok(Number(display[1])>=90);
 for(const match of [reg,cache,scannerLoader,dromeLoader])assert.equal(match[1],display[1]);
});
