-- Per-player durable reconnect cursor, isolated from match outcome and rewards.
create table if not exists public.chaotic_match_read_cursors (
  lobby_id uuid not null references public.chaotic_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seq integer not null default 0 check (last_seq >= 0),
  updated_at timestamptz not null default now(),
  primary key (lobby_id,user_id)
);
alter table public.chaotic_match_read_cursors enable row level security;
revoke all on public.chaotic_match_read_cursors from anon, authenticated;
create or replace function public.chaotic_ack_match_events(p_lobby_id uuid,p_last_seq integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_actor uuid := auth.uid();
 v_match public.chaotic_match_turns%rowtype;
 v_max integer;
 v_saved integer;
begin
 if v_actor is null then raise exception 'Faça login' using errcode='28000'; end if;
 if p_lobby_id is null or p_last_seq is null or p_last_seq < 0 then
   raise exception 'Cursor inválido' using errcode='22023'; end if;
 select * into v_match from public.chaotic_match_turns where lobby_id=p_lobby_id;
 if not found or (v_actor is distinct from v_match.host_id and v_actor is distinct from v_match.guest_id) then
   raise exception 'Partida não encontrada' using errcode='42501'; end if;
 select coalesce(max(seq),0) into v_max from public.chaotic_match_events where lobby_id=p_lobby_id;
 if p_last_seq > v_max then raise exception 'Cursor além do histórico' using errcode='22023'; end if;
 insert into public.chaotic_match_read_cursors(lobby_id,user_id,last_seq)
 values(p_lobby_id,v_actor,p_last_seq)
 on conflict(lobby_id,user_id) do update
 set last_seq=greatest(public.chaotic_match_read_cursors.last_seq,excluded.last_seq),
     updated_at=now()
 returning last_seq into v_saved;
 return jsonb_build_object('lobby_id',p_lobby_id,'last_seq',v_saved);
end;
$$;
revoke all on function public.chaotic_ack_match_events(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_ack_match_events(uuid,integer) to authenticated;
create or replace function public.chaotic_get_match_read_cursor(p_lobby_id uuid)
returns integer language plpgsql stable security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_match public.chaotic_match_turns%rowtype; v_seq integer;
begin
 if v_actor is null then raise exception 'Faça login' using errcode='28000'; end if;
 select * into v_match from public.chaotic_match_turns where lobby_id=p_lobby_id;
 if not found or (v_actor is distinct from v_match.host_id and v_actor is distinct from v_match.guest_id) then
  raise exception 'Partida não encontrada' using errcode='42501'; end if;
 select last_seq into v_seq from public.chaotic_match_read_cursors where lobby_id=p_lobby_id and user_id=v_actor;
 return coalesce(v_seq,0);
end;
$$;
revoke all on function public.chaotic_get_match_read_cursor(uuid) from public,anon,authenticated;
grant execute on function public.chaotic_get_match_read_cursor(uuid) to authenticated;