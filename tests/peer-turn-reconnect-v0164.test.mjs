import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [rpc,live,ui,index,sw] = await Promise.all([
  readFile(new URL("../supabase/chaotic-preview-3x3-peer-turn-sync-v0164.sql",import.meta.url),"utf8"),
  readFile(new URL("../supabase/tests/chaotic-preview-3x3-peer-turn-reconnect-live-v0164.test.sql",import.meta.url),"utf8"),
  readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
  readFile(new URL("../index.html",import.meta.url),"utf8"),
  readFile(new URL("../sw.js",import.meta.url),"utf8")
]);
test("v0.1.64: heartbeat reports same-turn sync only when both recent",()=>{
  for(const key of ["last_seen_turn=turn_state.turn_no",
    "self_synced_current_turn","peer_synced_current_turn","both_synced_current_turn",
    "coalesce(self_present,false) and coalesce(peer_present,false)"])
    assert.ok(rpc.includes(key),key);
  assert.match(rpc,/fresh_cutoff timestamptz:=statement_timestamp\(\)-interval '25 seconds'/);
});
test("v0.1.64: presence RPC retains member authorization and no raw table read",()=>{
  for(const key of ["actor uuid:=auth.uid()","actor not in(lobby.host_id,lobby.guest_id)",
    "revoke all on function public.chaotic_ping_preview_3x3_player",
    "grant execute on function public.chaotic_ping_preview_3x3_player"])
    assert.ok(rpc.includes(key),key);
  assert.doesNotMatch(rpc,/grant select on public\.chaotic_preview_3x3_player_presence/i);
  assert.doesNotMatch(rpc,/update\s+public\.chaotic_match_turns/i);
});
test("v0.1.64: two actors exercise turn catch-up, stale client and reconnect in rollback",()=>{
  for(const key of ["set local role authenticated","request.jwt.claim.sub",
    "chaotic_pass_turn('c1610000-0000-4000-8000-000000000161',1)",
    "False same-turn sync after pass","Guest failed current-turn catchup",
    "Disconnected guest reported current","Guest did not recover after reconnect",
    "Host failed to see recovery","rollbac"+ "k;"])
    assert.ok(live.includes(key),key);
  assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.64: DROME stops claiming everyone connected and handles mobile resume",()=>{
  assert.doesNotMatch(ui,/✅ Dois jogadores conectados/);
  for(const key of ["lobby-3x3-refresh-connection",
    "adversário ainda não sincronizou este turno",
    "peer_synced_current_turn","both_synced_current_turn",
    "if (document.hidden) return","visibilitychange","window.addEventListener(\"online\"",
    "refreshWhenVisible","refreshInFlight","refreshQueued",
    "requestedRoomId","async function refreshRoomOnce()"])
    assert.ok(ui.includes(key),key);
  assert.match(ui,/Fast heartbeat before dozens of sequential card\/board reads/);
});
test("v0.1.64: PWA cache and visible version match without replacing assets",()=>{
  const visible=index.match(/VERSÃO 0\.1\.(\d+)/);
  const loader=index.match(/sw\.js\?v=release-(\d+)/);
  const cache=sw.match(/chaotic-go-release-\d{8}-(\d+)/);
  assert.ok(visible&&loader&&cache,"versão, loader e cache presentes");
  assert.ok(Number(visible[1])>=64,"não regredir para antes de v0.1.64");
  assert.equal(visible[1],loader[1]);
  assert.equal(visible[1],cache[1]);
  assert.match(sw,/\.\/logo\.png/);
  assert.match(sw,/if\(request\.mode==='navigate' \|\| \/\\\.\(\?:js\|html\)\$\/i/);
});
