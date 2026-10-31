import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [resolver,spend,live,ui,index,sw,boot,scanner]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-speed-108-v0171.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-speed-v0171.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-speed-108-live-v0171.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.71: SPEED is original cost-zero and zero-damage server action",()=>{
 for(const marker of ["chaotic_apply_preview_3x3_training_speed_108",
  "proj.catalog_attack_id<>'108'","proj.attack_name<>'SPEED'",
  "proj.base_damage<>0 or proj.attack_cost<>0",
  "c.card_id='108' and c.card_name='SPEED'",
  "before_hp:=hp_def.hp_remaining;","after_hp:=before_hp",
  "speed_drew_card","training_speed_108_bonus_draw_resolved"])
   assert.ok(resolver.includes(marker),marker);
 assert.match(spend,/projection\.catalog_attack_id not in\('101','104','105','107','108'/);
});
test("v0.1.71: bonus draw stays owner-private and obeys 5-card limit",()=>{
 for(const marker of ["n_hand<5","card_state='deck'","card_state='hand'",
  "last_draw_turn<>p_expected_turn","attack_wallet.total_cards",
  "cycle>120","recycle_priority=pg_catalog.gen_random_uuid()",
  "where lobby_id=p_lobby_id and actor_id=actor",
  "select * into m from public.chaotic_match_turns",
  "where lobby_id=p_lobby_id for update"])
   assert.ok(resolver.includes(marker),marker);
 assert.doesNotMatch(resolver,/\bupdate public\.chaotic_game_nodes\b/i);
 assert.doesNotMatch(resolver,/\bupdate public\.chaotic_preview_3x3_hp_wallets\b/i);
 assert.doesNotMatch(resolver,/\bupdate public\.chaotic_preview_3x3_attack_hand[^;]*actor_id=w\.defender_id/i);
});
test("v0.1.71: only one private bonus-draw receipt and no replay allowed",()=>{
 for(const marker of ["chaotic_preview_3x3_speed_private_draw_check",
   "chaotic_preview_3x3_training_elemental_attack_catalog_check",
   "training_speed_108_bonus_draw_resolved",
   "if exists(select 1 from public.chaotic_preview_3x3_training_damage_events",
   "drew:=true","speed_drew_card is not null",
   "revoke all on function public.chaotic_apply_preview_3x3_training_speed_108",
   "to authenticated"])
   assert.ok(resolver.includes(marker),marker);
 assert.doesNotMatch(resolver,/drawn_card_slot/i);
});
test("v0.1.71: real Supabase test validates payment, privacy, no damage and full recovery",()=>{
 for(const marker of ["chaotic_spend_preview_3x3_attack(room,2)",
   "chaotic_apply_preview_3x3_training_speed_108(room,2)",
   "Defender can activate SPEED",
   "SPEED replay drew a second card",
   "SPEED failed bonus private draw or zero damage",
   "status_snapshot->>'phase'<>'damage_settled'",
   "chaotic_pass_turn(room,t+1)",
   "PASS v0.1.71"])
   assert.ok(live.includes(marker),marker);
 assert.match(live,/rollback;\s*select 'PASS v0\.1\.71/);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.71: DROME and PWA use new SPEED resolver without touching existing cards",()=>{
 for(const marker of [
   'resolvableTrainingAttacks3x3=new Set(["101","104","105","107","108"',
   "chaotic_apply_preview_3x3_training_speed_108",
   "speed_drew_card,base_damage",
   "SPEED: 1 carta adicional",
   "SPEED (108): custo 0, dano 0"])
   assert.ok(ui.includes(marker),marker);
 assert.match(index,/VERSÃO 0\.1\.71/);
 assert.match(index,/sw\.js\?v=release-71/);
 assert.match(sw,/chaotic-go-release-20261031-71/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-71/);
 assert.match(boot,/chaotic-lobby\.js\?v=release-71/);
});
