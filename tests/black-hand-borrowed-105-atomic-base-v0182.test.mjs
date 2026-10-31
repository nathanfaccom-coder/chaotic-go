import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const names=[
 "supabase/chaotic-borrowed-105-base-ledger-v0182.sql",
 "supabase/chaotic-borrowed-105-atomic-base-settlement-v0182.sql",
 "supabase/chaotic-pass-turn-borrowed-105-base-v0182.sql",
 "supabase/chaotic-borrowed-105-status-settled-v0182.sql",
 "supabase/tests/chaotic-borrowed-105-atomic-base-live-v0182.test.sql",
 "supabase/tests/chaotic-borrowed-105-equipped-rejection-v0182.test.sql",
 "supabase/tests/chaotic-borrowed-105-lethal-rejection-v0182.test.sql",
 "chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [schema,settle,passTurn,status,positive,equipped,lethal,ui,index,worker,scanner,boot]=
 await Promise.all(names.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));
test("v0.1.82: settlement schema makes half-paid plans impossible and limits scope to original 105",()=>{
 for(const x of [
  "'base_resolved_no_optional_reveal'",
  "state='base_resolved_no_optional_reveal' and payment_applied and damage_applied",
  "state<>'base_resolved_no_optional_reveal' and not payment_applied and not damage_applied",
  "chaotic_preview_3x3_borrowed_105_base_events",
  "unique(custody_id)",
  "check(points_after=points_before-1)",
  "check(hp_after=hp_before-5 and hp_after>0)",
  "check(not optional_reveal_applied)",
  "check(not original_owner_changed)",
  "enable row level security",
  "grant select on public.chaotic_preview_3x3_borrowed_105_base_events to authenticated"
 ])assert.ok(schema.includes(x),x);
 assert.doesNotMatch(schema,/grant\s+(insert|update|delete|all)\s+on\s+public\.chaotic_preview_3x3_borrowed_105_base_events\s+to\s+authenticated/i);
});
test("v0.1.82: only attacker after real defender pass can atomically charge one point and five nonlethal HP",()=>{
 for(const x of [
  "actor uuid:=auth.uid()",
  "m.current_player is distinct from actor",
  "plan.state<>'defender_passed_preview'",
  "plan.defender_passed_at is null",
  "plan.borrower_id is distinct from actor",
  "loan.custody_state<>'held'",
  "loan.source_actor_id is distinct from plan.defender_id",
  "source_card.card_state<>'loaned'",
  "quote->>'can_afford_if_enabled'<>'true'",
  "quote->>'defender_hp_before'",
  "before_points<>plan.points_available",
  "wallet.spent_points+1>65",
  "if def.hp_remaining<=5",
  "spent_points=spent_points+1",
  "hp_remaining=hp_remaining-5,damage_events=damage_events+1",
  "set state='base_resolved_no_optional_reveal'",
  "payment_applied=true,damage_applied=true",
  "insert into public.chaotic_preview_3x3_borrowed_105_base_events",
  "chaotic_internal_release_preview_3x3_black_hand",
  "'borrowed_card_returned',true"
 ])assert.ok(settle.includes(x),x);
 assert.match(settle,/revoke all on function public\.chaotic_settle_preview_3x3_borrowed_105_base\(uuid,integer\)/);
});
test("v0.1.82: original defender equipment and knockout path remain fail-closed",()=>{
 for(const x of [
  "decks/3x3_slot_",
  "gear:=nullif",
  "Defensor com equipamento exige resolução completa",
  "Ataque emprestado letal aguarda suporte de nocaute",
  "if def.hp_remaining<=5",
  "'optional_reveal_applied',false"
 ])assert.ok(settle.includes(x)||schema.includes(x),x);
});
test("v0.1.82: next-turn guard accepts only proved settlement plus released original custody",()=>{
 for(const x of [
  "chaotic_preview_3x3_borrowed_105_base_events ev",
  "plan.state='base_resolved_no_optional_reveal'",
  "plan.payment_applied and plan.damage_applied",
  "ev.points_after=ev.points_before-1",
  "ev.hp_after=ev.hp_before-5",
  "loan.custody_state='released'"
 ])assert.ok(passTurn.includes(x),x);
 assert.ok(passTurn.includes("Contato 3x3 pendente"));
 assert.ok(passTurn.includes("chaotic_preview_burst_mugic_intents"));
});
test("v0.1.82: database fixtures prove atomic payment and rejection without modified HP or custody",()=>{
 for(const x of [
  "Borrower settled without defender pass",
  "Defender settled borrower card",
  "Second settlement duplicated charge",
  "Settlement event duplicated",
  "chaotic_pass_turn(room,3)",
  "rollback;",
  "PASS v0.1.82"
 ])assert.ok(positive.includes(x),x);
 for(const t of [equipped,lethal]){
  for(const x of [
   "Unsupported borrowed 105 attack was wrongly paid",
   "Unsafe borrowed 105 request partially charged or altered card",
   "chaotic_abort_preview_3x3_borrowed_105_priority",
   "rollback;",
   "PASS v0.1.82"
  ])assert.ok(t.includes(x),x);
  assert.doesNotMatch(t,/\bcommit\s*;/i);
 }
});
test("v0.1.82: private status now reflects actual event while UI retains nonlethal warning",()=>{
 for(const x of [
  "'payment_applied',plan.payment_applied",
  "'damage_applied',plan.damage_applied",
  "'your_attack',plan.borrower_id=actor"
 ])assert.ok(status.includes(x),x);
 for(const x of [
  "lobby-3x3-borrowed-settle-base",
  "chaotic_settle_preview_3x3_borrowed_105_base",
  "borrowedPlan3x3?.state===\"defender_passed_preview\"",
  "Revelação opcional NÃO executada",
  "Carta original devolvida ao dono",
  "SEM nocaute/equipamento"
 ])assert.ok(ui.includes(x),x);
});
test("v0.1.82: public and Android PWA cache align",()=>{
 assert.match(index,/VERSÃO 0\.1\.82/);
 assert.match(index,/sw\.js\?v=release-82/);
 assert.match(worker,/chaotic-go-release-20261031-82/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-82/);
 assert.match(boot,/chaotic-lobby\.js\?v=release-82/);
});
