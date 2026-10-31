import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [orig,migration,ui,reveal,skip]=await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-vento-105-face-down-reveal.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-vento-105-reveal-real-integration.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-vento-105-skip-real.test.sql",import.meta.url),"utf8")
]);
test("Vento Forte original optional reveal one enemy face-down champion only on successful attack",()=>{
 const card=orig.slice(orig.indexOf('nome: "Vento Forte"'),orig.indexOf('nome: "Armadilha de Víbora"'));
 assert.match(card,/custo: 1/);assert.match(card,/danoBase: 5/);
 assert.match(card,/Se este ataque for bem sucedido você pode revelar 1 campeão que esteja virado para baixo do seu oponente/);
 assert.match(migration,/dmg\.damage_dealt<=0/);
 assert.match(migration,/spent\.catalog_attack_id<>'105'/);
});
test("3x3 face-down markers start on formation and flip engaged champions",()=>{
 for(const term of ["create table public.chaotic_preview_3x3_face_states",
  "chaotic_3x3_initialize_face_down","chaotic_3x3_contact_reveals_participants",
  "new.attacker_id","new.defender_id","reveal_reason='combat'",
  "chaotic_preview_3x3_vento_reveal_events",
  "create policy chaotic_3x3_face_states_room_players_read"]){
  assert.ok(migration.includes(term),term);
 }
});
test("Vento reveal is once per turn, never for face-up or knocked-out targets",()=>{
 for(const term of ["chaotic_resolve_preview_3x3_vento_reveal",
  "auth.uid()","m.current_player is distinct from actor",
  "spent.training_damage_applied","chosen.face_up","h.hp_remaining>0",
  "chaotic_preview_3x3_training_outcomes","chaotic_preview_3x3_vento_reveal_events",
  "training_base_damage_105_reveal_resolved",
  "set optional_reveal_pending=false,effects_fully_resolved=true"]){
  assert.ok(migration.includes(term),term);
 }
 assert.doesNotMatch(migration,/update\s+public\.chaotic_game_nodes/i);
 assert.doesNotMatch(migration,/update\s+public\.chaotic_match_turns/i);
});
test("real transactional integration tests face-down target, permission and replay",()=>{
 for(const term of ["for i in 1..12 loop",
  "Opponent was able to trigger Vento Forte",
  "Vento Forte re-revealed active defender",
  "Vento Forte reveal not persisted",
  "Vento Forte replay accepted","rollback;"]){
   assert.ok(reveal.includes(term),term);
 }
 assert.doesNotMatch(reveal,/\bcommit\s*;/i);
});
test("real transactional integration tests optional skip with no extra face-up",()=>{
 for(const term of ["chaotic_resolve_preview_3x3_vento_reveal(lobby,1,null,true)",
 "Vento Forte skip not settled","Vento Forte skip allowed later reveal",
 "rollback;"]){assert.ok(skip.includes(term),term);}
 assert.doesNotMatch(skip,/\bcommit\s*;/i);
});
test("DROME offers reveal/skip actions and labels visual-only concealment",()=>{
 for(const term of ["chaotic_preview_3x3_face_states",
 "chaotic_preview_3x3_vento_reveal_events",
 "lobby-3x3-vento-choose","lobby-3x3-vento-skip",
 "chaotic_resolve_preview_3x3_vento_reveal",
 "reveal_reason","isFacedown","ainda exige uma etapa posterior",
 "document.createElement(\"option\")"]){assert.ok(ui.includes(term),term);}
 assert.match(ui,/p_skip:true/);assert.match(ui,/p_skip:false/);
});
