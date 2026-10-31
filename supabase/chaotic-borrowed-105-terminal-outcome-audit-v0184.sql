-- v0.1.84: train-only terminal audit accepts an OWNED spent card OR
-- a BORROWED 105 that has already been charged, KO-recorded, and returned.
-- It never accepts a mere priority pass as proof of terminal outcome.
CREATE OR REPLACE FUNCTION public.chaotic_validate_3x3_training_outcome_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 n integer;
 defeated integer;
 owned_ok boolean;
 borrowed_ok boolean;
begin
 select * into m from public.chaotic_match_turns
  where lobby_id=new.lobby_id for update;
 select * into l from public.chaotic_lobbies where id=new.lobby_id;
 if actor is null or m.lobby_id is null or l.id is null
   or m.status<>'active' or l.status<>'ready' or l.mode<>'3x3'
   or l.expires_at<=pg_catalog.statement_timestamp()
   or m.turn_no is distinct from new.decided_turn
   or m.current_player is distinct from actor
   or new.winner_id is distinct from actor
   or actor not in (m.host_id,m.guest_id)
   or new.defeated_id is distinct from
     (case when actor=m.host_id then m.guest_id else m.host_id end)
   or m.host_id is distinct from l.host_id
   or m.guest_id is distinct from l.guest_id
   or new.outcome_scope<>'training_only_no_official_victory'
   or new.official_match_ended or new.official_match_modified
   or new.experience_awarded or new.currency_awarded
 then raise exception 'Resultado terminal 3x3 requer evidência de treino autenticada';end if;
 select count(*),count(*) filter (where hp_remaining=0)
 into n,defeated from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=new.lobby_id and actor_id=new.defeated_id;
 if n<>3 or defeated<>3
 then raise exception 'Resultado de equipe exige três criaturas com 0 HP de treino';end if;
 select exists(
  select 1 from public.chaotic_preview_3x3_training_knockouts ko
  join public.chaotic_preview_3x3_defense_windows w
    on w.lobby_id=ko.lobby_id and w.turn_no=ko.turn_no
  join public.chaotic_preview_3x3_attack_spends paid
    on paid.lobby_id=ko.lobby_id and paid.turn_no=ko.turn_no
  where ko.lobby_id=new.lobby_id and ko.turn_no=new.decided_turn
    and ko.attacker_id=actor and ko.defender_id=new.defeated_id
    and ko.catalog_attack_id='105'
    and w.status='defender_passed_preview'
    and w.attacker_id=actor and w.defender_id=new.defeated_id
    and w.defender_slot=ko.defender_slot
    and paid.actor_id=actor and paid.catalog_attack_id='105'
    and paid.attack_instance_id=w.attack_instance_id
    and paid.training_points_paid and paid.training_card_spent
 ) into owned_ok;
 select exists(
  select 1 from public.chaotic_preview_3x3_borrowed_105_knockouts ko
  join public.chaotic_preview_3x3_borrowed_105_plans plan
    on plan.lobby_id=ko.lobby_id and plan.turn_no=ko.turn_no
  join public.chaotic_preview_3x3_borrowed_105_base_events receipt
    on receipt.lobby_id=ko.lobby_id and receipt.turn_no=ko.turn_no
  join public.chaotic_preview_3x3_temporary_card_custody loan
    on loan.id=plan.custody_id and loan.lobby_id=plan.lobby_id
  join public.chaotic_preview_3x3_attack_hand original
    on original.lobby_id=loan.lobby_id and original.actor_id=loan.source_actor_id
      and original.card_slot=loan.source_card_slot
  join public.chaotic_preview_3x3_contact_intents contact
    on contact.lobby_id=ko.lobby_id and contact.turn_no=ko.turn_no
  where ko.lobby_id=new.lobby_id and ko.turn_no=new.decided_turn
    and ko.borrower_id=actor and ko.defender_id=new.defeated_id
    and ko.hp_after=0 and ko.hp_before between 1 and 5
    and ko.custody_id=plan.custody_id
    and ko.defender_slot=plan.defender_slot
    and plan.borrower_id=actor and plan.defender_id=new.defeated_id
    and plan.state='base_resolved_no_optional_reveal'
    and plan.priority_opened_at is not null
    and plan.defender_passed_at is not null
    and plan.payment_applied and plan.damage_applied
    and not plan.official_match_modified
    and receipt.borrower_id=actor and receipt.defender_id=new.defeated_id
    and receipt.custody_id=plan.custody_id
    and receipt.hp_before=ko.hp_before and receipt.hp_after=0
    and receipt.points_after=receipt.points_before-1
    and receipt.training_only and not receipt.official_match_modified
    and contact.attacker_id=actor and contact.defender_id=new.defeated_id
    and contact.defender_slot=ko.defender_slot
    and loan.borrower_id=actor and loan.source_actor_id=new.defeated_id
    and loan.custody_state='released' and loan.catalog_attack_id='105'
    and loan.training_only and loan.released_turn=new.decided_turn
    and original.attack_instance_id=loan.source_attack_instance_id
    and original.card_state='deck' and not original.original_card_consumed
 ) into borrowed_ok;
 if (not owned_ok and not borrowed_ok) or (owned_ok and borrowed_ok)
 then raise exception 'Resultado não possui uma única origem válida de nocaute';end if;
 return new;
end;
$function$
