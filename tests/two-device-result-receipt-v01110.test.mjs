import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const start=source.indexOf("function build3x3VerificationReport(");
const end=source.indexOf("function update3x3UI()",start);
assert.ok(start>=0&&end>start,"3x3 two-device receipt helper boundaries");
const report=vm.runInNewContext("("+source.slice(start,end).trim()+")");
const room={id:"room-A",code:"ABCD1234",mode:"3x3",host_id:"host",guest_id:"guest"};
const outcome={
 winner_id:"host",defeated_id:"guest",decided_turn:12,defeated_team_size:3,
 official_match_ended:false,experience_awarded:0,currency_awarded:0
};
const ko=(slot,more={})=>({
 defender_id:"guest",defender_slot:slot,turn_no:slot+4,
 hp_after:0,training_only:true,official_match_modified:false,...more
});
const state=(overrides={})=>({
 room,match:{turn_no:12},outcomes:[outcome],
 knockouts:[ko(4),ko(5),ko(6)],...overrides
});

test("v0.1.110: canonical 3x3 server outcome produces a comparable receipt",()=>{
 const out=report(state());
 for(const value of ["ABCD1234","RESULTADO DE TREINO CONSISTENTE","ANFITRIÃO","CONVIDADO","T12","3/3","c4:KO","c5:KO","c6:KO","Não é certificado"])
  assert.ok(out.includes(value),value);
});
test("v0.1.110: same server data produces exactly the same text for both members",()=>{
 const host=report(state({userId:"host"}));
 const guest=report(state({userId:"guest"}));
 assert.equal(host,guest);
 assert.doesNotMatch(host,/Sua equipe|Equipe adversária/);
});
test("v0.1.110: duplicate KO in two attack sources does not count as third creature",()=>{
 const out=report(state({knockouts:[ko(4),ko(4,{borrowed_attack:true}),ko(5)]}));
 assert.match(out,/NÃO CONFERIDO/);
 assert.match(out,/nocautes 2\/3/);
 assert.match(out,/c6:PENDENTE/);
});
test("v0.1.110: mixed original and borrowed attack knockouts count only after validated training HP zero",()=>{
 const out=report(state({knockouts:[ko(4),ko(5,{borrowed_attack:true}),ko(6)]}));
 assert.match(out,/CONSISTENTE/);
 const bad=report(state({knockouts:[ko(4),ko(5,{borrowed_attack:true,hp_after:1}),ko(6)]}));
 assert.match(bad,/NÃO CONFERIDO/);
});
test("v0.1.110: never certify an outcome with official rewards or official combat mutations",()=>{
 for(const changed of [
  {official_match_ended:true},{experience_awarded:10},{currency_awarded:1},{defeated_team_size:2}
 ]){
  const out=report(state({outcomes:[{...outcome,...changed}]}));
  assert.match(out,/NÃO CONFERIDO/,JSON.stringify(changed));
 }
 const changedKo=report(state({knockouts:[ko(4),ko(5),ko(6,{official_match_modified:true})]}));
 assert.match(changedKo,/NÃO CONFERIDO/);
});
test("v0.1.110: winner and defeated must be distinct actual members of this room",()=>{
 for(const changed of [
  {winner_id:"intruder"},{defeated_id:"intruder"},{winner_id:"guest"}
 ]){
  const out=report(state({outcomes:[{...outcome,...changed}]}));
  assert.match(out,/NÃO CONFERIDO/);
 }
});
test("v0.1.110: a KO after the decided turn must not be considered evidence",()=>{
 const out=report(state({knockouts:[ko(4),ko(5),ko(6,{turn_no:13})]}));
 assert.match(out,/NÃO CONFERIDO/);
 assert.match(out,/nocautes 2\/3/);
});
test("v0.1.110: no final result reports evidence as partial, never as victory",()=>{
 const out=report(state({outcomes:[],knockouts:[ko(4),ko(5)]}));
 assert.match(out,/SEM RESULTADO FINAL/);
 assert.match(out,/Nocautes distintos consultados: 2/);
 assert.doesNotMatch(out,/CONSISTENTE/);
});
test("v0.1.110: receipt is absent outside 3x3 and gracefully tolerates empty rows",()=>{
 assert.equal(report(state({room:{...room,mode:"1x1"}})),"");
 assert.match(report(state({outcomes:null,knockouts:null})),/SEM RESULTADO FINAL/);
});
test("v0.1.110: copy control is user initiated, client-side and cannot replay combat",()=>{
 assert.match(source,/id="lobby-3x3-verification-report"/);
 assert.match(source,/id="lobby-3x3-copy-verification"/);
 const b=source.indexOf('$("lobby-3x3-copy-verification").onclick=');
 const e=source.indexOf('$("lobby-3x3-refresh-connection").onclick=',b);
 assert.ok(b>=0&&e>b);
 const copyHandler=source.slice(b,e);
 assert.match(copyHandler,/navigator\.clipboard\.writeText\(report\)/);
 assert.doesNotMatch(copyHandler,/rpc\(|chaotic_(?:pass|spend|attack|prepare)/);
});
