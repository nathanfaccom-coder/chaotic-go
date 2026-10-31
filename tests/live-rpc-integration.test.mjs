import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
 new URL("../supabase/tests/chaotic-preview-3x3-live-rpc-integration.test.sql",import.meta.url),"utf8"
);

test("live SQL training integration uses only disposable accounts and rolls back all writes",()=>{
 assert.match(sql,/^begin;\s*do \$integration\$/i);
 assert.match(sql,/end \$integration\$;\s*rollback;/i);
 assert.match(sql,/a1510000-0000-4000-8000-000000000151/);
 assert.match(sql,/a1510000-0000-4000-8000-000000000152/);
 assert.match(sql,/example\.invalid/);
 assert.match(sql,/insert into auth\.users/i);
 assert.match(sql,/update public\.chaotic_lobbies set status='cancelled'/);
 assert.doesNotMatch(sql,/\bcommit\s*;/i);
});

test("live integration exercises five server RPCs and actual training HP",()=>{
 for(const marker of [
  "'105'","'111'","'112'","'113'","'114'",
  "chaotic_apply_preview_3x3_training_base_105",
  "chaotic_apply_preview_3x3_training_attack_lock",
  "chaotic_apply_preview_3x3_training_fallen_allies",
  "chaotic_preview_3x3_attack_spends",
  "chaotic_preview_3x3_defense_windows",
  "chaotic_preview_3x3_private_equipment_checks",
  "chaotic_preview_3x3_training_knockouts",
  "chaotic_preview_3x3_training_damage_events",
  "effect.hp_before<>prior_hp",
  "current_hp<>expected_hp",
  "expected_bonus"
 ])assert.ok(sql.includes(marker),marker);
});

test("live integration rejects another actor, replay and unresolved equipment",()=>{
 assert.match(sql,/set_config\('request\.jwt\.claim\.sub',guest::text,true\)/);
 assert.match(sql,/position\('Apenas o atacante' in error_text\)/);
 assert.match(sql,/Replay attack % was accepted/);
 assert.match(sql,/Defender equipment was ignored/);
 assert.match(sql,/chaotic_pass_turn\(lobby,1\)/);
 assert.match(sql,/position\('impedida de atacar' in error_text\)/);
 assert.match(sql,/Zero PURGATÓRIO created fake damage/);
});
