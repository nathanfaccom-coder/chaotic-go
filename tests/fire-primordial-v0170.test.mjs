import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,spend,live,ui,index,sw,bootstrap,scanner]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-fire-104-v0170.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-104-v0170.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-fire-104-live-v0170.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.70: Fogo Primordial 104 rolls one server d6 atomically with HP",()=>{
 for(const x of ["chaotic_apply_preview_3x3_training_fire_104","pg_catalog.random()*6",
  "effective_damage:=5*fire_die_roll","fire_die_roll","training_fire_104_die_resolved",
  "where lobby_id=p_lobby_id for update","chaotic_preview_3x3_training_damage_events"])
  assert.ok(sql.includes(x),x);
 const damage=sql.indexOf("insert into public.chaotic_preview_3x3_training_damage_events(",sql.indexOf("fire_die_roll:="));
 const hp=sql.indexOf("update public.chaotic_preview_3x3_hp_wallets",damage);
 assert.ok(damage>=0&&hp>damage,"roll event must exist before HP KO verification");
 assert.doesNotMatch(sql,/\b(official_match_ended|currency_awarded)\s*=\s*true\b/i);
});
test("v0.1.70: constraints and KO trigger check the recorded die, not a client value",()=>{
 for(const x of ["chaotic_preview_3x3_fire_die_only_104",
  "fire_die_roll between 1 and 6","damage_dealt <= 30",
  "chaotic_preview_3x3_knockout_elemental_attack",
  "Nocaute de Fogo Primordial sem dado íntegro",
  "expected_damage:=5*fire_event.fire_die_roll",
  "fire_event.hp_after is distinct from new.hp_remaining",
  "paid.catalog_attack_id not in ('101','104','105'"]){
  assert.ok(sql.includes(x),x);
 }
 assert.match(sql,/grant execute on function public\.chaotic_apply_preview_3x3_training_fire_104\(uuid,integer\)\s+to authenticated/i);
 assert.match(sql,/revoke all on function public\.chaotic_apply_preview_3x3_training_fire_104\(uuid,integer\)/i);
});
test("v0.1.70: canonical 104 payment costs two and preserves original cards",()=>{
 assert.match(spend,/projection\.catalog_attack_id not in\('101','104','105'/);
 assert.match(spend,/available_points<projection\.attack_cost/);
 assert.match(spend,/new_spent:=wallet\.spent_points\+projection\.attack_cost/);
 assert.doesNotMatch(spend,/update\s+public\.chaotic_game_nodes/i);
 assert.doesNotMatch(spend,/update\s+public\.chaotic_preview_3x3_hp_wallets/i);
});
test("v0.1.70: database rollback tested paid 104, legitimate KO and anti-replay",()=>{
 for(const x of ["chaotic_spend_preview_3x3_attack(room,t)",
  "Original Fogo 104 payment was not atomic",
  "Defender rolled attacker die",
  "chaotic_apply_preview_3x3_training_fire_104(room,t)",
  "dmg.fire_die_roll not between 1 and 6",
  "dmg.base_damage<>5*dmg.fire_die_roll",
  "Post-reconnect damage replay accepted",
  "Guest did not recover final defeat",
  "rollback;","PASS v0.1.70"]){
 assert.ok(live.includes(x),x);
 }
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.70: DROME shows persisted die and versioned Android assets",()=>{
 for(const x of ["resolvableTrainingAttacks3x3=new Set([\"101\",\"104\"",
  "chaotic_apply_preview_3x3_training_fire_104",
  "fire_die_roll,base_damage",
  "Dado do servidor: ",
  "settled.fire_die_roll",
  "Fogo Primordial 2.0 (104): o servidor rola automaticamente 1d6"]){
 assert.ok(ui.includes(x),x);
 }
 assert.match(index,/VERSÃO 0\.1\.70/);
 assert.match(index,/sw\.js\?v=release-70/);
 assert.match(sw,/chaotic-go-release-20261031-70/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-70/);
 assert.match(bootstrap,/chaotic-lobby\.js\?v=release-70/);
});
