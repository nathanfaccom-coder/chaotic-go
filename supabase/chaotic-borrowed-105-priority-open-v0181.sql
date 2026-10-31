-- v0.1.81: open borrower 105 defense priority without paying or applying HP.
create or replace function public.chaotic_open_preview_3x3_borrowed_105_priority(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql volatile security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 c public.chaotic_preview_3x3_contact_intents;
 plan public.chaotic_preview_3x3_borrowed_105_plans;
 loan public.chaotic_preview_3x3_temporary_card_custody;
 quote jsonb;
 modified integer;
begin
 if actor is null or p_lobby_id is null or p_expected_turn not between 1 and 120
 then raise exception 'Reação de ataque emprestado inválida';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null or m.status<>'active'
  or m.turn_no<>p_expected_turn or m.current_player is distinct from actor
  or actor not in(m.host_id,m.guest_id)
  or l.mode<>'3x3' or l.status<>'ready'
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
  or l.expires_at<=pg_catalog.statement_timestamp()
  or exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
    where o.lobby_id=p_lobby_id)
 then raise exception 'Somente atacante na vez pode solicitar prioridade 105';end if;
 select * into plan from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 select * into c from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if plan.lobby_id is null or plan.borrower_id is distinct from actor
  or plan.state<>'planned'
  or c.lobby_id is null or c.attacker_id is distinct from actor
  or c.defender_id is distinct from plan.defender_id
  or plan.defender_id is distinct from
      (case when actor=m.host_id then m.guest_id else m.host_id end)
  or plan.attacker_slot is distinct from c.attacker_slot
  or plan.defender_slot is distinct from c.defender_slot
  or plan.hp_before is distinct from c.defender_hp_at_contact
  or c.contact_status<>'awaiting_validated_attack_preview'
  or c.damage_applied or c.official_match_modified
  or exists(select 1 from public.chaotic_preview_3x3_attack_projections pr
    where pr.lobby_id=p_lobby_id and pr.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_attack_spends sp
    where sp.lobby_id=p_lobby_id and sp.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_defense_windows d
    where d.lobby_id=p_lobby_id and d.turn_no=p_expected_turn)
 then raise exception 'Prioridade emprestada não corresponde ao contato sem pagamento';end if;
 select * into loan from public.chaotic_preview_3x3_temporary_card_custody
   where id=plan.custody_id and lobby_id=p_lobby_id for update;
 if loan.id is null or loan.borrower_id is distinct from actor
  or loan.source_actor_id is distinct from plan.defender_id
  or loan.custody_state<>'held' or loan.catalog_attack_id<>'105'
  or not loan.training_only or loan.granted_turn>=p_expected_turn
 then raise exception 'Custódia original do ataque emprestado inválida';end if;
 quote:=public.chaotic_quote_preview_3x3_borrowed_attack(
   p_lobby_id,plan.custody_id,p_expected_turn);
 if quote->>'catalog_attack_id'<>'105'
  or quote->>'attack_name'<>'Vento Forte'
  or (quote->>'attack_cost')::integer<>1
  or (quote->>'base_damage')::integer<>5
  or quote->>'can_afford_if_enabled'<>'true'
  or (quote->>'points_available')::integer<>plan.points_available
  or (quote->>'defender_hp_before')::integer<>plan.hp_before
  or (quote->>'defender_hp_after_base_only')::integer<>plan.hp_base_after
  or exists(select 1 from public.chaotic_preview_3x3_training_attack_locks lk
    where lk.lobby_id=p_lobby_id and lk.defender_id=actor
    and p_expected_turn>lk.inflicted_turn and p_expected_turn<=lk.last_blocked_turn)
 then raise exception 'Saldo, alvo ou bloqueio mudou desde o planejamento';end if;
 update public.chaotic_preview_3x3_borrowed_105_plans
  set state='awaiting_defender',priority_opened_at=pg_catalog.statement_timestamp()
  where lobby_id=p_lobby_id and turn_no=p_expected_turn
    and borrower_id=actor and state='planned';
 get diagnostics modified=row_count;
 if modified<>1 then raise exception 'Já existe uma janela de reação para esta carta';end if;
 return pg_catalog.jsonb_build_object(
  'status','awaiting_defender','turn_no',p_expected_turn,
  'attack_name','Vento Forte','attack_cost',1,
  'defender_acknowledged',false,'payment_applied',false,'damage_applied',false,
  'original_owner_changed',false,'official_match_modified',false);
end;
$fn$;
revoke all on function public.chaotic_open_preview_3x3_borrowed_105_priority(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_open_preview_3x3_borrowed_105_priority(uuid,integer)
 to authenticated;