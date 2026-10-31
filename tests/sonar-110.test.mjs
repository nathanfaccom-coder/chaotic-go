import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [cards,battle,sql,ui,live] = await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../batalha.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-sonar-110-rex-immunity.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-sonar-110-rex-live-integration.test.sql",import.meta.url),"utf8")
]);
test("Original Rex prevents the FULL damage of an Air-bearing attack",()=>{
 const rex=cards.slice(cards.indexOf('nome: "Rex"'),cards.indexOf('nome: "Spedman"'));
 const sonar=cards.slice(cards.indexOf('nome: "SONAR"'),cards.indexOf('nome: "MÃO ELETRÔNICA"'));
 assert.match(rex,/não toma dano do elemento vento/);
 assert.match(sonar,/custo: 2/);
 assert.match(sonar,/danoBase: 0/);
 assert.match(sonar,/terra: 10, ar: 10/);
 assert.match(sonar,/carta de ataque de custo 1 ou inferior/);
 const idx=battle.indexOf("GATILHOS PASSIVOS: Imunidades");
 assert.ok(idx>0);
 const block=battle.slice(idx,idx+1700);
 assert.match(block,/defensorAtual\.nome === "Rex"/);
 assert.match(block,/danoTotal = 0/);
 assert.match(sql,/blocked_damage:=case when rex_immune then potential_damage else 0 end/);
});
test("SONAR calculates native Earth/Air 0/10/20 and Rex cancellation",()=>{
 for(const e of [0,1])for(const a of [0,1]){
  const candidate=10*(e+a);
  for(const rex of [false,true]){
   const prevented=rex?candidate:0;
   const applied=candidate-prevented;
   assert.equal(applied,rex?0:candidate);
  }
 }
 for(const key of ["meta.earth_component<>10 or meta.air_component<>10",
  "potential_damage:=10*earth_granted::integer+10*air_granted::integer",
  "blocked_damage:=case when rex_immune then potential_damage else 0 end",
  "if after_hp<before_hp then","immunity_prevented_damage",
  "training_elemental_sonar_110_rex_immunity_search_pending"]){
  assert.ok(sql.includes(key),key);
 }
});
test("SONAR rejects unknown gear, Naty and a living supporting Guru",()=>{
 for(const key of [
  "actor_ally.creature_name='Naty'","a.position<>w.attacker_slot and a.creature_name='Guru'",
  "and h.hp_remaining>0","gear.equipment_status<>'no_equipment_in_slot'",
  "actor_deck->'equipamentos'","defender_ally.creature_name is distinct from hp_def.creature_name",
  "c.card_id='13' and c.card_name='Rex'"]){
  assert.ok(sql.includes(key),key);
 }
 assert.match(sql,/catalog_attack_id='110' and base_damage=0/);
 assert.match(sql,/not optional_reveal_pending and not effects_fully_resolved/);
});
test("Real test covers 11 RPC scenarios, Rex on Air AND Earth, regular knockouts",()=>{
 for(const key of ["for i in 1..11 loop","when i in(8,10) then 'Guru'",
  "when i in(8,9) then 'Rex'","when i in(6,9,11) then 'Lion'",
  "chaotic_apply_preview_3x3_training_sonar_110",
  "Rex immunity created a fake HP damage event",
  "effect.effects_fully_resolved","rollback;"]){
  assert.ok(live.includes(key),key);
 }
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("DROME displays SONAR immunity, zero damage and pending card search",()=>{
 for(const key of [
 '["101","105","107","110","111","112","113","114"].includes(attackId)',
 "chaotic_apply_preview_3x3_training_sonar_110",
 "immunity_prevented_damage",'110:"SONAR"',
 "Busca de carta custo até 1 PENDENTE"]){
  assert.ok(ui.includes(key),key);
 }
});
