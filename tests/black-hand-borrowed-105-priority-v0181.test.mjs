import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const paths=[
 "supabase/chaotic-borrowed-105-priority-state-v0181.sql",
 "supabase/chaotic-borrowed-105-priority-open-v0181.sql",
 "supabase/chaotic-borrowed-105-defender-pass-abort-v0181.sql",
 "supabase/chaotic-borrowed-105-priority-status-guards-v0181.sql",
 "supabase/tests/chaotic-borrowed-105-priority-live-v0181.test.sql",
 "chaotic-lobby.js",
 "index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [states,opened,pass,guard,live,ui,index,worker,scanner,boot]=
 await Promise.all(paths.map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));
test("v0.1.81: borrower opens priority only for legitimate loan with unchanged cost and HP",()=>{
 for(const part of [
  "chaotic_open_preview_3x3_borrowed_105_priority",
  "actor uuid:=auth.uid()",
  "m.current_player is distinct from actor",
  "plan.borrower_id is distinct from actor",
  "loan.source_actor_id is distinct from plan.defender_id",
  "loan.custody_state<>'held'",
  "loan.catalog_attack_id<>'105'",
  "loan.granted_turn>=p_expected_turn",
  "chaotic_quote_preview_3x3_borrowed_attack",
  "quote->>'can_afford_if_enabled'<>'true'",
  "quote->>'points_available'",
  "quote->>'defender_hp_before'",
  "quote->>'defender_hp_after_base_only'",
  "state='awaiting_defender'",
  "'payment_applied',false",
  "'damage_applied',false",
  "grant execute on function public.chaotic_open_preview_3x3_borrowed_105_priority"
 ])assert.ok(opened.includes(part),part);
 assert.doesNotMatch(opened,/update\s+public\.chaotic_preview_3x3_(hp_wallets|attack_wallets|temporary_card_custody)/i);
});
test("v0.1.81: only current defender may acknowledge, attacker may abort, no payout",()=>{
 for(const p of [
  "actor not in(m.host_id,m.guest_id)",
  "plan.state<>'awaiting_defender'",
  "plan.defender_id is distinct from actor",
  "plan.borrower_id=actor",
  "state='defender_passed_preview'",
  "chaotic_abort_preview_3x3_borrowed_105_priority",
  "plan.state not in ('awaiting_defender','defender_passed_preview')",
  "set state='cancelled'",
  "'payment_applied',false",
  "'damage_applied',false"
 ])assert.ok(pass.includes(p),p);
 for(const p of [
  "'planned','awaiting_defender','defender_passed_preview','cancelled'",
  "priority_opened_at",
  "defender_passed_at",
  "check(not payment_applied)"
 ])assert.ok(states.includes(p)||p==="check(not payment_applied)",p);
});
test("v0.1.81: server turn/attack guard prevents defender bypass and privacy leaks",()=>{
 for(const p of [
  "chaotic_get_preview_3x3_borrowed_105_priority",
  "actor not in(m.host_id,m.guest_id)",
  "'your_defense',plan.defender_id=actor",
  "chaotic_guard_preview_3x3_borrowed_priority",
  "new.turn_no is distinct from old.turn_no",
  "p.state='awaiting_defender'",
  "p.state in('awaiting_defender','defender_passed_preview')",
  "chaotic_guard_borrowed_105_turn_advance",
  "chaotic_guard_borrowed_105_other_attack_projection",
  "chaotic_guard_borrowed_105_other_attack_spend"
 ])assert.ok(guard.includes(p),p);
 assert.doesNotMatch(guard,/'source_attack_instance_id'\s*[:,]/i);
 assert.doesNotMatch(guard,/'custody_id'\s*[:,]/i);
});
test("v0.1.81: rollback SQL fixture verifies actual defender acknowledgement and anti-replay",()=>{
 for(const p of [
  "chaotic_prepare_preview_3x3_borrowed_105(room,loan,3)",
  "chaotic_open_preview_3x3_borrowed_105_priority(room,3)",
  "Attacker skipped defender priority",
  "Concurrent ordinary attack bypassed borrowed priority",
  "Outsider acknowledged defense",
  "chaotic_pass_preview_3x3_borrowed_105_priority(room,3)",
  "Defense replay accepted",
  "chaotic_abort_preview_3x3_borrowed_105_priority(room,3)",
  "Reaction changed cost, owner, HP or loan",
  "rollback;",
  "PASS v0.1.81"
 ])assert.ok(live.includes(p),p);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.81: DROME server status, reaction and cancellation UI are properly connected",()=>{
 for(const p of [
  "borrowedPriority3x3 = null",
  "chaotic_get_preview_3x3_borrowed_105_priority",
  'lobby-3x3-borrowed-open-priority',
  'lobby-3x3-borrowed-defender-pass',
  'lobby-3x3-borrowed-abort-priority',
  "chaotic_open_preview_3x3_borrowed_105_priority",
  "chaotic_pass_preview_3x3_borrowed_105_priority",
  "chaotic_abort_preview_3x3_borrowed_105_priority",
  "borrowedPriority3x3.your_defense===true",
  "Pagamento e dano NÃO aplicados"
 ])assert.ok(ui.includes(p),p);
});
test("v0.1.81: release and PWA cache are aligned",()=>{
 assert.match(index,/VERSÃO 0\.1\.81/);
 assert.match(index,/sw\.js\?v=release-81/);
 assert.match(worker,/chaotic-go-release-20261031-81/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-81/);
 assert.match(boot,/chaotic-lobby\.js\?v=release-81/);
});
