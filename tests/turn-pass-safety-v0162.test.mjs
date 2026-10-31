import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [db,ui,live,audit] = await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-turn-pass-safety-v0162.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-turn-pass-integrity-live.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-turn-pass-audit.test.sql",import.meta.url),"utf8")
]);
test("v0.1.62: a completed training outcome blocks another pass server-side",()=>{
 assert.match(db,/if lobby.mode='3x3' then/);
 assert.match(db,/chaotic_preview_3x3_training_outcomes/);
 assert.match(db,/Treinamento 3x3 já teve vencedor/);
 assert.match(live,/Pass accepted after recorded training outcome/);
});
test("v0.1.62: a paid attack cannot skip applied damage or a pending defender window",()=>{
 assert.match(db,/d.status='awaiting_defender'/);
 assert.match(db,/not s.training_damage_applied/);
 assert.match(db,/Aguarde o defensor responder antes de passar/);
 assert.match(db,/Ataque 3x3 pago ainda não teve o dano aplicado/);
 for(const key of ["Premature pass accepted while attack paid",
   "Pass bypassed pending defender"])assert.ok(live.includes(key),key);
});
test("v0.1.62: Vento Forte and SONAR choices must settle before switching players",()=>{
 assert.match(db,/d.catalog_attack_id='105'\s+and d.optional_reveal_pending/);
 assert.match(db,/d.catalog_attack_id='110'\s+and not d.effects_fully_resolved/);
 assert.match(live,/Premature SONAR pass accepted/);
 assert.match(live,/Premature Vento Forte pass accepted/);
 assert.doesNotMatch(db,/catalog_attack_id='107'\s+and not d.effects_fully_resolved/);
});
test("v0.1.62: 1x1 Burst priority and queued Mugics are still protected",()=>{
 assert.match(db,/lobby.mode='1x1'/);
 assert.match(db,/chaotic_preview_burst_windows/);
 assert.match(db,/chaotic_preview_burst_priority/);
 assert.match(db,/chaotic_preview_burst_mugic_intents/);
 assert.match(db,/insert into public.chaotic_match_events/);
 assert.doesNotMatch(db,/update\s+public\.chaotic_game_nodes/i);
});
test("v0.1.62: DROME recomputes pass button after each defense and attack",()=>{
 for(const key of ["const hold3x3=room.mode",
  "defenseWindows3x3.some","attackSpends3x3.some",
  "trainingDamage3x3.some","x.optional_reveal_pending",
  "!x.effects_fully_resolved","hold3x3 ||",
  "updateMatchUI();"]){
  assert.ok(ui.includes(key),key);
 }
 assert.match(ui,/trainingComplete&&match\?\.status==="active"/);
});
test("v0.1.62: 12 real DB attacks exercise blocked and legitimate turn transitions",()=>{
 assert.match(live,/for i in 1\.\.12 loop/);
 assert.match(live,/perform public\.chaotic_pass_turn\(lobby,1\)/);
 assert.match(live,/Winner|winner|vencedor/);
 assert.match(live,/public\.chaotic_stop_match\(lobby\)/);
 assert.match(live,/rollbac[kK];/);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
 assert.match(audit,/chaotic_preview_burst_windows/);
});
