import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [rpc,live,ui,spend,index,sw,boot,scanner]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-borrowed-attack-inspection-v0176.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-borrowed-card-private-live-v0176.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-tornado-v0173.sql",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.76: borrower-only RPC validates lobby membership and owner-held instance",()=>{
 for(const x of [
 "chaotic_get_preview_3x3_borrowed_attacks",
 "actor not in(m.host_id,m.guest_id)",
 "c.borrower_id=actor",
 "c.custody_state='held'",
 "loan.source_actor_id=actor",
 "original_card.card_state<>'loaned'",
 "original_card.attack_instance_id is distinct from loan.source_attack_instance_id",
 "g.user_id=loan.source_actor_id and g.node_path='album'"])
 assert.ok(rpc.includes(x),x);
});
test("v0.1.76: borrowed card attributes use original album and server catalog",()=>{
 for(const x of ["pg_catalog.jsonb_array_elements(album_items)",
 "x.value->>'id'=loan.source_attack_instance_id",
 "x.value->>'tipoCarta'='Ataque'",
 "c.card_id=loan.catalog_attack_id",
 "c.card_name=card_record->>'nome'",
 "'attack_name',canonical.card_name",
 "'attack_cost',canonical.attack_cost",
 "'base_damage',canonical.base_damage",
 "'ownership_transferred',false",
 "'payment_enabled',false",
 "'playable',false"])
 assert.ok(rpc.includes(x),x);
 assert.doesNotMatch(rpc,/\b(insert into|update public\.|delete from)\b/i);
 assert.doesNotMatch(rpc,/'source_attack_instance_id'\s*,\s*loan\./i);
});
test("v0.1.76: RPC is authenticated-only, live SQL tests privacy and rollback",()=>{
 assert.match(rpc,/revoke all on function public\.chaotic_get_preview_3x3_borrowed_attacks/);
 assert.match(rpc,/grant execute on function public\.chaotic_get_preview_3x3_borrowed_attacks\(uuid\)\s+to authenticated/);
 for(const x of ["Borrower-only borrowed card detail wrong or leaked data",
 "Owner got borrower-only stolen card details",
 "Borrower still sees released card as held",
 "Outsider could inspect stolen-card details",
 "Authenticated browser invoked internal loan",
 "rollback;",
 "PASS v0.1.76"])
 assert.ok(live.includes(x),x);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.76: DROME lists borrowed card but never merges into owned hand or enables 102",()=>{
 for(const x of ["borrowedAttacks3x3 = []",
 "chaotic_get_preview_3x3_borrowed_attacks",
 "borrowedAttacks3x3=Array.isArray(borrowerView?.borrowed_attacks)",
 "lobby-3x3-borrowed-attacks",
 "Cartas recebidas TEMPORARIAMENTE",
 "outras cartas emprestadas permanecem indisponíveis",
 "Para roubar no treino 3x3, pague a Mão Negra e aguarde o passe do defensor"])
 assert.ok(ui.includes(x),x);
 assert.doesNotMatch(ui,/resolvableTrainingAttacks3x3=new Set\([^)]*"102"/);
 assert.match(spend,/projection\.catalog_attack_id not in\('101','104','105','107','108','109','110','111','112','113','114','115'\)/);
});
test("v0.1.76+: the release and PWA cache never regress below the validated feature",()=>{
 const shown=index.match(/VERSÃO 0\.1\.(\d+)/);
 const cache=index.match(/sw\.js\?v=release-(\d+)/);
 const swCache=sw.match(/chaotic-go-release-\d{8}-(\d+)/);
 const loaded=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const lobby=boot.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(shown&&cache&&swCache&&loaded&&lobby);
 assert.ok(Number(shown[1])>=76);
 for(const hit of [cache,swCache,loaded,lobby])assert.equal(hit[1],shown[1]);
});
