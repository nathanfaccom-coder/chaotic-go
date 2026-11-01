import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const a=source.indexOf("function parse3x3Receipt(");
const b=source.indexOf("function update3x3UI()",a);
const builderStart=source.indexOf("function build3x3VerificationReport(");
assert.ok(a>0&&b>a&&builderStart>0,"comparison and report functions must exist");
const ctx={};
vm.runInNewContext(source.slice(a,b).trim(),ctx);
const buildEnd=source.indexOf("function parse3x3Receipt(",builderStart);
const build=vm.runInNewContext("("+source.slice(builderStart,buildEnd).trim()+")",{});
const room={mode:"3x3",code:"DM1234",host_id:"host",guest_id:"guest"};
const outcome={
 decided_turn:9,winner_id:"host",defeated_id:"guest",
 defeated_team_size:3,outcome_scope:"training_only_no_official_victory",
 official_match_ended:false,official_match_modified:false,
 experience_awarded:false,currency_awarded:false
};
const ko=slot=>({
 turn_no:slot+2,attacker_id:"host",defender_id:"guest",defender_slot:slot,
 hp_before:4,hp_after:0,training_only:true,
 official_hp_changed:false,official_match_modified:false
});
function report(args={}){
 return build({room:{...room,...args.room},match:{turn_no:9,status:"finished"},
  outcomes:args.outcomes??[outcome],knockouts:args.knockouts??[ko(4),ko(5),ko(6)]});
}
const parse=s=>ctx.parse3x3Receipt(s);
const compare=(a,b)=>ctx.compare3x3Receipts(a,b);

test("v0.1.122: exact valid server summary parses into non-sensitive match fields",()=>{
 const parsed=parse(report());
 assert.equal(parsed.sala,"DM1234");
 assert.equal(parsed.vencedor,"ANFITRIÃO");
 assert.equal(parsed.derrotado,"CONVIDADO");
 assert.equal(parsed.turno,"9");
 assert.equal(parsed.nocautes,"c4/c5/c6");
});
test("v0.1.122: same summaries from both devices compare successfully",()=>{
 const result=compare(report(),report());
 assert.match(result,/RESUMOS COINCIDEM/);
 assert.match(result,/NÃO comprova dois celulares físicos/);
});
test("v0.1.122: wrapped whitespace when pasting from mobile is tolerated",()=>{
 const other=report().replaceAll(" · "," \n ·  ");
 assert.match(compare(report(),other),/RESUMOS COINCIDEM/);
});
test("v0.1.122: different lobby code is rejected, never reported as matching",()=>{
 const result=compare(report(),report({room:{code:"OTHER2"}}));
 assert.match(result,/DIVERGÊNCIA/);
 assert.match(result,/sala/);
 assert.doesNotMatch(result,/RESUMOS COINCIDEM/);
});
test("v0.1.122: different winner is rejected even if knockout slots look identical",()=>{
 const other=report().replace("vencedor ANFITRIÃO · derrotado CONVIDADO",
    "vencedor CONVIDADO · derrotado ANFITRIÃO");
 const result=compare(report(),other);
 assert.match(result,/DIVERGÊNCIA/);
 assert.match(result,/vencedor/);
 assert.match(result,/derrotado/);
});
test("v0.1.122: mismatched decision turn is reported explicitly",()=>{
 assert.match(compare(report(),report().replace("turno decisivo T9","turno decisivo T10")),
   /DIVERGÊNCIA.*turno decisivo/);
});
test("v0.1.122: no server outcome cannot be mistaken for victory",()=>{
 const result=compare(report({outcomes:[]}),report());
 assert.match(result,/ainda não foi confirmado/);
 assert.equal(parse(report({outcomes:[]})),null);
});
test("v0.1.122: missing one of 3 KOs produces an invalid pasted receipt",()=>{
 const incomplete=report({knockouts:[ko(4),ko(5)]});
 assert.equal(parse(incomplete),null);
 assert.match(compare(report(),incomplete),/incompleto/);
});
test("v0.1.122: invalid flags for official rewards must never compare as certified",()=>{
 const unsafe=report({outcomes:[{...outcome,currency_awarded:true}]});
 assert.equal(parse(unsafe),null);
 assert.match(compare(report(),unsafe),/sem vitória de treino confirmada/);
});
test("v0.1.122: fabricated contradictory side labels fail a receipt comparison",()=>{
 const forged=report().replace("derrotado CONVIDADO","derrotado ANFITRIÃO");
 assert.equal(parse(forged),null);
 assert.match(compare(report(),forged),/incompleto/);
});
test("v0.1.122: a receipt from a third source is never physical-device certification",()=>{
 const result=compare(report(),report());
 assert.doesNotMatch(result,/dois aparelhos confirmados|homologação concluída/);
 assert.match(result,/não substitui o teste de desconexão e defesa/);
});
test("v0.1.122: paste and compare uses textContent/value; never writes DB or HTML from pasted input",()=>{
 const start=source.indexOf('$("lobby-3x3-compare-receipts").onclick=');
 const end=source.indexOf('$("lobby-3x3-refresh-connection").onclick=',start);
 assert.ok(start>=0&&end>start);
 const nodes={
  "lobby-3x3-verification-report":{textContent:report()},
  "lobby-3x3-other-receipt":{value:report()},
  "lobby-3x3-compare-status":{textContent:"",dataset:{}},
  "lobby-3x3-compare-receipts":{onclick:null}
 };
 vm.runInNewContext(source.slice(start,end),{
  $:id=>nodes[id],compare3x3Receipts:compare
 });
 nodes["lobby-3x3-compare-receipts"].onclick();
 assert.match(nodes["lobby-3x3-compare-status"].textContent,/RESUMOS COINCIDEM/);
 assert.equal(nodes["lobby-3x3-compare-status"].dataset.local,report());
 const handler=source.slice(start,end);
 assert.doesNotMatch(handler,/innerHTML|rpc\(|api\.|\\.insert\(|\\.upsert\(|\\.update\(/);
 assert.match(source,/id="lobby-3x3-other-receipt"/);
 assert.match(source,/id="lobby-3x3-compare-status"/);
});
