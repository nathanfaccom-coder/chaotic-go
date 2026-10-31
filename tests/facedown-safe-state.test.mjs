import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [migration,ui,live]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-facedsafe-state-v0157.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-facedsafe-state-live.test.sql",import.meta.url),"utf8")
]);
const privateTables=[
 "chaotic_preview_3x3_allies",
 "chaotic_preview_3x3_hp_wallets",
 "chaotic_preview_3x3_board_positions",
 "chaotic_preview_3x3_move_events",
 "chaotic_preview_3x3_token_transfers"
];
test("RLS: five raw 3x3 identity-bearing tables are owner-only, no raw Realtime",()=>{
 for(const name of privateTables){
  assert.match(migration,new RegExp("drop policy if exists chaotic_preview_3x3_"));
  assert.ok(migration.includes("on public."+name),name);
  assert.ok(migration.includes("and tablename='"+name+"'"),name);
  assert.doesNotMatch(ui,new RegExp('\\.from\\("'+name+'"\\)'));
  assert.doesNotMatch(ui,new RegExp('table:"'+name+'"'));
 }
 assert.match(migration,/using\(actor_id=\(select auth.uid\(\)\)\)/);
});
test("Only a member may obtain masked state via authenticated security-definer function",()=>{
 assert.match(migration,/actor uuid:=auth.uid\(\)/);
 assert.match(migration,/actor not in\(host_user,guest_user\)/);
 assert.match(migration,/revoke all on function public\.chaotic_get_preview_3x3_safe_state\(uuid\)/);
 assert.match(migration,/grant execute on function public\.chaotic_get_preview_3x3_safe_state\(uuid\)\s+to authenticated/);
 assert.match(ui,/rpc\("chaotic_get_preview_3x3_safe_state"/);
});
test("Face-down rivals have server-masked creature names, card IDs, deck slots and HP",()=>{
 for(const col of ["creature_instance_id","creature_name","starting_tokens",
  "remaining_tokens","received_tokens","deck_slot","hp_initial","hp_max","damage_events",
  "healing_events"]){
  assert.ok(migration.includes("'"+col+"',null"),col);
 }
 assert.match(migration,/case when h.hp_remaining>0 then 1 else 0 end/);
 assert.match(migration,/coalesce\(f.face_up,false\)/);
});
test("Movement and private token transfer data cannot reveal a facedown card instance",()=>{
 assert.match(migration,/from public\.chaotic_preview_3x3_board_positions b/);
 assert.match(migration,/from \(select \* from public\.chaotic_preview_3x3_move_events/);
 assert.match(migration,/from \(select \* from public\.chaotic_preview_3x3_token_transfers/);
 assert.match(migration,/then to_jsonb\(ev\)\s+else to_jsonb\(ev\)\|\|pg_catalog\.jsonb_build_object/);
 assert.match(migration,/'donor_creature_name',null/);
 assert.match(ui,/transferência de ficha entre c/);
});
test("Real transactional test switches authenticated actors, masks opponent and rejects outsider",()=>{
 for(const term of ["set local role authenticated",
  "request.jwt.claim.sub","Host masked view leaked",
  "Guest saw facedown rival","Non-member accessed safe formation RPC",
  "Raw secret table still on Realtime","rollback;"]){
  assert.ok(live.includes(term),term);
 }
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("DROME hides facedown HP and uses server safe-state for all five formerly public tables",()=>{
 assert.match(ui,/safeState\?\.allies/);
 assert.match(ui,/safeState\?\.hp_wallets/);
 assert.match(ui,/safeState\?\.board_positions/);
 assert.match(ui,/safeState\?\.move_events/);
 assert.match(ui,/safeState\?\.token_transfers/);
 assert.match(ui,/HP oculto/);
 assert.match(ui,/isFacedown/);
});
