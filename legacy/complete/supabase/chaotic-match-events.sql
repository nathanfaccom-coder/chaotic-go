-- DROME (fase 3): histórico imutável das ações de turno em protocolo de teste.
-- Os eventos não são cartas, ataques, dano, resultado ou recompensa.
create table if not exists public.chaotic_match_events (
  lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
  seq integer not null check (seq between 1 and 122),
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('start','pass','stop')),
  turn_no integer not null check (turn_no between 1 and 121),
  created_at timestamptz not null default now(),
  primary key (lobby_id,seq)
);
alter table public.chaotic_match_events enable row level security;
revoke all on public.chaotic_match_events from public,anon,authenticated;
grant select on public.chaotic_match_events to authenticated;
drop policy if exists chaotic_match_events_members_read on public.chaotic_match_events;
create policy chaotic_match_events_members_read on public.chaotic_match_events
  for select to authenticated using (
    exists (
      select 1 from public.chaotic_match_turns mt
      where mt.lobby_id = chaotic_match_events.lobby_id
        and ((select auth.uid()) = mt.host_id or (select auth.uid()) = mt.guest_id)
    )
  );

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
  select * into lobby from public.chaotic_lobbies where id=p_lobby_id for update;
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
  insert into public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
    values(p_lobby_id,1,actor,'start',1);
  return match;
end;
$$;

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
  -- O insert faz parte da mesma transação do turno: sem histórico parcial.
  insert into public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
    values(p_lobby_id,match.turn_no,actor,'pass',match.turn_no);
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
  select * into match from public.chaotic_match_turns
    where lobby_id=p_lobby_id for update;
  if not found or match.status <> 'active'
     or (match.host_id <> actor and match.guest_id <> actor) then
    raise exception 'Partida não está ativa ou você não participa';
  end if;
  update public.chaotic_match_turns set status='finished',updated_at=now()
    where lobby_id=p_lobby_id returning * into match;
  insert into public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
    values(p_lobby_id,match.turn_no+1,actor,'stop',match.turn_no);
  return match;
end;
$$;

-- Encerramento da sala finaliza um teste ainda ativo.
-- Travamento da sala impede que novos convidados entrem enquanto ela é fechada.
create or replace function public.chaotic_close_lobby(p_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  affected integer;
  m public.chaotic_match_turns;
begin
  if actor is null then raise exception 'Faça login'; end if;
  perform 1 from public.chaotic_lobbies where id=p_id and host_id=actor for update;
  if not found then return false; end if;
  update public.chaotic_lobbies set status='cancelled',updated_at=now()
    where id=p_id and status in ('waiting','ready');
  get diagnostics affected = row_count;
  if affected=0 then return false; end if;
  select * into m from public.chaotic_match_turns where lobby_id=p_id for update;
  if found and m.status='active' then
    update public.chaotic_match_turns set status='finished',updated_at=now()
      where lobby_id=p_id;
    insert into public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
      values(p_id,m.turn_no+1,actor,'stop',m.turn_no);
  end if;
  return true;
end;
$$;

-- Se alguém sair de um teste já iniciado, a sala é cancelada.
-- Não reutilizar a mesma partida com um convidado novo.
create or replace function public.chaotic_leave_lobby(p_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  lobby public.chaotic_lobbies;
  m public.chaotic_match_turns;
begin
  if actor is null then raise exception 'Faça login'; end if;
  select * into lobby from public.chaotic_lobbies
    where id=p_id and guest_id=actor and status='ready' for update;
  if not found then return false; end if;
  select * into m from public.chaotic_match_turns where lobby_id=p_id for update;
  if found then
    update public.chaotic_lobbies
      set status='cancelled',updated_at=now() where id=p_id;
    if m.status='active' then
      update public.chaotic_match_turns set status='finished',updated_at=now()
        where lobby_id=p_id;
      insert into public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
        values(p_id,m.turn_no+1,actor,'stop',m.turn_no);
    end if;
  else
    update public.chaotic_lobbies
      set guest_id=null,status='waiting',updated_at=now() where id=p_id;
  end if;
  return true;
end;
$$;

-- SQL CREATE OR REPLACE preserva GRANTs anteriores, mas reafirmamos o isolamento.
revoke all on function public.chaotic_start_match(uuid),public.chaotic_pass_turn(uuid,integer),
  public.chaotic_stop_match(uuid),public.chaotic_close_lobby(uuid),
  public.chaotic_leave_lobby(uuid) from public,anon,authenticated;
grant execute on function public.chaotic_start_match(uuid),public.chaotic_pass_turn(uuid,integer),
  public.chaotic_stop_match(uuid),public.chaotic_close_lobby(uuid),
  public.chaotic_leave_lobby(uuid) to authenticated;
