import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,ui,fixture,audit]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-private-dynamic-rpc-response-v0160.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-dynamic-rpc-safe-live.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-dynamic-rpc-safe-audit.test.sql",import.meta.url),"utf8")
]);
test("Original raw dynamic inspection function is no longer invokable by browser roles",()=>{
 assert.match(sql,/revoke all on function public\.chaotic_inspect_preview_3x3_dynamic_elements\(uuid,integer\)/);
 assert.match(sql,/from public,anon,authenticated/);
 assert.match(audit,/has_function_privilege\('authenticated'/);
});
test("New authenticated function retains canonical effect calculation and returns safe projection",()=>{
 for(const marker of [
  "chaotic_inspect_preview_3x3_dynamic_elements_safe",
  "actor uuid:=auth.uid()",
  "perform public.chaotic_inspect_preview_3x3_dynamic_elements(",
  "chaotic_get_preview_3x3_safe_inspections(p_lobby_id)",
  "jsonb_array_elements(safe_state->'dynamic_checks')",
  "return filtered","grant execute on function"
 ]) assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/return result;/);
});
test("DROME calls filtered dynamic inspection and does not treat hidden Guru as false",()=>{
 assert.match(ui,/rpc\("chaotic_inspect_preview_3x3_dynamic_elements_safe"/);
 assert.doesNotMatch(ui,/rpc\("chaotic_inspect_preview_3x3_dynamic_elements",/);
 assert.match(ui,/review\.attacker_air_attack_candidate===null/);
 assert.match(ui,/Bônus de Guru na equipe adversária continua OCULTO/);
});
test("Real 12-attack SQL scenario executes filtered inspector, protects Guru and disallows replay",()=>{
 for(const marker of [
  "for i in 1..12 loop",
  "chaotic_inspect_preview_3x3_dynamic_elements_safe(lobby,1)",
  "Defender inspection RPC leaked opponent support",
  "Dynamic inspection replay accepted",
  "chaotic_get_preview_3x3_safe_inspections(lobby)",
  "Outsider read inspection history",
  "rollback;"
 ]) assert.ok(fixture.includes(marker),marker);
 assert.doesNotMatch(fixture,/\bcommit\s*;/i);
});
test("Legacy damage mechanics and source catalog are left intact",()=>{
 assert.doesNotMatch(sql,/drop\s+function\s+public\.chaotic_inspect_preview_3x3_dynamic_elements\(/i);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_game_nodes/i);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_preview_3x3_hp_wallets/i);
 assert.match(sql,/security definer/);
});
