-- v0.1.82: status reflects actual settled cost/HP without exposing custody identifiers.
create or replace function public.chaotic_get_preview_3x3_borrowed_105_priority(
 p_lobby_id uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $view$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 plan public.chaotic_preview_3x3_borrowed_105_plans;
begin
 if actor is null or p_lobby_id is null then raise exception 'Faça login';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null
  or actor not in(m.host_id,m.guest_id) or m.status<>'active'
  or l.mode<>'3x3' or l.status<>'ready'
  or l.expires_at<=pg_catalog.statement_timestamp()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Acesso à reação emprestada restrito aos jogadores do treino';end if;
 select * into plan from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=p_lobby_id and turn_no=m.turn_no;
 if plan.lobby_id is null
 then return pg_catalog.jsonb_build_object('state','none','turn_no',m.turn_no);end if;
 if actor not in(plan.borrower_id,plan.defender_id)
 then raise exception 'Reação pertence a outros jogadores';end if;
 return pg_catalog.jsonb_build_object(
  'state',plan.state,'turn_no',plan.turn_no,
  'attack_name','Vento Forte',
  'your_defense',plan.defender_id=actor,
  'your_attack',plan.borrower_id=actor,
  'payment_applied',plan.payment_applied,'damage_applied',plan.damage_applied,
  'original_owner_changed',false);
end;
$view$;
revoke all on function public.chaotic_get_preview_3x3_borrowed_105_priority(uuid)
 from public,anon,authenticated;
grant execute on function public.chaotic_get_preview_3x3_borrowed_105_priority(uuid)
 to authenticated;
