-- Chaotic GO 0.1.20: server-tracked, single-response Burst preview.
-- No ability, counterspell, Spedman interception or final damage is resolved.
-- The opponent may PASS while it is the ATTACKER's turn; no other user may.
create table if not exists public.chaotic_preview_burst_windows (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 status text not null default 'awaiting_defender'
  check(status in ('awaiting_defender','defender_passed')),
 defender_response text check(defender_response is null or defender_response='pass'),
 defender_responded_at timestamptz,
 burst_fully_resolved boolean not null default false
  check(burst_fully_resolved=false),
 final_damage_verified boolean not null default false
  check(final_damage_verified=false),
 opened_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_clashes(lobby_id,turn_no)
  on delete cascade,
 check(attacker_id<>defender_id),
 check (
  (status='awaiting_defender' and defender_response is null
    and defender_responded_at is null)
  or (status='defender_passed' and defender_response='pass'
    and defender_responded_at is not null)
 )
);
alter table public.chaotic_preview_burst_windows enable row level security;
revoke all on public.chaotic_preview_burst_windows from public,anon,authenticated;
grant select on public.chaotic_preview_burst_windows to authenticated;
drop policy if exists chaotic_burst_members_read on public.chaotic_preview_burst_windows;
create policy chaotic_burst_members_read on public.chaotic_preview_burst_windows
 for select to authenticated using (
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_burst_windows.lobby_id
    and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_open_preview_burst(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_windows
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 c public.chaotic_preview_clashes;
 attack public.chaotic_preview_attack_instances;
 result public.chaotic_preview_burst_windows;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player<>actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Apenas atacante na vez atual pode abrir Burst';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
  raise exception 'Sala 1x1 de teste inválida';end if;
 select * into c from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into attack from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if c.attacker_id is distinct from actor
  or c.defender_id not in (m.host_id,m.guest_id)
  or c.defender_id=actor
  or attack.actor_id is distinct from actor
  or attack.attack_instance_id is distinct from c.attack_card
 then raise exception 'Confronto e carta individual não preparados';end if;
 if exists(select 1 from public.chaotic_preview_individual_damage
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
   raise exception 'Dano já foi pré-calculado: Burst retroativo proibido';end if;
 if exists(select 1 from public.chaotic_preview_burst_windows
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
   raise exception 'Janela de Burst já aberta';end if;
 insert into public.chaotic_preview_burst_windows(
  lobby_id,turn_no,attacker_id,defender_id,attack_instance_id
 ) values(p_lobby_id,p_expected_turn,actor,c.defender_id,c.attack_card)
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_open_preview_burst(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_open_preview_burst(uuid,integer)
 to authenticated;

create or replace function public.chaotic_pass_preview_burst(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_windows
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 win public.chaotic_preview_burst_windows;
 result public.chaotic_preview_burst_windows;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Partida encerrada, rodada alterada ou ator inválido';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
  raise exception 'Sala 1x1 indisponível';end if;
 select * into win from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or win.status<>'awaiting_defender'
  or win.defender_id<>actor or win.attacker_id<>m.current_player then
  raise exception 'Somente o defensor pode passar, uma vez, na vez do atacante';end if;
 update public.chaotic_preview_burst_windows
  set status='defender_passed',defender_response='pass',
   defender_responded_at=now()
  where lobby_id=p_lobby_id and turn_no=p_expected_turn
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_pass_preview_burst(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_pass_preview_burst(uuid,integer)
 to authenticated;
do $$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_burst_windows') then
  alter publication supabase_realtime add table public.chaotic_preview_burst_windows;
 end if;
end $$;
