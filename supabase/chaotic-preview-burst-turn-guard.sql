-- Chaotic GO 0.1.21: do not advance a test 1x1 turn during an unanswered Burst.
-- Other modes and turns without a Burst keep their previous semantics.
create or replace function public.chaotic_pass_turn(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_match_turns
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 match public.chaotic_match_turns;
 lobby public.chaotic_lobbies;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_expected_turn is null or p_expected_turn<1 then
  raise exception 'Número de turno inválido';end if;
 select * into match from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found then raise exception 'Partida não encontrada';end if;
 if actor<>match.host_id and actor<>match.guest_id then
  raise exception 'Você não participa desta partida';end if;
 if match.status<>'active' then raise exception 'Partida encerrada';end if;
 if match.current_player<>actor then raise exception 'Aguarde sua vez';end if;
 if match.turn_no<>p_expected_turn then raise exception 'O turno mudou. Atualize';end if;
 select * into lobby from public.chaotic_lobbies where id=p_lobby_id;
 if not found or lobby.status<>'ready' or lobby.expires_at<=now()
  or lobby.host_id<>match.host_id or lobby.guest_id is distinct from match.guest_id then
   raise exception 'Sala encerrada ou jogadores alterados';end if;
 if lobby.mode='1x1' and exists(
  select 1 from public.chaotic_preview_burst_windows w
   where w.lobby_id=p_lobby_id and w.turn_no=p_expected_turn
    and w.attacker_id=actor and w.status='awaiting_defender'
 ) then raise exception 'Aguarde a resposta do defensor ao Burst antes de passar o turno';end if;
 update public.chaotic_match_turns
  set last_player=actor,turn_no=match.turn_no+1,
   current_player=case when actor=match.host_id then match.guest_id else match.host_id end,
   status=case when match.turn_no>=120 then 'finished' else 'active' end,
   updated_at=now()
  where lobby_id=p_lobby_id returning * into match;
 insert into public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
  values(p_lobby_id,match.turn_no,actor,'pass',match.turn_no);
 return match;
end;
$fn$;
revoke all on function public.chaotic_pass_turn(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_pass_turn(uuid,integer) to authenticated;
