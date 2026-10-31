-- Chaotic GO v0.1.69: safely cancel only an UNPAID experimental contact.
-- Contact can reveal the two combatants. Revealed identities intentionally remain
-- revealed; undoing a public reveal would let a player regain hidden information.
-- DELETE cascades only through projection -> cost inspection. Never a paid spend.
create or replace function public.chaotic_cancel_preview_3x3_unpaid_contact(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $cancel$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 c public.chaotic_preview_3x3_contact_intents;
 proj public.chaotic_preview_3x3_attack_projections;
begin
 if actor is null or p_lobby_id is null or p_expected_turn is null
   or p_expected_turn not between 1 and 120
 then raise exception 'Faça login e informe o turno válido para cancelar o contato';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor
   or actor not in(m.host_id,m.guest_id)
 then raise exception 'Apenas o atacante no turno atual pode cancelar o contato';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready'
   or l.expires_at<=statement_timestamp()
   or l.host_id is distinct from m.host_id
   or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 indisponível para cancelamento';end if;
 select * into c from public.chaotic_preview_3x3_contact_intents
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or c.attacker_id is distinct from actor
   or c.damage_applied or c.attack_card_validated
   or c.official_match_modified or c.official_hp_changed
 then raise exception 'Contato não encontrado ou já resolvido; não é possível cancelar';end if;
 select * into proj from public.chaotic_preview_3x3_attack_projections
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if proj.lobby_id is not null and (proj.actor_id is distinct from actor
   or proj.attack_cost_paid or proj.training_hp_changed
   or proj.original_card_consumed or proj.official_match_modified)
 then raise exception 'Projeção modificada não pode ser cancelada';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_spends
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_3x3_defense_windows
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_3x3_training_damage_events
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_burst_windows
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Pagamento, defesa ou dano já iniciados; cancelamento proibido';end if;
 -- FKs: inspection references projection ON DELETE CASCADE,
 -- projection references contact ON DELETE CASCADE. No money/HP/card touched.
 delete from public.chaotic_preview_3x3_contact_intents
 where lobby_id=p_lobby_id and turn_no=p_expected_turn
   and attacker_id=actor;
 if not found then raise exception 'Contato foi alterado antes do cancelamento';end if;
 return pg_catalog.jsonb_build_object(
  'status','unpaid_contact_cancelled',
  'turn_no',p_expected_turn,
  'points_refunded',0,
  'card_restored',false,
  'training_hp_changed',false,
  'official_match_modified',false,
  'revealed_champions_remain_revealed',true,
  'training_only',true
 );
end;
$cancel$;
revoke all on function public.chaotic_cancel_preview_3x3_unpaid_contact(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_cancel_preview_3x3_unpaid_contact(uuid,integer)
 to authenticated;
