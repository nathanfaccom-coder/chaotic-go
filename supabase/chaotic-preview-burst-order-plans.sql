-- Chaotic GO 0.1.22: immutable server-defined inspection order for Burst.
-- IMPORTANT: PASS is NOT a Burst card, and Rex/Amulet defenses are passive.
-- These steps are an inspection plan; NONE is an executed card, action, or damage.

create table if not exists public.chaotic_preview_burst_order_plans (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 defender_response text not null check(defender_response in ('pass','acknowledge_air_immunity')),
 defensive_immunity_source text check(
  defensive_immunity_source is null or
  defensive_immunity_source in ('rex_air','vacuum_amulet_air')),
 inspection_steps jsonb not null check(jsonb_typeof(inspection_steps)='array'),
 inspection_step_count smallint generated always as (jsonb_array_length(inspection_steps)) stored,
 preparation_status text not null default 'prepared_not_executed'
  check(preparation_status='prepared_not_executed'),
 burst_stack_executed boolean not null default false check(burst_stack_executed=false),
 final_damage_verified boolean not null default false check(final_damage_verified=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
  references public.chaotic_preview_burst_windows(lobby_id,turn_no) on delete cascade,
 check(attacker_id<>defender_id),
 check(
  (defender_response='pass' and defensive_immunity_source is null
    and jsonb_array_length(inspection_steps)=1)
  or (defender_response='acknowledge_air_immunity'
    and defensive_immunity_source is not null
    and jsonb_array_length(inspection_steps)=2)
 )
);
alter table public.chaotic_preview_burst_order_plans enable row level security;
revoke all on public.chaotic_preview_burst_order_plans from public,anon,authenticated;
grant select on public.chaotic_preview_burst_order_plans to authenticated;
drop policy if exists chaotic_burst_order_members on public.chaotic_preview_burst_order_plans;
create policy chaotic_burst_order_members on public.chaotic_preview_burst_order_plans
 for select to authenticated using (
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_burst_order_plans.lobby_id
    and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_prepare_preview_burst_order(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_order_plans
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 win public.chaotic_preview_burst_windows;
 clash public.chaotic_preview_clashes;
 attack public.chaotic_preview_attack_instances;
 steps jsonb;
 result public.chaotic_preview_burst_order_plans;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null
  or p_expected_turn not between 1 and 120 then
  raise exception 'Número de turno inválido';end if;

 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player<>actor or actor not in(m.host_id,m.guest_id)
 then raise exception 'Só o atacante pode preparar a sequência em sua vez';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 inválida';end if;
 select * into win from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or win.attacker_id<>actor
  or win.defender_id not in(m.host_id,m.guest_id) or win.defender_id=actor
  or win.status not in('defender_passed','defender_immunity_noted')
  or win.defender_responded_at is null
 then raise exception 'A resposta do defensor precisa estar registrada no servidor';end if;
 select * into clash from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into attack from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if clash.attacker_id is distinct from actor
  or clash.defender_id is distinct from win.defender_id
  or clash.attack_card is distinct from win.attack_instance_id
  or attack.actor_id is distinct from actor
  or attack.attack_instance_id is distinct from win.attack_instance_id
 then raise exception 'Confronto e ataque não conferem com Burst';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
  raise exception 'A sequência já foi registrada';end if;
 if win.status='defender_passed' then
  if win.defender_response<>'pass' or win.defensive_immunity_source is not null then
   raise exception 'Resposta PASSAR incoerente';end if;
  -- PASS is a response, not an action in the stack.
  steps:=jsonb_build_array(
    jsonb_build_object('order',1,'stage','inspect_attack',
      'actor','attacker','source','declared_attack',
      'executed',false));
 else
  if win.defender_response<>'acknowledge_air_immunity'
   or win.defensive_immunity_source not in('rex_air','vacuum_amulet_air') then
   raise exception 'Reconhecimento de imunidade inválido';end if;
  -- Check defender's passive first, then inspect the underlying attack.
  -- Neither stage is an execution, and no passive is counted as a counter-card.
  steps:=jsonb_build_array(
    jsonb_build_object('order',1,'stage','inspect_passive_air_immunity',
      'actor','defender','source',win.defensive_immunity_source,
      'executed',false),
    jsonb_build_object('order',2,'stage','inspect_attack',
      'actor','attacker','source','declared_attack','executed',false));
 end if;
 insert into public.chaotic_preview_burst_order_plans(
  lobby_id,turn_no,attacker_id,defender_id,attack_instance_id,
  defender_response,defensive_immunity_source,inspection_steps
 ) values(
  p_lobby_id,p_expected_turn,actor,win.defender_id,win.attack_instance_id,
  win.defender_response,win.defensive_immunity_source,steps
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_burst_order(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_burst_order(uuid,integer)
 to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_burst_order_plans') then
  alter publication supabase_realtime
   add table public.chaotic_preview_burst_order_plans;
 end if;
end $$;
