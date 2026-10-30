import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [cards,sql,ui] = await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-creature-base-element-check.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8")
]);

test("3x3: the original 16 creatures and art paths remain intact",()=>{
 const section=cards.slice(cards.indexOf("const MONSTROS = ["),cards.indexOf("const ATAQUES = ["));
 const creatures=[...section.matchAll(/\{ id: (\d+), nome: "([^"]+)"/g)];
 assert.equal(creatures.length,16);
 assert.equal(new Set(creatures.map(x=>x[1])).size,16);
 assert.match(section,/nome: "Lion"[^\n]*elementos: \["Fogo", "Terra"\]/);
 assert.match(section,/nome: "Rex"[^\n]*elementos: \["Ar"\]/);
 assert.match(section,/nome: "Naty"[^\n]*elementos: \[\]/);
});
test("3x3: server verifies canonical snapshots without changing official HP",()=>{
 for(const code of ["auth.uid()","chaotic_preview_card_reference",
   "chaotic_preview_3x3_elemental_inspections",
   "chaotic_preview_3x3_hp_wallets","awaiting_defender",
   "effective_elements_verified=false","dynamic_effects_verified=false",
   "defender_equipment_verified=false","final_damage_calculated=false",
   "official_match_modified=false"]){
   assert.ok(sql.includes(code),code);
 }
 assert.match(sql,/a_elements \? 'fogo'/);
 assert.match(sql,/a_elements \? 'agua'/);
 assert.match(sql,/a_elements \? 'terra'/);
 assert.match(sql,/a_elements \? 'ar'/);
 assert.match(sql,/defender\.creature_name='Rex' and review\.air_component>0/);
});
test("3x3: defender-only DROME reads and displays the new unmodified snapshots",()=>{
 for(const identifier of ["chaotic_preview_3x3_creature_element_checks",
   "chaotic_inspect_preview_3x3_creature_elements",
   "lobby-3x3-creature-elements","lobby-3x3-creature-element-history",
   "creatureChecks3x3=creatureCheck.data||[]"]){
  assert.ok(ui.includes(identifier),identifier);
 }
 assert.match(ui,/elementalInspections3x3\.some\(x=>x\.turn_no===match\.turn_no\)/);
 assert.match(ui,/creatureChecks3x3\.some\(x=>x\.turn_no===match\.turn_no\)/);
});