import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cards,sql,ui]=await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-fallen-allies-damage-113-114.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8")
]);
test("3x3: original PURGATÓRIO and ESQUELETO add 5 damage per fallen ally",()=>{
 const purg=cards.slice(cards.indexOf("id: 113"),cards.indexOf("id: 114"));
 const skel=cards.slice(cards.indexOf("id: 114"),cards.indexOf("id: 115"));
 for(const [source,name,cost,base] of [[purg,"PURGATÓRIO",0,0],[skel,"ESQUELETO",2,10]]){
  assert.ok(source.includes('nome: "'+name+'"'));
  assert.ok(source.includes("custo: "+cost));
  assert.ok(source.includes("danoBase: "+base));
  assert.match(source,/\+5 de Dano extra para cada campeão seu derrotado/);
 }
 for(const token of ["expected_name","expected_cost",
  "proj.catalog_attack_id not in ('113','114')",
  "bonus_damage:=5*defeated_count","unit_count<>3","chaotic_preview_card_reference"]){
  assert.ok(sql.includes(token),token);
 }
});
test("3x3: all 0,1,2 defeated allies yield 0/5/10 or 10/15/20",()=>{
 for(const [base,expected] of [[0,[0,5,10]],[10,[10,15,20]]]){
  for(let dead=0;dead<=2;dead++){
   const damage=base+5*dead;assert.equal(damage,expected[dead]);
   for(const hp of [1,4,10,17,40,500]){
    const after=Math.max(0,hp-damage);
    assert.equal(hp-after,Math.min(hp,damage));
    if(!base&&!dead)assert.equal(after,hp);
   }
  }
 }
 assert.match(sql,/after_hp:=greatest\(0,before_hp-damage_points-bonus_damage\)/);
});
test("3x3: zero PURGATÓRIO does not update HP/KO but resolves turn",()=>{
 assert.match(sql,/if after_hp<before_hp then\s*update public\.chaotic_preview_3x3_hp_wallets/);
 assert.match(sql,/resolution_status='training_conditional_damage_resolved'/);
 assert.match(sql,/check\(damage_dealt between 0 and 20\)/);
 assert.match(sql,/catalog_attack_id='113' and base_damage=0/);
 assert.match(sql,/hp_after=greatest\(0,hp_before-base_damage-bonus_damage\)/);
});
test("3x3: KO trigger checks canonical 113/114 dynamic damage",()=>{
 assert.match(sql,/paid.catalog_attack_id not in \('105','111','112','113','114'\)/);
 assert.match(sql,/when '113' then 5\*dead_count/);
 assert.match(sql,/when '114' then 10\+5\*dead_count/);
 assert.match(sql,/old.hp_remaining>expected_damage/);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_match_turns/i);
});
test("3x3: DROME dispatches conditional RPC and displays original damage sources",()=>{
 for(const term of [
  "chaotic_apply_preview_3x3_training_fallen_allies",
  '["101","105","111","112","113","114"].includes(currentProjection?.catalog_attack_id)',
  '["101","105","111","112","113","114"].includes(attackId)',
  "defeated_allies_count","bonus_damage","PURGATÓRIO","ESQUELETO"
 ])assert.ok(ui.includes(term),term);
 assert.match(ui,/chaotic_preview_3x3_training_damage_events/);
});