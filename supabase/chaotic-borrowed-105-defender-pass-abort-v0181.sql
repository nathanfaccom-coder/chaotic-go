-- Chaotic GO v0.1.81 — defender acknowledges ONLY the private borrowed-105 window.
create or replace function public.chaotic_pass_preview_3x3_borrowed_105_priority(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql volatile security definer set search_path=''
as $pass$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 plan public.chaotic_preview_3x3_borrowed_105_plans;
 c public.chaotic_preview_3x3_contact_intents;
 count_changed integer;
begin
 if actor is null or p_lobby_id is null or p_expected_turn not between 1 and 120
 then raise exception 'Passe de defesa emprestada inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null or m.status<>'active' or m.turn_no<>p_expected_turn
  or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=pg_catalog.statement_timestamp()
  or m.host_id is distinct from l.host_id or m.guest_id is distinct from l.guest_id
  or actor not in(m.host_id,m.guest_id)
 then raise exception 'Janela 3x3 inativa';end if;
 select * into plan from public.chaotic_preview_3x3_borrowed_105_plans
   where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 select * into c from public.chaotic_preview_3x3_contact_intents
   where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if plan.lobby_id is null or plan.state<>'awaiting_defender'
  or plan.borrower_id is distinct from m.current_player
  or plan.defender_id is distinct from actor or plan.borrower_id=actor
  or c.attacker_id is distinct from plan.borrower_id
  or c.defender_id is distinct from actor
  or c.attacker_slot is distinct from plan.attacker_slot
  or c.defender_slot is distinct from plan.defender_slot
  or c.damage_applied or plan.priority_opened_at is null
  or plan.defender_passed_at is not null
 then raise exception 'Somente o defensor responde uma vez à intenção emprestada';end if;
 update public.chaotic_preview_3x3_borrowed_105_plans
  set state='defender_passed_preview',defender_passed_at=pg_catalog.statement_timestamp()
  where lobby_id=p_lobby_id and turn_no=p_expected_turn
   and defender_id=actor and state='awaiting_defender';
 get diagnostics count_changed=row_count;
 if count_changed<>1 then raise exception 'Reação já registrada';end if;
 return pg_catalog.jsonb_build_object('status','defender_passed_preview',
  'turn_no',p_expected_turn,'defender_acknowledged',true,
  'payment_applied',false,'damage_applied',false,'official_match_modified',false);
end;
$pass$;
revoke all on function public.chaotic_pass_preview_3x3_borrowed_105_priority(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_pass_preview_3x3_borrowed_105_priority(uuid,integer)
 to authenticated;
-- Cancel an already opened window without debiting points or releasing the loan.
create or replace function public.chaotic_abort_preview_3x3_borrowed_105_priority(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql volatile security definer set search_path=''
as $abort$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 plan public.chaotic_preview_3x3_borrowed_105_plans;
 changed integer;
begin
 if actor is null or p_lobby_id is null or p_expected_turn not between 1 and 120
 then raise exception 'Cancelamento de reação inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in(m.host_id,m.guest_id)
  or l.mode<>'3x3' or l.status<>'ready'
  or l.expires_at<=pg_catalog.statement_timestamp()
 then raise exception 'Somente o tomador na vez pode encerrar a reação';end if;
 select * into plan from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if plan.lobby_id is null or plan.borrower_id is distinct from actor
  or plan.state not in ('awaiting_defender','defender_passed_preview')
  or plan.payment_applied or plan.damage_applied
  or exists(select 1 from public.chaotic_preview_3x3_attack_spends s
    where s.lobby_id=p_lobby_id and s.turn_no=p_expected_turn)
 then raise exception 'Nenhuma reação emprestada não paga para cancelar';end if;
 update public.chaotic_preview_3x3_borrowed_105_plans
 set state='cancelled' where lobby_id=p_lobby_id and turn_no=p_expected_turn
   and borrower_id=actor and state in('awaiting_defender','defender_passed_preview');
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Reação já cancelada';end if;
 return pg_catalog.jsonb_build_object('status','cancelled',
  'payment_applied',false,'damage_applied',false,'original_owner_changed',false);
end;
$abort$;
revoke all on function public.chaotic_abort_preview_3x3_borrowed_105_priority(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_abort_preview_3x3_borrowed_105_priority(uuid,integer)
 to authenticated;