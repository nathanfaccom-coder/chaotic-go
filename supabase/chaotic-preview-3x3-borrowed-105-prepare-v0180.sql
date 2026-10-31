-- Chaotic GO 0.1.80: persist a nonpaying, private borrowed Vento Forte preview.
create or replace function public.chaotic_prepare_preview_3x3_borrowed_105(
 p_lobby_id uuid,p_custody_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 c public.chaotic_preview_3x3_contact_intents;
 loan public.chaotic_preview_3x3_temporary_card_custody;
 existing public.chaotic_preview_3x3_borrowed_105_plans;
 q jsonb;
begin
 if actor is null or p_lobby_id is null or p_custody_id is null
  or p_expected_turn not between 1 and 120
 then raise exception 'Prévia 105 inválida';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null
  or m.status<>'active' or m.current_player is distinct from actor
  or m.turn_no<>p_expected_turn or actor not in(m.host_id,m.guest_id)
  or l.mode<>'3x3' or l.status<>'ready'
  or l.expires_at<=pg_catalog.statement_timestamp()
  or m.host_id is distinct from l.host_id
  or m.guest_id is distinct from l.guest_id
  or exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
    where o.lobby_id=p_lobby_id)
 then raise exception 'Apenas atacante do treino 3x3 ativo pode planejar';end if;
 select * into c from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if c.lobby_id is null or c.attacker_id is distinct from actor
  or c.defender_id is distinct from
    (case when actor=m.host_id then m.guest_id else m.host_id end)
  or c.contact_status<>'awaiting_validated_attack_preview'
  or c.damage_applied or c.official_match_modified
  or exists(select 1 from public.chaotic_preview_3x3_attack_projections pr
    where pr.lobby_id=p_lobby_id and pr.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_attack_spends sp
    where sp.lobby_id=p_lobby_id and sp.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_training_attack_locks lock
    where lock.lobby_id=p_lobby_id and lock.defender_id=actor
      and p_expected_turn>lock.inflicted_turn and p_expected_turn<=lock.last_blocked_turn)
 then raise exception 'Contato comprometido, pago ou atacante bloqueado';end if;
 select * into loan from public.chaotic_preview_3x3_temporary_card_custody
  where id=p_custody_id and lobby_id=p_lobby_id for update;
 if loan.id is null or loan.borrower_id is distinct from actor
  or loan.source_actor_id is distinct from c.defender_id
  or loan.custody_state<>'held' or not loan.training_only
  or loan.catalog_attack_id<>'105' or loan.granted_turn>=p_expected_turn
 then raise exception 'Vento Forte 105 não emprestado para esta vez';end if;
 select * into existing from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if existing.lobby_id is not null
  and (existing.borrower_id is distinct from actor
    or existing.custody_id is distinct from p_custody_id
    or existing.state<>'planned')
 then raise exception 'Este turno já possui outra intenção ou cancelamento';end if;
 q:=public.chaotic_quote_preview_3x3_borrowed_attack(
  p_lobby_id,p_custody_id,p_expected_turn);
 if q->>'catalog_attack_id'<>'105' or q->>'attack_name'<>'Vento Forte'
  or (q->>'attack_cost')::integer<>1 or (q->>'base_damage')::integer<>5
  or q->>'can_afford_if_enabled'<>'true'
  or q->>'payment_enabled'<>'false' or q->>'damage_applied'<>'false'
 then raise exception 'Custo ou catálogo 105 divergente';end if;
 if existing.lobby_id is null then
  insert into public.chaotic_preview_3x3_borrowed_105_plans(
    lobby_id,turn_no,borrower_id,defender_id,custody_id,attacker_slot,
    defender_slot,points_available,hp_before,hp_base_after)
  values(p_lobby_id,p_expected_turn,actor,c.defender_id,p_custody_id,
    c.attacker_slot,c.defender_slot,
    (q->>'points_available')::integer,(q->>'defender_hp_before')::integer,
    (q->>'defender_hp_after_base_only')::integer);
 end if;
 return pg_catalog.jsonb_build_object(
  'status','planned','turn_no',p_expected_turn,'custody_id',p_custody_id,
  'attack_name','Vento Forte','attack_cost',1,'base_damage',5,
  'points_available',(q->>'points_available')::integer,
  'hp_base_after',(q->>'defender_hp_after_base_only')::integer,
  'payment_enabled',false,'payment_applied',false,'damage_applied',false,
  'original_owner_changed',false,'official_match_modified',false);
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_3x3_borrowed_105(uuid,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_3x3_borrowed_105(uuid,uuid,integer)
 to authenticated;