-- Chaotic GO v0.1.74: non-mutating Black Hand readiness check.
-- No card IDs, slot, owner album content or opponent hand count returned.
-- Original 102 payment remains DISABLED until safe borrow-use lifecycle exists.
create or replace function public.chaotic_preview_3x3_black_hand_readiness(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb
language plpgsql stable security definer set search_path=''
as $readiness$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 pr public.chaotic_preview_3x3_attack_projections;
 contact public.chaotic_preview_3x3_contact_intents;
 own_wallet public.chaotic_preview_3x3_attack_wallets;
 opponent_wallet public.chaotic_preview_3x3_attack_wallets;
 owned_cards integer;
 held_cards integer;
 their_cards integer;
 status_text text;
begin
 if actor is null or p_lobby_id is null or p_expected_turn is null
   or p_expected_turn not between 1 and 120
 then raise exception 'Faça login e informe turno válido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null
   or l.mode<>'3x3' or l.status<>'ready'
   or l.expires_at<=pg_catalog.statement_timestamp()
   or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor
   or actor not in(m.host_id,m.guest_id)
   or l.host_id is distinct from m.host_id
   or l.guest_id is distinct from m.guest_id
 then raise exception 'Apenas atacante autenticado no turno atual pode consultar Mão Negra';end if;
 select * into pr from public.chaotic_preview_3x3_attack_projections
 where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into contact from public.chaotic_preview_3x3_contact_intents
 where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if pr.lobby_id is null or contact.lobby_id is null
   or pr.actor_id is distinct from actor
   or pr.defender_id is distinct from contact.defender_id
   or contact.attacker_id is distinct from actor
   or contact.defender_id is distinct from
    (case when actor=m.host_id then m.guest_id else m.host_id end)
   or pr.catalog_attack_id<>'102' or pr.attack_name<>'Mão Negra'
   or pr.base_damage<>0 or pr.attack_cost<>0
   or pr.attack_cost_paid or contact.damage_applied
 then raise exception 'Só projeção original 102 não paga pode ser conferida';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_spends
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Contato já pago, não pode verificar empréstimo';end if;
 select * into own_wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor;
 select * into opponent_wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=contact.defender_id;
 select count(*) into owned_cards from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=actor and card_state='hand';
 select count(*) into held_cards from public.chaotic_preview_3x3_temporary_card_custody
  where lobby_id=p_lobby_id and borrower_id=actor
   and custody_state in('reserved','held');
 select count(*) into their_cards from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=contact.defender_id and card_state='hand';
 status_text:=case
  when own_wallet.lobby_id is null or own_wallet.last_draw_turn<>p_expected_turn
    then 'prepare_your_hand'
  when opponent_wallet.lobby_id is null then 'opponent_hand_not_prepared'
  when owned_cards+held_cards>=5 then 'your_hand_is_full'
  when their_cards=0 then 'opponent_hand_empty'
  else 'eligible_for_future_borrow' end;
 return pg_catalog.jsonb_build_object(
   'training_only',true,'turn_no',p_expected_turn,
   'status',status_text,
   'possible',status_text='eligible_for_future_borrow',
   'playable',false,'payment_enabled',false,
   'own_free_slots',greatest(0,5-owned_cards-held_cards),
   'opponent_has_card',their_cards>0,
   'original_decks_modified',false,
   'card_id_revealed',false);
end;
$readiness$;
revoke all on function public.chaotic_preview_3x3_black_hand_readiness(uuid,integer)
from public,anon,authenticated;
grant execute on function public.chaotic_preview_3x3_black_hand_readiness(uuid,integer)
to authenticated;
