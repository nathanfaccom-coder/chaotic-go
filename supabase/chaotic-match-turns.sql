-- DROME: protocolo transacional de turnos para DUAS contas autenticadas.
-- NÃO executa efeitos de cartas, calcula vencedor, concede recompensas ou transfere itens.
create table if not exists public.chaotic_match_turns (
  lobby_id uuid primary key references public.chaotic_lobbies(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','finished')),
  current_player uuid not null references auth.users(id),
  turn_no integer not null default 1 check (turn_no between 1 and 121),
  last_player uuid references auth.users(id),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chaotic_match_distinct_players check (host_id <> guest_id),
  constraint chaotic_match_current_member check (current_player in (host_id,guest_id))
);
alter table public.chaotic_match_turns enable row level security;
revoke all on table public.chaotic_match_turns from public,anon,authenticated;
grant select on public.chaotic_match_turns to authenticated;
drop policy if exists chaotic_match_member_read on public.chaotic_match_turns;
create policy chaotic_match_member_read on public.chaotic_match_turns
  for select to authenticated using (
    (select auth.uid()) = host_id or (select auth.uid()) = guest_id
  );

-- Autoridade do servidor: trava a sala e cria UMA única partida por sala.
create or replace function public.chaotic_start_match(p_lobby_id uuid)
returns public.chaotic_match_turns
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  lobby public.chaotic_lobbies;
  match public.chaotic_match_turns;
begin
  if actor is null then raise exception 'Faça login'; end if;
  select * into lobby from public.chaotic_lobbies
    where id=p_lobby_id for update;
  if not found then raise exception 'Sala não encontrada'; end if;
  if lobby.host_id <> actor then raise exception 'Somente o anfitrião inicia a partida'; end if;
  if lobby.status <> 'ready' or lobby.guest_id is null or lobby.expires_at <= now() then
    raise exception 'A sala precisa ter dois jogadores e estar ativa';
  end if;
  if exists (select 1 from public.chaotic_match_turns where lobby_id=p_lobby_id) then
    raise exception 'Já existe uma partida para esta sala';
  end if;
  insert into public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player)
    values(p_lobby_id,lobby.host_id,lobby.guest_id,lobby.host_id)
    returning * into match;
  return match;
end;
$$;

-- CAS/turno esperado: dois cliques simultâneos ou replay NÃO avançam duas vezes.
create or replace function public.chaotic_pass_turn(p_lobby_id uuid,p_expected_turn integer)
returns public.chaotic_match_turns
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  match public.chaotic_match_turns;
  lobby public.chaotic_lobbies;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_expected_turn is null or p_expected_turn < 1 then
    raise exception 'Número de turno inválido';
  end if;
  select * into match from public.chaotic_match_turns
    where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  if actor <> match.host_id and actor <> match.guest_id then
    raise exception 'Você não participa desta partida';
  end if;
  if match.status <> 'active' then raise exception 'Partida encerrada'; end if;
  if match.current_player <> actor then raise exception 'Aguarde sua vez'; end if;
  if match.turn_no <> p_expected_turn then raise exception 'O turno mudou. Atualize'; end if;
  select * into lobby from public.chaotic_lobbies where id=p_lobby_id;
  if not found or lobby.status <> 'ready' or lobby.expires_at <= now()
    or lobby.host_id <> match.host_id or lobby.guest_id is distinct from match.guest_id then
    raise exception 'Sala encerrada ou jogadores alterados';
  end if;
  update public.chaotic_match_turns
    set last_player=actor, turn_no=match.turn_no+1,
        current_player=case when actor=match.host_id then match.guest_id else match.host_id end,
        status=case when match.turn_no >= 120 then 'finished' else 'active' end,
        updated_at=now()
    where lobby_id=p_lobby_id
    returning * into match;
  return match;
end;
$$;

create or replace function public.chaotic_stop_match(p_lobby_id uuid)
returns public.chaotic_match_turns
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  match public.chaotic_match_turns;
begin
  if actor is null then raise exception 'Faça login'; end if;
  update public.chaotic_match_turns
    set status='finished',updated_at=now()
    where lobby_id=p_lobby_id and status='active'
      and (host_id=actor or guest_id=actor)
    returning * into match;
  if not found then raise exception 'Partida não está ativa ou você não participa'; end if;
  return match;
end;
$$;

revoke all on function public.chaotic_start_match(uuid) from public,anon,authenticated;
revoke all on function public.chaotic_pass_turn(uuid,integer) from public,anon,authenticated;
revoke all on function public.chaotic_stop_match(uuid) from public,anon,authenticated;
grant execute on function public.chaotic_start_match(uuid),
  public.chaotic_pass_turn(uuid,integer),public.chaotic_stop_match(uuid) to authenticated;
