-- Corrige a substituição de uma sala: uma partida ativa não fica órfã
-- quando o anfitrião cria outra sala.
create or replace function public.chaotic_create_lobby(p_mode text)
returns public.chaotic_lobbies
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  old_room public.chaotic_lobbies;
  old_match public.chaotic_match_turns;
  result public.chaotic_lobbies;
begin
  if actor is null then raise exception 'Faça login para abrir uma sala'; end if;
  if p_mode is null or p_mode not in ('1x1','3x3','6x6') then
    raise exception 'Modo de batalha inválido';
  end if;
  if (select count(*) from public.chaotic_lobbies
      where host_id=actor and created_at>now()-interval '15 minutes') >= 10 then
    raise exception 'Muitas salas criadas. Tente novamente mais tarde';
  end if;
  -- Serializa criações simultâneas da mesma conta sem confiar no navegador.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,357));
  for old_room in
    select * from public.chaotic_lobbies
    where host_id=actor and status in ('waiting','ready') for update
  loop
    update public.chaotic_lobbies
      set status='cancelled',updated_at=now() where id=old_room.id;
    select * into old_match from public.chaotic_match_turns
      where lobby_id=old_room.id for update;
    if found and old_match.status='active' then
      update public.chaotic_match_turns
        set status='finished',updated_at=now() where lobby_id=old_room.id;
      insert into public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
        values(old_room.id,old_match.turn_no+1,actor,'stop',old_match.turn_no);
    end if;
  end loop;
  insert into public.chaotic_lobbies(code,host_id,mode)
    values(upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),actor,p_mode)
    returning * into result;
  return result;
end;
$$;
revoke all on function public.chaotic_create_lobby(text) from public,anon,authenticated;
grant execute on function public.chaotic_create_lobby(text) to authenticated;
