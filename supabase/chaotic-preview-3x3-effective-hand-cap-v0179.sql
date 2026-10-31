-- Chaotic GO v0.1.79: borrowed cards count toward the five-card training hand cap.
-- Server-side triggers guard all hand draw sources (normal, Sonar, Speed, etc).
-- Original owner card is loaned, never duplicated into the borrower's Deck.
begin;
create or replace function public.chaotic_guard_preview_3x3_effective_hand_cap()
returns trigger language plpgsql security definer set search_path=''
as $hand_cap$
declare
 hands integer;
 loans integer;
 borrower uuid;
 lobby uuid;
begin
 if tg_table_name='chaotic_preview_3x3_attack_hand' then
  if new.card_state<>'hand' then return new;end if;
  if tg_op='UPDATE' then
   if old.card_state='hand' then return new;end if;
  end if;
  borrower:=new.actor_id;
  lobby:=new.lobby_id;
 elsif tg_table_name='chaotic_preview_3x3_temporary_card_custody' then
  if new.custody_state<>'held' then return new;end if;
  if tg_op='UPDATE' then
   if old.custody_state='held' then return new;end if;
  end if;
  borrower:=new.borrower_id;
  lobby:=new.lobby_id;
 else raise exception 'Unexpected effective-hand check table';end if;
 select count(*) into hands from public.chaotic_preview_3x3_attack_hand
  where lobby_id=lobby and actor_id=borrower and card_state='hand';
 select count(*) into loans from public.chaotic_preview_3x3_temporary_card_custody
  where lobby_id=lobby and borrower_id=borrower and custody_state='held';
 if hands+loans>=5
 then raise exception 'Mão 3x3 cheia: cartas emprestadas contam no limite de cinco';end if;
 return new;
end;
$hand_cap$;
revoke all on function public.chaotic_guard_preview_3x3_effective_hand_cap()
 from public,anon,authenticated;
create trigger chaotic_3x3_attack_hand_effective_five_cap
 before insert or update of card_state on public.chaotic_preview_3x3_attack_hand
 for each row execute function public.chaotic_guard_preview_3x3_effective_hand_cap();
create trigger chaotic_3x3_custody_effective_five_cap
 before insert or update of custody_state on public.chaotic_preview_3x3_temporary_card_custody
 for each row execute function public.chaotic_guard_preview_3x3_effective_hand_cap();
commit;