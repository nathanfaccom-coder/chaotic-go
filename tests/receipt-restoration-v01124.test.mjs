import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const a=source.indexOf('const verificationReport=$("lobby-3x3-verification-report")');
const b=source.indexOf('    $("lobby-3x3-training-attack-locks")',a);
const c=source.indexOf('const reset3x3ReceiptComparison=()');
const d=source.indexOf('$("lobby-3x3-refresh-connection").onclick=',c);
assert.ok(a>=0&&b>a&&c>0&&d>c);
const renderer=source.slice(a,b),handlers=source.slice(c,d);
const receipt="Sala R124 · treino 3×3 · RESULTADO DE TREINO CONSISTENTE NO SERVIDOR · vencedor ANFITRIÃO · derrotado CONVIDADO · turno decisivo T7 · nocautes 3/3 (c4:KO · c5:KO · c6:KO). Compare este mesmo resumo no outro celular após Atualizar conexão e turno. Não é certificado de partida em dois aparelhos; XP, moedas e combate oficial não são alterados.";
function harness(){
 const nodes={
  "lobby-3x3-verification-report":{textContent:""},
  "lobby-3x3-other-receipt":{value:receipt,oninput:null,onchange:null,onfocus:null},
  "lobby-3x3-compare-status":{textContent:"",dataset:{}},
  "lobby-3x3-compare-receipts":{onclick:null}
 };
 const $=id=>nodes[id]||null,state={value:receipt};
 vm.runInNewContext(handlers,{$,compare3x3Receipts:(a,b)=>a===b?"RESUMOS COINCIDEM":"DIVERGÊNCIA"});
 const render=()=>vm.runInNewContext(renderer,{
  $,build3x3VerificationReport:()=>state.value,parse3x3Receipt:()=>({}),
  room:{mode:"3x3"},match:{status:"finished"},trainingOutcomes3x3:[],trainingKnockouts3x3:[]
 });
 render();
 return {status:nodes["lobby-3x3-compare-status"],peer:nodes["lobby-3x3-other-receipt"],
  local:nodes["lobby-3x3-verification-report"],
  compare:()=>nodes["lobby-3x3-compare-receipts"].onclick(),render,
  setLocal:value=>state.value=value};
}
test("v0.1.124: unchanged refresh preserves a valid comparison",()=>{
 const h=harness();h.compare();h.render();
 assert.match(h.status.textContent,/RESUMOS COINCIDEM/);
});
test("v0.1.124: silent Android replacement invalidates stale success",()=>{
 const h=harness();h.compare();h.peer.value=receipt.replace("T7","T8");h.render();
 assert.match(h.status.textContent,/alterado ou restaurado/);
 assert.equal(h.status.dataset.peer,undefined);
 assert.doesNotMatch(h.status.textContent,/RESUMOS COINCIDEM/);
});
test("v0.1.124: focus detects silent restoration before server refresh",()=>{
 const h=harness();h.compare();h.peer.value="outro";h.peer.onfocus();
 assert.match(h.status.textContent,/Compare novamente/);
 assert.equal(h.status.dataset.peer,undefined);
});
test("v0.1.124: same-value focus does not invalidate comparison",()=>{
 const h=harness();h.compare();h.peer.onfocus();
 assert.match(h.status.textContent,/RESUMOS COINCIDEM/);
});
test("v0.1.124: new server receipt erases peer snapshot",()=>{
 const h=harness();h.compare();h.setLocal(receipt.replace("T7","T9"));h.render();
 assert.match(h.status.textContent,/Resultado local atualizado/);
 assert.equal(h.status.dataset.peer,undefined);
 assert.equal(h.status.dataset.local,h.local.textContent);
});
test("v0.1.124: explicit re-comparison needed after silent change",()=>{
 const h=harness();h.compare();h.peer.value="outro";h.render();
 assert.doesNotMatch(h.status.textContent,/RESUMOS COINCIDEM/);
 h.compare();assert.match(h.status.textContent,/DIVERGÊNCIA/);
 h.peer.value=receipt;h.peer.oninput();h.compare();
 assert.match(h.status.textContent,/RESUMOS COINCIDEM/);
});
test("v0.1.124: UI guard does not make database writes",()=>{
 assert.doesNotMatch(renderer,/\.innerHTML\s*=|\.insert\(|\.upsert\(|\.delete\(|\.update\(|rpc\(/);
 assert.match(renderer,/delete compareStatus\.dataset\.peer/);
});
