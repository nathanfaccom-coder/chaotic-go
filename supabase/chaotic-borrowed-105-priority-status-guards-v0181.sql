-- Chaotic GO 0.1.81: minimal room member status (no custody, instance or album IDs).
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
  'payment_applied',false,'damage_applied',false,
  'original_owner_changed',false);
end;
$view$;
revoke all on function public.chaotic_get_preview_3x3_borrowed_105_priority(uuid)
 from public,anon,authenticated;
grant execute on function public.chaotic_get_preview_3x3_borrowed_105_priority(uuid)
 to authenticated;
-- If an outstanding defense exists, passing turn must fail until defender passes or attacker aborts.
create or replace function public.chaotic_guard_preview_3x3_borrowed_priority()
returns trigger language plpgsql security definer set search_path=''
as $guard$
begin
 if tg_table_name='chaotic_match_turns' then
  if new.turn_no is distinct from old.turn_no
   and exists(select 1 from public.chaotic_preview_3x3_borrowed_105_plans p
    where p.lobby_id=old.lobby_id and p.turn_no=old.turn_no
      and p.state='awaiting_defender')
  then raise exception 'Espere a reação do defensor ou cancele o Vento Forte emprestado';end if;
 elsif tg_table_name in('chaotic_preview_3x3_attack_projections',
                         'chaotic_preview_3x3_attack_spends') then
  if exists(select 1 from public.chaotic_preview_3x3_borrowed_105_plans p
    where p.lobby_id=new.lobby_id and p.turn_no=new.turn_no
      and p.state in('awaiting_defender','defender_passed_preview'))
  then raise exception 'Finalize ou cancele a prioridade do ataque emprestado antes de outro ataque';end if;
 else raise exception 'Tabela não suportada no bloqueio de prioridade 105';end if;
 return new;
end;
$guard$;
revoke all on function public.chaotic_guard_preview_3x3_borrowed_priority()
 from public,anon,authenticated;
create trigger chaotic_guard_borrowed_105_turn_advance
 before update of turn_no on public.chaotic_match_turns for each row
 execute function public.chaotic_guard_preview_3x3_borrowed_priority();
create trigger chaotic_guard_borrowed_105_other_attack_projection
 before insert on public.chaotic_preview_3x3_attack_projections for each row
 execute function public.chaotic_guard_preview_3x3_borrowed_priority();
create trigger chaotic_guard_borrowed_105_other_attack_spend
 before insert on public.chaotic_preview_3x3_attack_spends for each row
 execute function public.chaotic_guard_preview_3x3_borrowed_priority();