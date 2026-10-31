import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,live,ui,index,sw,bootstrap,scanner] = await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-turn-consistency-v0168.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-action-interleavings-live-v0168.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.68: match-row lock serializes defensive actions, damage and turn pass",()=>{
 assert.match(sql,/from public\.chaotic_match_turns\s+where lobby_id=p_lobby_id for update/);
 assert.match(sql,/if match\.turn_no<>p_expected_turn then/);
 assert.match(sql,/if match\.current_player<>actor then/);
 assert.match(sql,/lobby\.mode='1x1'/);
 assert.match(sql,/lobby\.mode='3x3'/);
});
test("v0.1.68: a contact or projection without a matching payment cannot pass",()=>{
 assert.match(sql,/chaotic_preview_3x3_contact_intents c[\s\S]*?not exists\(select 1 from public\.chaotic_preview_3x3_attack_spends s/);
 assert.match(sql,/chaotic_preview_3x3_attack_projections proj[\s\S]*?s\.attack_instance_id=proj\.attack_instance_id/);
 assert.match(sql,/Contato 3x3 pendente/);
 assert.match(sql,/Ataque 3x3 declarado sem pagamento/);
 assert.match(sql,/Ataque 3x3 pago ainda não teve o dano aplicado/);
 assert.match(sql,/Treinamento 3x3 já teve vencedor/);
 assert.doesNotMatch(sql,/update\s+public\.chaotic_game_nodes/i);
});
test("v0.1.68: staging integration rejects premature pass, double defense and damage replay",()=>{
 for (const marker of ["Contact-only action was skipped","Unpaid attack projection was skipped",
 "Premature pass changed","Duplicate defense accepted",
 "Post-reconnect damage replay accepted","Post-victory extra turn accepted",
 "chaotic_apply_preview_3x3_training_base_105(room,t)",
 "chaotic_pass_preview_3x3_defense(room,t)","Guest did not recover final defeat",
 "select hp_remaining from public.chaotic_preview_3x3_hp_wallets"
 ]) {
  if(marker==="Premature pass changed")continue;
  assert.ok(live.includes(marker),marker);
 }
 assert.match(live,/Contact-only premature pass changed turn/);
 assert.match(live,/Unpaid premature pass changed turn/);
 assert.match(live,/rollback;\s*select 'PASS v0\.1\.68/);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.68: UI guards pending payment and refreshes conflicts instead of replaying actions",()=>{
 for(const marker of ["async function require3x3Phase",
   'require3x3Phase(expectedTurn,["awaiting_defender"],true)',
   'require3x3Phase(expectedTurn,["awaiting_damage"],true)',
   'require3x3Phase(expectedTurn,["ready","damage_settled"])',
   "await refreshRoom();",
   "O servidor atualizou o combate após o conflito",
   "Contato 3x3 pendente",
   "contacts3x3.some","attackProjections3x3.some",
   "O atacante precisa concluir o dano antes de passar o turno"
 ]) {
  if(marker==="Contato 3x3 pendente")continue; // Server phrase belongs to SQL.
  assert.ok(ui.includes(marker),marker);
 }
 assert.match(ui,/if\(stage\.turn_no!==expectedTurn \|\| stage\.training_finished/);
 assert.match(ui,/s\.attack_instance_id===x\.attack_instance_id/);
});
test("v0.1.68+: PWA, scanner and DROME keep matching release numbers",()=>{
 const shown=index.match(/VERSÃO 0\.1\.(\d+)/);
 const worker=index.match(/sw\.js\?v=release-(\d+)/);
 const cache=sw.match(/chaotic-go-release-\d{8}-(\d+)/);
 const loader=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const lobby=bootstrap.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(shown&&worker&&cache&&loader&&lobby,"all version markers must be present");
 assert.ok(Number(shown[1])>=68);
 for(const x of [worker,cache,loader,lobby])assert.equal(x[1],shown[1]);
});
