import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [migration,ui,prior] = await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-terminal-actions.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-training-vento-forte-hp.sql",import.meta.url),"utf8")
]);
test("3x3: training-only terminal outcome freezes actions and turn progression",()=>{
 assert.match(migration,/create or replace function public\.chaotic_guard_preview_3x3_terminal_actions\(\)/);
 assert.match(migration,/from public\.chaotic_preview_3x3_training_outcomes o/);
 assert.match(migration,/before insert or update on public\.%I/);
 assert.match(migration,/before update of turn_no on public\.chaotic_match_turns/);
 assert.match(migration,/new\.turn_no is distinct from old\.turn_no/);
 assert.match(migration,/revoke all on function public\.chaotic_guard_preview_3x3_terminal_actions\(\)/);
});
test("3x3: final hit can commit spend UPDATE and damage history after KO/outcome created",()=>{
 assert.match(prior,/update public\.chaotic_preview_3x3_hp_wallets/);
 assert.match(prior,/update public\.chaotic_preview_3x3_attack_spends/);
 assert.match(prior,/insert into public\.chaotic_preview_3x3_training_damage_events/);
 assert.match(migration,/before insert on public\.chaotic_preview_3x3_attack_spends/);
 assert.doesNotMatch(migration,/before insert or update on public\.chaotic_preview_3x3_attack_spends/);
 assert.doesNotMatch(migration,/before insert(?: or update)? on public\.chaotic_preview_3x3_training_damage_events/);
});
test("3x3: KO creatures do not appear in actionable movement or contact controls",()=>{
 for(const fragment of [
 "trainingOutcomes3x3.length===0",
 "hp3x3.filter(x=>x.actor_id===userId&&x.hp_remaining>0)",
 "hp3x3.filter(x=>x.actor_id!==userId&&x.hp_remaining>0)",
 'updateSlotChoices("lobby-3x3-move-unit",availableMoves.map(x=>x.formation_slot))',
 'updateSlotChoices("lobby-3x3-contact-attacker",attackPositions.map(x=>x.formation_slot))',
 'updateSlotChoices("lobby-3x3-contact-defender",defensePositions.map(x=>x.formation_slot))',
 "availableMoves.length>0",
 "Treinamento 3x3 concluído!",
 "updateMatchUI();",
 "const hold3x3=room.mode",
 "const trainingComplete=room.mode"]
 )assert.ok(ui.includes(fragment),fragment);
});
