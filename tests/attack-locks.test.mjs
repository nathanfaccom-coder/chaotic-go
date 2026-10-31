import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cards,sql,ui]=await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-training-attack-locks-111-112.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8")
]);
test("3x3: original MÃO ELETRÔNICA / MÃO MÃO cards retain damage, cost and restriction",()=>{
 const c111=cards.slice(cards.indexOf("id: 111"),cards.indexOf("id: 112"));
 const c112=cards.slice(cards.indexOf("id: 112"),cards.indexOf("id: 113"));
 assert.match(c111,/nome: "MÃO ELETRÔNICA"/);
 assert.match(c111,/custo: 3/);
 assert.match(c111,/danoBase: 10/);
 assert.match(c111,/não pode atacar nos 2 próximos turnos/);
 assert.match(c112,/nome: "MÃO MÃO"/);
 assert.match(c112,/custo: 1/);
 assert.match(c112,/danoBase: 5/);
 assert.match(c112,/não pode atacar no próximo turno/);
 for(const token of ["expected_name","expected_cost","chaotic_preview_card_reference",
  "proj.catalog_attack_id not in ('111','112')","proj.base_damage is distinct from damage_points"])
  assert.ok(sql.includes(token),token);
});
test("3x3: lock starts on defender's next turn and spans exactly their 1/2 turns",()=>{
 const blocked=(origin,count,turn)=>turn>origin&&turn<=origin+2*count-1&&
   (turn-origin)%2===1; // strict alternating actor turns in chaotic_match_turns
 for(const origin of [1,2,19,89]){
  assert.deepEqual([1,2,3,4,5].filter(n=>blocked(origin,1,origin+n)),[1]);
  assert.deepEqual([1,2,3,4,5].filter(n=>blocked(origin,2,origin+n)),[1,3]);
 }
 assert.match(sql,/last_blocked_turn=inflicted_turn\+2\*blocked_turn_count-1/);
 assert.match(sql,/turn_num>l.inflicted_turn and turn_num<=l.last_blocked_turn/);
});
test("3x3: KO and final-hit transactions stay valid for attacks 105,111,112",()=>{
 assert.match(sql,/paid.catalog_attack_id not in \('105','111','112'\)/);
 assert.match(sql,/case when paid.catalog_attack_id='111' then 10 else 5 end/);
 assert.match(sql,/paid.catalog_attack_id,old.hp_remaining/);
 assert.match(sql,/base_damage=10/);
 assert.match(sql,/base_damage=5/);
 assert.match(sql,/resolution_status='training_base_damage_attack_lock_applied'/);
 assert.match(sql,/trigger chaotic_3x3_terminal_guard/);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_match_turns/i);
});
test("3x3: DROME shows locked turns and resolves only original eligible attacks",()=>{
 for(const text of ["chaotic_apply_preview_3x3_training_attack_lock",
 "chaotic_preview_3x3_training_attack_locks","lobby-3x3-training-attack-locks",
 "trainingAttackLocks3x3=locks.data||[]",
 'table:"chaotic_preview_3x3_training_attack_locks"',
 '["101","105","107","110","111","112","113","114"].includes(currentProjection?.catalog_attack_id)',
 "attackLockedThisTurn","MÃO ELETRÔNICA","MÃO MÃO"]){
  assert.ok(ui.includes(text),text);
 }
 assert.match(ui,/!attackLockedThisTurn&&myBoard.length===3/);
 assert.match(ui,/!attackLockedThisTurn&&!!currentContact/);
});
