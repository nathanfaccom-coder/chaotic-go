-- Chaotic GO v0.1.78 — authenticated, fail-closed recovery of stale 3x3 borrowed cards.
-- This endpoint NEVER authorizes borrowing or spending Mão Negra (102).
-- Trigger on terminal training outcome in v0.1.76 remains unchanged.
create or replace function public.chaotic_restore_expired_preview_3x3_loans(
 p_lobby_id uuid
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $restore_expired$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 loan public.chaotic_preview_3x3_temporary_card_custody;
 original public.chaotic_preview_3x3_attack_hand;
 changed integer;
 restored integer:=0;
 final_turn integer;
begin
 if actor is null or p_lobby_id is null then
  raise exception 'Faça login para recuperar um empréstimo expirado';end if;
 -- Locks follow the shared match -> lobby -> card order used by 3x3 combat.
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id for update;
 if m.lobby_id is null or l.id is null
  or actor not in(m.host_id,m.guest_id)
  or l.mode<>'3x3' or m.host_id is distinct from l.host_id
  or m.guest_id is distinct from l.guest_id
  or m.host_id=m.guest_id or l.guest_id is null
 then raise exception 'Recuperação permitida apenas aos participantes originais do treino 3x3';end if;
 -- A forged request cannot retrieve or manipulate cards in an active room.
 if l.status='ready' and l.expires_at>pg_catalog.statement_timestamp()
   and m.status='active'
 then raise exception 'Não é permitido recuperar empréstimos durante partida ativa';end if;
 if m.turn_no not between 1 and 121
 then raise exception 'Turno de recuperação inconsistente';end if;
 final_turn:=least(m.turn_no,120);
 -- States reserved/used need separate future semantics; do not silently
 -- 'repair' them and lose records belonging to a later game feature.
 if exists(
  select 1 from public.chaotic_preview_3x3_temporary_card_custody c
   where c.lobby_id=p_lobby_id and c.custody_state in('reserved','used')
 ) then raise exception 'Custódia intermediária exige recuperação específica';end if;
 for loan in
  select * from public.chaotic_preview_3x3_temporary_card_custody c
  where c.lobby_id=p_lobby_id and c.custody_state='held' and c.training_only
  order by c.source_actor_id,c.source_card_slot for update
 loop
  if loan.source_actor_id not in(m.host_id,m.guest_id)
    or loan.borrower_id not in(m.host_id,m.guest_id)
    or loan.source_actor_id=loan.borrower_id
    or loan.granted_turn>final_turn
  then raise exception 'Custódia incompatível com participantes ou turno';end if;
  select * into original from public.chaotic_preview_3x3_attack_hand h
   where h.lobby_id=p_lobby_id
    and h.actor_id=loan.source_actor_id
    and h.card_slot=loan.source_card_slot for update;
  if original.lobby_id is null or original.card_state<>'loaned'
    or original.attack_instance_id is distinct from loan.source_attack_instance_id
    or original.original_card_consumed or original.spent_turn is not null
    or original.spent_reason is not null
  then raise exception 'Empréstimo não íntegro: devolução cancelada sem alterações';end if;
  update public.chaotic_preview_3x3_attack_hand
   set card_state='deck',recycle_priority=pg_catalog.gen_random_uuid()
   where lobby_id=p_lobby_id and actor_id=loan.source_actor_id
    and card_slot=loan.source_card_slot
    and attack_instance_id=loan.source_attack_instance_id
    and card_state='loaned';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Recuperação de instância original não foi única';end if;
  update public.chaotic_preview_3x3_temporary_card_custody
   set custody_state='released',released_turn=final_turn
   where id=loan.id and lobby_id=p_lobby_id and custody_state='held';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Liberação de custódia não foi única';end if;
  restored:=restored+1;
 end loop;
 return pg_catalog.jsonb_build_object(
   'restored_count',restored,
   'already_clean',restored=0,
   'training_only',true,
   'original_album_modified',false,
   'ownership_transferred',false,
   'payments_or_hp_changed',false);
end;
$restore_expired$;
revoke all on function public.chaotic_restore_expired_preview_3x3_loans(uuid)
 from public,anon,authenticated;
grant execute on function public.chaotic_restore_expired_preview_3x3_loans(uuid)
 to authenticated;
