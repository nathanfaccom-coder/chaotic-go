-- Chaotic GO v0.1.68: lock pending contacts and unpaid attack projections before passing 3x3 turns.
-- Preserves original Battle, Burst, Mugics, Decks, 1x1 and 6x6.
CREATE OR REPLACE FUNCTION public.chaotic_pass_turn(p_lobby_id uuid, p_expected_turn integer)
 RETURNS chaotic_match_turns
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and w.attacker_id=actor
    and (w.status='awaiting_defender'
       or not exists(select 1 from public.chaotic_preview_burst_priority p
         where p.lobby_id=w.lobby_id and p.turn_no=w.turn_no
          and p.priority_status='closed_preview' and p.consecutive_passes=2)
       or not exists(select 1 from public.chaotic_preview_burst_order_plans plan
         where plan.lobby_id=w.lobby_id and plan.turn_no=w.turn_no))
 ) then raise exception 'Finalize os dois passes de prioridade e prepare a inspeção Burst antes de passar o turno';end if;

 -- The 3x3 training cannot skip a paid or pending combat action.
 -- Attack 107 has a documented partially executed effect, so only the
 -- genuinely optional 105/110 end-of-attack decisions block advancement.
 -- 1x1 Burst and 6x6 rules are not changed.
 if lobby.mode='3x3' then
  -- A contact and/or projection begun by this attacker must be
  -- paid or explicitly resolved before advancing. Without this guard,
  -- an interrupted phone could skip an unpaid declared attack.
  -- The match row is already locked FOR UPDATE above, matching the
  -- lock order of the defense and damage RPCs.
  if exists(select 1 from public.chaotic_preview_3x3_contact_intents c
    where c.lobby_id=p_lobby_id and c.turn_no=p_expected_turn
      and c.attacker_id=actor
      and not exists(select 1 from public.chaotic_preview_3x3_attack_spends s
        where s.lobby_id=c.lobby_id and s.turn_no=c.turn_no
          and s.actor_id=actor))
  then raise exception 'Contato 3x3 pendente: conclua o ataque antes de passar o turno';end if;
  if exists(select 1 from public.chaotic_preview_3x3_attack_projections proj
    where proj.lobby_id=p_lobby_id and proj.turn_no=p_expected_turn
      and proj.actor_id=actor
      and not exists(select 1 from public.chaotic_preview_3x3_attack_spends s
        where s.lobby_id=proj.lobby_id and s.turn_no=proj.turn_no
          and s.actor_id=actor and s.attack_instance_id=proj.attack_instance_id))
  then raise exception 'Ataque 3x3 declarado sem pagamento; conclua antes de passar o turno';end if;
  if exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
    where o.lobby_id=p_lobby_id)
  then raise exception 'Treinamento 3x3 já teve vencedor; encerre o treino, não passe o turno';end if;
  if exists(select 1 from public.chaotic_preview_3x3_defense_windows d
    where d.lobby_id=p_lobby_id and d.turn_no=p_expected_turn
      and d.attacker_id=actor and d.status='awaiting_defender')
  then raise exception 'Aguarde o defensor responder antes de passar o turno 3x3';end if;
  if exists(select 1 from public.chaotic_preview_3x3_attack_spends s
    where s.lobby_id=p_lobby_id and s.turn_no=p_expected_turn
      and s.actor_id=actor and not s.training_damage_applied)
  then raise exception 'Ataque 3x3 pago ainda não teve o dano aplicado';end if;
  if exists(select 1 from public.chaotic_preview_3x3_training_damage_events d
    where d.lobby_id=p_lobby_id and d.turn_no=p_expected_turn
      and d.attacker_id=actor and d.catalog_attack_id='105'
      and d.optional_reveal_pending)
  then raise exception 'Decida a revelação opcional do Vento Forte antes de passar o turno';end if;
  if exists(select 1 from public.chaotic_preview_3x3_training_damage_events d
    where d.lobby_id=p_lobby_id and d.turn_no=p_expected_turn
      and d.attacker_id=actor and d.catalog_attack_id='110'
      and not d.effects_fully_resolved)
  then raise exception 'Conclua a busca privada do SONAR antes de passar o turno';end if;
 end if;

 if exists(select 1 from public.chaotic_preview_burst_mugic_intents mi
  where mi.lobby_id=p_lobby_id and mi.turn_no=p_expected_turn
   and mi.intent_status='queued_unexecuted')
 then raise exception 'Mugic declarada mas ainda não resolvida no Burst; cancele a intenção para continuar o treino';end if;
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
$function$

