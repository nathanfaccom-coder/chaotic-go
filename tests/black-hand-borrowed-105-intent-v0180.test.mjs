import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const files=[
 "supabase/chaotic-preview-3x3-borrowed-105-intent-table-v0180.sql",
 "supabase/chaotic-preview-3x3-borrowed-105-prepare-v0180.sql",
 "supabase/chaotic-preview-3x3-borrowed-105-cancel-v0180.sql",
 "supabase/tests/chaotic-preview-3x3-borrowed-105-private-plan-live-v0180.test.sql",
 "chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [table,prepare,cancel,live,ui,index,worker,scanner,boot]=await Promise.all(files.map(
 path=>readFile(new URL("../"+path,import.meta.url),"utf8")
));
test("v0.1.80: plans are borrower-only and cannot be written through the browser",()=>{
 for(const marker of [
  "chaotic_preview_3x3_borrowed_105_plans",
  "enable row level security",
  "revoke all on public.chaotic_preview_3x3_borrowed_105_plans from public,anon,authenticated",
  "grant select on public.chaotic_preview_3x3_borrowed_105_plans to authenticated",
  "using (borrower_id=(select auth.uid()))",
  "check(not payment_applied)",
  "check(not damage_applied)"
 ])assert.ok(table.includes(marker),marker);
 assert.doesNotMatch(table,/grant\s+(insert|update|delete|all)\s+on\s+public\.chaotic_preview_3x3_borrowed_105_plans\s+to\s+authenticated/i);
});
test("v0.1.80: preparing borrowed 105 validates real original custody, current attack and wallet",()=>{
 for(const marker of [
  "actor uuid:=auth.uid()",
  "where lobby_id=p_lobby_id for update",
  "m.current_player is distinct from actor",
  "c.attacker_id is distinct from actor",
  "loan.borrower_id is distinct from actor",
  "loan.source_actor_id is distinct from c.defender_id",
  "loan.custody_state<>'held'",
  "loan.catalog_attack_id<>'105'",
  "loan.granted_turn>=p_expected_turn",
  "chaotic_quote_preview_3x3_borrowed_attack",
  "q->>'can_afford_if_enabled'<>'true'",
  "q->>'payment_enabled'<>'false'",
  "q->>'damage_applied'<>'false'",
  "existing.state<>'planned'",
  "grant execute on function public.chaotic_prepare_preview_3x3_borrowed_105"
 ])assert.ok(prepare.includes(marker),marker);
 assert.doesNotMatch(prepare,/\b(update\s+public\.chaotic_preview_3x3_attack_wallets|update\s+public\.chaotic_preview_3x3_hp_wallets|update\s+public\.chaotic_preview_3x3_temporary_card_custody)\b/i);
});
test("v0.1.80: cancellation is restricted to the original borrower and current unspent turn",()=>{
 for(const marker of [
 "m.current_player is distinct from actor",
 "m.turn_no<>p_expected_turn",
 "plan.borrower_id is distinct from actor",
 "plan.state<>'planned'",
 "chaotic_preview_3x3_attack_spends",
 "set state='cancelled'",
 "'payment_applied',false",
 "'damage_applied',false",
 "grant execute on function public.chaotic_cancel_preview_3x3_borrowed_105"
 ])assert.ok(cancel.includes(marker),marker);
});
test("v0.1.80: positive SQL fixture verifies privacy, replay prevention and no payments or HP",()=>{
 for(const marker of [
  "chaotic_prepare_preview_3x3_borrowed_105(room,loan,3)",
  "Borrower could plan on stale turn",
  "Duplicate borrowed 105 plan after retry",
  "Original owner prepared borrower attack",
  "Outsider cancelled borrower plan",
  "Cancelled intention was replayed",
  "Original owner viewed private 105 plan",
  "Borrower cannot view own 105 plan",
  "rollback;",
  "PASS 0.1.80"
 ])assert.ok(live.includes(marker),marker);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.80: DROME keeps borrowed plans separate from the owned hand and costs",()=>{
 for(const marker of [
  "borrowedPlan3x3 = null",
  "chaotic_preview_3x3_borrowed_105_plans",
  'lobby-3x3-borrowed-plan',
  'lobby-3x3-borrowed-cancel-plan',
  "chaotic_prepare_preview_3x3_borrowed_105",
  "chaotic_cancel_preview_3x3_borrowed_105",
  "SOMENTE PLANEJAMENTO: nada pago ou aplicado ao adversário",
  'selectedLoan?.catalog_attack_id==="105"'
 ])assert.ok(ui.includes(marker),marker);
 assert.doesNotMatch(ui,/resolvableTrainingAttacks3x3=new Set\([^)]*"102"/);
});
test("v0.1.80+: PWA versions remain aligned after subsequent releases",()=>{
 const displayed=index.match(/VERSÃO 0\.1\.(\d+)/);
 const swRegistration=index.match(/sw\.js\?v=release-(\d+)/);
 const cache=worker.match(/chaotic-go-release-\d{8}-(\d+)/);
 const scannerLoader=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const dromeLoader=boot.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(displayed&&swRegistration&&cache&&scannerLoader&&dromeLoader);
 assert.ok(Number(displayed[1])>=80);
 for(const match of [swRegistration,cache,scannerLoader,dromeLoader])
  assert.equal(match[1],displayed[1]);
});
