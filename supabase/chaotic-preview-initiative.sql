-- Chaotic GO 0.1.14: server-side initiative diagnostic for TEST 1x1 clashes.
-- Default speed comparison is provisional until location/arena state is linked.
-- No authority to change the real current player, points, HP, deck or rewards.

create table if not exists public.chaotic_preview_initiatives (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attacker_instance_id text not null,
 defender_instance_id text not null,
 attribute_code text not null default 'v' check(attribute_code='v'),
 attribute_source text not null default 'no_location_speed_default'
    check(attribute_source='no_location_speed_default'),
 attacker_value integer not null check(attacker_value between 0 and 999),
 defender_value integer not null check(defender_value between 0 and 999),
 winning_player uuid not null references auth.users(id),
 tie_favors_attacker boolean not null,
 calculation_status text not null default 'preview_only_no_turn_change'
    check(calculation_status='preview_only_no_turn_change'),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_clashes(lobby_id,turn_no)
  on delete cascade
);
alter table public.chaotic_preview_initiatives enable row level security;
revoke all on public.chaotic_preview_initiatives from public,anon,authenticated;
grant select on public.chaotic_preview_initiatives to authenticated;
drop policy if exists chaotic_initiative_member_read on public.chaotic_preview_initiatives;
create policy chaotic_initiative_member_read on public.chaotic_preview_initiatives
 for select to authenticated using (
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_initiatives.lobby_id
     and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

-- Private, side-effect-free compare helper suitable for SQL regression tests.
create or replace function public.chaotic_preview_initiative_compare(
 p_attacker_stats jsonb,p_defender_stats jsonb,p_attribute text default 'v'
) returns jsonb
language plpgsql immutable security invoker set search_path=''
as $fn$
declare
 a integer;
 d integer;
begin
 if p_attribute<>'v' then
   raise exception 'Only the location-free Speed fallback is supported';end if;
 if pg_catalog.jsonb_typeof(p_attacker_stats)<>'object'
   or pg_catalog.jsonb_typeof(p_defender_stats)<>'object'
   or p_attacker_stats->>'v' !~ '^[0-9]{1,3}$'
   or p_defender_stats->>'v' !~ '^[0-9]{1,3}$' then
   raise exception 'Individual Speed stats missing or invalid';end if;
 a:=(p_attacker_stats->>'v')::integer;
 d:=(p_defender_stats->>'v')::integer;
 return pg_catalog.jsonb_build_object(
   'attacker',a,'defender',d,'winner_side',case when d>a then 'defender' else 'attacker' end,
   'tie_favors_attacker',a=d,'attribute','v');
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
 vals:=public.chaotic_preview_initiative_compare(a.stats,d.stats,'v');
 insert into public.chaotic_preview_initiatives(
  lobby_id,turn_no,attacker_id,defender_id,attacker_instance_id,
  defender_instance_id,attacker_value,defender_value,winning_player,tie_favors_attacker
 ) values(
  p_lobby_id,p_expected_turn,c.attacker_id,c.defender_id,c.attacker_card,
  c.defender_card,(vals->>'attacker')::integer,(vals->>'defender')::integer,
  case when vals->>'winner_side'='defender' then c.defender_id else c.attacker_id end,
  (vals->>'tie_favors_attacker')::boolean
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
    and tablename='chaotic_preview_initiatives') then
  alter publication supabase_realtime add table public.chaotic_preview_initiatives;
 end if;
end $$;
