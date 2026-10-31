import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [sql,index,sw,ui] = await Promise.all([
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-three-knockouts-live-v0163.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
]);
test("v0.1.63: real integration uses disposable users and always rolls back",()=>{
 assert.match(sql,/begin;\s*do \$verify\$/i);
 assert.match(sql,/rollback;\s*select 'PASS v0\.1\.63/i);
 assert.doesNotMatch(sql,/\bcommit\s*;/i);
 assert.match(sql,/example\.invalid/);
});
test("v0.1.63: three paid 105 attacks hit distinct creatures in turns 1 3 5",()=>{
 for (const x of ["for i in 1..3 loop","t:=2*i-1",
  "slot:=i+3","chaotic_preview_3x3_defense_windows",
  "chaotic_apply_preview_3x3_training_base_105(room,t)",
  "chaotic_preview_3x3_training_knockouts","chaotic_preview_3x3_training_outcomes"])
 assert.ok(sql.includes(x),x);
 assert.match(sql,/case when i=3 then 1 else 0 end/);
});
test("v0.1.63: host and guest pass correctly, see final result and cannot advance after win",()=>{
 for(const x of ["chaotic_resolve_preview_3x3_vento_reveal(room,t,null,true)",
 "chaotic_pass_turn(room,t)","chaotic_pass_turn(room,t+1)",
 "chaotic_pass_turn(room,5)","Post-victory extra turn accepted",
 "chaotic_ping_preview_3x3_player(room,null)",
 "Host did not read win","Guest did not read loss",
 "chaotic_stop_match(room)"])assert.ok(sql.includes(x),x);
 assert.match(ui,/trainingOutcomes3x3\.length/);
});
test("v0.1.63: experimental result cannot award official XP or currency",()=>{
 assert.match(sql,/official_match_ended or experience_awarded or currency_awarded/);
 assert.match(sql,/Training illegally changed official rewards/);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_game_nodes/i);
});
test("v0.1.63: visible version and PWA cache are aligned",()=>{
 assert.match(index,/VERSÃO 0\.1\.63/);
 assert.match(index,/sw\.js\?v=release-63/);
 assert.match(sw,/chaotic-go-release-20261030-63/);
});
