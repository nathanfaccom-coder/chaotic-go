import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const a=source.indexOf("    // Manual, local-only acceptance log.");
const b=source.indexOf('    $("lobby-3x3-refresh-connection").onclick=',a);
assert.ok(a>0&&b>a,"manual acceptance handlers present");
const code=source.slice(a,b);
const ids=["same-room","offline","resume","defense","knockouts","integrity"];
const receipt="Sala TEST · treino 3×3 · RESULTADO DE TREINO CONSISTENTE NO SERVIDOR · vencedor ANFITRIÃO · derrotado CONVIDADO · turno decisivo T9 · nocautes 3/3 (c4:KO · c5:KO · c6:KO). Compare este mesmo resumo no outro celular após Atualizar conexão e turno. Não é certificado de partida em dois aparelhos; XP, moedas e combate oficial não são alterados.";
function setup(){
 const state={room:{mode:"3x3",code:"TEST"}};
 const nodes={
  "lobby-3x3-acceptance-panel":{dataset:{}},
  "lobby-3x3-acceptance-progress":{textContent:""},
  "lobby-3x3-acceptance-output":{value:""},
  "lobby-3x3-acceptance-export":{onclick:null},
  "lobby-3x3-verification-report":{textContent:receipt},
  "lobby-3x3-other-receipt":{value:receipt},
  "lobby-3x3-compare-status":{textContent:"RESUMOS COINCIDEM: teste",dataset:{local:receipt,peer:receipt}}
 };
 for(const id of ids)nodes["lobby-3x3-accept-"+id]={checked:false,onchange:null};
 const notes=[];
 const $=id=>nodes[id]||null;
 // Re-evaluate handlers with a mutable room via shared wrapper parameter.
 const fn=vm.runInNewContext("(function($,room,note,parse3x3Receipt){"+
 code+";return {export:()=>exportAcceptance3x3.onclick(),refresh:updateAcceptanceProgress3x3};})");
 let ops=fn($,state.room,(message)=>notes.push(message),s=>s.includes("RESULTADO DE TREINO")?{}:null);
 return {state,nodes,notes,ids,ops,resetRoom(code){
  state.room.code=code;
 },rebind(){
  ops=fn($,state.room,(message)=>notes.push(message),s=>s.includes("RESULTADO DE TREINO")?{}:null);
  this.ops=ops;
 }};
}
test("v0.1.125: six physical acceptance conditions appear as touch controls",()=>{
 for(const id of ids)assert.match(source,new RegExp('id="lobby-3x3-accept-'+id+'"'));
 assert.match(source,/lobby-3x3-acceptance-output" readonly/);
 assert.match(source,/details id="lobby-3x3-acceptance-panel"/);
});
test("v0.1.125: unchecked steps generate an honest pending report",()=>{
 const h=setup();h.ops.export();
 const text=h.nodes["lobby-3x3-acceptance-output"].value;
 assert.match(text,/Itens relatados manualmente: 0\/6/);
 assert.match(text,/NÃO HOMOLOGAÇÃO/);
 assert.match(text,/não autoriza recompensa|não autoriza recompensa|autoriza recompensa|autoriza recompensa/i);
 assert.match(text,/NÃO comprovam dois aparelhos/);
});
test("v0.1.125: checking one step updates count and clears stale export",()=>{
 const h=setup();h.ops.export();
 const box=h.nodes["lobby-3x3-accept-offline"];
 box.checked=true;box.onchange();
 assert.match(h.nodes["lobby-3x3-acceptance-progress"].textContent,/1\/6/);
 assert.equal(h.nodes["lobby-3x3-acceptance-output"].value,"");
});
test("v0.1.125: a different room resets the previous manual checkmarks",()=>{
 const h=setup();const box=h.nodes["lobby-3x3-accept-offline"];
 box.checked=true;box.onchange();
 h.resetRoom("OTHER");
 h.ops.export();
 assert.equal(box.checked,false);
 assert.match(h.nodes["lobby-3x3-acceptance-output"].value,/Sala: OTHER/);
 assert.match(h.nodes["lobby-3x3-acceptance-output"].value,/0\/6/);
});
test("v0.1.125: changed pasted receipt cannot claim current coincidence",()=>{
 const h=setup();h.nodes["lobby-3x3-other-receipt"].value="different";
 h.ops.export();
 assert.match(h.nodes["lobby-3x3-acceptance-output"].value,/sem comparação válida e atual/);
});
test("v0.1.125: report displays manual marks, not tokens or server identifiers",()=>{
 const h=setup();h.ids.forEach(id=>{
  h.nodes["lobby-3x3-accept-"+id].checked=true;
 });
 h.ops.export();
 const report=h.nodes["lobby-3x3-acceptance-output"].value;
 assert.match(report,/6\/6/);
 assert.match(report,/REGISTRO MANUAL, NÃO HOMOLOGAÇÃO/);
 assert.doesNotMatch(code,/rpc\(|\.insert\(|\.upsert\(|\.update\(|\.delete\(|innerHTML/);
});
