import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const files=[
 "supabase/chaotic-borrowed-105-outcome-contact-v0184.sql",
 "supabase/chaotic-borrowed-105-terminal-ko-trigger-v0184.sql",
 "supabase/chaotic-borrowed-105-terminal-outcome-settlement-v0184.sql",
 "supabase/chaotic-borrowed-105-terminal-outcome-audit-v0184.sql",
 "supabase/chaotic-preview-3x3-return-loans-on-outcome-v0176.sql",
 "supabase/tests/chaotic-borrowed-105-final-team-outcome-v0184.test.sql",
 "supabase/tests/chaotic-borrowed-105-final-team-unsafe-loan-rollback-v0184.test.sql",
 "supabase/tests/chaotic-borrowed-105-single-ko-live-v0183.test.sql",
 "chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [fk,trigger,settle,audit,returnLoans,positive,negative,individual,ui,index,worker,scanner,loader]=
 await Promise.all(files.map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));
test("v0.1.84: terminal FK binds both native and borrowed attack to verified contact",()=>{
 for(const s of [
  "chaotic_3x3_result_contact_v0184_fk",
  "foreign key(lobby_id,decided_turn)",
  "references public.chaotic_preview_3x3_contact_intents(lobby_id,turn_no)",
  "on delete cascade"
 ])assert.ok(fk.includes(s),s);
});
test("v0.1.84: borrowed KO trigger defers final outcome but keeps original native KO intact",()=>{
 for(const s of [
  "borrowed.state='defender_passed_preview'",
  "insert into public.chaotic_preview_3x3_borrowed_105_knockouts",
  "select * into w from public.chaotic_preview_3x3_defense_windows",
  "insert into public.chaotic_preview_3x3_training_knockouts",
  "insert into public.chaotic_preview_3x3_training_outcomes"
 ])assert.ok(trigger.includes(s),s);
 assert.doesNotMatch(trigger,/then raise exception 'Nocaute final de equipe com carta emprestada ainda não habilitado'/);
});
test("v0.1.84: terminal result inserted after payment, KO, ledger and current loan release",()=>{
 for(const s of [
  "set spent_points=spent_points+1",
  "set hp_remaining=greatest(0,hp_remaining-5)",
  "insert into public.chaotic_preview_3x3_borrowed_105_base_events",
  "chaotic_internal_release_preview_3x3_black_hand",
  "select count(*),count(*) filter(where hp_remaining=0)",
  "if team_units<>3",
  "if dead_units=3",
  "chaotic_preview_3x3_borrowed_105_knockouts",
  "insert into public.chaotic_preview_3x3_training_outcomes",
  "'training_outcome_recorded',outcome_recorded",
  "'experience_awarded',false,'currency_awarded',false"
 ])assert.ok(settle.includes(s),s);
 assert.ok(settle.indexOf("chaotic_internal_release_preview_3x3_black_hand")<
   settle.indexOf("insert into public.chaotic_preview_3x3_training_outcomes"));
});
test("v0.1.84: terminal audit rejects unpaid and requires unique real settled KO and original owner returned",()=>{
 for(const s of [
  "owned_ok boolean;",
  "borrowed_ok boolean;",
  "chaotic_preview_3x3_borrowed_105_base_events receipt",
  "plan.state='base_resolved_no_optional_reveal'",
  "plan.payment_applied and plan.damage_applied",
  "receipt.hp_before=ko.hp_before and receipt.hp_after=0",
  "receipt.points_after=receipt.points_before-1",
  "loan.custody_state='released'",
  "original.card_state='deck' and not original.original_card_consumed",
  "if (not owned_ok and not borrowed_ok) or (owned_ok and borrowed_ok)"
 ])assert.ok(audit.includes(s),s);
 assert.ok(returnLoans.includes("where c.lobby_id=new.lobby_id and c.custody_state='held'"));
 assert.ok(returnLoans.includes("loan.source_actor_id not in(new.winner_id,new.defeated_id)"));
 assert.ok(returnLoans.includes("original.card_state<>'loaned'"));
});
test("v0.1.84: real SQL fixtures check training winner, two returned loans and negative rollback",()=>{
 for(const s of [
  "training_outcome_recorded",
  "Training-only winner not recorded exactly once",
  "Training victory did not return BOTH original borrowed cards",
  "Winning borrowed KO allowed duplicate charge",
  "Finished training wrongly advanced to next turn",
  "rollback;",
  "PASS v0.1.84"
 ])assert.ok(positive.includes(s),s);
 for(const s of [
  "Corrupted second loan allowed training winner",
  "Corrupted second loan caused partial charge, HP, KO, or winner",
  "rollback;",
  "PASS v0.1.84"
 ])assert.ok(negative.includes(s),s);
 assert.ok(individual.includes("Borrowed KO replay accepted"));
 for(const s of [positive,negative])assert.doesNotMatch(s,/\bcommit\s*;/i);
});
test("v0.1.84: DROME distinguishes training winner from official match result",()=>{
 for(const s of [
  "settled.training_outcome_recorded",
  "VITÓRIA NO TREINO 3x3!",
  "Todos os empréstimos devolvidos",
  "sem XP, moedas ou vitória oficial",
  "chaotic_preview_3x3_training_outcomes",
  "chaotic_preview_3x3_borrowed_105_knockouts"
 ])assert.ok(ui.includes(s),s);
});
test("v0.1.84: PWA public and scanner loader all refer to release 84",()=>{
 assert.match(index,/VERSÃO 0\.1\.84/);
 assert.match(index,/sw\.js\?v=release-84/);
 assert.match(worker,/chaotic-go-release-20261031-84/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-84/);
 assert.match(loader,/chaotic-lobby\.js\?v=release-84/);
});
