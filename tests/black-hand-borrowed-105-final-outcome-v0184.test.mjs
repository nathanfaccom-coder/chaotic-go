import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const paths=[
 "supabase/chaotic-training-3x3-verified-terminal-source-v0184.sql",
 "supabase/chaotic-outcome-audit-settled-105-v0184.sql",
 "supabase/chaotic-borrowed-105-terminal-ko-trigger-v0184.sql",
 "supabase/chaotic-borrowed-105-terminal-outcome-settlement-v0184.sql",
 "supabase/tests/chaotic-borrowed-105-terminal-outcome-live-v0184.test.sql",
 "supabase/tests/chaotic-preview-3x3-three-knockouts-live-v0163.test.sql",
 "supabase/tests/chaotic-borrowed-105-lethal-rejection-v0182.test.sql",
 "chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [initialAudit,audit,trigger,settle,terminal,native,corrupt,ui,index,sw,scanner,boot]=
 await Promise.all(paths.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));
test("v0.1.84: terminal outcome requires 3 defeated units and verified training-only KO provenance",()=>{
 for(const term of [
  "chaotic_validate_3x3_training_outcome_source",
  "defeated<>3",
  "new.outcome_scope<>'training_only_no_official_victory'",
  "new.experience_awarded or new.currency_awarded",
  "chaotic_preview_3x3_training_knockouts ko",
  "chaotic_preview_3x3_borrowed_105_knockouts ko",
  "chaotic_preview_3x3_defense_windows w",
  "chaotic_preview_3x3_attack_spends paid",
  "if (not owned_ok and not borrowed_ok) or (owned_ok and borrowed_ok)"
 ])assert.ok(initialAudit.includes(term),term);
 for(const term of [
  "plan.state='base_resolved_no_optional_reveal'",
  "plan.payment_applied and plan.damage_applied",
  "chaotic_preview_3x3_borrowed_105_base_events event",
  "event.points_after=event.points_before-1",
  "event.hp_before=ko.hp_before and event.hp_after=ko.hp_after",
  "loan.custody_state='released'",
  "owner_card.card_state='deck'",
  "loan.released_turn=new.decided_turn"
 ])assert.ok(audit.includes(term),term);
});
test("v0.1.84: native 105 knockout and owned-hand code remain intact",()=>{
 for(const term of [
  "chaotic_preview_3x3_borrowed_105_knockouts",
  "select * into w from public.chaotic_preview_3x3_defense_windows",
  "paid.catalog_attack_id<>'105'",
  "insert into public.chaotic_preview_3x3_training_knockouts",
  "insert into public.chaotic_preview_3x3_training_outcomes"
 ])assert.ok(trigger.includes(term),term);
 assert.ok(native.includes("3 consecutive actual KOs"));
});
test("v0.1.84: terminal borrowed 105 finalization pays, logs KO, returns ALL loans and no official prizes",()=>{
 for(const term of [
  "spent_points=spent_points+1",
  "hp_remaining=greatest(0,hp_remaining-5)",
  "chaotic_preview_3x3_borrowed_105_base_events",
  "chaotic_internal_release_preview_3x3_black_hand",
  "if dead_units=3 then",
  "insert into public.chaotic_preview_3x3_training_outcomes",
  "active.custody_state='held'",
  "'training_outcome_recorded',outcome_recorded",
  "'experience_awarded',false",
  "'currency_awarded',false"
 ])assert.ok(settle.includes(term),term);
 for(const term of [
  "chaotic_preview_3x3_training_outcomes",
  "custody_state='released'",
  "chaotic_pass_turn(room,3)",
  "PASS v0.1.84",
  "rollback;"
 ])assert.ok(terminal.includes(term),term);
 assert.doesNotMatch(terminal,/\bcommit\s*;/i);
});
test("v0.1.84: malformed secondary loan blocks the result and leaves original cards and HP intact",()=>{
 for(const term of [
  "corrupt",
  "rollback;",
  "PASS v0.1.84",
  "chaotic_preview_3x3_temporary_card_custody"
 ])assert.ok(corrupt.toLowerCase().includes(term.toLowerCase()),term);
});
test("v0.1.84: DROME distinguishes training victory from official outcome",()=>{
 for(const term of [
  "VITÓRIA NO TREINO 3x3!",
  "Todos os empréstimos devolvidos",
  "settled.training_outcome_recorded",
  "chaotic_preview_3x3_training_outcomes",
  "SEM equipamento",
  "nocaute INDIVIDUAL ou FINAL DA EQUIPE"
 ])assert.ok(ui.includes(term),term);
 assert.ok(ui.includes("não encerra o combate oficial"));
});
test("v0.1.84+: PWA version, cache and scanners stay synchronized",()=>{
 const current=index.match(/VERSÃO 0\.1\.(\d+)/);
 const reg=index.match(/sw\.js\?v=release-(\d+)/);
 const cache=sw.match(/chaotic-go-release-\d{8}-(\d+)/);
 const scannerLoader=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const dromeLoader=boot.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(current&&reg&&cache&&scannerLoader&&dromeLoader);
 assert.ok(Number(current[1])>=84);
 for(const m of [reg,cache,scannerLoader,dromeLoader])assert.equal(m[1],current[1]);
});
