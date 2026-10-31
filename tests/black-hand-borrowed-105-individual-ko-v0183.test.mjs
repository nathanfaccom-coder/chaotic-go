import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const files=[
 "supabase/chaotic-borrowed-105-knockout-ledger-v0183.sql",
 "supabase/chaotic-borrowed-105-knockout-trigger-v0183.sql",
 "supabase/chaotic-borrowed-105-knockout-settlement-v0183.sql",
 "supabase/tests/chaotic-borrowed-105-single-ko-live-v0183.test.sql",
 "supabase/tests/chaotic-borrowed-105-lethal-rejection-v0182.test.sql",
 "supabase/chaotic-preview-3x3-training-knockouts-outcomes.sql",
 "chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [ledger,trigger,settle,positive,finalTeam,originalKO,ui,index,sw,scanner,boot]=
 await Promise.all(files.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));
test("v0.1.83: borrowed KO has separate private training-only ledger",()=>{
 for(const marker of [
  "chaotic_preview_3x3_borrowed_105_knockouts",
  "hp_before integer not null check(hp_before between 1 and 5)",
  "hp_after integer not null default 0 check(hp_after=0)",
  "optional_reveal_applied boolean not null default false check(not optional_reveal_applied)",
  "original_owner_changed boolean not null default false check(not original_owner_changed)",
  "official_match_modified boolean not null default false check(not official_match_modified)",
  "enable row level security",
  "grant select on public.chaotic_preview_3x3_borrowed_105_knockouts to authenticated",
  "(select auth.uid())=borrower_id or (select auth.uid())=defender_id",
  "check(hp_after=greatest(0,hp_before-5) and hp_after between 0 and 499)"
 ])assert.ok(ledger.includes(marker),marker);
 assert.doesNotMatch(ledger,/grant\s+(insert|update|delete|all)\s+on\s+public\.chaotic_preview_3x3_borrowed_105_knockouts\s+to\s+authenticated/i);
});
test("v0.1.83: existing owned Vento Forte KO unchanged, borrower branch requires authenticated original owner and defender",()=>{
 for(const marker of [
  "actor uuid:=auth.uid()",
  "borrowed.state='defender_passed_preview'",
  "source_loan.custody_state<>'held'",
  "source_loan.source_actor_id is distinct from new.actor_id",
  "borrowed.hp_before is distinct from old.hp_remaining",
  "new.hp_remaining<>0",
  "new.damage_events is distinct from old.damage_events+1",
  "chaotic_preview_3x3_borrowed_105_knockouts",
  "not exists(select 1 from public.chaotic_preview_3x3_hp_wallets h",
  "h.position<>new.position and h.hp_remaining>0",
  "return new;",
  "select * into w from public.chaotic_preview_3x3_defense_windows",
  "insert into public.chaotic_preview_3x3_training_knockouts"
 ])assert.ok(trigger.includes(marker),marker);
 // Original owned-hand validation still present after the new borrower branch.
 const originalPart=originalKO.match(/select \* into w from public\.chaotic_preview_3x3_defense_windows[\s\S]*?(?=return new;\nend;)/)?.[0];
 assert.ok(originalPart&&trigger.includes(originalPart));
});
test("v0.1.83: cost, 5 HP KO, receipt and original card return remain one atomic RPC",()=>{
 for(const marker of [
  "if def.hp_remaining<=5 and not exists(",
  "Nocaute final de equipe com ataque emprestado ainda não habilitado",
  "set hp_remaining=greatest(0,hp_remaining-5),damage_events=damage_events+1",
  "before_points,before_points-1,plan.hp_before,greatest(0,plan.hp_before-5)",
  "chaotic_internal_release_preview_3x3_black_hand",
  "'hp_after',greatest(0,plan.hp_before-5)",
  "revoke all on function public.chaotic_settle_preview_3x3_borrowed_105_base",
  "grant execute on function public.chaotic_settle_preview_3x3_borrowed_105_base"
 ])assert.ok(settle.includes(marker),marker);
 assert.doesNotMatch(settle,/\bupdate\s+public\.chaotic_game_nodes\b/i);
});
test("v0.1.83: live rollback fixtures test individual KO, replay and final-team fail-closed",()=>{
 for(const marker of [
  "Borrowed KO was not atomic",
  "Borrowed KO replay accepted",
  "chaotic_preview_3x3_training_knockouts where lobby_id=room",
  "chaotic_preview_3x3_borrowed_105_knockouts",
  "Original borrowed card album modified",
  "chaotic_pass_turn(room,3)",
  "rollback;",
  "PASS 0.1.83"
 ])assert.ok(positive.includes(marker),marker);
 // The v0.1.83 final-team denial was superseded in v0.1.84.
 // Its historical file now checks that inconsistent loan custody rolls back.
 for(const marker of [
  "chaotic_preview_3x3_temporary_card_custody",
  "Corrupted second loan allowed training winner",
  "Corrupted second loan caused partial charge, HP, KO, or winner",
  "rollback;",
  "PASS v0.1.84"
 ])assert.ok(finalTeam.includes(marker),marker);
});
test("v0.1.83: DROME shows knockout history from both native and borrowed attacks",()=>{
 for(const marker of [
  'chaotic_preview_3x3_borrowed_105_knockouts',
  "attacker_id:x.borrower_id,borrowed_attack:true",
  "com ataque EMPRESTADO (Mão Negra); carta original devolvida",
  "NOCAUTE de criatura",
  "Nocaute individual permitido".toLowerCase()
 ])assert.ok(ui.toLowerCase().includes(marker.toLowerCase()),marker);
});
test("v0.1.83+: cache and PWA remain aligned after later releases",()=>{
 const v=index.match(/VERSÃO 0\.1\.(\d+)/);
 const swVersion=index.match(/sw\.js\?v=release-(\d+)/);
 const cache=sw.match(/chaotic-go-release-\d{8}-(\d+)/);
 const scannerVersion=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const bootVersion=boot.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(v&&swVersion&&cache&&scannerVersion&&bootVersion);
 assert.ok(Number(v[1])>=83);
 for(const m of [swVersion,cache,scannerVersion,bootVersion]) assert.equal(m[1],v[1]);
});
