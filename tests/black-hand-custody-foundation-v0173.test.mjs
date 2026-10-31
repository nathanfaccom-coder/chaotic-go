import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [schema,live,spend,ui]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-temporary-card-custody-v0173.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-custody-foundation-live-v0173.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-tornado-v0173.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8")
]);
test("v0.1.73: stolen card custody is a separate training-only table, never a Deck mutation",()=>{
 for(const marker of ["chaotic_preview_3x3_temporary_card_custody",
 "source_actor_id","borrower_id","source_card_slot","source_attack_instance_id",
 "catalog_attack_id","custody_state","training_only boolean not null default true check(training_only)",
 "source_actor_id<>borrower_id","source_card_slot between 1 and 20"])
 assert.ok(schema.includes(marker),marker);
 assert.doesNotMatch(schema,/\bupdate\s+public\.chaotic_game_nodes/i);
 assert.doesNotMatch(schema,/\bupdate\s+public\.chaotic_preview_3x3_attack_hand/i);
});
test("v0.1.73: dormant custody private by RLS with no client write rights",()=>{
 assert.match(schema,/enable row level security/);
 assert.match(schema,/grant select on public\.chaotic_preview_3x3_temporary_card_custody to authenticated/);
 assert.match(schema,/revoke all on public\.chaotic_preview_3x3_temporary_card_custody from public,anon,authenticated/);
 assert.match(schema,/for select to authenticated/);
 assert.match(schema,/\(select auth\.uid\(\)\) in\(source_actor_id,borrower_id\)/);
 assert.doesNotMatch(schema,/grant (insert|update|delete)/i);
 for(const marker of ["Owner cannot see custody","Borrower cannot see custody",
 "Outsider can see custody","Client forged custody","rollback;","PASS 0.1.73"])
 assert.ok(live.includes(marker),marker);
});
test("v0.1.73: 102 remains unpayable until borrowed cards can be validated and played",()=>{
 assert.match(spend,/projection\.catalog_attack_id not in\('101','104','105','107','108','109','110','111','112','113','114','115'\)/);
 assert.ok(!ui.includes("chaotic_apply_preview_3x3_training_black_hand_102"),
 "Do not pretend card theft is playable");
});
