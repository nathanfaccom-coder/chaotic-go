-- Chaotic GO 0.1.27 — successive PASS priority in an ISOLATED Burst 1x1 preview.
-- PASS is never a card; this is NOT full Burst execution or official combat.
create table if not exists public.chaotic_preview_burst_priority (
  lobby_id uuid not null,
  turn_no integer not null check(turn_no between 1 and 120),
  attacker_id uuid not null references auth.users(id),
  defender_id uuid not null references auth.users(id),
  next_actor_id uuid references auth.users(id),
  consecutive_passes smallint not null default 0 check(consecutive_passes between 0 and 2),
  priority_status text not null default 'awaiting_priority'
    check(priority_status in ('awaiting_priority','closed_preview')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  official_match_modified boolean not null default false check(official_match_modified=false),
  burst_fully_resolved boolean not null default false check(burst_fully_resolved=false),
  final_damage_verified boolean not null default false check(final_damage_verified=false),
  primary key (lobby_id,turn_no),
  foreign key(lobby_id,turn_no) references public.chaotic_preview_burst_windows(lobby_id,turn_no)
    on delete cascade,
  check(attacker_id<>defender_id),
  check(
    (priority_status='awaiting_priority' and closed_at is null
      and ((consecutive_passes=0 and next_actor_id=attacker_id)
        or (consecutive_passes=1 and next_actor_id=defender_id)))
    or (priority_status='closed_preview' and consecutive_passes=2
      and next_actor_id is null and closed_at is not null)
  )
);
create table if not exists public.chaotic_preview_burst_priority_passes (
  lobby_id uuid not null,
  turn_no integer not null,
  pass_seq smallint not null check(pass_seq in (1,2)),
  actor_id uuid not null references auth.users(id),
  action_type text not null default 'pass' check(action_type='pass'),
  created_at timestamptz not null default now(),
  official_match_modified boolean not null default false check(official_match_modified=false),
  primary key(lobby_id,turn_no,pass_seq),
  foreign key(lobby_id,turn_no) references public.chaotic_preview_burst_priority(lobby_id,turn_no)
    on delete cascade
);
alter table public.chaotic_preview_burst_priority enable row level security;
alter table public.chaotic_preview_burst_priority_passes enable row level security;
revoke all on public.chaotic_preview_burst_priority,
 public.chaotic_preview_burst_priority_passes from public,anon,authenticated;
grant select on public.chaotic_preview_burst_priority,
 public.chaotic_preview_burst_priority_passes to authenticated;
create policy chaotic_burst_priority_member_read
 on public.chaotic_preview_burst_priority for select to authenticated using (
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_burst_priority.lobby_id
 and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid())))
);
create policy chaotic_burst_priority_pass_member_read
 on public.chaotic_preview_burst_priority_passes for select to authenticated using (
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_burst_priority_passes.lobby_id
 and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid())))
);
create or replace function public.chaotic_open_preview_burst_priority(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_priority
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_burst_windows;
 result public.chaotic_preview_burst_priority;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player<>actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente atacante pode abrir rodada de prioridade';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
   or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 indisponível';end if;
 select * into w from public.chaotic_preview_burst_windows
   where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.attacker_id<>actor or w.defender_id not in (m.host_id,m.guest_id)
   or w.defender_id=actor
   or w.status not in ('defender_passed','defender_immunity_noted')
   or w.defender_responded_at is null
 then raise exception 'A resposta inicial do defensor não foi concluída';end if;
 if exists(select 1 from public.chaotic_preview_burst_priority
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_burst_order_plans
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_individual_damage
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Rodada de prioridade já aberta ou dano/ordem já registrados';end if;
 insert into public.chaotic_preview_burst_priority(
   lobby_id,turn_no,attacker_id,defender_id,next_actor_id
 ) values (p_lobby_id,p_expected_turn,actor,w.defender_id,actor)
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_open_preview_burst_priority(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_open_preview_burst_priority(uuid,integer)
 to authenticated;

create or replace function public.chaotic_pass_preview_burst_priority(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_priority
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_burst_windows;
 state public.chaotic_preview_burst_priority;
 result public.chaotic_preview_burst_priority;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or actor not in (m.host_id,m.guest_id)
 then raise exception 'Partida ou turno inválido';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
   or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 indisponível';end if;
 select * into w from public.chaotic_preview_burst_windows
   where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into state from public.chaotic_preview_burst_priority
   where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or state.priority_status<>'awaiting_priority'
   or state.next_actor_id is distinct from actor
   or state.attacker_id is distinct from m.current_player
   or state.attacker_id is distinct from w.attacker_id
   or state.defender_id is distinct from w.defender_id
   or w.status not in ('defender_passed','defender_immunity_noted')
   or w.defender_responded_at is null
 then raise exception 'Prioridade não pertence a você ou janela mudou';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_individual_damage
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Prioridade encerrada após início de resolução';end if;
 insert into public.chaotic_preview_burst_priority_passes(
   lobby_id,turn_no,pass_seq,actor_id
 ) values(p_lobby_id,p_expected_turn,state.consecutive_passes+1,actor);
 update public.chaotic_preview_burst_priority
 set consecutive_passes=state.consecutive_passes+1,
  priority_status=case when state.consecutive_passes=1 then 'closed_preview'
    else 'awaiting_priority' end,
  next_actor_id=case when state.consecutive_passes=1 then null
    else state.defender_id end,
  closed_at=case when state.consecutive_passes=1 then now()
    else null end
 where lobby_id=p_lobby_id and turn_no=p_expected_turn
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_pass_preview_burst_priority(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_pass_preview_burst_priority(uuid,integer)
 to authenticated;

do $pub$
begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_burst_priority') then
   alter publication supabase_realtime add table public.chaotic_preview_burst_priority;
 end if;
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_burst_priority_passes') then
   alter publication supabase_realtime add table public.chaotic_preview_burst_priority_passes;
 end if;
end $pub$;