import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [privacy,timestamps,ui,live,audit]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-alakazaz-transfer-existence-privacy.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-facedsafe-timestamps.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-alakazaz-transfer-existence-live.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-alakazaz-transfer-existence-audit.test.sql",import.meta.url),"utf8")
]);
test("Alakazaz-only transfer must be HIDDEN even as an event until donor revealed",()=>{
 assert.match(privacy,/where t\.actor_id=actor or coalesce\(fd\.face_up,false\)/);
 assert.match(privacy,/from \(select \* from public\.chaotic_preview_3x3_token_transfers/);
 assert.doesNotMatch(privacy,/where t\.actor_id=actor or coalesce\(fr\.face_up,false\)/);
});
test("Owner can see their transfer while visible donor and hidden receiver use masked fields",()=>{
 assert.match(privacy,/case when t\.actor_id=actor or/);
 assert.match(privacy,/coalesce\(fd\.face_up,false\) and coalesce\(fr\.face_up,false\)/);
 for(const x of ["'donor_creature_instance_id',null",
  "'receiver_creature_instance_id',null","'receiver_before',null",
  "'receiver_after',null"])assert.ok(privacy.includes(x),x);
});
test("Hidden opponent creature's updated_at and created_at cannot fingerprint token donor",()=>{
 assert.match(timestamps,/'received_tokens',null,'created_at',null,'updated_at',null/);
 assert.match(timestamps,/a\.actor_id=actor or coalesce\(f\.face_up,false\)/);
});
test("Role-authenticated SQL test covers hidden event, owner, receiver and outsider",()=>{
 for(const x of [
  "Hidden Alakazaz identity leaked through existence of transfer",
  "Alakazaz identified via hidden ally timestamps",
  "Owner lost their own Alakazaz training history",
  "Revealed donor history not visible",
  "Receiver hidden information leaked",
  "Non-member accessed safe formation RPC",
  "set local role authenticated",
  "rollback;"
 ])assert.ok(live.includes(x),x);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("DROME uses sanitized transfer history without direct rival table or Realtime",()=>{
 assert.match(ui,/safeState\?\.token_transfers/);
 assert.doesNotMatch(ui,/\.from\("chaotic_preview_3x3_token_transfers"\)/);
 assert.doesNotMatch(ui,/table:"chaotic_preview_3x3_token_transfers"/);
 assert.match(audit,/has_table_privilege\('anon'/);
});
