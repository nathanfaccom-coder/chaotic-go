import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [trigger,live,sqlBorrow]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-return-loans-on-outcome-v0176.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-automatic-loan-return-v0176.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-black-hand-atomic-custody-v0175.sql",import.meta.url),"utf8")
]);
test("v0.1.76: terminal-trigger returns held originals before terminal lock",()=>{
 for(const marker of [
 "chaotic_restore_3x3_loans_before_training_outcome",
 "before insert on public.chaotic_preview_3x3_training_outcomes",
 "c.custody_state='held' and c.training_only",
 "order by c.source_actor_id,c.source_card_slot for update",
 "original.card_state<>'loaned'",
 "original.attack_instance_id is distinct from loan.source_attack_instance_id",
 "set card_state='deck',recycle_priority=pg_catalog.gen_random_uuid()",
 "set custody_state='released',released_turn=new.decided_turn"])
 assert.ok(trigger.includes(marker),marker);
});
test("v0.1.76: cleanup is atomic, scope-specific, cannot be called directly from browser",()=>{
 for(const marker of [
 "new.outcome_scope<>'training_only_no_official_victory'",
 "new.official_match_ended or new.official_match_modified",
 "new.experience_awarded or new.currency_awarded",
 "get diagnostics changed=row_count",
 "if changed<>1 then raise exception",
 "revoke all on function public.chaotic_restore_3x3_loans_before_training_outcome()"])
 assert.ok(trigger.includes(marker),marker);
 assert.doesNotMatch(trigger,/\bupdate public\.chaotic_game_nodes\b/i);
 assert.doesNotMatch(trigger,/\bset actor_id\s*=/i);
 assert.ok(sqlBorrow.includes("set card_state='loaned'"));
});
test("v0.1.76: actual SQL rollback tests corrupted loan blocking final result and successful return",()=>{
 for(const marker of [
 "chaotic_internal_hold_preview_3x3_black_hand(lobby,1)",
 "Corrupt loan unexpectedly permitted terminal outcome",
 "Failed outcome left a committed winner row",
 "End-of-training did not restore the original owner card",
 "Training-only outcome touched official match or rewards",
 "rollback;","PASS v0.1.76"])
 assert.ok(live.includes(marker),marker);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
