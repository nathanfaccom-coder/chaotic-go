-- Chaotic GO 0.1.89: read-only, authenticated inspection of YOUR creature
-- and YOUR original Crystal Bracelet 206. Never sacrifice or cure automatically.
-- Attack 106 poison has an explicit uncurable rule; 206 cannot override it.
create or replace function public.chaotic_inspect_preview_3x3_poison_crystal_206(
 p_lobby_id uuid,p_position integer
) returns jsonb
language plpgsql stable security definer set search_path=''
as $inspect$
declare
 actor uuid:=auth.uid();
 match_row public.chaotic_match_turns;
 lobby public.chaotic_lobbies;
 ally public.chaotic_preview_3x3_allies;
 hp public.chaotic_preview_3x3_hp_wallets;
 poison public.chaotic_preview_3x3_poison_statuses;
 deck jsonb;
 album jsonb;
 album_items jsonb;
 equip_id text;
 equip_record jsonb;
 equip_matches integer:=0;
 equip_rule public.chaotic_preview_3x3_equipment_catalog;
 crystal_verified boolean:=false;
 reason_code text;
begin
 if actor is null or p_lobby_id is null or p_position not between 4 and 6
 then raise exception 'Consulta de veneno 3x3 inválida';end if;
 select * into match_row from public.chaotic_match_turns
  where lobby_id=p_lobby_id;
 select * into lobby from public.chaotic_lobbies
  where id=p_lobby_id;
 if match_row.lobby_id is null or lobby.id is null
  or actor not in(match_row.host_id,match_row.guest_id)
  or lobby.host_id is distinct from match_row.host_id
  or lobby.guest_id is distinct from match_row.guest_id
  or lobby.mode<>'3x3' or lobby.status<>'ready'
  or lobby.expires_at<=pg_catalog.statement_timestamp()
 then raise exception 'Sem autorização para consultar criatura 3x3';end if;
 select * into ally from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=actor and position=p_position;
 select * into hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor and position=p_position;
 if ally.lobby_id is null or hp.lobby_id is null
  or hp.creature_instance_id is distinct from ally.creature_instance_id
 then raise exception 'Criatura própria não encontrada no treino';end if;
 select * into poison from public.chaotic_preview_3x3_poison_statuses
  where lobby_id=p_lobby_id and actor_id=actor and position=p_position;
 if poison.lobby_id is not null
   and poison.creature_instance_id is distinct from hp.creature_instance_id
 then raise exception 'Veneno não corresponde à criatura original';end if;
 select g.data into deck from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path in(
    'decks/3x3_slot_'||ally.deck_slot::text,
    'decks/3x3_'||ally.deck_slot::text
  ) order by (g.node_path='decks/3x3_slot_'||ally.deck_slot::text) desc
  limit 1;
 if deck is null or pg_catalog.jsonb_typeof(deck->'criaturas')<>'array'
  or deck->'criaturas'->>(p_position-1) is distinct from ally.creature_instance_id
  or (deck ? 'equipamentos' and pg_catalog.jsonb_typeof(deck->'equipamentos')<>'array')
 then raise exception 'Deck original da criatura não está íntegro';end if;
 equip_id:=nullif(deck->'equipamentos'->>(p_position-1),'');
 if equip_id is not null and equip_id<>'null' and length(equip_id)<=48 then
  select data into album from public.chaotic_game_nodes
   where user_id=actor and node_path='album';
  if pg_catalog.jsonb_typeof(album)='array' then
    album_items:=album;
  elsif pg_catalog.jsonb_typeof(album)='object' then
    select coalesce(pg_catalog.jsonb_agg(value),'[]'::jsonb)
      into album_items from pg_catalog.jsonb_each(album);
  end if;
  if pg_catalog.jsonb_typeof(album_items)='array' then
   select count(*),min(e.value::text)::jsonb
    into equip_matches,equip_record
    from pg_catalog.jsonb_array_elements(album_items) e(value)
    where e.value->>'id'=equip_id and e.value->>'tipoCarta'='Equipamento';
   if equip_matches=1 then
    select * into equip_rule from public.chaotic_preview_3x3_equipment_catalog cat
      where cat.equipment_name=equip_record->>'nome';
    crystal_verified:=equip_rule.equipment_id='206'
       and equip_rule.rule_code='increase_earth_damage_5_cure_poison';
   end if;
  end if;
 end if;
 reason_code:=case
   when poison.lobby_id is not null then 'viper_106_cannot_be_cured'
   when not crystal_verified then 'original_crystal_206_not_verified'
   else 'no_poison_source_to_cure'
 end;
 return pg_catalog.jsonb_build_object(
  'position',p_position,
  'creature_hp',hp.hp_remaining,
  'poisoned',poison.lobby_id is not null,
  'source_attack_id',case when poison.lobby_id is not null then '106' else null end,
  'poison_kind',poison.poison_kind,
  'poison_damage_per_victim_turn',case when poison.lobby_id is null then 0 else 5 end,
  'poison_tick_enabled',false,
  'crystal_206_verified',crystal_verified,
  'poison_curable',false,
  'crystal_cure_enabled',false,
  'equipment_sacrificed',false,
  'points_spent',0,
  'hp_modified',false,
  'official_match_modified',false,
  'reason_code',reason_code
 );
end;
$inspect$;
revoke all on function public.chaotic_inspect_preview_3x3_poison_crystal_206(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_inspect_preview_3x3_poison_crystal_206(uuid,integer)
 to authenticated;
