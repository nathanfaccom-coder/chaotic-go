import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [loan,unique,live,spend,ui,index,sw,bootstrap,scanner]=await Promise.all([
 readFile(new URL("../supabase/chaotic-preview-3x3-black-hand-atomic-custody-v0175.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-black-hand-loan-once-v0175.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-black-hand-loan-live-v0175.test.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-spend-tornado-v0173.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../index.html",import.meta.url),"utf8"),
 readFile(new URL("../sw.js",import.meta.url),"utf8"),
 readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
 readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.75: original-owner cards get separate loaned state, never transferred to borrower's Deck",()=>{
 for(const x of ["card_state in ('deck','hand','spent','loaned')",
  "card_state in('deck','hand','loaned') and spent_turn is null",
  "chaotic_preview_3x3_temporary_card_custody",
  "victim.attack_instance_id,catalog,p_expected_turn,'held'",
  "set card_state='loaned'",
  "actor_id=contact.defender_id",
  "where g.user_id=contact.defender_id and g.node_path='album'",
  "from public.chaotic_preview_card_reference ref"])
 assert.ok(loan.includes(x),x);
 assert.doesNotMatch(loan,/\bset\s+actor_id\s*=/i);
 assert.doesNotMatch(loan,/update\s+public\.chaotic_game_nodes/i);
});
test("v0.1.75: no browser access to internal theft or return functions",()=>{
 for(const fn of ["chaotic_internal_hold_preview_3x3_black_hand","chaotic_internal_release_preview_3x3_black_hand"]){
 assert.ok(loan.includes("revoke all on function public."+fn),fn);
 assert.doesNotMatch(loan,new RegExp("grant execute on function public\\."+fn+"\\([^)]*\\)\\s+to authenticated","i"));
 }
 assert.match(spend,/projection\.catalog_attack_id not in\('101','104','105','107','108','109','110','111','112','113','114','115'\)/);
 assert.doesNotMatch(ui,/resolvableTrainingAttacks3x3=new Set\([^)]*"102"/);
});
test("v0.1.75: original owner can restore only the exact card; no double loan or return",()=>{
 for(const x of [
 "c.custody_state<>'held'",
 "h.card_state<>'loaned'",
 "h.attack_instance_id is distinct from c.source_attack_instance_id",
 "set card_state='deck',recycle_priority=pg_catalog.gen_random_uuid()",
 "set custody_state='released',released_turn=p_expected_turn",
 "one_loan_per_borrower_turn",
 "and borrower_id=actor",
 "Empréstimo da Mão Negra já executado neste turno (antirreplay)"])
 assert.ok((loan+"\n"+unique).includes(x),x);
});
test("v0.1.75: real DB rollback test includes synthetic paid 102, random hold and return",()=>{
 for(const x of ["'H1','102',0,3,3",
 "chaotic_internal_hold_preview_3x3_black_hand(room,1)",
 "chaotic_internal_release_preview_3x3_black_hand(room,loan,1)",
 "Defender triggered Black Hand loan",
 "102 duplicate loan was allowed",
 "102 repeat after RELEASE was accepted",
 "Authenticated browser invoked internal loan",
 "Authenticated browser invoked internal restitution",
 "rollback;","PASS v0.1.75"])
 assert.ok(live.includes(x),x);
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("v0.1.75+: latest PWA cache aligned and 102 still unplayable",()=>{
 const displayed=index.match(/VERSÃO 0\.1\.(\d+)/);
 const workerTag=index.match(/sw\.js\?v=release-(\d+)/);
 const cache=sw.match(/chaotic-go-release-\d{8}-(\d+)/);
 const scan=scanner.match(/full-game-bootstrap\.js\?v=release-(\d+)/);
 const lobby=bootstrap.match(/chaotic-lobby\.js\?v=release-(\d+)/);
 assert.ok(displayed&&workerTag&&cache&&scan&&lobby);
 assert.ok(Number(displayed[1])>=75);
 for(const ref of [workerTag,cache,scan,lobby])assert.equal(ref[1],displayed[1]);
 assert.ok(ui.includes("O ataque emprestado recebido ainda não é utilizável."));
});
