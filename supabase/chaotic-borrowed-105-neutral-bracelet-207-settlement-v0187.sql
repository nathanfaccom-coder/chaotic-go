-- Chaotic GO v0.1.87: authorize verified ORIGINAL defender bracelet 207
-- solely against canonical neutral borrowed Vento Forte 105. Bracelet is an
-- offensive WATER modifier; it cannot negate or modify a neutral enemy attack.
-- No ability, water element, extra damage or equipment spending is performed.
create or replace function public.chaotic_settle_preview_3x3_borrowed_105_base(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql volatile security definer set search_path=''
as $settle$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 c public.chaotic_preview_3x3_contact_intents;
 plan public.chaotic_preview_3x3_borrowed_105_plans;
 loan public.chaotic_preview_3x3_temporary_card_custody;
 wallet public.chaotic_preview_3x3_attack_wallets;
 att public.chaotic_preview_3x3_hp_wallets;
 def public.chaotic_preview_3x3_hp_wallets;
 ally public.chaotic_preview_3x3_allies;
 source_card public.chaotic_preview_3x3_attack_hand;
 deck jsonb;
 gear text;
 equip_album jsonb;
 equip_array jsonb;
 equip_item jsonb;
 equip_matches integer;
 equip_cat public.chaotic_preview_3x3_equipment_catalog;
 attack_cat public.chaotic_preview_card_reference;
 quote jsonb;
 before_points integer;
 updated integer;
 team_units integer;
 dead_units integer;
 outcome_recorded boolean:=false;
begin
 if actor is null or p_lobby_id is null or p_expected_turn not between 1 and 120
 then raise exception 'Resolução emprestada 105 inválida';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null or m.status<>'active'
  or m.current_player is distinct from actor or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id)
  or l.mode<>'3x3' or l.status<>'ready'
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
  or l.expires_at<=pg_catalog.statement_timestamp()
  or exists(select 1 from public.chaotic_preview_3x3_training_outcomes t
    where t.lobby_id=p_lobby_id)
 then raise exception 'Somente atacante no treino 3x3 ativo pode resolver';end if;
 select * into plan from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 select * into c from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if plan.lobby_id is null or plan.borrower_id is distinct from actor
  or plan.state<>'defender_passed_preview'
  or plan.priority_opened_at is null or plan.defender_passed_at is null
  or plan.payment_applied or plan.damage_applied or plan.official_match_modified
  or c.lobby_id is null or c.attacker_id is distinct from actor
  or c.defender_id is distinct from plan.defender_id
  or plan.defender_id is distinct from
    (case when actor=m.host_id then m.guest_id else m.host_id end)
  or c.attacker_slot is distinct from plan.attacker_slot
  or c.defender_slot is distinct from plan.defender_slot
  or c.contact_status<>'awaiting_validated_attack_preview'
  or c.damage_applied or c.attack_card_validated or c.official_hp_changed
  or c.official_match_modified
  or exists(select 1 from public.chaotic_preview_3x3_attack_projections pr
    where pr.lobby_id=p_lobby_id and pr.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_attack_spends sp
    where sp.lobby_id=p_lobby_id and sp.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_defense_windows w
    where w.lobby_id=p_lobby_id and w.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_training_damage_events e
    where e.lobby_id=p_lobby_id and e.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_borrowed_105_base_events e
    where e.lobby_id=p_lobby_id and e.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows b
    where b.lobby_id=p_lobby_id and b.turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_clashes b
    where b.lobby_id=p_lobby_id and b.turn_no=p_expected_turn)
 then raise exception 'Reação não concluída, ataque duplicado ou combate conflitante';end if;
 select * into loan from public.chaotic_preview_3x3_temporary_card_custody
  where id=plan.custody_id and lobby_id=p_lobby_id for update;
 if loan.id is null or loan.custody_state<>'held' or not loan.training_only
  or loan.borrower_id is distinct from actor
  or loan.source_actor_id is distinct from plan.defender_id
  or loan.catalog_attack_id<>'105'
  or loan.granted_turn>=p_expected_turn
 then raise exception 'Carta temporária não pertence a este empréstimo';end if;
 select * into source_card from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=loan.source_actor_id
    and card_slot=loan.source_card_slot for update;
 if source_card.lobby_id is null or source_card.card_state<>'loaned'
  or source_card.attack_instance_id is distinct from loan.source_attack_instance_id
  or source_card.original_card_consumed or source_card.spent_turn is not null
 then raise exception 'Carta original perdeu a integridade';end if;
 quote:=public.chaotic_quote_preview_3x3_borrowed_attack(
  p_lobby_id,loan.id,p_expected_turn);
 if quote->>'catalog_attack_id'<>'105' or quote->>'attack_name'<>'Vento Forte'
  or (quote->>'attack_cost')::integer<>1 or (quote->>'base_damage')::integer<>5
  or quote->>'can_afford_if_enabled'<>'true'
  or quote->>'payment_enabled'<>'false'
  or (quote->>'points_available')::integer<>plan.points_available
  or (quote->>'defender_hp_before')::integer<>plan.hp_before
  or (quote->>'defender_hp_after_base_only')::integer<>plan.hp_base_after
 then raise exception 'Custo ou alvo da carta mudou após o passe';end if;
 select * into ally from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=plan.defender_id
  and position=plan.defender_slot for update;
 if ally.lobby_id is null or ally.creature_instance_id is distinct from c.defender_creature_instance_id
 then raise exception 'Criatura defensora do contato foi alterada';end if;
 -- Same original deck check used by the v0.1.46 equipment inspector.
 select g.data into deck from public.chaotic_game_nodes g
  where g.user_id=plan.defender_id
    and g.node_path in('decks/3x3_slot_'||ally.deck_slot::text,
                       'decks/3x3_'||ally.deck_slot::text)
  order by (g.node_path='decks/3x3_slot_'||ally.deck_slot::text) desc
  limit 1 for update;
 if deck is null or pg_catalog.jsonb_typeof(deck->'criaturas')<>'array'
  or deck->'criaturas'->>(plan.defender_slot-1) is distinct from ally.creature_instance_id
  or (deck ? 'equipamentos' and pg_catalog.jsonb_typeof(deck->'equipamentos')<>'array')
 then raise exception 'Deck original defensor indisponível ou divergente';end if;
 gear:=nullif(deck->'equipamentos'->>(plan.defender_slot-1),'');
 if gear is not null and gear<>'null' then
   -- No equipment is ever copied, spent or publicly revealed.
   if length(gear)>48
   then raise exception 'Instância de equipamento inválida';end if;
   select data into equip_album from public.chaotic_game_nodes
    where user_id=plan.defender_id and node_path='album' for update;
   if pg_catalog.jsonb_typeof(equip_album)='array' then
     equip_array:=equip_album;
   elsif pg_catalog.jsonb_typeof(equip_album)='object' then
     select coalesce(pg_catalog.jsonb_agg(value),'[]'::jsonb)
      into equip_array from pg_catalog.jsonb_each(equip_album);
   else
     raise exception 'Álbum original do defensor indisponível';end if;
   select count(*),min(x.value::text)::jsonb into equip_matches,equip_item
     from pg_catalog.jsonb_array_elements(equip_array) x(value)
     where x.value->>'id'=gear and x.value->>'tipoCarta'='Equipamento';
   if equip_matches<>1 or nullif(equip_item->>'nome','') is null
   then raise exception 'Equipamento ausente ou ambíguo no álbum original';end if;
   select * into equip_cat from public.chaotic_preview_3x3_equipment_catalog
    where equipment_name=equip_item->>'nome';
   if equip_cat.equipment_id is null
     or (equip_cat.equipment_id='202' and equip_cat.rule_code<>'immune_to_attacks_involving_air')
     or (equip_cat.equipment_id='204' and equip_cat.rule_code<>'increase_wisdom_40')
     or (equip_cat.equipment_id='207' and equip_cat.rule_code<>'increase_water_damage_5_without_granting_water')
     or equip_cat.equipment_id not in('202','204','207')
   then raise exception 'Equipamento ainda precisa de resposta defensiva completa';end if;
   select * into attack_cat from public.chaotic_preview_card_reference
    where kind='attack' and card_id='105';
   if attack_cat.card_id is null or attack_cat.card_name<>'Vento Forte'
     or attack_cat.base_damage<>5 or attack_cat.attack_cost<>1
     or attack_cat.element_damage is distinct from
       '{"fogo":0,"agua":0,"terra":0,"ar":0}'::jsonb
   then raise exception 'Vento Forte não neutro ou catálogo alterado';end if;
   insert into public.chaotic_preview_3x3_borrowed_105_equipment_audits(
     lobby_id,turn_no,borrower_id,defender_id,defender_slot,
     equipment_instance_id,catalog_equipment_id,rule_code,
     attack_elemental_damage_zero,original_owner_verified)
   values(p_lobby_id,p_expected_turn,actor,plan.defender_id,plan.defender_slot,
     gear,equip_cat.equipment_id,equip_cat.rule_code,true,true);
 end if;
 select * into wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if wallet.lobby_id is null or wallet.last_draw_turn<>p_expected_turn
  or wallet.prepared_turn>p_expected_turn
  or (p_expected_turn-wallet.prepared_turn)%2<>0
  or wallet.spent_points not between 0 and 65
  or wallet.official_points_changed or wallet.official_match_modified
 then raise exception 'Carteira de treino dessincronizada';end if;
 before_points:=3+(p_expected_turn-wallet.prepared_turn)/2-wallet.spent_points;
 if before_points<>plan.points_available or before_points not between 1 and 65
  or wallet.spent_points+1>65
 then raise exception 'Pontos insuficientes ou alterados desde a prévia';end if;
 select * into att from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor
    and position=plan.attacker_slot for update;
 select * into def from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=plan.defender_id
    and position=plan.defender_slot for update;
 if att.lobby_id is null or def.lobby_id is null
  or att.creature_instance_id is distinct from c.attacker_creature_instance_id
  or def.creature_instance_id is distinct from c.defender_creature_instance_id
  or att.hp_remaining is distinct from c.attacker_hp_at_contact
  or def.hp_remaining is distinct from plan.hp_before
  or def.hp_remaining is distinct from c.defender_hp_at_contact
  or att.hp_remaining<=0 or def.damage_events>=120
 then raise exception 'HP das criaturas alterado desde o contato';end if;
 -- Before charging, the borrowed attack and true defender pass have been
 -- locked and validated. The HP trigger records an individual borrowed KO.
 -- The LAST creature KO is settled via outcome only AFTER current custody
 -- is returned and the cost/damage receipt is written.
 update public.chaotic_preview_3x3_attack_wallets
  set spent_points=spent_points+1
  where lobby_id=p_lobby_id and actor_id=actor;
 get diagnostics updated=row_count;
 if updated<>1 then raise exception 'Débito de treino não efetuado';end if;
 update public.chaotic_preview_3x3_hp_wallets
  set hp_remaining=greatest(0,hp_remaining-5),damage_events=damage_events+1
  where lobby_id=p_lobby_id and actor_id=plan.defender_id
    and position=plan.defender_slot and hp_remaining=plan.hp_before;
 get diagnostics updated=row_count;
 if updated<>1 then raise exception 'Dano de treino não efetuado';end if;
 update public.chaotic_preview_3x3_borrowed_105_plans
  set state='base_resolved_no_optional_reveal',
      payment_applied=true,damage_applied=true,
      settled_at=pg_catalog.statement_timestamp()
  where lobby_id=p_lobby_id and turn_no=p_expected_turn
    and borrower_id=actor and state='defender_passed_preview';
 get diagnostics updated=row_count;
 if updated<>1 then raise exception 'Pagamento já resolvido';end if;
 insert into public.chaotic_preview_3x3_borrowed_105_base_events(
  lobby_id,turn_no,borrower_id,defender_id,custody_id,points_before,
  points_after,hp_before,hp_after
 ) values(p_lobby_id,p_expected_turn,actor,plan.defender_id,loan.id,
  before_points,before_points-1,plan.hp_before,greatest(0,plan.hp_before-5));
 if public.chaotic_internal_release_preview_3x3_black_hand(
  p_lobby_id,loan.id,p_expected_turn) is distinct from true
 then raise exception 'Carta original não retornou ao dono';end if;
 -- If the third and final defender is defeated, declare a TRAINING-ONLY
 -- winner. The BEFORE INSERT trigger returns ALL other held 3x3 cards.
 -- No official victory, XP, currency or persistent album ownership changes.
 if plan.hp_before<=5 then
   select count(*),count(*) filter(where hp_remaining=0)
     into team_units,dead_units
     from public.chaotic_preview_3x3_hp_wallets
     where lobby_id=p_lobby_id and actor_id=plan.defender_id;
   if team_units<>3 then raise exception 'Equipe 3x3 incompleta no nocaute';end if;
   if dead_units=3 then
     if not exists(select 1 from public.chaotic_preview_3x3_borrowed_105_knockouts ko
       where ko.lobby_id=p_lobby_id and ko.turn_no=p_expected_turn
         and ko.borrower_id=actor and ko.defender_id=plan.defender_id
         and ko.defender_slot=plan.defender_slot and ko.custody_id=plan.custody_id)
     then raise exception 'Nocaute final emprestado sem registro íntegro';end if;
     insert into public.chaotic_preview_3x3_training_outcomes(
       lobby_id,decided_turn,winner_id,defeated_id
     ) values(p_lobby_id,p_expected_turn,actor,plan.defender_id);
     -- Entire transaction fails if a loan could not be returned safely.
     if exists(select 1 from public.chaotic_preview_3x3_temporary_card_custody active
       where active.lobby_id=p_lobby_id and active.custody_state='held')
     then raise exception 'O treino não encerrou todas as custódias temporárias';end if;
     outcome_recorded:=true;
   end if;
 end if;
 return pg_catalog.jsonb_build_object(
  'status','base_resolved_no_optional_reveal',
  'points_before',before_points,'points_after',before_points-1,
  'hp_before',plan.hp_before,'hp_after',greatest(0,plan.hp_before-5),
  'base_damage',5,'optional_reveal_applied',false,
  'borrowed_card_returned',true,'training_outcome_recorded',outcome_recorded,
  'official_match_modified',false,'experience_awarded',false,'currency_awarded',false);
end;
$settle$;
revoke all on function public.chaotic_settle_preview_3x3_borrowed_105_base(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_settle_preview_3x3_borrowed_105_base(uuid,integer)
 to authenticated;