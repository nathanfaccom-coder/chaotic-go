-- v0.1.70: server-owned Fogo Primordial 2.0, 5 x 1d6
BEGIN;
alter table public.chaotic_preview_3x3_training_damage_events
 add column if not exists fire_die_roll smallint;
alter table public.chaotic_preview_3x3_training_damage_events
 add constraint chaotic_preview_3x3_fire_die_only_104 check (
 (catalog_attack_id='104' and fire_die_roll between 1 and 6)
 or (catalog_attack_id<>'104' and fire_die_roll is null));
do $constraints$
declare x text; cat text;
begin
 select pg_get_constraintdef(oid) into x from pg_constraint
 where conrelid='public.chaotic_preview_3x3_attack_spends'::regclass
 and conname='chaotic_preview_3x3_training_settlement_consistency';
 x:=replace(x,'''training_base_damage_105_reveal_resolved''::text,',
   '''training_base_damage_105_reveal_resolved''::text, ''training_fire_104_die_resolved''::text,');
 execute 'alter table public.chaotic_preview_3x3_attack_spends drop constraint chaotic_preview_3x3_training_settlement_consistency';
 execute 'alter table public.chaotic_preview_3x3_attack_spends add constraint chaotic_preview_3x3_training_settlement_consistency '||x;
 select pg_get_constraintdef(oid) into x from pg_constraint
 where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
 and conname='chaotic_preview_3x3_training_conditional_damage_range';
 x:=replace(x,'damage_dealt <= 20','damage_dealt <= 30');
 execute 'alter table public.chaotic_preview_3x3_training_damage_events drop constraint chaotic_preview_3x3_training_conditional_damage_range';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events add constraint chaotic_preview_3x3_training_conditional_damage_range '||x;
 select pg_get_constraintdef(oid) into x from pg_constraint
 where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
 and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 cat:=substr(x,1,length(x)-1)||' OR (catalog_attack_id=''104''::text AND fire_die_roll between 1 and 6 AND base_damage=5*fire_die_roll AND bonus_damage=0 AND defeated_allies_count=0 AND elemental_bonus_damage=0 AND immunity_prevented_damage=0 AND NOT optional_reveal_pending AND effects_fully_resolved))';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events drop constraint chaotic_preview_3x3_training_elemental_attack_catalog_check';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events add constraint chaotic_preview_3x3_training_elemental_attack_catalog_check '||cat;
end $constraints$;
do $
declare x text;
begin
 select pg_get_constraintdef(oid) into x
 from pg_constraint where conrelid='public.chaotic_preview_3x3_training_knockouts'::regclass
 and conname='chaotic_preview_3x3_knockout_elemental_attack';
 x:=substr(x,1,length(x)-1)||
  ' OR (catalog_attack_id=''104''::text and hp_before between 1 and 30))';
 execute 'alter table public.chaotic_preview_3x3_training_knockouts drop constraint chaotic_preview_3x3_knockout_elemental_attack';
 execute 'alter table public.chaotic_preview_3x3_training_knockouts add constraint chaotic_preview_3x3_knockout_elemental_attack '||x;
end $;
CREATE OR REPLACE FUNCTION public.chaotic_record_preview_3x3_training_knockout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 w public.chaotic_preview_3x3_defense_windows;
 paid public.chaotic_preview_3x3_attack_spends;
 n integer;
 dead_count integer;
 alive_count integer;
 conditional_base integer;
 expected_damage integer;
 fire_event public.chaotic_preview_3x3_training_damage_events;
 review public.chaotic_preview_3x3_creature_element_checks;
 ref_el jsonb;
 ref_count integer;
begin
 if new.hp_remaining<>0 or old.hp_remaining<=0
 then return new;end if;

 select * into m from public.chaotic_match_turns
 where lobby_id=new.lobby_id for update;
 if actor is null or m.lobby_id is null or m.status<>'active'
 or m.current_player is distinct from actor
 or actor not in(m.host_id,m.guest_id)
 or new.actor_id not in(m.host_id,m.guest_id)
 or actor=new.actor_id
 then raise exception 'Nocaute de treino exige atacante autenticado na partida';end if;

 select * into w from public.chaotic_preview_3x3_defense_windows
 where lobby_id=new.lobby_id and turn_no=m.turn_no for update;
 select * into paid from public.chaotic_preview_3x3_attack_spends
 where lobby_id=new.lobby_id and turn_no=m.turn_no for update;
 if w.lobby_id is null or paid.lobby_id is null
 or w.attacker_id is distinct from actor
 or w.defender_id is distinct from new.actor_id
 or w.defender_slot is distinct from new.position
 or w.status<>'defender_passed_preview'
 or paid.actor_id is distinct from actor
 or paid.catalog_attack_id not in ('101','104','105','107','110','111','112','113','114')
 or paid.attack_instance_id is distinct from w.attack_instance_id
 or not paid.training_points_paid or not paid.training_card_spent
 or paid.training_damage_applied
 or old.creature_instance_id is distinct from new.creature_instance_id
 or old.creature_name is distinct from new.creature_name
 or old.hp_max is distinct from new.hp_max
 or new.damage_events is distinct from old.damage_events+1
 then raise exception 'Nocaute 3x3 não corresponde ao ataque pago';end if;
 -- Dynamic KO verification: the attacker must have exactly three own wallets,
 -- a living attacking champion and a server-derived graveyard.
 select count(*),count(*) filter(where hp_remaining=0)
 into alive_count,dead_count from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=new.lobby_id and actor_id=actor;
 if alive_count<>3 or dead_count not between 0 and 2 then
  raise exception 'Contagem de campeões derrotados inválida';end if;
 if paid.catalog_attack_id in ('101','107','110') then
   select * into review from public.chaotic_preview_3x3_creature_element_checks
    where lobby_id=new.lobby_id and turn_no=m.turn_no;
   select count(*),min(c.creature_elements::text)::jsonb into ref_count,ref_el
    from public.chaotic_preview_card_reference c
    where c.kind='creature' and c.card_name=review.attacker_creature_name;
   if ref_count<>1 or ref_el is distinct from review.attacker_base_elements
    or review.attacker_id is distinct from actor or review.defender_id is distinct from new.actor_id
    or review.attacker_slot is distinct from w.attacker_slot
    or review.defender_slot is distinct from w.defender_slot
    or review.defender_creature_name is distinct from new.creature_name
    or review.defender_creature_instance_id is distinct from new.creature_instance_id
   then raise exception 'Nocaute elemental não corresponde à criatura original';end if;
   if paid.catalog_attack_id='101' then
    expected_damage:=10+5*(ref_el ? 'fogo')::integer
                         +5*(ref_el ? 'agua')::integer;
   elsif paid.catalog_attack_id='107' then
    expected_damage:=5+5*(ref_el ? 'terra')::integer;
   else
    -- The attack card ALWAYS carries 10 Air. Rex cancels the entire
    -- SONAR damage independently of attacker elemental ownership.
    expected_damage:=case when new.creature_name='Rex' then 0
      else 10*(ref_el ? 'terra')::integer+
           10*(ref_el ? 'ar')::integer end;
   end if;
 elsif paid.catalog_attack_id='104' then
   select * into fire_event from public.chaotic_preview_3x3_training_damage_events e
    where e.lobby_id=new.lobby_id and e.turn_no=m.turn_no;
   if fire_event.lobby_id is null or fire_event.catalog_attack_id<>'104'
     or fire_event.attacker_id is distinct from actor
     or fire_event.defender_id is distinct from new.actor_id
     or fire_event.defender_slot is distinct from new.position
     or fire_event.fire_die_roll not between 1 and 6
     or fire_event.base_damage is distinct from 5*fire_event.fire_die_roll
     or fire_event.hp_before is distinct from old.hp_remaining
     or fire_event.hp_after is distinct from new.hp_remaining
   then raise exception 'Nocaute de Fogo Primordial sem dado íntegro';end if;
   expected_damage:=5*fire_event.fire_die_roll;
 else
   expected_damage:=case paid.catalog_attack_id
    when '111' then 10 when '114' then 10+5*dead_count
    when '113' then 5*dead_count else 5 end;
 end if;
 if expected_damage<=0
  or new.hp_remaining is distinct from greatest(0,old.hp_remaining-expected_damage)
  or old.hp_remaining>expected_damage
 then raise exception 'Dano de nocaute não corresponde ao total condicional';end if;

 insert into public.chaotic_preview_3x3_training_knockouts(
  lobby_id,turn_no,attacker_id,defender_id,defender_slot,
  defender_creature_instance_id,defender_creature_name,attack_instance_id,
  catalog_attack_id,hp_before
 ) values(
  new.lobby_id,m.turn_no,actor,new.actor_id,new.position,
  new.creature_instance_id,new.creature_name,w.attack_instance_id,
  paid.catalog_attack_id,old.hp_remaining
 );

 select count(*), count(*) filter(where hp_remaining=0)
 into n,dead_count from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=new.lobby_id and actor_id=new.actor_id;
 if n=3 and dead_count=3 then
  insert into public.chaotic_preview_3x3_training_outcomes(
    lobby_id,decided_turn,winner_id,defeated_id
  ) values(new.lobby_id,m.turn_no,actor,new.actor_id)
  on conflict(lobby_id) do nothing;
 end if;
 return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.chaotic_apply_preview_3x3_training_fire_104(p_lobby_id uuid, p_expected_turn integer)
 RETURNS chaotic_preview_3x3_training_damage_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_defense_windows;
 contact public.chaotic_preview_3x3_contact_intents;
 proj public.chaotic_preview_3x3_attack_projections;
 paid public.chaotic_preview_3x3_attack_spends;
 meta public.chaotic_preview_3x3_elemental_inspections;
 creature public.chaotic_preview_3x3_creature_element_checks;
 gear public.chaotic_preview_3x3_private_equipment_checks;
 hp_def public.chaotic_preview_3x3_hp_wallets;
 hp_att public.chaotic_preview_3x3_hp_wallets;
 before_hp integer;
 after_hp integer;
 fire_die_roll integer;
 effective_damage integer;
 event_row public.chaotic_preview_3x3_training_damage_events;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno de dano de treino inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor
   or actor not in(m.host_id,m.guest_id)
 then raise exception 'Apenas o atacante no turno ativo aplica dano de treino';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala de treino 3x3 inválida';end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.attacker_id is distinct from actor
   or w.defender_id is distinct from
    (case when actor=m.host_id then m.guest_id else m.host_id end)
   or w.status<>'defender_passed_preview' or w.defender_passed_at is null
 then raise exception 'O defensor precisa passar a reação de treino antes do dano';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_damage_events
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Dano já debitado neste turno (antirreplay)';end if;
 select * into contact from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into proj from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into paid from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if contact.lobby_id is null or proj.lobby_id is null or paid.lobby_id is null
  or contact.attacker_id is distinct from actor
  or contact.defender_id is distinct from w.defender_id
  or contact.attacker_slot is distinct from w.attacker_slot
  or contact.defender_slot is distinct from w.defender_slot
  or contact.damage_applied or contact.official_match_modified
  or proj.actor_id is distinct from actor
  or proj.defender_id is distinct from w.defender_id
  or proj.attacker_slot is distinct from w.attacker_slot
  or proj.defender_slot is distinct from w.defender_slot
  or proj.attack_instance_id is distinct from w.attack_instance_id
  or paid.actor_id is distinct from actor
  or paid.attack_instance_id is distinct from w.attack_instance_id
  or paid.attack_instance_id is distinct from proj.attack_instance_id
  or paid.training_attack_cost is distinct from w.training_attack_cost
  or not paid.training_points_paid or not paid.training_card_spent
  or paid.training_damage_applied or paid.official_match_modified
 then raise exception 'Contato, ataque ou pagamento de treino divergente';end if;
 if proj.catalog_attack_id<>'104' or proj.attack_name<>'Fogo Primordial 2.0'
  or proj.base_damage<>5 or proj.attack_cost<>2
  or paid.catalog_attack_id<>'104' or paid.training_attack_cost<>2
  or proj.defender_hp_before is distinct from contact.defender_hp_at_contact
 then raise exception 'Somente Fogo Primordial 2.0 original (104, 5 x 1d6) é permitido';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference c
  where c.kind='attack' and c.card_id='104' and c.card_name='Fogo Primordial 2.0'
   and c.base_damage=5 and c.attack_cost=2
   and c.effect_text='Rode um dado de 6 lados. O valor será multiplicado com o dano base desta carta e passa a ser o dano total.')
 then raise exception 'Referência original de Fogo Primordial 2.0 alterada';end if;
 select * into meta from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creature from public.chaotic_preview_3x3_creature_element_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if meta.lobby_id is null or creature.lobby_id is null
  or meta.attack_instance_id is distinct from w.attack_instance_id
  or meta.catalog_attack_id<>'104' or meta.base_damage<>5
  or meta.special_resolution<>'six_sided_base_multiplier'
  or meta.fire_component<>5 or meta.water_component<>0
  or meta.earth_component<>0 or meta.air_component<>0
  or meta.attacker_id is distinct from actor
  or meta.defender_id is distinct from w.defender_id
  or creature.attacker_id is distinct from actor
  or creature.defender_id is distinct from w.defender_id
  or creature.attacker_slot is distinct from w.attacker_slot
  or creature.defender_slot is distinct from w.defender_slot
  or creature.official_match_modified or creature.final_damage_calculated
 then raise exception 'Componentes ou criaturas não validados no catálogo';end if;
 select * into gear from public.chaotic_preview_3x3_private_equipment_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if gear.lobby_id is null or gear.defender_id is distinct from w.defender_id
  or gear.defender_slot is distinct from w.defender_slot
  or gear.defender_creature_instance_id is distinct from creature.defender_creature_instance_id
  or gear.equipment_status<>'no_equipment_in_slot'
  or gear.equipment_instance_id is not null
 then raise exception 'Resolva a defesa: somente defensor SEM equipamento é elegível';end if;
 select * into hp_att from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor and position=w.attacker_slot for update;
 select * into hp_def from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=w.defender_id and position=w.defender_slot for update;
 if hp_att.lobby_id is null or hp_def.lobby_id is null
  or hp_att.creature_instance_id is distinct from contact.attacker_creature_instance_id
  or hp_def.creature_instance_id is distinct from contact.defender_creature_instance_id
  or hp_att.creature_instance_id is distinct from creature.attacker_creature_instance_id
  or hp_def.creature_instance_id is distinct from creature.defender_creature_instance_id
  or hp_att.hp_remaining is distinct from contact.attacker_hp_at_contact
  or hp_def.hp_remaining is distinct from contact.defender_hp_at_contact
  or hp_att.hp_remaining<1 or hp_def.hp_remaining<1
  or hp_def.damage_events>=120
 then raise exception 'HP alterado ou criatura diferente do contato';end if;
 -- One server die per attack, in the same DB transaction as HP.
 fire_die_roll:=pg_catalog.floor(pg_catalog.random()*6)::integer+1;
 effective_damage:=5*fire_die_roll;
 before_hp:=hp_def.hp_remaining;
 after_hp:=greatest(0,before_hp-effective_damage);
 -- Insert first so the AFTER HP knockout trigger can audit the die.
 insert into public.chaotic_preview_3x3_training_damage_events(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,catalog_attack_id,base_damage,fire_die_roll,
  hp_before,hp_after,damage_dealt,optional_reveal_pending,effects_fully_resolved
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,w.attacker_slot,w.defender_slot,
  w.attack_instance_id,'104',effective_damage,fire_die_roll,
  before_hp,after_hp,before_hp-after_hp,false,true
 ) returning * into event_row;
 update public.chaotic_preview_3x3_hp_wallets
  set hp_remaining=after_hp,damage_events=damage_events+1
  where lobby_id=p_lobby_id and actor_id=w.defender_id and position=w.defender_slot;
 update public.chaotic_preview_3x3_attack_spends
  set training_damage_applied=true,
      resolution_status='training_fire_104_die_resolved'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 return event_row;
end;
$function$
;
revoke all on function public.chaotic_apply_preview_3x3_training_fire_104(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_3x3_training_fire_104(uuid,integer) to authenticated;
COMMIT;