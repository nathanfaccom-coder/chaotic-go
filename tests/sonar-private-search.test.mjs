import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [cards,db,ui,live]=await Promise.all([
 readFile(new URL("../cartas.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/chaotic-preview-3x3-sonar-private-search.sql",import.meta.url),"utf8"),
 readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8"),
 readFile(new URL("../supabase/tests/chaotic-preview-3x3-sonar-private-search-live.test.sql",import.meta.url),"utf8")
]);
test("SONAR original selects a card of attack cost one or less",()=>{
 const card=cards.slice(cards.indexOf('nome: "SONAR"'),cards.indexOf('nome: "MÃO ELETRÔNICA"'));
 assert.match(card,/Pegue uma carta de ataque de custo 1 ou inferior do monte e adicione na sua mão/);
 assert.match(db,/cost_value<=1/);
 assert.match(db,/h\.card_state='deck'/);
});
test("SONAR validates deck, album, cost and owner before moving one card",()=>{
 for(const key of [
 "auth.uid()","m.current_player is distinct from actor","wallet.total_cards",
 "deck->'ataques'","jsonb_array_elements(records)",
 "x.card->>'id'=card_row.attack_instance_id",
 "x.card->>'tipoCarta'='Ataque'","x.card->>'nome'=c.card_name",
 "c.kind='attack'","cost_value<=1","set card_state='hand'",
 "hand_count_after","count_hand<5"]){
  assert.ok(db.includes(key),key);
 }
 assert.doesNotMatch(db,/update\s+public\.chaotic_game_nodes/i);
});
test("Search is actor-private, single-use, not exposed through realtime",()=>{
 for(const key of ["enable row level security",
 "using ((select auth.uid())=actor_id)",
 "revoke all on public.chaotic_preview_3x3_sonar_search_events",
 "grant select on public.chaotic_preview_3x3_sonar_search_events to authenticated",
 "training_elemental_sonar_110_rex_immunity_search_pending",
 "if exists(select 1 from public.chaotic_preview_3x3_sonar_search_events",
 "create trigger chaotic_3x3_terminal_guard"]){
  assert.ok(db.includes(key),key);
 }
 assert.doesNotMatch(db,/publication supabase_realtime/i);
});
test("Zero eligible candidates ends search without drawing or consuming an original",()=>{
 assert.match(db,/if pg_catalog\.jsonb_array_length\(candidates\)=0 and p_card_slot is not null/);
 assert.match(db,/case when chosen then p_card_slot else null end/);
 assert.match(db,/original_card_consumed boolean not null default false check\(not original_card_consumed\)/);
 assert.match(db,/if chosen then\s*update public\.chaotic_preview_3x3_attack_hand/);
 assert.match(db,/set effects_fully_resolved=true/);
});
test("Real disposable DB fixture exercises cost 0/1, rejects costs 2/3, enemy and replay",()=>{
 for(const key of ["for i in 1..12 loop","sonar-v55-c105","sonar-v55-c108",
 "sonar-v55-c110","sonar-v55-c111",
 "chaotic_resolve_preview_3x3_sonar_search",
 "Opponent accessed private SONAR candidates","SONAR search replay accepted",
 "SONAR accepted cost >1 target","SONAR no eligible card should end cleanly",
 "rollback;"]){
  assert.ok(live.includes(key),key);
 }
 assert.doesNotMatch(live,/\bcommit\s*;/i);
});
test("DROME provides private lookup, choice, confirmation and empty-state",()=>{
 for(const key of ["chaotic_preview_3x3_sonar_search_events",
  "lobby-3x3-sonar-list","lobby-3x3-sonar-choice","lobby-3x3-sonar-choose",
  "lobby-3x3-sonar-empty","sonarSearchEvents3x3","sonarSearchChoices3x3",
  "p_lookup_only:true","p_lookup_only:false",'document.createElement("option")',
  "Escolha uma carta do seu monte"]){assert.ok(ui.includes(key),key);}
 assert.match(ui,/\.eq\("actor_id",userId\)/);
});
