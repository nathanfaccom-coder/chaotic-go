import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [resolver,spend,live,ui,index,sw,boot,scanner]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-sopro-115-v0172.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-sopro-v0172.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-sopro-115-live-v0172.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.72: SOPRO 115 costs zero, inflicts zero damage, validates original catalog",()=>{
 for(const word of ["chaotic_apply_preview_3x3_training_sopro_115",
  "proj.catalog_attack_id<>'115'","proj.attack_name<>'SOPRO'",
  "proj.base_damage<>0 or proj.attack_cost<>0",
  "c.card_id='115' and c.card_name='SOPRO'",
  "before_hp:=hp_def.hp_remaining;","after_hp:=before_hp",
  "resolution_status='training_sopro_115_random_discard_resolved'"])
 assert.ok(resolver.includes(word),word);
 assert.match(spend,/projection\.catalog_attack_id not in\('101','104','105','107','108','110','111','112','113','114','115'\)/);
 assert.doesNotMatch(resolver,/update\s+public\.chaotic_preview_3x3_hp_wallets/i);
});
test("v0.1.72: server chooses only defender-owned hand card and never transfers ownership",()=>{
 for(const word of [
 "actor uuid:=auth.uid()",
 "select * into m from public.chaotic_match_turns",
 "where lobby_id=p_lobby_id for update",
 "actor_id=w.defender_id and card_state='hand'",
 "order by pg_catalog.random() limit 1 for update",
 "spent_reason='discard'",
 "and card_slot=victim_card.card_slot and card_state='hand'",
 "sopro_discarded_card",
 "chaotic_preview_3x3_sopro_private_discard_check"])
 assert.ok(resolver.includes(word),word);
 assert.doesNotMatch(resolver,/\bset\s+actor_id\s*=/i);
 assert.doesNotMatch(resolver,/\bupdate\s+public\.chaotic_game_nodes\b/i);
});
test("v0.1.72: private effect exposes Boolean only and has no replay",()=>{
 assert.match(resolver,/if exists\(select 1 from public\.chaotic_preview_3x3_training_damage_events/);
 assert.match(resolver,/return event_row/);
 assert.doesNotMatch(resolver,/return .*victim_card\.(attack_instance_id|card_slot)/i);
 assert.match(resolver,/revoke all on function public\.chaotic_apply_preview_3x3_training_sopro_115/);
 assert.match(resolver,/to authenticated/);
 assert.match(live,/SOPRO replay discarded a second card/);
 assert.match(live,/rollback;\s*select 'PASS v0\.1\.72/);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.72: real integration retained fire and vento, tested opponent discard",()=>{
 for(const word of ["chaotic_spend_preview_3x3_attack(room,2)",
  "chaotic_apply_preview_3x3_training_sopro_115(room,2)",
  "Defender can activate SOPRO",
  "SOPRO failed private opponent discard or zero damage",
  "actor_id=host and card_slot=4",
  "actor_id=guest and card_state='hand'",
  "chaotic_pass_turn(room,t+1)",
  "Guest did not recover final defeat"])
  assert.ok(live.includes(word),word);
});
test("v0.1.72: UI and Android cache match without exposing enemy card names",()=>{
 for(const word of [
 'resolvableTrainingAttacks3x3=new Set(["101","104","105","107","108","110","111","112","113","114","115"])',
 "chaotic_apply_preview_3x3_training_sopro_115",
 "sopro_discarded_card,base_damage",
 "SOPRO: uma carta aleatória",
 "SOPRO (115): custo 0, dano 0"])
 assert.ok(ui.includes(word),word);
 assert.match(index,/VERSÃO 0\.1\.72/);
 assert.match(index,/sw\.js\?v=release-72/);
 assert.match(sw,/chaotic-go-release-20261031-72/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-72/);
 assert.match(boot,/chaotic-lobby\.js\?v=release-72/);
});
