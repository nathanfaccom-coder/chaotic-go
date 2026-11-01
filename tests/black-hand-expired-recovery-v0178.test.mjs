import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,ui,original,release]=await Promise.all([
 "supabase/chaotic-preview-3x3-expired-loan-recovery-v0178.sql",
 "chaotic-lobby.js",
 "supabase/chaotic-preview-3x3-return-loans-on-outcome-v0176.sql",
 "supabase/chaotic-preview-3x3-spend-tornado-v0173.sql"
].map(f=>readFile(new URL("../"+f,import.meta.url),"utf8")));
test("v0.1.78: authenticated participant-only recovery is never callable in a live room",()=>{
 for(const m of [
  "actor uuid:=auth.uid()",
  "actor not in(m.host_id,m.guest_id)",
  "l.mode<>'3x3'",
  "m.host_id is distinct from l.host_id",
  "m.guest_id is distinct from l.guest_id",
  "l.status='ready' and l.expires_at>pg_catalog.statement_timestamp()",
  "and m.status='active'",
  "for update",
  "grant execute on function public.chaotic_restore_expired_preview_3x3_loans(uuid)",
  "to authenticated;"
 ]) assert.ok(sql.includes(m),m);
 assert.match(sql,/revoke all on function public\.chaotic_restore_expired_preview_3x3_loans\(uuid\)[\s\S]*from public,anon,authenticated/);
});
test("v0.1.78: loans return exactly to original private owner and no source IDs are returned",()=>{
 for(const m of [
  "c.custody_state='held' and c.training_only",
  "loan.source_actor_id=loan.borrower_id",
  "original.attack_instance_id is distinct from loan.source_attack_instance_id",
  "original.card_state<>'loaned'",
  "set card_state='deck',recycle_priority=pg_catalog.gen_random_uuid()",
  "set custody_state='released',released_turn=final_turn",
  "if changed<>1",
  "'already_clean',restored=0",
  "'original_album_modified',false"
 ]) assert.ok(sql.includes(m),m);
 assert.doesNotMatch(sql,/\b(update|delete|insert into)\s+public\.chaotic_game_nodes\b/i);
 assert.doesNotMatch(sql,/'source_attack_instance_id'\s*,\s*loan\./i);
});
test("v0.1.78: fails closed on unknown custody states and maintains 102 disabled",()=>{
 assert.ok(sql.includes("c.custody_state in('reserved','used')"));
 assert.ok(sql.includes("not between 1 and 121"));
 assert.ok(sql.includes("least(m.turn_no,120)"));
 assert.doesNotMatch(sql,/pg_catalog\.least\(/);
 assert.ok(original.includes("before insert on public.chaotic_preview_3x3_training_outcomes"));
 assert.ok(release.includes("projection.catalog_attack_id not in('101','104','105','107','108','109','110','111','112','113','114','115')"));
});
test("v0.1.78: reconnection recovers expired and cancelled 3x3 room before forgetting local ID",()=>{
 for(const m of [
  'chaotic_restore_expired_preview_3x3_loans',
  'p_lobby_id:requestedRoomId',
  'p_lobby_id:id',
  'data.status==="cancelled"',
  'new Date(data.expires_at).getTime()<=Date.now()',
  'forgetLastRoom();',
  'Cartas emprestadas recuperadas:',
  'Sala anterior encerrada.'
 ]) assert.ok(ui.includes(m),m);
 const refresh=ui.slice(ui.indexOf("async function refreshRoomOnce()"),ui.indexOf("async function refreshRoom()"));
 const recovery=refresh.indexOf('const recovery=await rpc("chaotic_restore_expired_preview_3x3_loans"');
 const clear=refresh.indexOf('forgetLastRoom();\\n      show();',recovery);
 assert.ok(recovery>=0&&clear>recovery,"return temporary loans before resetting UI");
});
