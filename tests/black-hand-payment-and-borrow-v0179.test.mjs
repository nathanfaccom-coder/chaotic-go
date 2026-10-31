import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,live,ui,spend,borrow]=await Promise.all([
 "supabase/chaotic-preview-3x3-black-hand-payment-and-borrow-v0179.sql",
 "supabase/tests/chaotic-preview-3x3-black-hand-atomic-live-v0179.test.sql",
 "chaotic-lobby.js",
 "supabase/chaotic-preview-3x3-spend-tornado-v0173.sql",
 "supabase/chaotic-preview-3x3-black-hand-loan-once-v0175.sql"
].map(file=>readFile(new URL("../"+file,import.meta.url),"utf8")));
test("v0.1.79: dedicated Mão Negra pay function reuses strict 3x3 original hand and cost protocol",()=>{
 for(const part of ["chaotic_pay_preview_3x3_black_hand",
 "m.current_player is distinct from actor",
 "projection.catalog_attack_id<>'102'",
 "projection.attack_name<>'Mão Negra'",
 "projection.attack_cost<>0",
 "projection.base_damage<>0",
 "chaotic_preview_3x3_black_hand_readiness",
 "inspection.hand_verified is distinct from true",
 "wallet.last_draw_turn<>p_expected_turn",
 "card.card_state<>'hand'",
 "set card_state='spent',spent_turn=p_expected_turn,spent_reason='attack'",
 "grant execute on function public.chaotic_pay_preview_3x3_black_hand(uuid,integer) to authenticated"
 ])assert.ok(sql.includes(part),part);
 assert.doesNotMatch(spend,/catalog_attack_id not in\([^)]*'102'/);
});
test("v0.1.79: theft after defender pass is atomic, original-owner preserving and anti-replay",()=>{
 for(const part of [
 "chaotic_resolve_preview_3x3_black_hand",
 "w.status<>'defender_passed_preview'",
 "w.defender_passed_at is null",
 "paid.training_damage_applied",
 "paid.resolution_status<>'paid_training_unresolved'",
 "public.chaotic_internal_hold_preview_3x3_black_hand(p_lobby_id,p_expected_turn)",
 "set training_damage_applied=true",
 "resolution_status='training_black_hand_102_borrow_resolved'",
 "get diagnostics changed=row_count",
 "if changed<>1",
 "'borrowed_attack_playable',false",
 "'original_owner_changed',false",
 "'damage_applied',false"
 ])assert.ok(sql.includes(part),part);
 assert.ok(borrow.includes("set card_state='loaned'"));
 assert.match(sql,/revoke all on function public\.chaotic_resolve_preview_3x3_black_hand\(uuid,integer\) from public,anon,authenticated/);
});
test("v0.1.79: real SQL test checks negative priority, authorized hold, no replay and rollback",()=>{
 for(const part of [
 "chaotic_pay_preview_3x3_black_hand(room,1)",
 "102 stole attack without defender pass",
 "chaotic_open_preview_3x3_defense_window(room,1)",
 "chaotic_pass_preview_3x3_defense(room,1)",
 "chaotic_resolve_preview_3x3_black_hand(room,1)",
 "training_black_hand_102_borrow_resolved",
 "102 replay created extra card",
 "rollback;",
 "PASS v0.1.79"
 ])assert.ok(live.includes(part),part);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.79: DROME shows payment, priority window and theft only in the matching stage",()=>{
 for(const part of [
 'lobby-3x3-black-hand-pay',
 'lobby-3x3-black-hand-resolve',
 'chaotic_pay_preview_3x3_black_hand',
 'chaotic_resolve_preview_3x3_black_hand',
 'blackHandPaid.training_damage_applied',
 'defenseWindowThisTurn?.status==="defender_passed_preview"',
 'A carta original pertence ao dono',
 'seu uso ainda está DESABILITADO'
 ])assert.ok(ui.includes(part),part);
 assert.doesNotMatch(ui,/resolvableTrainingAttacks3x3=new Set\([^)]*"102"/);
});
