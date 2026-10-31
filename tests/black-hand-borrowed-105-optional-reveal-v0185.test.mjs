import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const paths=[
"supabase/chaotic-borrowed-105-optional-reveal-ledger-v0185.sql",
"supabase/chaotic-borrowed-105-optional-reveal-rpc-v0185.sql",
"supabase/chaotic-borrowed-105-reveal-next-turn-guard-v0185.sql",
"supabase/tests/chaotic-borrowed-105-optional-reveal-live-v0185.test.sql",
"supabase/tests/chaotic-borrowed-105-optional-reveal-skip-v0185.test.sql",
"supabase/tests/chaotic-borrowed-105-reveal-after-terminal-denied-v0185.test.sql",
"supabase/tests/chaotic-borrowed-105-atomic-base-live-v0182.test.sql",
"supabase/tests/chaotic-borrowed-105-single-ko-live-v0183.test.sql",
"chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"];
const [schema,rpc,guard,positive,skip,terminal,oldBase,oldKO,ui,index,sw,scanner,loader]=
 await Promise.all(paths.map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));
test("v0.1.85: separate optional borrowed 105 receipt is training-only, RLS members and read-only",()=>{
 for(const marker of [
 "chaotic_preview_3x3_borrowed_105_reveal_events",
 "foreign key(lobby_id,turn_no)",
 "references public.chaotic_preview_3x3_borrowed_105_base_events(lobby_id,turn_no)",
 "enable row level security",
 "revoke all on public.chaotic_preview_3x3_borrowed_105_reveal_events from public,anon,authenticated",
 "grant select on public.chaotic_preview_3x3_borrowed_105_reveal_events to authenticated",
 "(select auth.uid())=attacker_id or (select auth.uid())=defender_id",
 "check((skipped and revealed_slot is null)"
 ])assert.ok(schema.includes(marker),marker);
 assert.doesNotMatch(schema,/grant\s+(insert|update|delete|all)\s+on\s+public\.chaotic_preview_3x3_borrowed_105_reveal_events\s+to\s+authenticated/i);
});
test("v0.1.85: borrower can choose or skip ONLY after paid settled damage; no double charge",()=>{
 for(const marker of [
 "actor uuid:=auth.uid()",
 "m.current_player is distinct from actor",
 "exists(select 1 from public.chaotic_preview_3x3_training_outcomes",
 "plan.state<>'base_resolved_no_optional_reveal'",
 "not plan.payment_applied or not plan.damage_applied",
 "paid.points_after<>paid.points_before-1",
 "paid.hp_after is distinct from greatest(0,paid.hp_before-5)",
 "chaotic_preview_3x3_borrowed_105_reveal_events",
 "loan.custody_state<>'released'",
 "original.card_state<>'deck'",
 "if not p_skip then",
 "face.face_up",
 "hp.hp_remaining>0",
 "face_up=true,reveal_reason='vento_forte',revealed_turn=p_expected_turn",
 "return pg_catalog.jsonb_build_object",
 "'payment_applied_again',false",
 "'damage_applied_again',false",
 "grant execute on function public.chaotic_resolve_preview_3x3_borrowed_105_reveal"
 ])assert.ok(rpc.includes(marker),marker);
 assert.doesNotMatch(rpc,/update\s+public\.chaotic_preview_3x3_(attack_wallets|hp_wallets|attack_hand|temporary_card_custody)/i);
});
test("v0.1.85: nonterminal turn cannot skip optional reveal; finished training stays finished",()=>{
 for(const marker of [
 "new.turn_no is distinct from old.turn_no",
 "chaotic_preview_3x3_borrowed_105_base_events paid",
 "not exists(select 1 from public.chaotic_preview_3x3_borrowed_105_reveal_events",
 "not exists(select 1 from public.chaotic_preview_3x3_training_outcomes",
 "chaotic_guard_borrowed_105_reveal_before_next_turn"
 ])assert.ok(guard.includes(marker),marker);
});
test("v0.1.85: live tests confirm borrower-only reveal target, replay, RLS and turn guard",()=>{
 for(const marker of [
 "Reveal without paid attack accepted",
 "Unchosen borrowed reveal allowed next turn",
 "Already revealed active target accepted",
 "Defender could reveal own creature with stolen card",
 "Repeat reveal or skip accepted",
 "Outsider read optional reveal",
 "Defender cannot read optional reveal outcome",
 "chaotic_pass_turn(room,3)",
 "rollback;",
 "PASS v0.1.85"
 ])assert.ok(positive.includes(marker),marker);
 for(const marker of [
 "Skip with target was accepted",
 "borrowed_105_reveal_events",
 "Skipped optional reveal should allow next turn",
 "rollback;",
 "PASS v0.1.85"
 ])assert.ok(skip.includes(marker),marker);
 for(const marker of [
 "Borrowed Vento Forte revealed after the training outcome",
 "rollback;",
 "PASS v0.1.85"
 ])assert.ok(terminal.includes(marker),marker);
 for(const content of [positive,skip,terminal])assert.doesNotMatch(content,/\bcommit\s*;/i);
});
test("v0.1.85: prior nonterminal base and KO fixtures explicitly finish optional effect",()=>{
 for(const content of [oldBase,oldKO])
  assert.ok(content.includes("chaotic_resolve_preview_3x3_borrowed_105_reveal(room,3,null,true)"));
});
test("v0.1.85: DROME still shows reveal controls after the borrowed card is returned",()=>{
 for(const marker of [
 "borrowedRevealEvents3x3",
 'chaotic_preview_3x3_borrowed_105_reveal_events',
 "if(match?.turn_no&&contacts3x3.some(x=>x.turn_no===match.turn_no))",
 "borrowedRevealPending",
 "lobby-3x3-borrowed-reveal-panel",
 "lobby-3x3-borrowed-reveal-choose",
 "lobby-3x3-borrowed-reveal-skip",
 "chaotic_resolve_preview_3x3_borrowed_105_reveal",
 "Dispensar revelação e liberar turno",
 "Sem custo adicional"
 ])assert.ok(ui.includes(marker),marker);
});
test("v0.1.85: PWA release number and static loaders are synchronized",()=>{
 assert.match(index,/VERSÃO 0\.1\.85/);
 assert.match(index,/sw\.js\?v=release-85/);
 assert.match(sw,/chaotic-go-release-20261031-85/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-85/);
 assert.match(loader,/chaotic-lobby\.js\?v=release-85/);
});
