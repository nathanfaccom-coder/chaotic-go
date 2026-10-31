import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cards,migration,ui]=await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-private-defender-equipment.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8")
]);
test("3x3: all 7 original equipment IDs and names preserved in private reference",()=>{
 const section=cards.slice(cards.indexOf("const EQUIPAMENTOS = ["),cards.indexOf("const MAGIAS = ["));
 const originals=[...section.matchAll(/\{ id: (20\d), nome: "([^"]+)"/g)].map(x=>[x[1],x[2]]);
 const catalog=[...migration.matchAll(/^ \('(20\d)','([^']+)','[^']+'\)/gm)].map(x=>[x[1],x[2]]);
 assert.equal(originals.length,7);
 assert.deepEqual(catalog,originals);
 assert.match(section,/Amuleto do Vácuo[^\n]+elemento ar/);
 assert.match(section,/Anel Precioso[^\n]+ignora danos elementais/);
});
test("3x3: original equipment snapshot keeps defender identity private",()=>{
 for(const required of ["auth.uid()","chaotic_preview_3x3_private_equipment_checks",
 "chaotic_preview_3x3_creature_element_checks","chaotic_preview_3x3_elemental_inspections",
 "chaotic_preview_3x3_hp_wallets","chaotic_game_nodes",
 "owned_card->>'nome'","x.value->>'tipoCarta'='Equipamento'",
 "defender_id=(select auth.uid())","equipment_publicly_revealed=false",
 "equipment_effect_applied=false","final_damage_calculated=false"]){
  assert.ok(migration.includes(required),required);
 }
 assert.doesNotMatch(migration,/alter publication supabase_realtime add table public\.chaotic_preview_3x3_private_equipment_checks/);
 assert.match(migration,/deck->'equipamentos'->>\(w\.defender_slot-1\)/);
 assert.match(migration,/w\.defender_id is distinct from actor/);
});
test("3x3: private gear button is defender-only, without room broadcast",()=>{
 for(const required of ["lobby-3x3-private-equipment",
 "lobby-3x3-private-equipment-history",
 "chaotic_inspect_preview_3x3_private_defender_equipment",
 "privateEquipmentChecks3x3=equipmentCheck.data||[]"]){
  assert.ok(ui.includes(required),required);
 }
 assert.match(ui,/defenseWindowThisTurn\.defender_id===userId/);
 assert.doesNotMatch(ui,/table:"chaotic_preview_3x3_private_equipment_checks",filter/);
});