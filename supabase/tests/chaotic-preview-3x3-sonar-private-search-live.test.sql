-- Chaotic GO 0.1.51 — REAL transaction-level integration for the current five training attacks.
-- All fixture accounts, rooms, hands and HP are created in this transaction and ROLLED BACK.
-- Never run without BEGIN/ROLLBACK; never use production accounts or real saved cards.
begin;
do $integration$
declare
 host uuid:='a1510000-0000-4000-8000-000000000151';
 guest uuid:='a1510000-0000-4000-8000-000000000152';
 lobby uuid;
 attack_id text;
 attack_name text;
 base_damage int;
 cost int;
 prior_hp int;
 expected_hp int;
 expected_bonus int;
 effect public.chaotic_preview_3x3_training_damage_events;
 current_hp integer;
 knockout_count integer;
 status_after text;
 error_text text;
 i int;
begin
 insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
 values(host,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'chaotic-test-v51-host@example.invalid',now(),now()),
 (guest,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'chaotic-test-v51-guest@example.invalid',now(),now());

 for i in 1..12 loop
  attack_id:=case i when 1 then '105' when 2 then '111'
    when 3 then '112' when 4 then '113' when 5 then '114' when 6 then '101' when 7 then '107' else '110' end;
  attack_name:=case i when 1 then 'Vento Forte' when 2 then 'MÃO ELETRÔNICA'
    when 3 then 'MÃO MÃO' when 4 then 'PURGATÓRIO' when 5 then 'ESQUELETO' when 6 then 'Ácido Gástrico' when 7 then 'Armadilha de Vinha' else 'SONAR' end;
  base_damage:=case when i in (2,5,6) then 10 when i=4 or i>=8 then 0 else 5 end;
  cost:=case when i in (1,3,7) then 1 when i in (2,6) then 3 when i=4 then 0 else 2 end;
  -- ESQUELETO scenario: one ally already defeated, defender has 15 HP.
  prior_hp:=case when i in (5,6) then 15 when i=7 or i>=8 then 10 else 20 end;
  expected_bonus:=case when i in (5,6,7) then 5 when i in (10,11) then 10 else 0 end;
  expected_hp:=greatest(0,prior_hp-base_damage-expected_bonus);
  lobby:=gen_random_uuid();

  insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
   values(lobby,upper(left(replace(lobby::text,'-',''),12)),host,guest,'3x3','ready');
  insert into public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player,turn_no)
   values(lobby,host,guest,host,1);

  insert into public.chaotic_preview_3x3_allies(
   lobby_id,actor_id,position,deck_slot,creature_instance_id,creature_name,
   starting_tokens,remaining_tokens)
  select lobby,v.actor,v.pos,1,
   (case when v.actor=host then 'H' else 'G' end)||v.pos::text,
   case when i in(6,9,11) and v.actor=host and v.pos=4 then 'Lion'
        when i in(8,10) and v.actor=host and v.pos=4 then 'Guru'
        when i=7 and v.actor=host and v.pos=4 then 'Horn-ey'
        when i in(8,9) and v.actor=guest and v.pos=4 then 'Rex'
        when v.pos=4 then 'Johnes' when v.pos=5 then 'Promos' else 'Alakazaz' end,
   case when i in(6,9,11) and v.actor=host and v.pos=4 then 1
        when i in(8,10) and v.actor=host and v.pos=4 then 2
        when i=7 and v.actor=host and v.pos=4 then 0
        when v.pos=4 then 2 when v.pos=5 then 3 else 5 end,
   case when i in(6,9,11) and v.actor=host and v.pos=4 then 1
        when i in(8,10) and v.actor=host and v.pos=4 then 2
        when i=7 and v.actor=host and v.pos=4 then 0
        when v.pos=4 then 2 when v.pos=5 then 3 else 5 end
  from (select a.actor,p.pos from (values(host),(guest)) a(actor)
    cross join (values(4),(5),(6)) p(pos)) v;

  insert into public.chaotic_preview_3x3_hp_wallets(
   lobby_id,actor_id,position,creature_instance_id,creature_name,
   hp_initial,hp_max,hp_remaining,initialized_turn,damage_events)
  select lobby,actor_id,position,creature_instance_id,creature_name,
    20,20,
    case when i=5 and actor_id=host and position=5 then 0
         when actor_id=guest and position=4 then prior_hp else 20 end,
    1,case when i=5 and actor_id=host and position=5 then 1
          when i>=5 and actor_id=guest and position=4 then 1 else 0 end
  from public.chaotic_preview_3x3_allies where lobby_id=lobby;

  if i>=6 then
   insert into public.chaotic_game_nodes(user_id,node_path,data)
    values(host,'decks/3x3_slot_1',
      '{"criaturas":[null,null,null,"H4","H5","H6"],"equipamentos":[null,null,null,null,null,null]}'::jsonb)
    on conflict(user_id,node_path) do update set data=excluded.data;
  end if;
  insert into public.chaotic_preview_3x3_board_positions(
   lobby_id,actor_id,formation_slot,creature_instance_id,hex_position)
  select lobby,actor_id,position,creature_instance_id,
    case when position=4 then 4 else position-4 end
  from public.chaotic_preview_3x3_allies where lobby_id=lobby;

  insert into public.chaotic_preview_3x3_contact_intents(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attacker_creature_instance_id,defender_creature_instance_id,
   attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
  values(lobby,1,host,guest,4,4,'H4','G4',4,4,20,prior_hp);

  insert into public.chaotic_preview_3x3_attack_projections(
   lobby_id,turn_no,actor_id,attack_deck_slot,attack_card_slot,
   attack_instance_id,catalog_attack_id,attack_name,base_damage,attack_cost,
   attacker_slot,defender_id,defender_slot,defender_hp_before,
   defender_hp_projected,projected_hp_loss,hypothetical_knockout)
  values(lobby,1,host,1,1,'attack-test-'||attack_id,attack_id,attack_name,
   base_damage,cost,4,guest,4,prior_hp,greatest(0,prior_hp-base_damage),
   least(prior_hp,base_damage),prior_hp<=base_damage);

  insert into public.chaotic_preview_3x3_attack_wallets(
    lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn,total_cards)
  values(lobby,host,1,1,1,3);

  insert into public.chaotic_preview_3x3_attack_hand(
   lobby_id,actor_id,card_slot,attack_instance_id,draw_position,
   card_state,spent_turn,spent_reason)
  values(lobby,host,1,'attack-test-'||attack_id,1,'spent',1,'attack');

  if i in(10,11,12) then
   -- Canonical album-backed synthetic cards in the *private training* deck.
   -- A real SONAR can choose cost 1 Vento Forte or cost 0 SPEED.
   update public.chaotic_game_nodes
    set data=pg_catalog.jsonb_set(data,'{ataques}',case when i=12
      then '["attack-test-110","sonar-v55-c110","sonar-v55-c111"]'::jsonb
      else '["attack-test-110","sonar-v55-c105","sonar-v55-c108"]'::jsonb end)
    where user_id=host and node_path='decks/3x3_slot_1';
   insert into public.chaotic_game_nodes(user_id,node_path,data)
    values(host,'album',case when i=12 then '[
      {"id":"attack-test-110","nome":"SONAR","tipoCarta":"Ataque"},
      {"id":"sonar-v55-c110","nome":"SONAR","tipoCarta":"Ataque"},
      {"id":"sonar-v55-c111","nome":"MÃO ELETRÔNICA","tipoCarta":"Ataque"}]'::jsonb
      else '[
      {"id":"attack-test-110","nome":"SONAR","tipoCarta":"Ataque"},
      {"id":"sonar-v55-c105","nome":"Vento Forte","tipoCarta":"Ataque"},
      {"id":"sonar-v55-c108","nome":"SPEED","tipoCarta":"Ataque"}]'::jsonb end)
    on conflict(user_id,node_path) do update set data=excluded.data;
   insert into public.chaotic_preview_3x3_attack_hand(
    lobby_id,actor_id,card_slot,attack_instance_id,draw_position,card_state)
   values(lobby,host,2,
        case when i=12 then 'sonar-v55-c110' else 'sonar-v55-c105' end,2,'deck'),
         (lobby,host,3,
        case when i=12 then 'sonar-v55-c111' else 'sonar-v55-c108' end,3,'deck');
  end if;

  insert into public.chaotic_preview_3x3_cost_inspections(
   lobby_id,turn_no,actor_id,attack_instance_id,card_slot,catalog_attack_id,
   attack_cost,points_available,can_afford,points_after_if_paid)
  values(lobby,1,host,'attack-test-'||attack_id,1,attack_id,cost,10,true,10-cost);

  insert into public.chaotic_preview_3x3_attack_spends(
   lobby_id,turn_no,actor_id,attack_deck_slot,card_slot,attack_instance_id,
   catalog_attack_id,training_attack_cost,points_before,points_after)
  values(lobby,1,host,1,1,'attack-test-'||attack_id,attack_id,cost,10,10-cost);

  insert into public.chaotic_preview_3x3_defense_windows(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attack_instance_id,training_attack_cost,status,defender_passed_at)
  values(lobby,1,host,guest,4,4,'attack-test-'||attack_id,
   cost,'defender_passed_preview',now());

  insert into public.chaotic_preview_3x3_elemental_inspections(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attack_instance_id,catalog_attack_id,attack_name,base_damage,
   fire_component,water_component,earth_component,air_component,
   special_resolution,attacker_hp_at_contact,defender_hp_at_contact)
  values(lobby,1,host,guest,4,4,'attack-test-'||attack_id,
   attack_id,attack_name,base_damage,
   case when i=6 then 5 else 0 end,
   case when i=6 then 5 else 0 end,
   case when i=7 then 5 when i>=8 then 10 else 0 end,
   case when i>=8 then 10 else 0 end,'none',20,prior_hp);

  insert into public.chaotic_preview_3x3_creature_element_checks(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attacker_creature_instance_id,defender_creature_instance_id,
   attacker_creature_name,defender_creature_name,
   attacker_base_elements,defender_base_elements,
   fire_base_match,water_base_match,earth_base_match,air_base_match)
  values(lobby,1,host,guest,4,4,'H4','G4',
   case when i in(6,9,11) then 'Lion' when i=7 then 'Horn-ey'
        when i in(8,10) then 'Guru' else 'Johnes' end,
   case when i in(8,9) then 'Rex' else 'Johnes' end,
   case when i in(6,9,11) then '["fogo","terra"]'::jsonb
        when i=7 then '["terra"]'::jsonb
        when i in(8,10) then '["ar"]'::jsonb else '[]'::jsonb end,
   case when i in(8,9) then '["ar"]'::jsonb else '[]'::jsonb end,
   i=6,false,i in(7,9,11),i in(8,10));

  insert into public.chaotic_preview_3x3_private_equipment_checks(
   lobby_id,turn_no,attacker_id,defender_id,defender_slot,
   defender_creature_instance_id,source_deck_slot,equipment_status)
  values(lobby,1,host,guest,4,'G4',1,'no_equipment_in_slot');

  -- A valid participant who is not the current attacker cannot execute the
  -- settlement RPC, even with the correct room and turn identifiers.
  perform set_config('request.jwt.claim.sub',guest::text,true);
  error_text:=null;
  begin
   if attack_id='105' then
    perform public.chaotic_apply_preview_3x3_training_base_105(lobby,1);
   elsif attack_id in ('111','112') then
    perform public.chaotic_apply_preview_3x3_training_attack_lock(lobby,1);
   elsif attack_id in ('113','114') then
    perform public.chaotic_apply_preview_3x3_training_fallen_allies(lobby,1);
   elsif attack_id='101' then
    perform public.chaotic_apply_preview_3x3_training_acid_101(lobby,1);
   elsif attack_id='107' then
    perform public.chaotic_apply_preview_3x3_training_vine_107(lobby,1);
   else
    perform public.chaotic_apply_preview_3x3_training_sonar_110(lobby,1);
   end if;
  exception when others then get stacked diagnostics error_text=message_text;end;
  if error_text is null or position('Apenas o atacante' in error_text)=0
  then raise exception 'Non-attacker was not rejected for %: %',attack_id,error_text;end if;
  perform set_config('request.jwt.claim.sub',host::text,true);
  if auth.uid() is distinct from host then raise exception 'JWT test identity missing';end if;
  if attack_id='101' then
   -- Equipment on the ATTACKER must also block 101. An unverified Water
   -- bracelet could otherwise add a bonus which the subset does not model.
   update public.chaotic_game_nodes
    set data=pg_catalog.jsonb_set(data,'{equipamentos,3}','"synthetic-equip-201"'::jsonb)
    where user_id=host and node_path='decks/3x3_slot_1';
   error_text:=null;
   begin
    perform public.chaotic_apply_preview_3x3_training_acid_101(lobby,1);
   exception when others then get stacked diagnostics error_text=message_text;end;
   if error_text is null or position('atacante sem equipamento' in error_text)=0
   then raise exception 'Acid 101 accepted unknown attacker equipment: %',error_text;end if;
   update public.chaotic_game_nodes
    set data=pg_catalog.jsonb_set(data,'{equipamentos,3}','null'::jsonb)
    where user_id=host and node_path='decks/3x3_slot_1';
  end if;
  if attack_id='105' then
   -- Equipped defenders are not yet supported by the damage resolver.
   -- Even neutral damage must be blocked until equipment effects are resolved.
   update public.chaotic_preview_3x3_private_equipment_checks
   set equipment_status='owned_original_equipment_in_slot',
     equipment_instance_id='synthetic-equip-201',catalog_equipment_id='201',
     equipment_name='Anel Precioso',
     rule_code='ignore_elemental_damage_with_energy_cost'
   where lobby_id=lobby and turn_no=1;
   error_text:=null;
   begin
    perform public.chaotic_apply_preview_3x3_training_base_105(lobby,1);
   exception when others then get stacked diagnostics error_text=message_text;end;
   if error_text is null or position('SEM equipamento' in error_text)=0
   then raise exception 'Defender equipment was ignored: %',error_text;end if;
   update public.chaotic_preview_3x3_private_equipment_checks
   set equipment_status='no_equipment_in_slot',
     equipment_instance_id=null,catalog_equipment_id=null,
     equipment_name=null,rule_code=null
   where lobby_id=lobby and turn_no=1;
  end if;

  if attack_id='105' then
   effect:=public.chaotic_apply_preview_3x3_training_base_105(lobby,1);
  elsif attack_id in ('111','112') then
   effect:=public.chaotic_apply_preview_3x3_training_attack_lock(lobby,1);
  elsif attack_id in ('113','114') then
   effect:=public.chaotic_apply_preview_3x3_training_fallen_allies(lobby,1);
  elsif attack_id='101' then
   effect:=public.chaotic_apply_preview_3x3_training_acid_101(lobby,1);
  elsif attack_id='107' then
   effect:=public.chaotic_apply_preview_3x3_training_vine_107(lobby,1);
  else
   effect:=public.chaotic_apply_preview_3x3_training_sonar_110(lobby,1);
  end if;

  select hp_remaining into current_hp
  from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=lobby and actor_id=guest and position=4;
  if effect.hp_before<>prior_hp or effect.hp_after<>expected_hp
     or current_hp<>expected_hp or effect.damage_dealt<>prior_hp-expected_hp
     or effect.catalog_attack_id<>attack_id
  then raise exception 'Incorrect HP/total for %: event %, actual %',
   attack_id,row_to_json(effect),current_hp;end if;

  select count(*) into knockout_count from public.chaotic_preview_3x3_training_knockouts
   where lobby_id=lobby;
  if knockout_count<>(case when expected_hp=0 then 1 else 0 end)
   then raise exception 'KO count wrong for %: %',attack_id,knockout_count;end if;

  select resolution_status into status_after
   from public.chaotic_preview_3x3_attack_spends where lobby_id=lobby;
  if status_after='paid_training_unresolved'
  then raise exception 'Attack % paid but unresolved',attack_id;end if;

  -- One attempt per turn. The second call must fail without double-debiting.
  error_text:=null;
  begin
   if attack_id='105' then
    perform public.chaotic_apply_preview_3x3_training_base_105(lobby,1);
   elsif attack_id in ('111','112') then
    perform public.chaotic_apply_preview_3x3_training_attack_lock(lobby,1);
   elsif attack_id in ('113','114') then
    perform public.chaotic_apply_preview_3x3_training_fallen_allies(lobby,1);
   elsif attack_id='101' then
    perform public.chaotic_apply_preview_3x3_training_acid_101(lobby,1);
   elsif attack_id='107' then
    perform public.chaotic_apply_preview_3x3_training_vine_107(lobby,1);
   else
    perform public.chaotic_apply_preview_3x3_training_sonar_110(lobby,1);
   end if;
  exception when others then get stacked diagnostics error_text=message_text;end;
  if error_text is null then
   raise exception 'Replay attack % was accepted',attack_id;end if;
  if (select count(*) from public.chaotic_preview_3x3_training_damage_events
    where lobby_id=lobby)<>1
   or (select hp_remaining from public.chaotic_preview_3x3_hp_wallets
    where lobby_id=lobby and actor_id=guest and position=4)<>expected_hp
  then raise exception 'Replay attack % duplicated an HP transaction',attack_id;end if;

  if attack_id='110' then
   if effect.immunity_prevented_damage<>(case when i in(8,9) then 10 else 0 end)
    or effect.elemental_bonus_damage<>(case when i in(10,11) then 10 else 0 end)
    or effect.effects_fully_resolved
   then raise exception 'SONAR Rex immunity or deferred search incorrect on test %',i;end if;
   if i in(8,9) and (select damage_events from public.chaotic_preview_3x3_hp_wallets
     where lobby_id=lobby and actor_id=guest and position=4)<>1
   then raise exception 'Rex immunity created a fake HP damage event';end if;
  end if;
  if i in (10,11) then
   perform set_config('request.jwt.claim.sub',guest::text,true);
   error_text:=null;
   begin
    perform public.chaotic_resolve_preview_3x3_sonar_search(lobby,1,null,true);
   exception when others then get stacked diagnostics error_text=message_text;end;
   if error_text is null or position('Somente o atacante' in error_text)=0
   then raise exception 'Opponent accessed private SONAR candidates: %',error_text;end if;
   perform set_config('request.jwt.claim.sub',host::text,true);
   declare
    choices jsonb;
    finished jsonb;
    picked integer;
   begin
    choices:=public.chaotic_resolve_preview_3x3_sonar_search(lobby,1,null,true);
    if pg_catalog.jsonb_array_length(choices->'choices')<>2
      or (choices->'choices'->0->>'attack_cost')::integer<>1
      or (choices->'choices'->1->>'attack_cost')::integer<>0
    then raise exception 'SONAR did not offer exactly cost 1/0 album cards: %',choices;end if;
    error_text:=null;
    begin
     perform public.chaotic_resolve_preview_3x3_sonar_search(lobby,1,1,false);
    exception when others then get stacked diagnostics error_text=message_text;end;
    if error_text is null or position('Selecione uma carta elegível' in error_text)=0
    then raise exception 'SONAR accepted spent attack: %',error_text;end if;
    picked:=case when i=10 then 2 else 3 end;
    finished:=public.chaotic_resolve_preview_3x3_sonar_search(lobby,1,picked,false);
    if not (finished->>'search_succeeded')::boolean
      or (finished->>'hand_count_after')::integer<>1
      or (select card_state from public.chaotic_preview_3x3_attack_hand
       where lobby_id=lobby and actor_id=host and card_slot=picked)<>'hand'
      or (select not effects_fully_resolved
          from public.chaotic_preview_3x3_training_damage_events
          where lobby_id=lobby and turn_no=1)
      or (select resolution_status from public.chaotic_preview_3x3_attack_spends
          where lobby_id=lobby and turn_no=1)<>
           'training_elemental_sonar_110_search_complete'
    then raise exception 'SONAR private deck to hand move was not settled: %',finished;end if;
    error_text:=null;
    begin
     perform public.chaotic_resolve_preview_3x3_sonar_search(lobby,1,picked,false);
    exception when others then get stacked diagnostics error_text=message_text;end;
    if error_text is null then raise exception 'SONAR search replay accepted';end if;
    if (select count(*) from public.chaotic_preview_3x3_sonar_search_events
      where lobby_id=lobby)<>1
    then raise exception 'SONAR search receipt duplicated';end if;
   end;
  end if;
  if i=12 then
   declare check_choices jsonb;finished jsonb;
   begin
    check_choices:=public.chaotic_resolve_preview_3x3_sonar_search(lobby,1,null,true);
    if pg_catalog.jsonb_array_length(check_choices->'choices')<>0
    then raise exception 'SONAR cost >1 offered as eligible: %',check_choices;end if;
    error_text:=null;
    begin
     perform public.chaotic_resolve_preview_3x3_sonar_search(lobby,1,2,false);
    exception when others then get stacked diagnostics error_text=message_text;end;
    if error_text is null or position('Não há carta elegível' in error_text)=0
    then raise exception 'SONAR accepted cost >1 target: %',error_text;end if;
    finished:=public.chaotic_resolve_preview_3x3_sonar_search(lobby,1,null,false);
    if (finished->>'search_succeeded')::boolean
      or (finished->>'hand_count_after')::integer<>0
      or not (select effects_fully_resolved from public.chaotic_preview_3x3_training_damage_events
              where lobby_id=lobby and turn_no=1)
      or (select count(*) from public.chaotic_preview_3x3_attack_hand
          where lobby_id=lobby and actor_id=host and card_state='hand')<>0
    then raise exception 'SONAR no eligible card should end cleanly: %',finished;end if;
   end;
  end if;
  if attack_id='113' and (effect.damage_dealt<>0 or
    (select damage_events from public.chaotic_preview_3x3_hp_wallets
    where lobby_id=lobby and actor_id=guest and position=4)<>0)
  then raise exception 'Zero PURGATÓRIO created fake damage';end if;

  if attack_id='107' and not exists(
   select 1 from public.chaotic_preview_3x3_training_attack_locks
   where lobby_id=lobby and catalog_attack_id='107' and blocks_draw
     and last_blocked_turn=2)
  then raise exception 'Vine attack+draw restriction was not stored';end if;
  if attack_id in('111','112') and not exists(
   select 1 from public.chaotic_preview_3x3_training_attack_locks
    where lobby_id=lobby and blocked_turn_count=
      case when attack_id='111' then 2 else 1 end)
  then raise exception 'Future attack restriction was not recorded for %',attack_id;end if;
  if attack_id in('111','112','107') then
   -- Attacker completes the turn. The blocked defender MUST be unable
   -- to open another contact when they become the active player.
   perform public.chaotic_pass_turn(lobby,1);
   perform set_config('request.jwt.claim.sub',guest::text,true);
   error_text:=null;
   begin
    insert into public.chaotic_preview_3x3_contact_intents(
     lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
     attacker_creature_instance_id,defender_creature_instance_id,
     attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
    values(lobby,2,guest,host,4,4,'G4','H4',4,4,expected_hp,20);
   exception when others then get stacked diagnostics error_text=message_text;end;
   if error_text is null or position('impedida de atacar' in error_text)=0
   then raise exception 'Blocked opponent opened attack: % %',attack_id,error_text;end if;
   if attack_id='107' then
    -- A valid attempted draw next turn must be rejected by the DB trigger.
    insert into public.chaotic_preview_3x3_attack_wallets(
     lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn,total_cards)
    values(lobby,guest,1,1,1,3);
    error_text:=null;
    begin
     insert into public.chaotic_preview_3x3_hand_draw_events(
      lobby_id,turn_no,actor_id,drew_card,drawn_card_slot,
      recycle_cycle,recycled_count,hand_count_after,available_points)
     values(lobby,2,guest,true,1,0,0,1,10);
    exception when others then get stacked diagnostics error_text=message_text;end;
    if error_text is null or position('impedida de comprar cartas' in error_text)=0
    then raise exception 'Vine failed to block a real hand draw: %',error_text;end if;
   end if;
  end if;
  -- The lobby has one-active-match-per-host uniqueness. Each fixture is deleted
  -- before seeding the next case, within the enclosing rollback transaction.
  update public.chaotic_lobbies set status='cancelled' where id=lobby;
 end loop;
end $integration$;
rollback;
select 'PASS v0.1.55: 12 attack RPCs, 2 private SONAR selections cost 0/1, no-target closes, opponent and replay blocked; rollback' as result;