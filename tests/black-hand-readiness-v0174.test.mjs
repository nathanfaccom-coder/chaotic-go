import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [rpc,live,ui,spend,index,worker,bootstrap,scanner]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-black-hand-readiness-v0174.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-black-hand-readiness-live-v0174.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-tornado-v0173.sql",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.74: 102 readiness validates current turn, original card, opponent and hand capacity",()=>{
 for(const name of [
 "chaotic_preview_3x3_black_hand_readiness",
 "m.current_player is distinct from actor",
 "actor not in(m.host_id,m.guest_id)",
 "pr.catalog_attack_id<>'102'",
 "pr.attack_name<>'Mão Negra'",
 "pr.attack_cost_paid",
 "own_wallet.last_draw_turn<>p_expected_turn",
 "opponent_wallet.lobby_id is null",
 "owned_cards+held_cards>=5",
 "their_cards=0"])
 assert.ok(rpc.includes(name),name);
});
test("v0.1.74: private read-only answer never exposes borrowed card identity or implies payable 102",()=>{
 for(const marker of [
 "'playable',false","'payment_enabled',false",
 "'card_id_revealed',false","'opponent_has_card',their_cards>0",
 "'original_decks_modified',false",
 "revoke all on function public.chaotic_preview_3x3_black_hand_readiness",
 "to authenticated"])
 assert.ok(rpc.includes(marker),marker);
 assert.doesNotMatch(rpc,/\b(insert\s+into|update\s+public\.|delete\s+from)\b/i);
 assert.doesNotMatch(rpc,/jsonb_build_object\([^]*source_attack_instance_id/);
 assert.match(spend,/projection\.catalog_attack_id not in\('101','104','105','107','108','109','110','111','112','113','114','115'\)/);
});
test("v0.1.74: live transaction checks authorized-only preflight and no mutations",()=>{
 for(const marker of [
 "eligible_for_future_borrow",
 "Defender was allowed to inspect 102 readiness",
 "Outsider was allowed to inspect 102 readiness",
 "card_id_revealed",
 "Client forged custody",
 "rollback;","PASS 0.1.74"])
 assert.ok(live.includes(marker),marker);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.74: DROME accurately labels nonplayable Mão Negra without revealing card ID",()=>{
 for(const marker of [
 "lobby-3x3-black-hand-readiness",
 "lobby-3x3-black-hand-info",
 "chaotic_preview_3x3_black_hand_readiness",
 "eligible_for_future_borrow",
 "Ainda não é possível roubar, pagar ou usar a carta",
 "A identidade da carta adversária permanece secreta",
 'currentProjection?.catalog_attack_id==="102"'])
 assert.ok(ui.includes(marker),marker);
 assert.doesNotMatch(ui,/resolvableTrainingAttacks3x3=new Set\([^)]*"102"/);
});
test("v0.1.74: PWA cache and visible release version remain synchronized",()=>{
 assert.match(index,/VERSÃO 0\.1\.74/);
 assert.match(index,/sw\.js\?v=release-74/);
 assert.match(worker,/chaotic-go-release-20261031-74/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-74/);
 assert.match(bootstrap,/chaotic-lobby\.js\?v=release-74/);
});
