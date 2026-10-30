-- Chaotic GO 0.1.23: one authenticated equipment-reveal RESPONSE in experimental Burst.
-- No existing equipment is revealed or consumed yet: this action is DECLARED,
-- not executed. Normal attacks are never accepted as Burst counter-cards.

create table if not exists public.chaotic_preview_burst_equipment_responses (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 defender_id uuid not null references auth.users(id),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 equipment_instance_id text not null check(length(equipment_instance_id) between 1 and 48),
 equipment_name text not null check(length(equipment_name) between 1 and 120),
 response_kind text not null default 'declare_equipment_reveal'
  check(response_kind='declare_equipment_reveal'),
 resolution_status text not null default 'queued_unexecuted'
  check(resolution_status='queued_unexecuted'),
 equipment_actually_revealed boolean not null default false
  check(equipment_actually_revealed=false),
 official_match_modified boolean not null default false
  check(official_match_modified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
  public.chaotic_preview_burst_windows(lobby_id,turn_no) on delete cascade
);

alter table public.chaotic_preview_burst_equipment_responses enable row level security;
revoke all on public.chaotic_preview_burst_equipment_responses from public,anon,authenticated;
grant select on public.chaotic_preview_burst_equipment_responses to authenticated;
drop policy if exists chaotic_burst_equipment_participants
 on public.chaotic_preview_burst_equipment_responses;
create policy chaotic_burst_equipment_participants
 on public.chaotic_preview_burst_equipment_responses
 for select to authenticated using(
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_burst_equipment_responses.lobby_id
    and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_queue_preview_burst_equipment(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_equipment_responses
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_burst_windows;
 c public.chaotic_preview_clashes;
 unit public.chaotic_preview_loadouts;
 result public.chaotic_preview_burst_equipment_responses;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id)
 then raise exception 'Partida ou turno não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 não está ativa';end if;
 select * into w from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.status<>'awaiting_defender' or w.defender_id<>actor
  or w.attacker_id<>m.current_player then
  raise exception 'Apenas o defensor pode declarar equipamento durante Burst';end if;
 select * into c from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into unit from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 if c.attacker_id is distinct from w.attacker_id
  or c.defender_id is distinct from actor
  or c.defender_card is distinct from unit.card_instance_id
 then raise exception 'Defensor sem criatura válida no confronto';end if;
 if unit.equipment_instance_id is null or unit.equipment_name is null
  or pg_catalog.btrim(unit.equipment_instance_id)=''
 then raise exception 'Defensor não tem equipamento no DNA registrado';end if;
 if exists(select 1 from public.chaotic_preview_equipment_reveals e
  where e.lobby_id=p_lobby_id and e.actor_id=actor) then
  raise exception 'Equipamento já revelado';end if;
 if exists(select 1 from public.chaotic_preview_burst_equipment_responses
  where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
  raise exception 'Revelação já declarada nesta janela';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Sequência de conferência já preparada';end if;
 insert into public.chaotic_preview_burst_equipment_responses(
  lobby_id,turn_no,defender_id,creature_instance_id,
  equipment_instance_id,equipment_name
 ) values(
  p_lobby_id,p_expected_turn,actor,unit.card_instance_id,
  unit.equipment_instance_id,unit.equipment_name
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_queue_preview_burst_equipment(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_queue_preview_burst_equipment(uuid,integer)
 to authenticated;

-- At this stage one equipment response can precede the attack, but PASS itself
-- does not occupy a stack entry. No card effect is executed.
alter table public.chaotic_preview_burst_order_plans
 drop constraint if exists chaotic_preview_burst_order_plans_check;
alter table public.chaotic_preview_burst_order_plans
 add constraint chaotic_preview_burst_order_plans_check check (
  (defender_response='pass' and defensive_immunity_source is null
    and jsonb_array_length(inspection_steps) between 1 and 2)
  or (defender_response='acknowledge_air_immunity'
    and defensive_immunity_source is not null
    and jsonb_array_length(inspection_steps)=2)
 );

do $$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_burst_equipment_responses') then
  alter publication supabase_realtime
   add table public.chaotic_preview_burst_equipment_responses;
 end if;
end $$;
