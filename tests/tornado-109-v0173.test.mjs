import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [resolver,spend,live,ui,index,sw,boot,scanner]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-tornado-109-v0173.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-tornado-v0173.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-tornado-109-live-v0173.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.73: TORNADO 109 requires original natural Air and initialized opponent hand before spending",()=>{
 for(const marker of [
 "projection.catalog_attack_id='109'",
 "c.creature_elements ? 'ar'",
 "TORNADO só pode ser pago com campeão atacante de elemento Ar",
 "TORNADO exige mão adversária inicializada",
 "projection.catalog_attack_id not in('101','104','105','107','108','109'",
 "Somente TORNADO original (109",
 "not (creature.attacker_base_elements ? 'ar')"])
 assert.ok((spend+"\n"+resolver).includes(marker),marker);
});
test("v0.1.73: owner-only hand shuffle draws up to two without moving real ownership",()=>{
 for(const marker of [
 "actor_id=w.defender_id",
 "set card_state='deck',draw_cycle=target_wallet.recycle_cycles",
 "recycle_priority=pg_catalog.gen_random_uuid()",
 "for i in 1..2 loop",
 "set card_state='hand'",
 "target_wallet.total_cards",
 "hand_count>5",
 "where lobby_id=p_lobby_id for update"])
 assert.ok(resolver.includes(marker),marker);
 assert.doesNotMatch(resolver,/set\s+actor_id\s*=/);
 assert.doesNotMatch(resolver,/update\s+public\.chaotic_game_nodes/i);
 assert.doesNotMatch(resolver,/update\s+public\.chaotic_preview_3x3_hp_wallets/i);
});
test("v0.1.73: no card identity in shared receipt, no double application",()=>{
 for(const marker of [
 "chaotic_preview_3x3_tornado_private_count_check",
 "tornado_shuffled_count between 0 and 5",
 "tornado_drawn_count between 0 and 2",
 "training_tornado_109_reshuffle_two_resolved",
 "if exists(select 1 from public.chaotic_preview_3x3_training_damage_events",
 "revoke all on function public.chaotic_apply_preview_3x3_training_tornado_109",
 "to authenticated"])
 assert.ok(resolver.includes(marker),marker);
 assert.doesNotMatch(resolver,/return\s+victim_card/i);
});
test("v0.1.73: live rollback test exercised denied non-Air, two redraws and anti-replay",()=>{
 for(const marker of [
 "Non-Air attacker paid TORNADO",
 "chaotic_spend_preview_3x3_attack(room,2)",
 "chaotic_apply_preview_3x3_training_tornado_109(room,2)",
 "dmg.tornado_shuffled_count<>1 or dmg.tornado_drawn_count<>2",
 "TORNADO replay reshuffled or drew cards twice",
 "TORNADO failed defender shuffle/two private draws/zero damage",
 "Guest did not recover final defeat",
 "rollback;","PASS v0.1.73"])
 assert.ok(live.includes(marker),marker);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.73: DROME supports TORNADO; old cards and Android cache remain versioned",()=>{
 for(const marker of [
 'resolvableTrainingAttacks3x3=new Set(["101","104","105","107","108","109"',
 "chaotic_apply_preview_3x3_training_tornado_109",
 "tornado_shuffled_count,tornado_drawn_count,base_damage",
 "TORNADO: ",
 "TORNADO (109): custo 0, dano 0"])
 assert.ok(ui.includes(marker),marker);
 assert.match(index,/VERSÃO 0\.1\.73/);
 assert.match(index,/sw\.js\?v=release-73/);
 assert.match(sw,/chaotic-go-release-20261031-73/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-73/);
 assert.match(boot,/chaotic-lobby\.js\?v=release-73/);
});
