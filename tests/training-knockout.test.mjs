import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,ui,previous] = await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-training-knockouts-outcomes.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-training-vento-forte-hp.sql",import.meta.url),"utf8")
]);
test("3x3: knockout is emitted by a real HP change only when Vento Forte reaches zero",()=>{
 for (const term of ["after update of hp_remaining",
  "old.hp_remaining>0 and new.hp_remaining=0","auth.uid()",
  "m.current_player is distinct from actor",
  "w.status<>'defender_passed_preview'","paid.catalog_attack_id<>'105'",
  "paid.training_damage_applied","greatest(0,old.hp_remaining-5)",
  "new.damage_events is distinct from old.damage_events+1",
  "chaotic_preview_3x3_training_knockouts"]){
  assert.ok(sql.includes(term),term);
 }
 assert.match(previous,/set hp_remaining=after_hp,damage_events=damage_events\+1/);
});
test("3x3: training outcome requires all three seeded units at 0 HP",()=>{
 assert.match(sql,/select count\(\*\), count\(\*\) filter\(where hp_remaining=0\)/);
 assert.match(sql,/if n=3 and dead_count=3 then/);
 assert.match(sql,/on conflict\(lobby_id\) do nothing/);
 assert.match(sql,/outcome_scope text not null default 'training_only_no_official_victory'/);
 for(const term of ["official_match_ended boolean not null default false",
  "experience_awarded boolean not null default false",
  "currency_awarded boolean not null default false"]){
  assert.ok(sql.includes(term),term);
 }
});
test("3x3: DROME shows KO/outcome and correct damage events without official victory",()=>{
 for(const term of ["lobby-3x3-knockout-history","lobby-3x3-training-outcome",
  "chaotic_preview_3x3_training_knockouts","chaotic_preview_3x3_training_outcomes",
  "trainingKnockouts3x3=knockouts.data||[]",
  "trainingOutcomes3x3=outcome.data||[]",
  'table:"chaotic_preview_3x3_training_knockouts"',
  'table:"chaotic_preview_3x3_training_outcomes"',
  '" · "+x.damage_events+" ataque(s) de treino recebido(s)"']){
  assert.ok(ui.includes(term),term);
 }
 assert.doesNotMatch(ui,/0 ataques aplicados/);
});
