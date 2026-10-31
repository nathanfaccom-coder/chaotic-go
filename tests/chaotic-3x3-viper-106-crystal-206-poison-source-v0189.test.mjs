import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const paths=[
 "supabase/chaotic-3x3-viper-106-uncurable-poison-provenance-v0189.sql",
 "supabase/chaotic-3x3-crystal-206-poison-eligibility-v0189.sql",
 "supabase/tests/chaotic-3x3-viper-106-crystal-206-source-safety-v0189.test.sql",
 "cartas.js","chaotic-lobby.js","index.html","sw.js","scanner.html","full-game-bootstrap.js"
];
const [schema,inspect,sqltest,cards,ui,index,sw,scanner,boot]=
 await Promise.all(paths.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));

test("v0.1.89: original Viper 106 venom is explicitly uncurable; Crystal 206 may cure other poison",()=>{
 assert.match(cards,/nome:\s*"Armadilha de Víbora"[\s\S]*?efeito:\s*"Causa envenenamento\.[^"]*não pode ser curado\."/i);
 assert.match(cards,/id:\s*206,\s*nome:\s*"Bracelete de cristal"[^]*?Sacrifique este equipamento para curar envenenamento/);
});
test("v0.1.89: poison status has REAL paid damage FK, no tick/cure, private RLS",()=>{
 for(const mark of [
  "create table public.chaotic_preview_3x3_poison_statuses",
  "source_catalog_attack_id text not null default '106' check(source_catalog_attack_id='106')",
  "poison_kind='viper_uncurable'",
  "poison_state='pending_turn_tick_integration'",
  "base_energy_loss_per_victim_turn=5",
  "next_tick_enabled boolean not null default false check(not next_tick_enabled)",
  "ticks_applied integer not null default 0 check(ticks_applied=0)",
  "curable boolean not null default false check(not curable)",
  "crystal_206_cure_allowed boolean not null default false check(not crystal_206_cure_allowed)",
  "public.chaotic_preview_3x3_training_damage_events(lobby_id,turn_no)",
  "public.chaotic_preview_3x3_hp_wallets(lobby_id,actor_id,position)",
  "enable row level security",
  "revoke all on public.chaotic_preview_3x3_poison_statuses",
  "grant select on public.chaotic_preview_3x3_poison_statuses to authenticated",
  "for select to authenticated using((select auth.uid())=actor_id)"
 ])assert.ok(schema.includes(mark),mark);
 assert.doesNotMatch(schema,/\bgrant\s+(insert|update|delete|all)\s+on\s+public\.chaotic_preview_3x3_poison_statuses\s+to\s+authenticated/i);
});
test("v0.1.89: poison provenance requires paid 106 in original owned hand and verified damaged victim",()=>{
 for(const mark of [
  "if tg_op='UPDATE' or tg_op='DELETE'",
  "turn_no=new.source_turn",
  "hit.catalog_attack_id<>'106' or spend.catalog_attack_id<>'106'",
  "not spend.training_points_paid or not spend.training_card_spent",
  "not spend.training_damage_applied",
  "hit.attack_instance_id is distinct from spend.attack_instance_id",
  "hit.damage_dealt<=0 or hit.hp_after<=0",
  "hit.hp_after is distinct from hp.hp_remaining",
  "contact.defender_creature_instance_id is distinct from new.creature_instance_id",
  "hp.hp_remaining<=0",
  "chaotic_preview_3x3_training_outcomes",
  "before insert or update or delete"
 ])assert.ok(schema.includes(mark),mark);
});
test("v0.1.89: Crystal inspection is owner-only, read-only, proves original equipment and rejects uncurable 106",()=>{
 for(const mark of [
  "actor uuid:=auth.uid()",
  "actor not in(match_row.host_id,match_row.guest_id)",
  "actor_id=actor and position=p_position",
  "hp.creature_instance_id is distinct from ally.creature_instance_id",
  "chaotic_preview_3x3_poison_statuses",
  "user_id=actor and g.node_path in(",
  "deck->'criaturas'->>(p_position-1)",
  "e.value",
  "e.value->>'tipoCarta'='Equipamento'",
  "equip_matches=1",
  "equip_rule.equipment_id='206'",
  "equip_rule.rule_code='increase_earth_damage_5_cure_poison'",
  "viper_106_cannot_be_cured",
  "'poison_tick_enabled',false",
  "'crystal_cure_enabled',false",
  "'equipment_sacrificed',false",
  "'points_spent',0",
  "'hp_modified',false",
  "'official_match_modified',false"
 ])assert.ok(inspect.includes(mark),mark);
 assert.doesNotMatch(inspect,/\b(update|insert into|delete from)\s+public\./i);
});
test("v0.1.89: live SQL verifies fake source rejection, private read, no tick or sacrifice",()=>{
 for(const mark of [
  "no_poison_source_to_cure",
  "Fabricated venom without paid 106 accepted",
  "Outsider inspected owner crystal 206",
  "Invalid creature slot inspection accepted",
  "Read-only poison inspection modified equipment or HP",
  "Client can directly forge poison",
  "Client has poison write privileges",
  "rollback;",
  "PASS v0.1.89"
 ])assert.ok(sqltest.includes(mark),mark);
 assert.doesNotMatch(sqltest,/\bcommit\s*;/i);
});
test("v0.1.89: own-character poison inspection UI warns cure and periodic damage disabled",()=>{
 for(const mark of [
  "lobby-3x3-poison-own-position",
  "lobby-3x3-poison-inspect-own",
  "lobby-3x3-poison-own-result",
  "chaotic_inspect_preview_3x3_poison_crystal_206",
  "NÃO PODE SER CURADO",
  "Dano periódico de 5 por turno ainda NÃO está ativo",
  "nenhuma carta será sacrificada",
  "Cura: desabilitada",
  "hp_modified"
 ])assert.ok(ui.includes(mark),mark);
});
test("v0.1.89: public and PWA scanners synchronized at release-89",()=>{
 assert.match(index,/VERSÃO 0\.1\.89/);
 assert.match(index,/sw\.js\?v=release-89/);
 assert.match(sw,/chaotic-go-release-20261031-89/);
 assert.match(scanner,/full-game-bootstrap\.js\?v=release-89/);
 assert.match(boot,/chaotic-lobby\.js\?v=release-89/);
});
