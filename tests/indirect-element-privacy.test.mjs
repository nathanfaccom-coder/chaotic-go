import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [privacy,hardening,ui,fixture,audit] = await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-indirect-element-history-privacy.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-indirect-element-history-hardening.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-indirect-element-privacy-live.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-indirect-element-privacy-audit.test.sql",import.meta.url),"utf8")
]);
const secret=["chaotic_preview_3x3_creature_element_checks",
"chaotic_preview_3x3_dynamic_element_checks"];
test("3x3: removes direct member access and Realtime to two raw fingerprint tables",()=>{
 for(const name of secret){
  assert.ok(privacy.includes("on public."+name),name);
  assert.ok(privacy.includes("drop table public."+name),name);
  assert.ok(privacy.includes("revoke select on public."+name),name);
  assert.doesNotMatch(ui,new RegExp('\\.from\\("'+name+'"\\)'));
  assert.doesNotMatch(ui,new RegExp('table:"'+name+'"'));
 }
});
test("3x3: safe inspection RPC checks auth, room and outputs whitelisted keys",()=>{
 assert.match(privacy,/actor uuid:=auth.uid\(\)/);
 assert.match(privacy,/actor not in \(actor_host,actor_guest\)/);
 assert.match(privacy,/revoke all on function public\.chaotic_get_preview_3x3_safe_inspections/);
 assert.match(privacy,/grant execute on function public\.chaotic_get_preview_3x3_safe_inspections/);
 assert.match(privacy,/pg_catalog\.jsonb_build_object/);
 assert.doesNotMatch(privacy,/to_jsonb\(c\)|to_jsonb\(d\)/);
});
test("3x3: does not expose unrevealed element arrays, Rex immunity, Naty or Guru",()=>{
 for(const marker of [
  "'attacker_base_elements',case","'defender_base_elements',case",
  "'rex_air_immunity_candidate',case",
  "'attacker_naty_variable_candidate',case",
  "'defender_naty_variable_candidate',case",
  "'attacker_guru_support_count',case",
  "'defender_guru_support_count',case"
 ])assert.ok(privacy.includes(marker),marker);
 assert.match(privacy,/coalesce\(fa\.face_up,false\)/);
 assert.match(privacy,/coalesce\(fd\.face_up,false\)/);
});
test("3x3: historical Guru count remains hidden even after face-down team member is KO'd",()=>{
 assert.match(hardening,/not coalesce\(f\.face_up,false\)/);
 assert.doesNotMatch(hardening,/h\.hp_remaining>0/);
 assert.match(hardening,/create or replace function public\.chaotic_get_preview_3x3_safe_inspections/);
});
test("3x3: DROME displays concealed labels instead of false negative Guru/Naty",()=>{
 assert.match(ui,/chaotic_get_preview_3x3_safe_inspections/);
 assert.match(ui,/Campeão oculto/);
 assert.match(ui,/Guru aliado vivo \(atacante\)/);
 assert.match(ui,/==null\?"oculto"/);
 assert.match(ui,/informação parcialmente oculta/);
 assert.match(ui,/Imunidades adversárias ocultas/);
});
test("3x3: live SQL exercise restores 12-attack integration and tests hidden Guru and outsider",()=>{
 for(const key of ["for i in 1..12 loop",
 "chaotic_get_preview_3x3_safe_inspections",
 "Attacker reads hidden rival elemental identity/Guru",
 "Defender cannot see own hidden supporter",
 "Outsider read inspection history","rollback;"]){
  assert.ok(fixture.includes(key),key);
 }
 assert.doesNotMatch(fixture,/\bcommit\s*;/i);
 assert.match(audit,/has_table_privilege\('authenticated'/);
});
