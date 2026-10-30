-- Chaotic GO 0.1.15: one server-selected preview location per 1x1 room.
-- Three original models: Cidade de Kiru(501: Sabedoria), Tunel da Tempestade(502: Poder),
-- Barragem de Magma(503: Ar defaults to Velocidade per original engine).
-- Live arenas, buffs, HP and win conditions remain untouched.

create or replace function public.chaotic_preview_location_attribute(p_catalog_id integer)
returns text language plpgsql immutable security invoker set search_path=''
as $fn$
begin
 return case p_catalog_id when 501 then 's' when 502 then 'p'
   when 503 then 'v' else null end;
end;
$fn$;
revoke all on function public.chaotic_preview_location_attribute(integer)
 from public,anon,authenticated;

create table if not exists public.chaotic_preview_room_locations (
 lobby_id uuid primary key references public.chaotic_match_turns(lobby_id) on delete cascade,
 selected_by uuid not null references auth.users(id),
 selected_turn integer not null check(selected_turn between 1 and 120),
 source_deck_slot smallint not null check(source_deck_slot between 1 and 3),
 source_card_slot smallint not null check(source_card_slot between 1 and 10),
 location_instance_id text not null check(length(location_instance_id) between 1 and 48),
 catalog_location_id integer not null check(catalog_location_id in (501,502,503)),
 location_name text not null,
 attribute_code text not null check(attribute_code in ('v','p','s')),
 created_at timestamptz not null default now()
);
alter table public.chaotic_preview_room_locations enable row level security;
revoke all on public.chaotic_preview_room_locations from public,anon,authenticated;
grant select on public.chaotic_preview_room_locations to authenticated;
drop policy if exists chaotic_preview_room_location_members on public.chaotic_preview_room_locations;
create policy chaotic_preview_room_location_members on public.chaotic_preview_room_locations
 for select to authenticated using (
 exists(select 1 from public.chaotic_match_turns m
  where m.lobby_id=chaotic_preview_room_locations.lobby_id
   and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_capture_preview_room_location(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_room_locations
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 c public.chaotic_preview_clashes;
 a public.chaotic_preview_loadouts;
 d public.chaotic_preview_loadouts;
 deck jsonb;
 album jsonb;
 records jsonb;
 picked record;
 card jsonb;
 matched integer;
 catalog_id integer;
 loc_name text;
 result public.chaotic_preview_room_locations;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_expected_turn is null or p_expected_turn not between 1 and 120 then
  raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player<>actor or actor not in (m.host_id,m.guest_id) then
  raise exception 'Turno inválido ou jogador não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.status<>'ready' or l.mode<>'1x1' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
  raise exception 'Sala 1x1 não está pronta';end if;
 select * into c from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or c.attacker_id<>actor then
  raise exception 'Registre o confronto antes de sortear o Local';end if;
 select * into a from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 select * into d from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=c.defender_id;
 if a.card_instance_id is distinct from c.attacker_card
  or d.card_instance_id is distinct from c.defender_card then
  raise exception 'Fichas individuais devem corresponder ao confronto';end if;
 if exists(select 1 from public.chaotic_preview_room_locations
   where lobby_id=p_lobby_id) then
  raise exception 'Local já sorteado para esta sala';end if;
 if exists(select 1 from public.chaotic_preview_initiatives
   where lobby_id=p_lobby_id) then
  raise exception 'A iniciativa de teste já começou sem Local; não é possível alterá-la';end if;

 select g.data into deck from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path in (
    'decks/1x1_slot_'||a.deck_slot::text,
    'decks/1x1_'||a.deck_slot::text)
  order by (g.node_path='decks/1x1_slot_'||a.deck_slot::text) desc limit 1;
 if deck is null or jsonb_typeof(deck->'locais')<>'array'
  or jsonb_array_length(deck->'locais') not between 1 and 10 then
  raise exception 'Salve de 1 a 10 Locais no seu Deck 1x1 de teste';end if;
 select e.val as instance_id,e.idx::integer as slot into picked
   from jsonb_array_elements_text(deck->'locais') with ordinality e(val,idx)
   where e.val is not null and e.val not in ('','null')
   order by pg_catalog.gen_random_uuid() limit 1;
 if not found or length(picked.instance_id)>48 then
  raise exception 'Deck sem Local individual válido';end if;
 select g.data into album from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path='album';
 if jsonb_typeof(album)='array' then records:=album;
 elsif jsonb_typeof(album)='object' then
  select coalesce(jsonb_agg(e.value),'[]'::jsonb) into records from jsonb_each(album) e;
 else raise exception 'Álbum indisponível';end if;
 select count(*),min(x.value::text)::jsonb into matched,card
  from jsonb_array_elements(records) x(value)
  where x.value->>'id'=picked.instance_id and x.value->>'tipoCarta'='Local';
 if matched<>1 then raise exception 'Local não corresponde a uma instância única no álbum';end if;
 loc_name:=card->>'nome';
 catalog_id:=case loc_name
   when 'Cidade de Kiru' then 501
   when 'O Túnel da Tempestade' then 502
   when 'A Barragem de Magma' then 503
   else null end;
 if catalog_id is null then
   raise exception 'Local ainda não reconhecido pelo catálogo original';end if;
 insert into public.chaotic_preview_room_locations (
  lobby_id,selected_by,selected_turn,source_deck_slot,source_card_slot,
  location_instance_id,catalog_location_id,location_name,attribute_code)
 values(p_lobby_id,actor,p_expected_turn,a.deck_slot,picked.slot,picked.instance_id,
  catalog_id,loc_name,public.chaotic_preview_location_attribute(catalog_id))
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_capture_preview_room_location(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_capture_preview_room_location(uuid,integer)
 to authenticated;

alter table public.chaotic_preview_initiatives
 drop constraint if exists chaotic_preview_initiatives_attribute_code_check;
alter table public.chaotic_preview_initiatives
 add constraint chaotic_preview_initiatives_attribute_code_check
 check(attribute_code in ('c','p','s','v'));
alter table public.chaotic_preview_initiatives
 drop constraint if exists chaotic_preview_initiatives_attribute_source_check;
alter table public.chaotic_preview_initiatives
 add constraint chaotic_preview_initiatives_attribute_source_check
 check(attribute_source in ('no_location_speed_default','preview_location_deck'));
alter table public.chaotic_preview_initiatives
 add column if not exists location_id integer
 check (location_id is null or location_id in (501,502,503));

create or replace function public.chaotic_preview_initiative_compare(
 p_attacker_stats jsonb,p_defender_stats jsonb,p_attribute text default 'v'
) returns jsonb
language plpgsql immutable security invoker set search_path=''
as $fn$
declare
 a integer;
 d integer;
begin
 if p_attribute is null or p_attribute not in ('c','p','s','v') then
   raise exception 'Iniciativa aceita apenas atributos c/p/s/v';end if;
 if pg_catalog.jsonb_typeof(p_attacker_stats)<>'object'
   or pg_catalog.jsonb_typeof(p_defender_stats)<>'object'
   or p_attacker_stats->>p_attribute !~ '^[0-9]{1,3}$'
   or p_defender_stats->>p_attribute !~ '^[0-9]{1,3}$' then
   raise exception 'Individual Speed stats missing or invalid';end if;
 a:=(p_attacker_stats->>p_attribute)::integer;
 d:=(p_defender_stats->>p_attribute)::integer;
 return pg_catalog.jsonb_build_object(
   'attacker',a,'defender',d,'winner_side',case when d>a then 'defender' else 'attacker' end,
   'tie_favors_attacker',a=d,'attribute',p_attribute);
end;
$fn$;

revoke all on function public.chaotic_preview_initiative_compare(jsonb,jsonb,text)
 from public,anon,authenticated;

create or replace function public.chaotic_capture_preview_initiative(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_initiatives
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 c public.chaotic_preview_clashes;
 a public.chaotic_preview_loadouts;
 d public.chaotic_preview_loadouts;
 vals jsonb;
 loc public.chaotic_preview_room_locations;
 initiative_attr text:='v';
 initiative_source text:='no_location_speed_default';
 result public.chaotic_preview_initiatives;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_expected_turn is null or p_expected_turn not between 1 and 120 then
  raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player<>actor or actor not in (m.host_id,m.guest_id) then
   raise exception 'Não é seu turno em partida ativa';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.status<>'ready' or l.mode<>'1x1' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
  raise exception 'Sala de teste 1x1 inválida';end if;
 select * into c from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or c.attacker_id<>actor then
  raise exception 'Confronto precisa ser registrado pelo atacante';end if;
 select * into a from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=c.attacker_id;
 if not found or a.card_instance_id<>c.attacker_card then
  raise exception 'A ficha do atacante não corresponde ao confronto';end if;
 select * into d from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=c.defender_id;
 if not found or d.card_instance_id<>c.defender_card then
  raise exception 'A ficha do defensor não corresponde ao confronto';end if;
 if exists(select 1 from public.chaotic_preview_initiatives
  where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
  raise exception 'Iniciativa de teste já calculada neste confronto';end if;
 select * into loc from public.chaotic_preview_room_locations
   where lobby_id=p_lobby_id;
 if found then
   initiative_attr:=loc.attribute_code;
   initiative_source:='preview_location_deck';
 end if;
 vals:=public.chaotic_preview_initiative_compare(a.stats,d.stats,initiative_attr);
 insert into public.chaotic_preview_initiatives(
  lobby_id,turn_no,attacker_id,defender_id,attacker_instance_id,
  defender_instance_id,attacker_value,defender_value,winning_player,tie_favors_attacker,attribute_code,attribute_source,location_id
 ) values(
  p_lobby_id,p_expected_turn,c.attacker_id,c.defender_id,c.attacker_card,
  c.defender_card,(vals->>'attacker')::integer,(vals->>'defender')::integer,
  case when vals->>'winner_side'='defender' then c.defender_id else c.attacker_id end,
  (vals->>'tie_favors_attacker')::boolean,
 initiative_attr,initiative_source,loc.catalog_location_id
 ) returning * into result;
 return result;
end;
$fn$;

revoke all on function public.chaotic_capture_preview_initiative(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_capture_preview_initiative(uuid,integer)
 to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
     and tablename='chaotic_preview_room_locations') then
   alter publication supabase_realtime add table public.chaotic_preview_room_locations;
 end if;
end $$;
