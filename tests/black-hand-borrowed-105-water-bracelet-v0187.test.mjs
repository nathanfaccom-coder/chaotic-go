import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const paths=[
 "supabase/chaotic-borrowed-105-neutral-bracelet-207-audit-v0187.sql",
 "supabase/chaotic-borrowed-105-neutral-bracelet-207-settlement-v0187.sql",
 "supabase/tests/chaotic-borrowed-105-water-207-live-v0187.test.sql",
 "supabase/tests/chaotic-borrowed-105-earth-206-refusal-v0187.test.sql",
 "supabase/tests/chaotic-borrowed-105-forged-water-207-refusal-v0187.test.sql",
 "chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [schema,settle,water,earth,forged,ui,index,sw,scanner,boot]=
 await Promise.all(paths.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));
test("v0.1.87: defender-private ledger only recognizes catalog-verified water bracelet 207",()=>{
 for(const s of [
  "chaotic_borrowed_105_supported_equipment_ids_v0187",
  "catalog_equipment_id in('202','204','207')",
  "chaotic_borrowed_105_supported_rules_v0187",
  "increase_water_damage_5_without_granting_water",
  "chaotic_borrowed_105_equipment_id_rule_match_v0187"
 ])assert.ok(schema.includes(s),s);
 assert.doesNotMatch(schema,/\bgrant\s+(insert|update|delete|all)\b/i);
});
test("v0.1.87: neutral Vento Forte 105 never receives water bonus from defender bracelet",()=>{
 for(const s of [
  "equip_cat.equipment_id='207'",
  "equip_cat.rule_code<>'increase_water_damage_5_without_granting_water'",
  "equip_cat.equipment_id not in('202','204','207')",
  "x.value->>'id'=gear",
  "x.value->>'tipoCarta'='Equipamento'",
  "equip_matches<>1",
  "attack_cat.base_damage<>5 or attack_cat.attack_cost<>1",
  "attack_cat.element_damage is distinct from",
  "chaotic_preview_3x3_borrowed_105_equipment_audits",
  "set spent_points=spent_points+1",
  "set hp_remaining=greatest(0,hp_remaining-5)",
  "chaotic_internal_release_preview_3x3_black_hand"
 ])assert.ok(settle.includes(s),s);
 assert.ok(settle.indexOf("chaotic_preview_3x3_borrowed_105_equipment_audits")
   < settle.indexOf("set spent_points=spent_points+1"));
 assert.doesNotMatch(settle,/\bupdate\s+public\.chaotic_game_nodes\b/i);
});
test("v0.1.87: real neutral-207 live fixture proves privacy, one cost, five damage and restitution",()=>{
 for(const s of [
  "Bracelete de Água",
  "E207",
  "increase_water_damage_5_without_granting_water",
  "borrowed_card_returned",
  "Equipment damage and payment replay permitted",
  "Borrower saw defender private equipment audit",
  "Defender could not inspect own original equipment audit",
  "Outsider saw defender private equipment audit",
  "chaotic_resolve_preview_3x3_borrowed_105_reveal(room,3,null,true)",
  "rollback;",
  "PASS v0.1.86 water-207"
 ])assert.ok(water.includes(s),s);
});
test("v0.1.87: unsupported earth bracelet and forged water bracelet are denied atomically",()=>{
 for(const [name,f] of [["earth-206",earth],["forged-water-207",forged]]){
  for(const s of [
   "Equipment "+name+" incorrectly bypassed authentic safety guard",
   "Rejected equipment changed points, HP, custody or private audit",
   "chaotic_abort_preview_3x3_borrowed_105_priority",
   "rollback;",
   "PASS v0.1.87 blocked "+name
  ])assert.ok(f.includes(s),s);
  assert.doesNotMatch(f,/\bcommit\s*;/i);
 }
});
test("v0.1.87: UI describes only validated neutral equipments without exposing private identifiers",()=>{
 for(const s of [
   "Bracelete de Água (207)",
   "202/204/206/207 originais verificados",
   "SEM equipamento ou com 202/204/206/207 validados",
   "chaotic_settle_preview_3x3_borrowed_105_base"
 ])assert.ok(ui.includes(s),s);
});
test("v0.1.87+: PWA release pointers remain synchronized",()=>{
 const version=index.match(/VERSÃO 0\.1\.(\d+)/);
 const registration=index.match(/sw\.js\?v=release-(\d+)/);
 const cache=sw.match(/chaotic-go-release-\d{8}-(\d+)/);
 const scannerScript=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const dromeScript=boot.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(version&&registration&&cache&&scannerScript&&dromeScript);
 assert.ok(Number(version[1])>=87);
 for(const part of [registration,cache,scannerScript,dromeScript])
  assert.equal(part[1],version[1]);
});
