import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const files=[
 "supabase/chaotic-borrowed-105-neutral-equipment-audit-v0186.sql",
 "supabase/chaotic-borrowed-105-202-204-neutral-equipment-settlement-v0186.sql",
 "supabase/tests/chaotic-borrowed-105-vacuum-202-live-v0186.test.sql",
 "supabase/tests/chaotic-borrowed-105-wisdom-204-live-v0186.test.sql",
 "supabase/tests/chaotic-borrowed-105-ring-201-refusal-v0186.test.sql",
 "supabase/tests/chaotic-borrowed-105-bomb-205-refusal-v0186.test.sql",
 "supabase/tests/chaotic-borrowed-105-forged-202-refusal-v0186.test.sql",
 "chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [audit,settle,vacuum,wisdom,ring,bomb,forged,ui,index,sw,scanner,boot]=
 await Promise.all(files.map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));
test("v0.1.86: private equipment audit RLS is defender-only and never writable by players",()=>{
 for(const marker of [
   "chaotic_preview_3x3_borrowed_105_equipment_audits",
   "catalog_equipment_id in('202','204')",
   "rule_code in('immune_to_attacks_involving_air','increase_wisdom_40')",
   "attack_elemental_damage_zero boolean not null check(attack_elemental_damage_zero)",
   "original_owner_verified boolean not null check(original_owner_verified)",
   "equipment_effect_applied boolean not null default false check(not equipment_effect_applied)",
   "official_match_modified boolean not null default false check(not official_match_modified)",
   "enable row level security",
   "revoke all on public.chaotic_preview_3x3_borrowed_105_equipment_audits",
   "for select to authenticated using ((select auth.uid())=defender_id)"
 ])assert.ok(audit.includes(marker),marker);
 assert.doesNotMatch(audit,/grant\s+(insert|update|delete|all)\s+on\s+public\.chaotic_preview_3x3_borrowed_105_equipment_audits\s+to\s+authenticated/i);
});
test("v0.1.86: neutral original 105 settles only catalog 202/204 and original album-owned gear",()=>{
 for(const marker of [
   "gear:=nullif",
   "plan.defender_id and node_path='album'",
   "pg_catalog.jsonb_array_elements(equip_array)",
   "x.value->>'id'=gear",
   "x.value->>'tipoCarta'='Equipamento'",
   "equip_matches<>1",
   "chaotic_preview_3x3_equipment_catalog",
   "equipment_name=equip_item->>'nome'",
   "equip_cat.equipment_id='202'",
   "immune_to_attacks_involving_air",
   "equip_cat.equipment_id='204'",
   "increase_wisdom_40",
   "equip_cat.equipment_id not in('202','204')",
   "chaotic_preview_card_reference",
   "kind='attack' and card_id='105'",
   "attack_cat.element_damage is distinct from",
   "'{\"fogo\":0,\"agua\":0,\"terra\":0,\"ar\":0}'::jsonb",
   "chaotic_preview_3x3_borrowed_105_equipment_audits",
   "set spent_points=spent_points+1",
   "set hp_remaining=greatest(0,hp_remaining-5)",
   "chaotic_internal_release_preview_3x3_black_hand"
 ])assert.ok(settle.includes(marker),marker);
 assert.ok(settle.indexOf("chaotic_preview_3x3_borrowed_105_equipment_audits")<
   settle.indexOf("set spent_points=spent_points+1"),"equipment audit before cost");
 assert.doesNotMatch(settle,/\bupdate\s+public\.chaotic_game_nodes\b/i);
});
test("v0.1.86: live positive tests verify both authentic inert equipments, neutral damage and private access",()=>{
 for(const [name,fixture] of [["vacuum-202",vacuum],["wisdom-204",wisdom]]){
  for(const marker of [
    "chaotic_prepare_preview_3x3_borrowed_105",
    "chaotic_pass_preview_3x3_borrowed_105_priority",
    "chaotic_settle_preview_3x3_borrowed_105_base",
    "Equipment damage and payment replay permitted",
    "Borrower saw defender private equipment audit",
    "Defender could not inspect own original equipment audit",
    "Outsider saw defender private equipment audit",
    "chaotic_resolve_preview_3x3_borrowed_105_reveal(room,3,null,true)",
    "chaotic_pass_turn(room,3)",
    "rollback;",
    "PASS v0.1.86 "+name
  ])assert.ok(fixture.includes(marker),marker);
  assert.doesNotMatch(fixture,/\bcommit\s*;/i);
 }
});
test("v0.1.86: 201, 205 and forged catalog item refuse payment, HP and custody changes",()=>{
 for(const [name,fixture] of [["ring-201",ring],["bomb-205",bomb],["forged-202",forged]]){
  for(const marker of [
   "chaotic_settle_preview_3x3_borrowed_105_base",
   "incorrectly bypassed authentic safety guard",
   "Rejected equipment changed points, HP, custody or private audit",
   "chaotic_abort_preview_3x3_borrowed_105_priority",
   "rollback;",
   "PASS v0.1.86 blocked "+name
  ])assert.ok(fixture.includes(marker),marker);
  assert.doesNotMatch(fixture,/\bcommit\s*;/i);
 }
});
test("v0.1.86: DROME explains only 202/204 permitted while keeping original modes",()=>{
 for(const marker of [
   "Amuleto do Vácuo (202)",
   "Bastão da Sabedoria (204)",
   "202/204/207 originais verificados",
   "SEM equipamento ou com 202/204/207 validados",
   "lobby-3x3-borrowed-settle-base",
   "chaotic_resolve_preview_3x3_borrowed_105_reveal"
 ])assert.ok(ui.includes(marker),marker);
 assert.doesNotMatch(ui,/resolvableTrainingAttacks3x3=new Set\([^)]*"102"/);
});
test("v0.1.86+: PWA cache, index and scanners remain synchronized",()=>{
 const current=index.match(/VERSÃO 0\.1\.(\d+)/);
 const registered=index.match(/sw\.js\?v=release-(\d+)/);
 const cache=sw.match(/chaotic-go-release-\d{8}-(\d+)/);
 const loaded=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const lobby=boot.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(current&&registered&&cache&&loaded&&lobby);
 assert.ok(Number(current[1])>=86);
 for(const match of [registered,cache,loaded,lobby])assert.equal(match[1],current[1]);
});
