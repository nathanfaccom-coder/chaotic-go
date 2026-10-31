-- Chaotic GO v0.1.76: restore ALL held original-owner cards
-- before recording the terminal training result. Idempotent when no loans.
-- BEFORE INSERT runs before terminal attack-hand mutation guard engages.
create or replace function public.chaotic_restore_3x3_loans_before_training_outcome()
returns trigger
language plpgsql security definer set search_path=''
as $restore$
declare
 loan public.chaotic_preview_3x3_temporary_card_custody;
 original public.chaotic_preview_3x3_attack_hand;
 changed integer;
begin
 if new.outcome_scope<>'training_only_no_official_victory'
    or new.official_match_ended or new.official_match_modified
    or new.experience_awarded or new.currency_awarded
 then raise exception 'A devolução de cartas é exclusiva do resultado de treino';end if;
 for loan in
  select * from public.chaotic_preview_3x3_temporary_card_custody c
  where c.lobby_id=new.lobby_id and c.custody_state='held' and c.training_only
  order by c.source_actor_id,c.source_card_slot for update
 loop
  if loan.source_actor_id not in(new.winner_id,new.defeated_id)
    or loan.borrower_id not in(new.winner_id,new.defeated_id)
    or loan.source_actor_id=loan.borrower_id
    or loan.granted_turn>new.decided_turn
  then raise exception 'Empréstimo inconsistente com resultado 3x3';end if;
  select * into original from public.chaotic_preview_3x3_attack_hand h
   where h.lobby_id=new.lobby_id
    and h.actor_id=loan.source_actor_id
    and h.card_slot=loan.source_card_slot for update;
  if original.lobby_id is null or original.card_state<>'loaned'
   or original.attack_instance_id is distinct from loan.source_attack_instance_id
  then raise exception 'Carta emprestada não está íntegra para a devolução no fim do treino';end if;
  update public.chaotic_preview_3x3_attack_hand
   set card_state='deck',recycle_priority=pg_catalog.gen_random_uuid()
   where lobby_id=new.lobby_id and actor_id=loan.source_actor_id
    and card_slot=loan.source_card_slot
    and attack_instance_id=loan.source_attack_instance_id
    and card_state='loaned';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Devolução original não foi única';end if;
  update public.chaotic_preview_3x3_temporary_card_custody
   set custody_state='released',released_turn=new.decided_turn
   where id=loan.id and custody_state='held';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Baixa do empréstimo não foi única';end if;
 end loop;
 return new;
end;
$restore$;
revoke all on function public.chaotic_restore_3x3_loans_before_training_outcome()
 from public,anon,authenticated;
create trigger chaotic_restore_3x3_loans_before_training_outcome
before insert on public.chaotic_preview_3x3_training_outcomes
for each row execute function public.chaotic_restore_3x3_loans_before_training_outcome();
