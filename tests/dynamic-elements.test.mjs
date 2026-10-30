import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cards,sql,ui]=await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-dynamic-element-candidates.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8")
]);
test("3x3: dynamic element candidates match Guru and Naty ORIGINAL card abilities",()=>{
 const section=cards.slice(cards.indexOf("const MONSTROS = ["),cards.indexOf("const ATAQUES = ["));
 assert.match(section,/nome: "Guru"[^\n]*todos os seus outros campeões ganham o elemento vento/);
 assert.match(section,/nome: "Naty"[^\n]*primeira vez que este campeão batalhar, ele ganha os 4 elementos/);
 assert.match(sql,/card_id='8' and card_name='Guru'/);
 assert.match(sql,/card_id='12' and card_name='Naty'/);
 assert.match(sql,/x\.position<>w\.attacker_slot and x\.creature_name='Guru'/);
 assert.match(sql,/x\.position<>w\.defender_slot and x\.creature_name='Guru'/);
});
test("3x3: dynamic check never applies eligibility, damage or private gear",()=>{
 for(const required of [
 "auth.uid()","w.defender_id is distinct from actor",
 "w.status<>'awaiting_defender'","chaotic_preview_3x3_creature_element_checks",
 "chaotic_preview_3x3_elemental_inspections","chaotic_preview_3x3_hp_wallets",
 "dynamic_elements_resolved=false","air_bonus_applied=false",
 "effect_activated=false","final_damage_calculated=false",
 "official_match_modified=false"]){
  assert.ok(sql.includes(required),required);
 }
 assert.doesNotMatch(sql,/chaotic_preview_3x3_private_equipment_checks/);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_preview_3x3_hp_wallets/i);
});
test("3x3: DROME exposes safe defender inspection and real-time history",()=>{
 for(const code of ["chaotic_inspect_preview_3x3_dynamic_elements",
  "lobby-3x3-dynamic-elements","lobby-3x3-dynamic-element-history",
  "dynamicElementChecks3x3=dynamicCheck.data||[]",
  'table:"chaotic_preview_3x3_dynamic_element_checks"']){
   assert.ok(ui.includes(code),code);
 }
 assert.match(ui,/defenseWindowThisTurn\.defender_id===userId/);
 assert.match(ui,/dynamicElementChecks3x3\.some\(x=>x\.turn_no===match\.turn_no\)/);
});