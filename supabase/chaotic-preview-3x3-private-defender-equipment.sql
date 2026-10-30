-- Chaotic GO v0.1.44: PRIVATE defender-only inspection of original equipment.
-- No automatic reveal to the attacker, no elemental damage resolution, no HP effects.
-- Values mirror cartas.js EQUIPAMENTOS (201..207); keep all existing assets and rules.

create table if not exists public.chaotic_preview_3x3_equipment_catalog (
 equipment_id text primary key check(equipment_id ~ '^20[1-7]$'),
 equipment_name text not null unique,
 rule_code text not null unique
);
alter table public.chaotic_preview_3x3_equipment_catalog enable row level security;
revoke all on public.chaotic_preview_3x3_equipment_catalog from public,anon,authenticated;
insert into public.chaotic_preview_3x3_equipment_catalog(equipment_id,equipment_name,rule_code)
values
 ('201','Anel Precioso','ignore_elemental_damage_with_energy_cost'),
 ('202','Amuleto do Vácuo','immune_to_attacks_involving_air'),
 ('203','Arpa Mágica','discard_for_ability_token'),
 ('204','Bastão da Sabedoria','increase_wisdom_40'),
 ('205','Bomba de Fogo','increase_energy_5_death_damage_25'),
 ('206','Bracelete de cristal','increase_earth_damage_5_cure_poison'),
 ('207','Bracelete de Água','increase_water_damage_5_without_granting_water')
on conflict(equipment_id) do update
 set equipment_name=excluded.equipment_name,rule_code=excluded.rule_code;

create table if not exists public.chaotic_preview_3x3_private_equipment_checks (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 defender_id uuid not null references auth.users(id),
 attacker_id uuid not null references auth.users(id),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 defender_creature_instance_id text not null,
 source_deck_slot smallint not null check(source_deck_slot between 1 and 3),
 equipment_instance_id text,
 catalog_equipment_id text references public.chaotic_preview_3x3_equipment_catalog(equipment_id),
 equipment_name text,
 rule_code text,
 equipment_status text not null check(equipment_status in ('no_equipment_in_slot','owned_original_equipment_in_slot')),
 air_immunity_candidate boolean not null default false,
 elemental_shield_candidate boolean not null default false,
 equipment_effect_applied boolean not null default false check(equipment_effect_applied=false),
 equipment_publicly_revealed boolean not null default false check(equipment_publicly_revealed=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 training_hp_changed boolean not null default false check(training_hp_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 final_damage_calculated boolean not null default false check(final_damage_calculated=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
  public.chaotic_preview_3x3_creature_element_checks(lobby_id,turn_no) on delete cascade,
 check(attacker_id<>defender_id),
 check(
  (equipment_status='no_equipment_in_slot'
   and equipment_instance_id is null and catalog_equipment_id is null
   and equipment_name is null and rule_code is null
   and not air_immunity_candidate and not elemental_shield_candidate)
  or
  (equipment_status='owned_original_equipment_in_slot'
   and equipment_instance_id is not null and catalog_equipment_id is not null
   and equipment_name is not null and rule_code is not null)
 )
);
alter table public.chaotic_preview_3x3_private_equipment_checks enable row level security;
revoke all on public.chaotic_preview_3x3_private_equipment_checks from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_private_equipment_checks to authenticated;
create policy chaotic_preview_3x3_equipment_owner_only
on public.chaotic_preview_3x3_private_equipment_checks for select
to authenticated using(
 defender_id=(select auth.uid()) and
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_private_equipment_checks.lobby_id
  and (select auth.uid())=m.host_id or false)
);
-- Replace policy above with explicit parentheses: owner may be either host or guest.
drop policy chaotic_preview_3x3_equipment_owner_only on public.chaotic_preview_3x3_private_equipment_checks;
create policy chaotic_preview_3x3_equipment_owner_only
on public.chaotic_preview_3x3_private_equipment_checks for select
to authenticated using(
 defender_id=(select auth.uid()) and
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_private_equipment_checks.lobby_id
 and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
);

create or replace function public.chaotic_inspect_preview_3x3_private_defender_equipment(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_private_equipment_checks
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_defense_windows;
 attack public.chaotic_preview_3x3_elemental_inspections;
 creatures public.chaotic_preview_3x3_creature_element_checks;
 ally public.chaotic_preview_3x3_allies;
 own_hp public.chaotic_preview_3x3_hp_wallets;
 deck jsonb;
 album jsonb;
 album_entries jsonb;
 owned_card jsonb;
 ref public.chaotic_preview_3x3_equipment_catalog;
 gear_id text;
 matching_cards integer;
 matching_catalog integer;
 result public.chaotic_preview_3x3_private_equipment_checks;
begin
 if actor is null then raise exception 'Faça login'; end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno 3x3 inválido'; end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id)
 then raise exception 'Jogador não participa deste turno ativo'; end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.status<>'ready' or l.mode<>'3x3' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 indisponível'; end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.status<>'awaiting_defender'
  or w.defender_id is distinct from actor or w.attacker_id is distinct from m.current_player
 then raise exception 'Apenas o defensor na janela aberta pode conferir seu equipamento'; end if;
 select * into attack from public.chaotic_preview_3x3_elemental_inspections
 where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creatures from public.chaotic_preview_3x3_creature_element_checks
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or attack.defender_id is distinct from actor
  or attack.attacker_id is distinct from w.attacker_id
  or attack.defender_slot is distinct from w.defender_slot
  or attack.attack_instance_id is distinct from w.attack_instance_id
  or creatures.defender_id is distinct from actor
  or creatures.attacker_id is distinct from w.attacker_id
  or creatures.defender_slot is distinct from w.defender_slot
  or creatures.attacker_slot is distinct from w.attacker_slot
  or creatures.final_damage_calculated or creatures.official_match_modified
 then raise exception 'Inspecione primeiro o ataque e os elementos básicos das criaturas'; end if;
 if exists(select 1 from public.chaotic_preview_3x3_private_equipment_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Conferência privada já registrada para este turno'; end if;
 select * into ally from public.chaotic_preview_3x3_allies
 where lobby_id=p_lobby_id and actor_id=actor and position=w.defender_slot for update;
 if not found or ally.creature_instance_id is distinct from creatures.defender_creature_instance_id
  or ally.creature_name is distinct from creatures.defender_creature_name
 then raise exception 'Criatura defensora mudou depois da inspeção'; end if;
 select * into own_hp from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=p_lobby_id and actor_id=actor and position=w.defender_slot for update;
 if not found or own_hp.creature_instance_id is distinct from creatures.defender_creature_instance_id
  or own_hp.hp_remaining is distinct from attack.defender_hp_at_contact
  or own_hp.hp_remaining<1
 then raise exception 'HP do defensor mudou depois do contato'; end if;
 select g.data into deck from public.chaotic_game_nodes g
 where g.user_id=actor
   and g.node_path in('decks/3x3_slot_'||ally.deck_slot::text,
                      'decks/3x3_'||ally.deck_slot::text)
 order by (g.node_path='decks/3x3_slot_'||ally.deck_slot::text) desc
 limit 1 for update;
 if deck is null or pg_catalog.jsonb_typeof(deck->'criaturas')<>'array'
   or deck->'criaturas'->>(w.defender_slot-1) is distinct from ally.creature_instance_id
 then raise exception 'Deck 3x3 original não corresponde à criatura defensora'; end if;
 if deck ? 'equipamentos' and pg_catalog.jsonb_typeof(deck->'equipamentos')<>'array'
 then raise exception 'Formato dos equipamentos no Deck inválido'; end if;
 gear_id:=nullif(deck->'equipamentos'->>(w.defender_slot-1),'');
 if gear_id='null' then gear_id:=null;end if;
 if gear_id is not null then
  if length(gear_id)>48 or gear_id !~ '^[A-Za-z0-9_-]+$'
  then raise exception 'Instância de equipamento inválida'; end if;
  select g.data into album from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path='album' for update;
  if pg_catalog.jsonb_typeof(album)='array' then album_entries:=album;
  elsif pg_catalog.jsonb_typeof(album)='object' then
   select coalesce(pg_catalog.jsonb_agg(x.value),'[]'::jsonb)
    into album_entries from pg_catalog.jsonb_each(album) x;
  else raise exception 'Álbum do defensor inválido'; end if;
  select count(*),min(x.value::text)::jsonb
   into matching_cards,owned_card
  from pg_catalog.jsonb_array_elements(album_entries) x(value)
  where x.value->>'id'=gear_id and x.value->>'tipoCarta'='Equipamento';
  if matching_cards<>1 or nullif(owned_card->>'nome','') is null
  then raise exception 'Equipamento não encontrado de forma única no álbum do defensor'; end if;
  select count(*) into matching_catalog
  from public.chaotic_preview_3x3_equipment_catalog c
  where c.equipment_name=owned_card->>'nome';
  if matching_catalog<>1 then raise exception 'Equipamento fora do catálogo original';end if;
  select * into ref from public.chaotic_preview_3x3_equipment_catalog
  where equipment_name=owned_card->>'nome';
 end if;
 insert into public.chaotic_preview_3x3_private_equipment_checks(
  lobby_id,turn_no,defender_id,attacker_id,defender_slot,
  defender_creature_instance_id,source_deck_slot,equipment_instance_id,
  catalog_equipment_id,equipment_name,rule_code,equipment_status,
  air_immunity_candidate,elemental_shield_candidate
 ) values (
  p_lobby_id,p_expected_turn,actor,w.attacker_id,w.defender_slot,
  ally.creature_instance_id,ally.deck_slot,gear_id,
  ref.equipment_id,ref.equipment_name,ref.rule_code,
  case when gear_id is null then 'no_equipment_in_slot'
       else 'owned_original_equipment_in_slot' end,
  gear_id is not null and ref.equipment_id='202' and attack.air_component>0,
  gear_id is not null and ref.equipment_id='201'
    and (attack.fire_component>0 or attack.water_component>0
     or attack.earth_component>0 or attack.air_component>0)
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_inspect_preview_3x3_private_defender_equipment(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_inspect_preview_3x3_private_defender_equipment(uuid,integer)
 to authenticated;
-- Intentionally no supabase_realtime publication: unexposed gear stays private.