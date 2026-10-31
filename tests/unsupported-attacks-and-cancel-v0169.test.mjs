import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cancel,spend,live,ui,index,sw,bootstrap,scanner]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-unpaid-cancel-v0169.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-capability-v0169.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-unpaid-cancel-live-v0169.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.69: only 8 catalog attacks can be spent in experimental 3x3",()=>{
 for(const id of ["101","105","107","110","111","112","113","114"])
  assert.ok(spend.includes("'"+id+"'"),id);
 assert.match(spend,/projection\.catalog_attack_id not in/);
 assert.match(spend,/ainda não possui dano experimental 3x3/);
 assert.match(spend,/select \* into m from public\.chaotic_match_turns where lobby_id=p_lobby_id for update/);
 assert.match(spend,/where lobby_id=p_lobby_id and actor_id=actor for update/);
});
test("v0.1.69: cancellation enforces actor, match and no payment/defense/damage",()=>{
 for(const phrase of ["actor uuid:=auth.uid()","where lobby_id=p_lobby_id for update",
   "m.current_player is distinct from actor","actor not in(m.host_id,m.guest_id)",
   "chaotic_preview_3x3_attack_spends","chaotic_preview_3x3_defense_windows",
   "chaotic_preview_3x3_training_damage_events","Pagamento, defesa ou dano",
   "revealed_champions_remain_revealed","points_refunded',0",
   "grant execute on function public.chaotic_cancel_preview_3x3_unpaid_contact"])
   assert.ok(cancel.includes(phrase),phrase);
 assert.doesNotMatch(cancel,/update\s+public\.chaotic_preview_3x3_attack_wallets/i);
 assert.doesNotMatch(cancel,/update\s+public\.chaotic_preview_3x3_hp_wallets/i);
 assert.doesNotMatch(cancel,/update\s+public\.chaotic_game_nodes/i);
});
test("v0.1.69: live test rejects unsupported 104, outsider and paid cancel; persists no fake data",()=>{
 for(const phrase of ["'104','Fogo Primordial 2.0'","chaotic_spend_preview_3x3_attack(room,t)",
 "Defender cancelled attacker contact","Paid original attack can be erased",
 "Unsupported 104 spent training points","unpaid_contact_cancelled","3 original 105 KOs"])
 assert.ok(live.includes(phrase),phrase);
 assert.match(live,/rollback;\s*select 'PASS v0\.1\.69/i);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.69: DROME warns on unsupported projection and cancels safely",()=>{
 for(const phrase of ["resolvableTrainingAttacks3x3","lobby-3x3-cancel-contact",
 "lobby-3x3-support-hint","chaotic_cancel_preview_3x3_unpaid_contact",
 "require3x3Phase(expectedTurn,[\"contact_open\",\"awaiting_payment\"])",
 "supportedAttack&&!!currentProjection","Nenhum ponto, carta ou HP foi alterado",
 "Nenhum ponto pode ser gasto"])
 assert.ok(ui.includes(phrase),phrase);
 assert.match(ui,/if\(!resolvableTrainingAttacks3x3\.has\(projectedAttack\?\.catalog_attack_id\)\)/);
});
test("v0.1.69: release and all PWA module caches are aligned",()=>{
 assert.match(index,/VERSÃO 0\.1\.69/);
 assert.match(index,/sw\.js\?v=release-69/);
 assert.match(sw,/chaotic-go-release-20261031-69/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-69/);
 assert.match(bootstrap,/chaotic-lobby\.js\?v=release-69/);
});
