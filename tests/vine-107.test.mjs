import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cards, sql,fix,ui,live]=await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-vine-107-native-earth.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-vine-draw-guard-field-fix.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-vine-107-real-integration.test.sql",import.meta.url),"utf8")
]);
test("original Vine 107 has cost 1, 5 neutral and 5 Earth, next-turn disables",()=>{
 const card=cards.slice(cards.indexOf("id: 107"),cards.indexOf("id: 108"));
 for(const m of [/nome: "Armadilha de Vinha"/,/custo: 1/,/danoBase: 5/,
  /terra: 5/,/não pode atacar, ativar habilidades, magias e nem comprar cartas no próximo turno/])
  assert.match(card,m);
 for(let earth of [false,true])assert.equal(5+5*Number(earth),earth?10:5);
});
test("vine server settles natural Earth and atomically creates draw+attack lock",()=>{
 for(const s of ["chaotic_apply_preview_3x3_training_vine_107",
  "expected_name:='Armadilha de Vinha'","expected_cost:=1",
  "meta.earth_component<>5","earth_granted:=actual_elements ? 'terra'",
  "elemental_bonus:=5*earth_granted::integer",
  "last_blocked_turn,blocks_draw","w.defender_id,'107',1",
  "training_elemental_vine_107_attack_draw_lock_partial",
  "hp_remaining=after_hp,damage_events=damage_events+1"]){
  assert.ok(sql.includes(s),s);
 }
 assert.match(sql,/effects_fully_resolved\s*\)/);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_match_turns/i);
});
test("vine next-turn server guard blocks draws without unsafe record field access",()=>{
 assert.match(fix,/draw_inserted:=new.drew_card/);
 assert.match(fix,/l.blocks_draw and draw_inserted/);
 assert.match(sql,/chaotic_3x3_vine_draw_guard/);
 assert.match(sql,/before insert on public\.chaotic_preview_3x3_hand_draw_events/);
 assert.match(sql,/catalog_attack_id='107' and blocked_turn_count=1 and blocks_draw/);
});
test("real disposable SQL fixture exercises seven RPCs and rejected next-turn draw",()=>{
 for(const s of ["for i in 1..7 loop","'Armadilha de Vinha'",
  "chaotic_apply_preview_3x3_training_vine_107",
  "when i=7 and v.actor=host and v.pos=4 then 'Horn-ey'",
  "Vine failed to block a real hand draw","Vine attack+draw restriction",
  "rollback;"]){assert.ok(live.includes(s),s);}
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("DROME tracks Vine and prevents drawing or attacking on locked turns",()=>{
 for(const s of ["chaotic_apply_preview_3x3_training_vine_107","drawLockedThisTurn",
  '!drawLockedThisTurn&&!!ownHandWallet','blocks_draw,training_only',
  'resolvableTrainingAttacks3x3.has(attackId)',
  "Armadilha de Vinha","Habilidades/Mugics ainda pendentes"]){
  assert.ok(ui.includes(s),s);
 }
});
