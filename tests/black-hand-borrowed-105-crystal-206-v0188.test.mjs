import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const paths=[
 "supabase/chaotic-borrowed-105-crystal-206-audit-v0188.sql",
 "supabase/chaotic-borrowed-105-crystal-206-passive-defense-v0188.sql",
 "supabase/chaotic-borrowed-105-neutral-equipment-audit-v0186.sql",
 "supabase/tests/chaotic-borrowed-105-crystal-206-neutral-live-v0188.test.sql",
 "supabase/tests/chaotic-borrowed-105-forged-crystal-206-refusal-v0188.test.sql",
 "chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [audit,settle,privacy,positive,forged,ui,index,sw,scanner,bootstrap]=
 await Promise.all(paths.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));

test("v0.1.88: private audit recognizes exact original crystal 206 catalog rule",()=>{
 for(const x of [
  "catalog_equipment_id in('202','204','206','207')",
  "increase_earth_damage_5_cure_poison",
  "catalog_equipment_id='206' and rule_code='increase_earth_damage_5_cure_poison'",
  "chaotic_borrowed_105_equipment_id_rule_match_v0188"
 ])assert.ok(audit.includes(x),x);
 assert.ok(privacy.includes("for select to authenticated using ((select auth.uid())=defender_id)"));
 assert.ok(privacy.includes("revoke all on public.chaotic_preview_3x3_borrowed_105_equipment_audits"));
 assert.doesNotMatch(audit,/grant\s+(insert|update|delete|all)\s+on\s+public\.chaotic_preview_3x3_borrowed_105_equipment_audits\s+to\s+authenticated/i);
});
test("v0.1.88: only canonical owned 206 may remain equipped on defender, no earth bonus or cure",()=>{
 for(const x of [
  "gear:=nullif",
  "user_id=plan.defender_id and node_path='album'",
  "x.value->>'id'=gear",
  "x.value->>'tipoCarta'='Equipamento'",
  "equip_matches<>1",
  "chaotic_preview_3x3_equipment_catalog",
  "equip_cat.equipment_id='206'",
  "equip_cat.rule_code<>'increase_earth_damage_5_cure_poison'",
  "equip_cat.equipment_id not in('202','204','206','207')",
  "chaotic_preview_card_reference",
  "kind='attack' and card_id='105'",
  "attack_cat.base_damage<>5 or attack_cat.attack_cost<>1",
  "attack_cat.element_damage is distinct from",
  '"fogo":0,"agua":0,"terra":0,"ar":0',
  "chaotic_preview_3x3_borrowed_105_equipment_audits",
  "set spent_points=spent_points+1",
  "set hp_remaining=greatest(0,hp_remaining-5)",
  "chaotic_internal_release_preview_3x3_black_hand"
 ])assert.ok(settle.includes(x),x);
 assert.ok(settle.indexOf("chaotic_preview_3x3_borrowed_105_equipment_audits") <
  settle.indexOf("set spent_points=spent_points+1"),"audit before any charge");
 assert.doesNotMatch(settle,/\bupdate\s+public\.chaotic_game_nodes\b/i);
 assert.doesNotMatch(settle,/set\s+poison|cure_poison\s*\(/i);
});
test("v0.1.88: live original bracelet transaction confirms 1 point, neutral 5 HP, owner return, RLS",()=>{
 for(const x of [
  "Bracelete de cristal",
  "E206",
  "increase_earth_damage_5_cure_poison",
  "borrowed_card_returned",
  "Equipment damage and payment replay permitted",
  "Borrower saw defender private equipment audit",
  "Defender could not inspect own original equipment audit",
  "Outsider saw defender private equipment audit",
  "chaotic_resolve_preview_3x3_borrowed_105_reveal(room,3,null,true)",
  "rollback;",
  "PASS v0.1.88 crystal-206"
 ])assert.ok(positive.includes(x),x);
});
test("v0.1.88: forged crystal is rejected before points, HP or original card changes",()=>{
 for(const x of [
  "Bracelete de cristal FALSO",
  "Equipment forged-crystal-206 incorrectly bypassed authentic safety guard",
  "Rejected equipment changed points, HP, custody or private audit",
  "chaotic_abort_preview_3x3_borrowed_105_priority",
  "rollback;",
  "PASS v0.1.88 blocked forged-crystal-206"
 ])assert.ok(forged.includes(x),x);
 assert.doesNotMatch(forged,/\bcommit\s*;/i);
});
test("v0.1.88: DROME accurately lists crystal passive equipment, not active poison cure",()=>{
 for(const x of [
  "Bracelete de Cristal (206)",
  "202/204/206/207 originais verificados",
  "SEM equipamento ou com 202/204/206/207 validados",
  "chaotic_settle_preview_3x3_borrowed_105_base"
 ])assert.ok(ui.includes(x),x);
 assert.ok(!ui.includes("Cura de veneno aplicada pelo Bracelete de Cristal"));
});
test("v0.1.88: cached PWA and scanners agree on release 88",()=>{
 assert.match(index,/VERSÃO 0\.1\.88/);
 assert.match(index,/sw\.js\?v=release-88/);
 assert.match(sw,/chaotic-go-release-20261031-88/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-88/);
 assert.match(bootstrap,/chaotic-lobby\.js\?v=release-88/);
});
