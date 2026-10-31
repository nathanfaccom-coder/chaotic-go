-- v0.1.80: cancel only a pending, nonpaying borrowed attack plan.
create or replace function public.chaotic_cancel_preview_3x3_borrowed_105(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 plan public.chaotic_preview_3x3_borrowed_105_plans;
 changed integer;
begin
 if actor is null or p_lobby_id is null or p_expected_turn not between 1 and 120
 then raise exception 'Cancelamento de prévia inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if m.lobby_id is null or m.status<>'active'
  or m.current_player is distinct from actor or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id)
 then raise exception 'Somente atacante atual pode cancelar o planejamento';end if;
 select * into plan from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if plan.lobby_id is null or plan.borrower_id is distinct from actor
  or plan.state<>'planned'
  or exists(select 1 from public.chaotic_preview_3x3_attack_spends sp
    where sp.lobby_id=p_lobby_id and sp.turn_no=p_expected_turn)
 then raise exception 'Planejamento não disponível para cancelamento';end if;
 update public.chaotic_preview_3x3_borrowed_105_plans
  set state='cancelled'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn
    and borrower_id=actor and state='planned';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Planejamento já cancelado';end if;
 return pg_catalog.jsonb_build_object('status','cancelled',
  'payment_applied',false,'damage_applied',false,
  'original_owner_changed',false);
end;
$fn$;
revoke all on function public.chaotic_cancel_preview_3x3_borrowed_105(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_cancel_preview_3x3_borrowed_105(uuid,integer)
 to authenticated;