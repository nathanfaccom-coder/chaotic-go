import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [rpc,live,ui,index,sw,bootstrap,scanner] = await Promise.all([
  readFile(new URL("../supabase/chaotic-preview-3x3-resume-checkpoint-v0166.sql",import.meta.url),"utf8"),
  readFile(new URL("../supabase/tests/chaotic-preview-3x3-resume-mid-attack-live-v0166.test.sql",import.meta.url),"utf8"),
  readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
  readFile(new URL("../index.html",import.meta.url),"utf8"),
  readFile(new URL("../sw.js",import.meta.url),"utf8"),
  readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
  readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.66: checkpoint API is read-only, private and member scoped",()=>{
  for (const key of ["actor uuid:=auth.uid()","actor not in(lobby.host_id,lobby.guest_id)",
    "revoke all on function public.chaotic_get_preview_3x3_resume_status(uuid)",
    "grant execute on function public.chaotic_get_preview_3x3_resume_status(uuid)",
    "language plpgsql stable security definer set search_path=''"]){
    assert.ok(rpc.includes(key),key);
  }
  assert.doesNotMatch(rpc,/\b(update|insert into|delete from)\s+public\./i);
  assert.doesNotMatch(rpc,/chaotic_game_nodes|\bdeck_slot\b|\bcard_slot\b/i);
});
test("v0.1.66: all documented recovery stages are derived from server state",()=>{
  for(const stage of ["'ready'","'contact_open'","'awaiting_payment'",
    "'awaiting_defender'","'awaiting_damage'","'awaiting_optional_reveal'",
    "'awaiting_sonar_search'","'damage_settled'","'training_finished'",
    "'session_closed'"]){
    assert.ok(rpc.includes(stage),stage);
  }
  assert.match(rpc,/training_damage_applied/);
  assert.match(rpc,/optional_reveal_pending/);
  assert.match(rpc,/effects_fully_resolved/);
});
test("v0.1.66: live fixture rejects duplicate defense and damage after returning online",()=>{
  for(const key of ["chaotic_get_preview_3x3_resume_status(room)",
    "Outsider read private recovery checkpoint",
    "awaiting_payment","awaiting_defender","awaiting_damage",
    "chaotic_pass_preview_3x3_defense(room,t)",
    "Duplicate defense accepted","Post-reconnect damage replay accepted",
    "awaiting_optional_reveal","damage_settled","training_finished",
    "Guest did not recover final defeat","Post-victory extra turn accepted"]){
    assert.ok(live.includes(key),key);
  }
  assert.match(live,/rollback;\s*select 'PASS v0\.1\.66/i);
  assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.66: UI displays recovery instructions but does not replay actions",()=>{
  for(const key of ["resumePhase3x3","lobby-3x3-recovery-state",
    "chaotic_get_preview_3x3_resume_status",
    "O servidor está em outro turno",
    "Nenhuma carta ou dano é repetido ao reconectar",
    "Verificação da etapa do ataque indisponível",
    "if (document.hidden) return","refreshWhenVisible"]){
    assert.ok(ui.includes(key),key);
  }
  assert.match(ui,/checkpoint\.your_action_required/);
  assert.match(ui,/checkpoint\?\.turn_no===match\?\.turn_no/);
});
test("v0.1.66: version and module caches aligned for published scanner",()=>{
  assert.match(index,/VERSÃO 0\.1\.66/);
  assert.match(index,/sw\.js\?v=release-66/);
  assert.match(sw,/chaotic-go-release-20261031-66/);
  assert.match(bootstrap,/chaotic-lobby\.js\?v=release-66/);
  assert.match(scanner,/full-game-bootstrap\.js\?v=release-66/);
});
