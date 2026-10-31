-- v0.1.85: resolve the borrowed 105 optional reveal after atomic damage.
-- This never charges points or modifies the borrowed original card.
create or replace function public.chaotic_resolve_preview_3x3_borrowed_105_reveal(
 p_lobby_id uuid,p_expected_turn integer,
 p_target_slot integer default null,p_skip boolean default false
) returns jsonb language plpgsql volatile security definer set search_path=''
as $reveal$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 plan public.chaotic_preview_3x3_borrowed_105_plans;
 paid public.chaotic_preview_3x3_borrowed_105_base_events;
 loan public.chaotic_preview_3x3_temporary_card_custody;
 original public.chaotic_preview_3x3_attack_hand;
 face public.chaotic_preview_3x3_face_states;
 receipt public.chaotic_preview_3x3_borrowed_105_reveal_events;
 opponent uuid;
 changed integer;
begin
 if actor is null or p_lobby_id is null
  or p_expected_turn not between 1 and 120 or p_skip is null
  or (p_target_slot is not null and p_target_slot not between 4 and 6)
  or (p_skip and p_target_slot is not null)
  or (not p_skip and p_target_slot is null)
 then raise exception 'Escolha uma criatura adversária oculta ou dispense a revelação';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null or m.status<>'active'
  or m.turn_no<>p_expected_turn or m.current_player is distinct from actor
  or actor not in(m.host_id,m.guest_id)
  or l.mode<>'3x3' or l.status<>'ready'
  or l.host_id is distinct from m.host_id
  or l.guest_id is distinct from m.guest_id
  or l.expires_at<=pg_catalog.statement_timestamp()
  or exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
    where o.lobby_id=p_lobby_id)
 then raise exception 'Revelação emprestada só durante o treino 3x3 ativo';end if;
 opponent:=case when actor=m.host_id then m.guest_id else m.host_id end;
 select * into plan from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 select * into paid from public.chaotic_preview_3x3_borrowed_105_base_events
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if plan.lobby_id is null or paid.lobby_id is null
  or plan.borrower_id is distinct from actor
  or plan.defender_id is distinct from opponent
  or plan.state<>'base_resolved_no_optional_reveal'
  or not plan.payment_applied or not plan.damage_applied
  or plan.official_match_modified
  or paid.borrower_id is distinct from actor
  or paid.defender_id is distinct from opponent
  or paid.custody_id is distinct from plan.custody_id
  or paid.attack_cost<>1 or paid.base_damage<>5
  or paid.points_after<>paid.points_before-1
  or paid.hp_after is distinct from greatest(0,paid.hp_before-5)
  or paid.hp_before is distinct from plan.hp_before
  or paid.hp_after is distinct from plan.hp_base_after
  or paid.optional_reveal_applied or paid.official_match_modified
 then raise exception 'Vento Forte emprestado exige pagamento e dano-base válidos antes da revelação';end if;
 if exists(select 1 from public.chaotic_preview_3x3_borrowed_105_reveal_events x
  where x.lobby_id=p_lobby_id and x.turn_no=p_expected_turn)
 then raise exception 'Revelação opcional emprestada já decidida neste turno';end if;
 select * into loan from public.chaotic_preview_3x3_temporary_card_custody
  where id=plan.custody_id and lobby_id=p_lobby_id for update;
 if loan.id is null or loan.custody_state<>'released'
  or loan.borrower_id is distinct from actor or loan.source_actor_id is distinct from opponent
  or loan.catalog_attack_id<>'105' or loan.released_turn<>p_expected_turn
  or not loan.training_only
 then raise exception 'Carta emprestada não foi devolvida após o ataque';end if;
 select * into original from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=opponent
  and card_slot=loan.source_card_slot for update;
 if original.lobby_id is null or original.card_state<>'deck'
  or original.attack_instance_id is distinct from loan.source_attack_instance_id
  or original.original_card_consumed or original.spent_turn is not null
 then raise exception 'Carta original não está íntegra após o empréstimo';end if;
 if not p_skip then
  select * into face from public.chaotic_preview_3x3_face_states
   where lobby_id=p_lobby_id and actor_id=opponent and position=p_target_slot
   for update;
  if face.lobby_id is null or face.face_up or not face.training_only
   or exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
    where o.lobby_id=p_lobby_id)
   or not exists(select 1 from public.chaotic_preview_3x3_allies a
    join public.chaotic_preview_3x3_hp_wallets hp
     on hp.lobby_id=a.lobby_id and hp.actor_id=a.actor_id and hp.position=a.position
    where a.lobby_id=p_lobby_id and a.actor_id=opponent
      and a.position=p_target_slot
      and hp.creature_instance_id=a.creature_instance_id and hp.hp_remaining>0)
  then raise exception 'Escolha somente uma criatura adversária viva e oculta';end if;
  update public.chaotic_preview_3x3_face_states set
    face_up=true,reveal_reason='vento_forte',revealed_turn=p_expected_turn
   where lobby_id=p_lobby_id and actor_id=opponent
     and position=p_target_slot and not face_up;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Criatura já foi revelada';end if;
 end if;
 insert into public.chaotic_preview_3x3_borrowed_105_reveal_events
  (lobby_id,turn_no,attacker_id,defender_id,revealed_slot,skipped)
 values(p_lobby_id,p_expected_turn,actor,opponent,
  case when p_skip then null else p_target_slot end,p_skip)
 returning * into receipt;
 return pg_catalog.jsonb_build_object(
  'revealed_slot',receipt.revealed_slot,'skipped',receipt.skipped,
  'effect_resolved',true,'borrowed_attack',true,'training_only',true,
  'payment_applied_again',false,'damage_applied_again',false,
  'original_owner_changed',false,'official_match_modified',false);
end;
$reveal$;
revoke all on function public.chaotic_resolve_preview_3x3_borrowed_105_reveal(uuid,integer,integer,boolean)
 from public,anon,authenticated;
grant execute on function public.chaotic_resolve_preview_3x3_borrowed_105_reveal(uuid,integer,integer,boolean)
 to authenticated;