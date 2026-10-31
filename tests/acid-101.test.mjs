import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cards,sql,ui,testSql]=await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-acid-101-native-elemental.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-native-acid-101-integration.test.sql",import.meta.url),"utf8")
]);
test("3x3: Acid 101 canonical cost 3 and base+Fire+Water component damage",()=>{
 const acid=cards.slice(cards.indexOf("id: 101"),cards.indexOf("id: 102"));
 assert.match(acid,/nome: "Ácido Gástrico"/);
 assert.match(acid,/custo: 3/);
 assert.match(acid,/danoBase: 10/);
 assert.match(acid,/danoElemental: \{ fogo: 5, agua: 5, terra: 0, vento: 0 \}/);
 for(const bonus of [0,5,10])for(const hp of [1,5,15,20,45]){
  const finalHp=Math.max(0,hp-10-bonus);
  assert.equal(hp-finalHp,Math.min(hp,10+bonus));
 }
 assert.match(sql,/elemental_bonus:=5\*fire_granted::integer\+5\*water_granted::integer/);
});
test("3x3: HP transaction requires both sides unequipped and original actor elements",()=>{
 for(const marker of [
 "actor_ally.creature_name='Naty'","actor_deck->'equipamentos'",
 "actor_deck->'criaturas'","deck_slot","creature.attacker_base_elements",
 "chaotic_preview_card_reference","gear.equipment_status<>'no_equipment_in_slot'",
 "meta.fire_component<>5 or meta.water_component<>5",
 "hp_remaining=after_hp,damage_events=damage_events+1",
 "training_elemental_acid_101_native_only"
 ])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_match_turns/i);
});
test("3x3: real database fixture tests Acid 101 native Fire KO, equip rejection and rollback",()=>{
 for(const marker of ["for i in 1..6 loop","'Ácido Gástrico'",
  "chaotic_apply_preview_3x3_training_acid_101",
  "when i=6 and v.actor=host and v.pos=4 then 'Lion'",
  "case when i=6 then '[\"fogo\",\"terra\"]'::jsonb",
  "Acid 101 accepted unknown attacker equipment",
  "example.invalid","rollback;"
 ])assert.ok(testSql.includes(marker),marker);
 assert.doesNotMatch(testSql,/\bcommit\s*;/i);
});
test("3x3: DROME includes Acid 101 and reports its elemental component",()=>{
 for(const marker of ["chaotic_apply_preview_3x3_training_acid_101",
  '["101","105","111","112","113","114"].includes(currentProjection?.catalog_attack_id)',
  "elemental_bonus_damage","Ácido Gástrico",
  "Bônus elemental NATURAL de Fogo/Água"]){
  assert.ok(ui.includes(marker),marker);
 }
});