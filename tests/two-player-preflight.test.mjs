import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,ui,live,audit] = await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-two-player-preflight-v0161.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-two-player-preflight-live.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-two-player-preflight-audit.test.sql",import.meta.url),"utf8")
]);
test("3x3 preflight is actor scoped, does not alter cards, HP or matches",()=>{
 for(const term of ["chaotic_preview_3x3_player_presence",
   "ready_for_test boolean not null default false",
   "last_seen_at timestamptz not null default now()",
   "actor uuid:=auth.uid()","actor not in(lobby.host_id,lobby.guest_id)",
   "ready_for_test=case when p_ready is null",
   "lobby.expires_at<=current_stamp"])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_preview_3x3_hp_wallets/i);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_match_turns/i);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_game_nodes/i);
});
test("a peer with stale heartbeat cannot be reported as active or both ready",()=>{
 assert.match(sql,/fresh_cutoff timestamptz:=statement_timestamp\(\)-interval '25 seconds'/);
 assert.match(sql,/last_seen_at>=fresh_cutoff/);
 assert.match(sql,/coalesce\(self_ready,false\) and coalesce\(peer_ready,false\)/);
 assert.match(sql,/coalesce\(self_present,false\) and coalesce\(peer_present,false\)/);
});
test("no browser role sees raw presence rows; only authenticated RPC",()=>{
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.chaotic_preview_3x3_player_presence from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.chaotic_ping_preview_3x3_player/);
 assert.doesNotMatch(sql,/grant (select|update|insert) on public\.chaotic_preview_3x3_player_presence/i);
 assert.match(audit,/has_function_privilege\('anon'/);
});
test("real two-actor SQL integration checks ready, offline, outsider and unready",()=>{
 for(const term of ["set local role authenticated",
 "chaotic_ping_preview_3x3_player",
 "Initial host presence invalid","Both players failed ready check",
 "Stale peer falsely marked connected","Unready toggle failed",
 "Peer toggle not synchronized","Outsider accessed presence RPC","rollback;"]){
  assert.ok(live.includes(term),term);
 }
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("DROME renders explicit two-phone diagnostic and server-backed ready toggles",()=>{
 for(const term of [
  "chaotic_ping_preview_3x3_player",
  "lobby-3x3-player-presence",
  "lobby-3x3-test-ready","lobby-3x3-test-unready",
  "p_ready:true","p_ready:false","p_ready:null",
  "sem atividade recente","presence.both_ready_now"]){
  assert.ok(ui.includes(term),term);
 }
 assert.doesNotMatch(ui,/table:"chaotic_preview_3x3_player_presence"/);
});
test("training outcome is reported without touching official rewards",()=>{
 assert.match(sql,/chaotic_preview_3x3_training_outcomes/);
 assert.match(sql,/then winner=actor else null end/);
 assert.match(sql,/official_match_modified',false/);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_match_turns/i);
});
