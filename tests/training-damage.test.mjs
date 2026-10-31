import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cards,migration,ui] = await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-training-vento-forte-hp.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8")
]);
test("3x3 actual training damage is restricted to the canonical Vento Forte 105",()=>{
 const card=cards.slice(cards.indexOf("id: 105"),cards.indexOf("id: 106"));
 assert.match(card,/nome: "Vento Forte"/);
 assert.match(card,/danoBase: 5/);
 assert.match(card,/danoElemental: \{ fogo: 0, agua: 0, terra: 0, ar: 0 \}/);
 assert.match(migration,/proj.catalog_attack_id<>'105'/);
 assert.match(migration,/proj.base_damage<>5/);
 assert.match(migration,/proj.attack_cost<>1/);
 assert.match(migration,/meta.fire_component<>0 or meta.water_component<>0/);
 assert.match(migration,/gear.equipment_status<>'no_equipment_in_slot'/);
});
test("3x3 training HP damage uses a real transactional wallet update after defender passes",()=>{
 for(const term of ["auth.uid()","m.current_player is distinct from actor",
 "w.status<>'defender_passed_preview'","paid.training_damage_applied",
 "chaotic_preview_3x3_training_damage_events","for update",
 "set hp_remaining=after_hp,damage_events=damage_events+1",
 "training_damage_applied=true","resolution_status='training_base_damage_105_optional_reveal_pending'",
 "optional_reveal_pending boolean not null default true",
 "official_match_modified boolean not null default false"]){
  assert.ok(migration.includes(term),term);
 }
 assert.doesNotMatch(migration,/update\s+public\.chaotic_player_state/i);
 assert.doesNotMatch(migration,/update\s+public\.chaotic_match_turns/i);
});
test("3x3 training HP is reduced only by original 5, capped at current HP",()=>{
 for(const hp of [1,2,4,5,8,30,100]){
  const after=Math.max(0,hp-5);
  assert.equal(hp-after,Math.min(hp,5));
  assert.ok(after>=0&&after<=hp);
 }
 assert.match(migration,/after_hp:=greatest\(0,before_hp-5\)/);
 assert.match(migration,/check\(hp_after=greatest\(0,hp_before-base_damage\)\)/);
 assert.match(migration,/primary key\(lobby_id,turn_no\)/);
});
test("3x3 DROME exposes training damage with history and only attacker button",()=>{
 for(const marker of [
  "lobby-3x3-training-damage",
  "lobby-3x3-training-damage-history",
  "chaotic_apply_preview_3x3_training_base_105",
  "trainingDamage3x3=trainingDmg.data||[]",
  'table:"chaotic_preview_3x3_training_damage_events"'
 ])assert.ok(ui.includes(marker),marker);
 assert.match(ui,/resolvableTrainingAttacks3x3\.has\(currentProjection\?\.catalog_attack_id\)/);
 assert.match(ui,/defenseWindowThisTurn.status==="defender_passed_preview"/);
 assert.match(ui,/!trainingDamage3x3.some\(x=>x.turn_no===match.turn_no\)/);
});