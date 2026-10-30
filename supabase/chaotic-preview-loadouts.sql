-- DROME: immutable preview of the INDIVIDUAL creature in a user's saved 1x1 deck.
-- A deck stores captured instance IDs (Date.now()), NOT catalog IDs. This bridges that gap.
-- No damage, reward, trade, equipment effect, or official combat mutation takes place.
create table if not exists public.chaotic_preview_loadouts (
  lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  card_instance_id text not null check(length(card_instance_id) between 1 and 48),
  creature_name text not null check(length(creature_name) between 1 and 120),
  tribe text,
  position smallint not null check(position=6),
  deck_slot smallint not null check(deck_slot between 1 and 3),
  stats jsonb not null,
  equipment_instance_id text,
  equipment_name text,
  created_at timestamptz not null default now(),
  primary key (lobby_id,actor_id),
  constraint preview_loadout_stats_object check(jsonb_typeof(stats)='object')
);
alter table public.chaotic_preview_loadouts enable row level security;
revoke all on public.chaotic_preview_loadouts from public,anon,authenticated;
grant select on public.chaotic_preview_loadouts to authenticated;
drop policy if exists chaotic_preview_loadout_members_read on public.chaotic_preview_loadouts;
create policy chaotic_preview_loadout_members_read on public.chaotic_preview_loadouts
  for select to authenticated using (
    exists(select 1 from public.chaotic_match_turns m
      where m.lobby_id=chaotic_preview_loadouts.lobby_id and
      ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
  );

create or replace function public.chaotic_capture_preview_loadout(
  p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_loadouts
language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  m public.chaotic_match_turns;
  l public.chaotic_lobbies;
  selected public.chaotic_combat_declarations;
  unit public.chaotic_preview_board;
  deck jsonb;
  album jsonb;
  records jsonb;
  creature jsonb;
  equipment jsonb;
  equip_id text;
  stats_in jsonb;
  stats_out jsonb;
  v text;
  numeric_value integer;
  stats_key text;
  matched integer;
  result public.chaotic_preview_loadouts;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Turno inválido'; end if;
  select * into m from public.chaotic_match_turns
    where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida de teste inexistente'; end if;
  if actor<>m.host_id and actor<>m.guest_id then raise exception 'Não é participante desta partida'; end if;
  if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
    raise exception 'Não é sua vez ou turno alterado'; end if;
  select * into l from public.chaotic_lobbies where id=p_lobby_id;
  if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Esta preparação é exclusiva do modo 1x1 ativo'; end if;
  select * into selected from public.chaotic_combat_declarations
    where lobby_id=p_lobby_id and actor_id=actor and kind='creature';
  if not found or selected.card_slot<>6 then
    raise exception 'Declare sua criatura no slot c6 primeiro'; end if;
  select * into unit from public.chaotic_preview_board
    where lobby_id=p_lobby_id and actor_id=actor;
  if not found or unit.position<>6 or unit.card_id<>selected.card_id then
    raise exception 'Posicione a mesma criatura no tabuleiro primeiro'; end if;
  if exists(select 1 from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=actor) then
    raise exception 'Ficha já preparada para esta partida'; end if;

  select g.data into deck from public.chaotic_game_nodes g
    where g.user_id=actor and g.node_path in (
      'decks/1x1_slot_'||selected.deck_slot::text,
      'decks/1x1_'||selected.deck_slot::text)
    order by (g.node_path='decks/1x1_slot_'||selected.deck_slot::text) desc limit 1;
  if deck is null or jsonb_typeof(deck->'criaturas')<>'array'
    or deck->'criaturas'->>5 is distinct from selected.card_id then
    raise exception 'Criatura não corresponde ao deck 1x1 salvo'; end if;

  select g.data into album from public.chaotic_game_nodes g
    where g.user_id=actor and g.node_path='album';
  if album is null then raise exception 'Álbum não encontrado'; end if;
  if jsonb_typeof(album)='array' then
    records:=album;
  elsif jsonb_typeof(album)='object' then
    select coalesce(jsonb_agg(e.value),'[]'::jsonb) into records
      from jsonb_each(album) e;
  else
    raise exception 'Formato do álbum inválido';
  end if;
  select count(*),min(x.value::text)::jsonb into matched,creature
    from jsonb_array_elements(records) x(value)
    where x.value->>'id'=selected.card_id and x.value->>'tipoCarta'='Criatura';
  if matched<>1 then raise exception 'Criatura do deck não foi localizada de forma única no seu álbum'; end if;
  if nullif(creature->>'nome','') is null or length(creature->>'nome')>120 then
    raise exception 'Nome da criatura inválido'; end if;
  stats_in:=creature->'stats';
  if jsonb_typeof(stats_in)<>'object' then raise exception 'Carta não possui atributos individuais'; end if;
  stats_out:='{}'::jsonb;
  foreach stats_key in array array['c','p','s','v','e'] loop
    v:=stats_in->>stats_key;
    if v is null or v !~ '^[0-9]{1,3}$' then
      raise exception 'Atributo individual inválido: %',stats_key; end if;
    numeric_value:=v::integer;
    if numeric_value>500 then raise exception 'Atributo individual fora do intervalo: %',stats_key; end if;
    stats_out:=stats_out||jsonb_build_object(stats_key,numeric_value);
  end loop;
  if (stats_out->>'e')::integer<1 then raise exception 'A energia da criatura precisa ser positiva'; end if;

  -- DROME original uses equipment at same slot, falling back to first nonempty.
  if jsonb_typeof(deck->'equipamentos')='array' then
    equip_id:=nullif(deck->'equipamentos'->>5,'');
    if equip_id is null or equip_id='null' then
      select val into equip_id from jsonb_array_elements_text(deck->'equipamentos') v(val)
        where val is not null and val<>'' and val<>'null' limit 1;
    end if;
  end if;
  if equip_id is not null then
    select count(*),min(x.value::text)::jsonb into matched,equipment
      from jsonb_array_elements(records) x(value)
      where x.value->>'id'=equip_id and x.value->>'tipoCarta'='Equipamento';
    if matched<>1 then raise exception 'Equipamento não localizado de forma única no seu álbum'; end if;
    if nullif(equipment->>'nome','') is null then raise exception 'Nome do equipamento inválido'; end if;
  end if;
  insert into public.chaotic_preview_loadouts(
    lobby_id,actor_id,card_instance_id,creature_name,tribe,position,deck_slot,
    stats,equipment_instance_id,equipment_name
  ) values(
    p_lobby_id,actor,selected.card_id,creature->>'nome',creature->>'tribo',
    6,selected.deck_slot,stats_out,equip_id,equipment->>'nome'
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.chaotic_capture_preview_loadout(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.chaotic_capture_preview_loadout(uuid,integer)
  to authenticated;
do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='chaotic_preview_loadouts') then
    alter publication supabase_realtime add table public.chaotic_preview_loadouts;
  end if;
end $$;
