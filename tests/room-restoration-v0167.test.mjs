import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [ui,rls,index,sw,bootstrap,scanner] = await Promise.all([
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-room-restore-rls-live-v0167.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.67: saved room is scoped to user, never a Deck or auth token",()=>{
 assert.match(ui,/lastRoomStorageKey="chaotic-go:last-room:"\+userId/);
 assert.match(ui,/setItem\(lastRoomStorageKey,JSON\.stringify\(\{\s*id:room\.id,expires_at:room\.expires_at/);
 assert.doesNotMatch(ui,/setItem\(lastRoomStorageKey,JSON\.stringify\(\{[^}]*?(token|deck|attack|hand|code):/i);
});
test("v0.1.67: reloading requires server membership, non-expired status, same view",()=>{
 for(const key of [
  "restoreLastRoom(generation)",
  ".eq(\"id\",id).maybeSingle()",
  "![data.host_id,data.guest_id].includes(userId)",
  "new Date(data.expires_at).getTime()<=Date.now()",
  "generation!==viewGeneration",
  "requestedView!==viewGeneration",
  "restoreLastRoom(viewGeneration)"
 ])assert.ok(ui.includes(key),key);
 assert.match(ui,/await refreshRoom\(\); \/\/ Reads data; does not replay defense, attack or spend/);
});
test("v0.1.67: local state is forgotten upon closing, expiry and revoked membership",()=>{
 for(const token of ["forgetLastRoom(); ++viewGeneration",
   "if (!data) { forgetLastRoom(); room = null;",
   'room.status==="cancelled"',
   'window.localStorage?.removeItem(lastRoomStorageKey)',
   "A sala anterior terminou ou não pertence a esta conta"])
 assert.ok(ui.includes(token),token);
});
test("v0.1.67: live two-player RLS integration is rolled back and rejects an outsider",()=>{
 assert.match(rls,/set local role authenticated/);
 assert.match(rls,/host_actor::text/);
 assert.match(rls,/guest_actor::text/);
 assert.match(rls,/outsider_actor::text/);
 assert.match(rls,/Outsider may read forged room ID/);
 assert.match(rls,/reset role;\s*rollback;\s*select 'PASS v0\.1\.67/);
 assert.doesNotMatch(rls,/\bcommit\s*;/i);
});
test("v0.1.67: Android PWA, scanner and DROME module share the same cache version",()=>{
 assert.match(index,/VERSÃO 0\.1\.67/);
 assert.match(index,/sw\.js\?v=release-67/);
 assert.match(sw,/chaotic-go-release-20261031-67/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-67/);
 assert.match(bootstrap,/chaotic-lobby\.js\?v=release-67/);
});
