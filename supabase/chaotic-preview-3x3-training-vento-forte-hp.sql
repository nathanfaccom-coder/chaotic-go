-- Chaotic GO 0.1.46: first genuine, persistent TRAINING HP settlement (attack 105 only).
-- Vento Forte: neutral base 5. Its optional creature reveal is NOT executed.
-- The real/official match, cards, XP, currency and winner never change here.
-- No equipment, dice, elemental, conditional or unrelated attack may use this RPC.

alter table public.chaotic_preview_3x3_hp_wallets
 drop constraint chaotic_preview_3x3_hp_wallets_check1,
 drop constraint chaotic_preview_3x3_hp_wallets_damage_events_check;
alter table public.chaotic_preview_3x3_hp_wallets
 add constraint chaotic_preview_3x3_training_hp_bounds
   check(hp_initial=hp_max and hp_remaining<=hp_initial
         and damage_events between 0 and 120
         and (damage_events>0 or hp_remaining=hp_initial));

alter table public.chaotic_preview_3x3_attack_spends
 drop constraint chaotic_preview_3x3_attack_spends_training_damage_applied_check,
 drop constraint chaotic_preview_3x3_attack_spends_resolution_status_check;
alter table public.chaotic_preview_3x3_attack_spends
 add constraint chaotic_preview_3x3_training_settlement_consistency
 check (
 (not training_damage_applied and resolution_status='paid_training_unresolved')
 or (training_damage_applied and resolution_status='training_base_damage_105_optional_reveal_pending')
 );

create table public.chaotic_preview_3x3_training_damage_events (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attacker_slot smallint not null check(attacker_slot between 4 and 6),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 attack_instance_id text not null,
 catalog_attack_id text not null default '105' check(catalog_attack_id='105'),
 base_damage integer not null default 5 check(base_damage=5),
 hp_before integer not null check(hp_before between 1 and 500),
 hp_after integer not null check(hp_after between 0 and 499),
 damage_dealt integer not null check(damage_dealt between 1 and 5),
 optional_reveal_pending boolean not null default true check(optional_reveal_pending),
 effects_fully_resolved boolean not null default false check(not effects_fully_resolved),
 training_only boolean not null default true check(training_only),
 official_hp_changed boolean not null default false check(not official_hp_changed),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
 references public.chaotic_preview_3x3_defense_windows(lobby_id,turn_no)
 on delete cascade,
 check(attacker_id<>defender_id),
 check(hp_after=greatest(0,hp_before-base_damage)),
 check(damage_dealt=hp_before-hp_after)
);
alter table public.chaotic_preview_3x3_training_damage_events enable row level security;
revoke all on public.chaotic_preview_3x3_training_damage_events from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_training_damage_events to authenticated;
create policy chaotic_preview_3x3_training_damage_members_read
 on public.chaotic_preview_3x3_training_damage_events
 for select to authenticated using (
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_3x3_training_damage_events.lobby_id
    and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_apply_preview_3x3_training_base_105(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_training_damage_events
language plpgsql security definer set search_path=''
as $fn$
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
 if proj.catalog_attack_id<>'105' or proj.attack_name<>'Vento Forte'
  or proj.base_damage<>5 or proj.attack_cost<>1
  or paid.catalog_attack_id<>'105' or paid.training_attack_cost<>1
  or proj.defender_hp_before is distinct from contact.defender_hp_at_contact
 then raise exception 'Apenas Vento Forte original (105, 5 dano neutro) está habilitado';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference c
  where c.kind='attack' and c.card_id='105' and c.card_name='Vento Forte'
   and c.base_damage=5 and c.attack_cost=1)
 then raise exception 'Referência original do Vento Forte alterada';end if;
 select * into meta from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creature from public.chaotic_preview_3x3_creature_element_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if meta.lobby_id is null or creature.lobby_id is null
  or meta.attack_instance_id is distinct from w.attack_instance_id
  or meta.catalog_attack_id<>'105' or meta.base_damage<>5
  or meta.special_resolution<>'none'
  or meta.fire_component<>0 or meta.water_component<>0
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
 before_hp:=hp_def.hp_remaining;
 after_hp:=greatest(0,before_hp-5);
 update public.chaotic_preview_3x3_hp_wallets
  set hp_remaining=after_hp,damage_events=damage_events+1
  where lobby_id=p_lobby_id and actor_id=w.defender_id and position=w.defender_slot;
 update public.chaotic_preview_3x3_attack_spends
  set training_damage_applied=true,
      resolution_status='training_base_damage_105_optional_reveal_pending'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 insert into public.chaotic_preview_3x3_training_damage_events(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,hp_before,hp_after,damage_dealt
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,w.attacker_slot,w.defender_slot,
  w.attack_instance_id,before_hp,after_hp,before_hp-after_hp
 ) returning * into event_row;
 return event_row;
end;
$fn$;
revoke all on function public.chaotic_apply_preview_3x3_training_base_105(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_3x3_training_base_105(uuid,integer)
 to authenticated;

do $pub$ begin
 if not exists(select 1 from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public'
  and tablename='chaotic_preview_3x3_training_damage_events')
 then alter publication supabase_realtime
  add table public.chaotic_preview_3x3_training_damage_events;end if;
end $pub$;