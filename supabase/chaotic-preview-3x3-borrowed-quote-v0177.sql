-- Chaotic GO v0.1.77: borrower-only, READ-ONLY attack quote.
-- Deliberately NOT a spend/projection insertion or damage resolution.
-- Full 102 gameplay remains disabled until a single atomic pay/use/release path exists.
create or replace function public.chaotic_quote_preview_3x3_borrowed_attack(
 p_lobby_id uuid,p_custody_id uuid,p_expected_turn integer
) returns jsonb
language plpgsql stable security definer set search_path=''
as $quote$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 c public.chaotic_preview_3x3_contact_intents;
 w public.chaotic_preview_3x3_attack_wallets;
 hp public.chaotic_preview_3x3_hp_wallets;
 b jsonb;
 card jsonb;
 available integer;
 card_cost integer;
 card_base integer;
begin
 if actor is null or p_lobby_id is null or p_custody_id is null
    or p_expected_turn not between 1 and 120
 then raise exception 'Prévia de ataque emprestado inválida';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null
   or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor
   or actor not in(m.host_id,m.guest_id)
   or l.mode<>'3x3' or l.status<>'ready'
   or l.host_id is distinct from m.host_id
   or l.guest_id is distinct from m.guest_id
   or l.expires_at<=pg_catalog.statement_timestamp()
 then raise exception 'Somente o atacante atual pode consultar sua prévia 3x3';end if;
 select * into c from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if c.lobby_id is null or c.attacker_id is distinct from actor
  or c.defender_id is distinct from (case when m.host_id=actor then m.guest_id else m.host_id end)
  or c.contact_status<>'awaiting_validated_attack_preview'
  or c.damage_applied or c.attack_card_validated
  or c.official_match_modified or c.official_hp_changed
  or exists(select 1 from public.chaotic_preview_3x3_attack_spends s
   where s.lobby_id=p_lobby_id and s.turn_no=p_expected_turn)
 then raise exception 'Contato de treino encerrado ou já consumido';end if;
 -- Reuse v0.1.76's borrower-only validation of the original owner album,
 -- source card still loaned, and catalog name/cost/damage integrity.
 b:=public.chaotic_get_preview_3x3_borrowed_attacks(p_lobby_id);
 select x.value into card
  from pg_catalog.jsonb_array_elements(b->'borrowed_attacks') x(value)
  where x.value->>'custody_id'=p_custody_id::text;
 if card is null
  or card->>'ownership_transferred'<>'false'
  or card->>'training_only'<>'true'
  or card->>'playable'<>'false'
  or card->>'payment_enabled'<>'false'
 then raise exception 'Carta não emprestada para o atacante ou empréstimo encerrado';end if;
 card_cost:=(card->>'attack_cost')::integer;
 card_base:=(card->>'base_damage')::integer;
 if card_cost not between 0 and 50 or card_base not between 0 and 1000
 then raise exception 'Parâmetros de ataque emprestado inválidos';end if;
 select * into w from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor;
 if w.lobby_id is null or w.last_draw_turn<>p_expected_turn
  or w.prepared_turn>p_expected_turn
  or (p_expected_turn-w.prepared_turn)%2<>0
  or w.spent_points not between 0 and 65
  or w.official_points_changed or w.official_match_modified
 then raise exception 'Carteira de treinamento não sincronizada';end if;
 available:=3+(p_expected_turn-w.prepared_turn)/2-w.spent_points;
 if available not between 0 and 65
 then raise exception 'Pontos de treinamento fora dos limites';end if;
 select * into hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=c.defender_id
    and position=c.defender_slot;
 if hp.lobby_id is null or hp.hp_remaining is distinct from c.defender_hp_at_contact
  or hp.hp_remaining<=0 or hp.official_hp_changed or hp.official_match_modified
 then raise exception 'HP do defensor mudou desde o contato';end if;
 return pg_catalog.jsonb_build_object(
  'custody_id',p_custody_id,
  'turn_no',p_expected_turn,
  'attack_name',card->>'attack_name',
  'catalog_attack_id',card->>'catalog_attack_id',
  'attack_cost',card_cost,
  'base_damage',card_base,
  'points_available',available,
  'can_afford_if_enabled',available>=card_cost,
  'points_if_paid',case when available>=card_cost then available-card_cost else null end,
  'defender_hp_before',hp.hp_remaining,
  'defender_hp_after_base_only',greatest(0,hp.hp_remaining-card_base),
  'base_damage_capped',least(hp.hp_remaining,card_base),
  'elemental_damage_calculated',false,
  'defensive_effects_resolved',false,
  'projection_only',true,
  'payment_enabled',false,
  'damage_applied',false,
  'ownership_transferred',false,
  'official_match_modified',false);
end;
$quote$;
revoke all on function public.chaotic_quote_preview_3x3_borrowed_attack(uuid,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_quote_preview_3x3_borrowed_attack(uuid,uuid,integer)
 to authenticated;
