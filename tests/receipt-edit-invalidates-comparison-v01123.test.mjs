import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const start=source.indexOf("const reset3x3ReceiptComparison=()");
const end=source.indexOf('$("lobby-3x3-refresh-connection").onclick=',start);
assert.ok(start>=0&&end>start,"receipt handlers found");
const code=source.slice(start,end);
const receipt="Sala R123 · treino 3×3 · RESULTADO DE TREINO CONSISTENTE NO SERVIDOR · vencedor ANFITRIÃO · derrotado CONVIDADO · turno decisivo T7 · nocautes 3/3 (c4:KO · c5:KO · c6:KO). Compare este mesmo resumo no outro celular após Atualizar conexão e turno. Não é certificado de partida em dois aparelhos; XP, moedas e combate oficial não são alterados.";
function harness(){
 const nodes={
  "lobby-3x3-verification-report":{textContent:receipt},
  "lobby-3x3-other-receipt":{value:receipt,oninput:null,onchange:null},
  "lobby-3x3-compare-status":{textContent:"Aguardando",dataset:{}},
  "lobby-3x3-compare-receipts":{onclick:null}
 };
 const compare3x3Receipts=(a,b)=>a===b?"RESUMOS COINCIDEM":"DIVERGÊNCIA entre resumos";
 vm.runInNewContext(code,{$:id=>nodes[id],compare3x3Receipts});
 return {local:nodes["lobby-3x3-verification-report"],
  other:nodes["lobby-3x3-other-receipt"],
  status:nodes["lobby-3x3-compare-status"],
  compare:()=>nodes["lobby-3x3-compare-receipts"].onclick()};
}

test("v0.1.123: comparison captures the exact two receipt snapshots",()=>{
 const f=harness();f.compare();
 assert.equal(f.status.dataset.local,receipt);
 assert.equal(f.status.dataset.peer,receipt);
 assert.match(f.status.textContent,/RESUMOS COINCIDEM/);
});

test("v0.1.123: typing after a match instantly invalidates old success",()=>{
 const f=harness();f.compare();
 f.other.value="Sala de outra partida";f.other.oninput();
 assert.doesNotMatch(f.status.textContent,/RESUMOS COINCIDEM/);
 assert.match(f.status.textContent,/Compare novamente/);
 assert.equal(f.status.dataset.local,undefined);
 assert.equal(f.status.dataset.peer,undefined);
});

test("v0.1.123: replacing the pasted result on Android change event invalidates comparison",()=>{
 const f=harness();f.compare();
 f.other.value=receipt.replace("T7","T8");f.other.onchange();
 assert.match(f.status.textContent,/alterado/);
 assert.equal(f.status.dataset.peer,undefined);
});

test("v0.1.123: clicking compare again uses new receipt and reports divergence",()=>{
 const f=harness();f.compare();
 f.other.value=receipt.replace("vencedor ANFITRIÃO","vencedor CONVIDADO");
 f.other.oninput();f.compare();
 assert.match(f.status.textContent,/DIVERGÊNCIA/);
 assert.equal(f.status.dataset.peer,f.other.value);
 assert.equal(f.status.dataset.local,receipt);
});

test("v0.1.123: editing back to original still requires another explicit compare click",()=>{
 const f=harness();f.compare();
 f.other.value="garbled";f.other.oninput();
 f.other.value=receipt;f.other.oninput();
 assert.doesNotMatch(f.status.textContent,/RESUMOS COINCIDEM/);
 f.compare();
 assert.match(f.status.textContent,/RESUMOS COINCIDEM/);
});

test("v0.1.123: comparison handler cannot write to Supabase or inject pasted HTML",()=>{
 assert.doesNotMatch(code,/\.innerHTML\s*=|\.insert\(|\.update\(|\.delete\(|\.upsert\(|rpc\(|api\./);
 assert.match(code,/\.textContent=result/);
 assert.match(code,/oninput=reset3x3ReceiptComparison/);
 assert.match(code,/onchange=reset3x3ReceiptComparison/);
});

test("v0.1.123: new local server receipt clears an earlier paired confirmation",()=>{
 const a=source.indexOf('const verificationReport=$("lobby-3x3-verification-report")');
 const b=source.indexOf('    $("lobby-3x3-training-attack-locks")',a);
 assert.ok(a>=0&&b>a,"receipt renderer found");
 const snippet=source.slice(a,b);
 const f=harness();f.compare();
 const ctx={
  $:id=>({
    "lobby-3x3-verification-report":f.local,
    "lobby-3x3-compare-status":f.status
  })[id]||null,
  build3x3VerificationReport:()=>receipt.replace("T7","T8"),
  parse3x3Receipt:()=>({turno:8}),room:{mode:"3x3"},
  match:{status:"finished"},trainingOutcomes3x3:[],trainingKnockouts3x3:[]
 };
 vm.runInNewContext(snippet,ctx);
 assert.doesNotMatch(f.status.textContent,/RESUMOS COINCIDEM/);
 assert.match(f.status.textContent,/Resultado local atualizado/);
 assert.equal(f.status.dataset.local,f.local.textContent);
});
