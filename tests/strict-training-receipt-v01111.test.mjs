import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const src=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const begin=src.indexOf("function build3x3VerificationReport(");
const end=src.indexOf("function update3x3UI()",begin);
assert.ok(begin>=0&&end>begin,"receipt helper");
const receipt=vm.runInNewContext("("+src.slice(begin,end).trim()+")");
const room={mode:"3x3",code:"ABC123",host_id:"H",guest_id:"G"};
const baseOutcome={
 winner_id:"H",defeated_id:"G",decided_turn:9,defeated_team_size:3,
 outcome_scope:"training_only_no_official_victory",
 official_match_ended:false,official_match_modified:false,
 experience_awarded:false,currency_awarded:false
};
const event=(slot,patch={})=>({
 attacker_id:"H",defender_id:"G",defender_slot:slot,turn_no:slot+1,
 hp_before:5,hp_after:0,training_only:true,official_hp_changed:false,
 official_match_modified:false,original_owner_changed:false,...patch
});
const state=(opts={})=>({
 room,match:{turn_no:9},outcomes:[baseOutcome],
 knockouts:[event(4),event(5),event(6)],...opts
});
const warning=s=>assert.match(s,/RESULTADO NÃO CONFERIDO/);

test("v0.1.111: strictly validated complete training-only server receipt stays consistent",()=>{
 assert.match(receipt(state()),/RESULTADO DE TREINO CONSISTENTE/);
});
test("v0.1.111: an absent or null HP value can never be read as zero",()=>{
 for(const hp of [null,undefined,false,"",NaN]){
  const out=receipt(state({knockouts:[event(4),event(5),event(6,{hp_after:hp})]}));
  warning(out);assert.match(out,/nocautes 2\/3/);
 }
});
test("v0.1.111: a KO requires positive pre-damage HP and real integer turn",()=>{
 for(const bad of [{hp_before:null},{hp_before:0},{hp_before:-1},
                   {turn_no:null},{turn_no:0},{turn_no:"7"}]){
  const out=receipt(state({knockouts:[event(4),event(5),event(6,bad)]}));
  warning(out);assert.match(out,/c6:PENDENTE/);
 }
});
test("v0.1.111: missing KO security flags cannot certify training victory",()=>{
 for(const bad of [
  {training_only:null},{official_hp_changed:null},{official_match_modified:null},
  {official_hp_changed:true},{official_match_modified:true}
 ]){
  warning(receipt(state({knockouts:[event(4),event(5),event(6,bad)]})));
 }
});
test("v0.1.111: a borrowed attack requires proof the original owner did not change",()=>{
 warning(receipt(state({knockouts:[
  event(4),event(5),event(6,{borrowed_attack:true,original_owner_changed:true})
 ]})));
 warning(receipt(state({knockouts:[
  event(4),event(5),event(6,{borrowed_attack:true,original_owner_changed:undefined})
 ]})));
 assert.match(receipt(state({knockouts:[
  event(4),event(5),event(6,{borrowed_attack:true,original_owner_changed:false})
 ]})),/CONSISTENTE/);
});
test("v0.1.111: result must explicitly be the scoped non-official training outcome",()=>{
 for(const scope of [undefined,null,"official","training_only"]){
  warning(receipt(state({outcomes:[{...baseOutcome,outcome_scope:scope}]})));
 }
});
test("v0.1.111: missing official-change and reward flags are not treated as false",()=>{
 for(const field of [
  "official_match_ended","official_match_modified","experience_awarded","currency_awarded"
 ]){
  for(const val of [null,undefined,0]){
   warning(receipt(state({outcomes:[{...baseOutcome,[field]:val}]})));
  }
 }
});
test("v0.1.111: only verified winner's own knockouts can certify the result",()=>{
 warning(receipt(state({knockouts:[
  event(4),event(5),event(6,{attacker_id:"G"})
 ]})));
 warning(receipt(state({knockouts:[
  event(4),event(5),event(6,{attacker_id:"other-account"})
 ]})));
});
test("v0.1.111: server fields required for auditing exist in the three read queries",()=>{
 const list=[
  "turn_no,attacker_id,defender_id,defender_slot,defender_creature_name,catalog_attack_id,hp_before,hp_after,training_only,official_hp_changed,official_match_modified",
  "turn_no,borrower_id,defender_id,defender_slot,defender_creature_name,catalog_attack_id,hp_before,hp_after,training_only,original_owner_changed,official_hp_changed,official_match_modified",
  "decided_turn,winner_id,defeated_id,defeated_team_size,outcome_scope,official_match_ended,official_match_modified,experience_awarded,currency_awarded"
 ];
 for(const selection of list)assert.ok(src.includes('.select("'+selection+'")'),selection);
});
test("v0.1.111: comparison receipt never initiates official combat or auto replays",()=>{
 const code=src.slice(begin,end);
 assert.doesNotMatch(code,/api\.(?:rpc|from)|chaotic_(?:spend|pass|apply|borrow)/);
 const report=receipt(state());
 assert.match(report,/Não é certificado de partida em dois aparelhos/);
});
