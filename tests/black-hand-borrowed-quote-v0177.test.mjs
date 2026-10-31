import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [quote,smoke,borrow,ui,spend,index,sw,scanner,boot]=await Promise.all([
 "supabase/chaotic-preview-3x3-borrowed-quote-v0177.sql",
 "supabase/tests/chaotic-preview-3x3-borrowed-quote-v0177.test.sql",
 "supabase/chaotic-preview-3x3-borrowed-attack-inspection-v0176.sql",
 "chaotic-lobby.js",
 "supabase/chaotic-preview-3x3-spend-tornado-v0173.sql",
 "index.html","sw.js","scanner.html","full-game-bootstrap.js"
].map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));
test("v0.1.77: quote checks active room, attacker, valid contact and turn",()=>{
 for(const marker of [
  "chaotic_quote_preview_3x3_borrowed_attack",
  "actor not in(m.host_id,m.guest_id)",
  "m.current_player is distinct from actor",
  "m.turn_no<>p_expected_turn",
  "c.contact_status<>'awaiting_validated_attack_preview'",
  "c.defender_id is distinct from",
  "chaotic_preview_3x3_attack_spends",
  "chaotic_get_preview_3x3_borrowed_attacks(p_lobby_id)"
 ])assert.ok(quote.includes(marker),marker);
 assert.match(quote,/revoke all on function public\.chaotic_quote_preview_3x3_borrowed_attack\(uuid,uuid,integer\)/);
 assert.match(quote,/grant execute on function public\.chaotic_quote_preview_3x3_borrowed_attack\(uuid,uuid,integer\)\s+to authenticated/);
});
test("v0.1.77: quote uses original owner's private validation, never transfers or mutates",()=>{
 for(const marker of [
  "c.borrower_id=actor","c.custody_state='held'",
  "original_card.card_state<>'loaned'",
  "c.card_id=loan.catalog_attack_id"
 ])assert.ok(borrow.includes(marker),marker);
 for(const marker of [
  "p_custody_id::text","'points_available',available",
  "'can_afford_if_enabled',available>=card_cost",
  "'defender_hp_after_base_only',greatest(0,hp.hp_remaining-card_base)",
  "'elemental_damage_calculated',false",
  "'payment_enabled',false",
  "'damage_applied',false",
  "'ownership_transferred',false"
 ])assert.ok(quote.includes(marker),marker);
 assert.doesNotMatch(quote,/\b(insert\s+into|update\s+public\.|delete\s+from)\b/i);
 assert.match(spend,/projection\.catalog_attack_id not in\('101','104','105','107','108','109','110','111','112','113','114','115'\)/);
});
test("v0.1.77: private DROME quote uses custody ID without adding stolen card to original deck",()=>{
 for(const marker of [
  'lobby-3x3-borrowed-quote-box',
  'lobby-3x3-borrowed-choice',
  'lobby-3x3-borrowed-quote-result',
  'chaotic_quote_preview_3x3_borrowed_attack',
  'borrowedAttacks3x3.some(x=>x.custody_id===choice)',
  'PAGAMENTO E USO DESABILITADOS',
  'Conferir custo e dano-base (SEM usar)'
 ])assert.ok(ui.includes(marker),marker);
 assert.doesNotMatch(ui,/resolvableTrainingAttacks3x3=new Set\([^)]*"102"/);
});
test("v0.1.77: SQL smoke is rollback-only and rejects anonymous/outsider contexts",()=>{
 for(const marker of [
  "has_function_privilege('anon',fn,'execute')",
  "has_function_privilege('authenticated',fn,'execute')",
  "Nonmember quote unexpectedly succeeded",
  "Anonymous quote unexpectedly succeeded",
  "Invalid turn quote unexpectedly succeeded",
  "rollback;","PASS v0.1.77"
 ])assert.ok(smoke.includes(marker),marker);
 assert.doesNotMatch(smoke,/\bcommit\s*;/i);
});
test("v0.1.77: publication pointers and PWA caches are coherent",()=>{
 assert.match(index,/VERSÃO 0\.1\.77/);
 assert.match(index,/sw\.js\?v=release-77/);
 assert.match(sw,/chaotic-go-release-20261031-77/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-77/);
 assert.match(boot,/chaotic-lobby\.js\?v=release-77/);
});

const positiveSql=await readFile(new URL("../supabase/tests/chaotic-preview-3x3-borrowed-quote-positive-live-v0177.test.sql",import.meta.url),"utf8");
test("v0.1.77: real Supabase positive loan fixture tests original cost, HP and owner isolation",()=>{
 for(const marker of [
  "chaotic_preview_3x3_temporary_card_custody",
  "chaotic_quote_preview_3x3_borrowed_attack(room,loan,1)",
  "quoted->>'attack_cost'<>'1'",
  "quoted->>'base_damage'<>'5'",
  "quoted->>'defender_hp_after_base_only'<>'15'",
  "Original owner could quote the borrower card",
  "rollback;","PASS v0.1.77 borrower-only quote"
 ])assert.ok(positiveSql.includes(marker),marker);
 assert.doesNotMatch(positiveSql,/\bcommit\s*;/i);
});
