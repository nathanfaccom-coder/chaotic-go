-- Chaotic GO v0.1.49: MÃO ELETRÔNICA 111 / MÃO MÃO 112.
-- Apply 10/5 HP damage AND disable the defender's next 2/1 attack turns.
-- Only experimental 3x3; no official cards, artwork, currency, XP or outcome.

alter table public.chaotic_preview_3x3_attack_spends
 drop constraint chaotic_preview_3x3_training_settlement_consistency;
alter table public.chaotic_preview_3x3_attack_spends
 add constraint chaotic_preview_3x3_training_settlement_consistency
 check((not training_damage_applied and resolution_status='paid_training_unresolved')
   or (training_damage_applied and resolution_status in(
     'training_base_damage_105_optional_reveal_pending',
     'training_base_damage_attack_lock_applied')));

alter table public.chaotic_preview_3x3_training_damage_events
 drop constraint chaotic_preview_3x3_training_damage_eve_catalog_attack_id_check,
 drop constraint chaotic_preview_3x3_training_damage_events_base_damage_check,
 drop constraint chaotic_preview_3x3_training_damage_events_damage_dealt_check,
 drop constraint chaotic_preview_3x3_training_dama_optional_reveal_pending_check,
 drop constraint chaotic_preview_3x3_training_damag_effects_fully_resolved_check;
alter table public.chaotic_preview_3x3_training_damage_events
 add constraint chaotic_preview_3x3_training_attack_catalog_check
 check((catalog_attack_id='105' and base_damage=5 and optional_reveal_pending
        and not effects_fully_resolved)
    or (catalog_attack_id='111' and base_damage=10 and not optional_reveal_pending
        and effects_fully_resolved)
    or (catalog_attack_id='112' and base_damage=5 and not optional_reveal_pending
        and effects_fully_resolved)),
 add constraint chaotic_preview_3x3_training_damage_range
 check(damage_dealt between 1 and 10);

alter table public.chaotic_preview_3x3_training_knockouts
 drop constraint chaotic_preview_3x3_training_knockouts_catalog_attack_id_check,
 drop constraint chaotic_preview_3x3_training_knockouts_hp_before_check;
alter table public.chaotic_preview_3x3_training_knockouts
 add constraint chaotic_preview_3x3_knockout_attack_damage_match
 check((catalog_attack_id='105' and hp_before between 1 and 5)
    or (catalog_attack_id='111' and hp_before between 1 and 10)
    or (catalog_attack_id='112' and hp_before between 1 and 5));

create table public.chaotic_preview_3x3_training_attack_locks (
 lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
 inflicted_turn integer not null check(inflicted_turn between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 catalog_attack_id text not null check(catalog_attack_id in('111','112')),
 blocked_turn_count smallint not null check(blocked_turn_count in(1,2)),
 last_blocked_turn integer not null check(last_blocked_turn between 2 and 123),
 training_only boolean not null default true check(training_only),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,inflicted_turn),
 foreign key(lobby_id,inflicted_turn) references
  public.chaotic_preview_3x3_defense_windows(lobby_id,turn_no) on delete cascade,
 check(attacker_id<>defender_id),
 check((catalog_attack_id='111' and blocked_turn_count=2)
    or (catalog_attack_id='112' and blocked_turn_count=1)),
 check(last_blocked_turn=inflicted_turn+2*blocked_turn_count-1)
);
alter table public.chaotic_preview_3x3_training_attack_locks enable row level security;
revoke all on public.chaotic_preview_3x3_training_attack_locks from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_training_attack_locks to authenticated;
create policy chaotic_preview_3x3_training_attack_lock_members_read
 on public.chaotic_preview_3x3_training_attack_locks
 for select to authenticated using(
  exists(select 1 from public.chaotic_match_turns m where m.lobby_id=
   chaotic_preview_3x3_training_attack_locks.lobby_id
    and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

-- This trigger fires BEFORE contact or attack projection so even another RPC
-- cannot bypass the ban by crafting a direct request. Turn order alternates
-- strictly between host and guest (chaotic_pass_turn).
create or replace function public.chaotic_guard_preview_3x3_training_attack_lock()
 returns trigger language plpgsql security definer set search_path=''
as $guard$
declare actor uuid; turn_num integer;
begin
 if tg_table_name='chaotic_preview_3x3_contact_intents' then
  actor:=new.attacker_id;
 elsif tg_table_name='chaotic_preview_3x3_attack_projections' then
  actor:=new.actor_id;
 elsif tg_table_name='chaotic_preview_3x3_attack_spends' then
  actor:=new.actor_id;
 else raise exception 'Unsupported training lock surface';end if;
 turn_num:=new.turn_no;
 if exists(select 1 from public.chaotic_preview_3x3_training_attack_locks l
 where l.lobby_id=new.lobby_id and l.defender_id=actor
   and turn_num>l.inflicted_turn and turn_num<=l.last_blocked_turn)
 then raise exception 'Sua equipe está impedida de atacar neste turno de treino';
 end if;
 return new;
end;
$guard$;
revoke all on function public.chaotic_guard_preview_3x3_training_attack_lock()
 from public,anon,authenticated;
create trigger chaotic_3x3_attack_lock_guard before insert on
 public.chaotic_preview_3x3_contact_intents
 for each row execute function public.chaotic_guard_preview_3x3_training_attack_lock();
create trigger chaotic_3x3_attack_lock_guard before insert on
 public.chaotic_preview_3x3_attack_projections
 for each row execute function public.chaotic_guard_preview_3x3_training_attack_lock();
create trigger chaotic_3x3_attack_lock_guard before insert on
 public.chaotic_preview_3x3_attack_spends
 for each row execute function public.chaotic_guard_preview_3x3_training_attack_lock();

-- Keep the existing v0.1.48 outcome guard; new lock rows are written
-- *before* the HP UPDATE (which can create the final KO and outcome).
create trigger chaotic_3x3_terminal_guard
 before insert on public.chaotic_preview_3x3_training_attack_locks
 for each row execute function public.chaotic_guard_preview_3x3_terminal_actions();

create or replace function public.chaotic_apply_preview_3x3_training_attack_lock(
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
 damage_points integer;
 lock_duration integer;
 expected_name text;
 expected_cost integer;
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
 if proj.catalog_attack_id not in ('111','112') then
  raise exception 'Somente os ataques 111 e 112 têm bloqueio de ataques no treino';end if;
 damage_points:=case when proj.catalog_attack_id='111' then 10 else 5 end;
 lock_duration:=case when proj.catalog_attack_id='111' then 2 else 1 end;
 expected_name:=case when proj.catalog_attack_id='111' then 'MÃO ELETRÔNICA' else 'MÃO MÃO' end;
 expected_cost:=case when proj.catalog_attack_id='111' then 3 else 1 end;
 if proj.attack_name is distinct from expected_name
  or proj.base_damage is distinct from damage_points
  or proj.attack_cost is distinct from expected_cost
  or paid.catalog_attack_id is distinct from proj.catalog_attack_id
  or paid.training_attack_cost is distinct from expected_cost
  or proj.defender_hp_before is distinct from contact.defender_hp_at_contact
 then raise exception 'Dados do ataque 111/112 divergentes do catálogo original';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference c
  where c.kind='attack' and c.card_id=proj.catalog_attack_id
   and c.card_name=expected_name
   and c.base_damage=damage_points and c.attack_cost=expected_cost)
 then raise exception 'Referência canônica do ataque com bloqueio ausente';end if;
 select * into meta from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creature from public.chaotic_preview_3x3_creature_element_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if meta.lobby_id is null or creature.lobby_id is null
  or meta.attack_instance_id is distinct from w.attack_instance_id
  or meta.catalog_attack_id is distinct from proj.catalog_attack_id
  or meta.base_damage is distinct from damage_points
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
 -- Lock is stored before the HP update. The final KO trigger can therefore
 -- register the outcome without preventing this atomic transaction from ending.
 insert into public.chaotic_preview_3x3_training_attack_locks(
  lobby_id,inflicted_turn,attacker_id,defender_id,catalog_attack_id,
  blocked_turn_count,last_blocked_turn
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,proj.catalog_attack_id,
  lock_duration,p_expected_turn+2*lock_duration-1
 );
 before_hp:=hp_def.hp_remaining;
 after_hp:=greatest(0,before_hp-damage_points);
 update public.chaotic_preview_3x3_hp_wallets
  set hp_remaining=after_hp,damage_events=damage_events+1
  where lobby_id=p_lobby_id and actor_id=w.defender_id and position=w.defender_slot;
 update public.chaotic_preview_3x3_attack_spends
  set training_damage_applied=true,
      resolution_status='training_base_damage_attack_lock_applied'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 insert into public.chaotic_preview_3x3_training_damage_events(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,catalog_attack_id,base_damage,hp_before,hp_after,damage_dealt,
  optional_reveal_pending,effects_fully_resolved
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,w.attacker_slot,w.defender_slot,
  w.attack_instance_id,proj.catalog_attack_id,damage_points,before_hp,after_hp,
  before_hp-after_hp,false,true
 ) returning * into event_row;
 return event_row;
end;
$fn$;
revoke all on function public.chaotic_apply_preview_3x3_training_attack_lock(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_3x3_training_attack_lock(uuid,integer)
 to authenticated;

-- Extend KO recording to both cards (HP 5/10) without losing 105 support.
create or replace function public.chaotic_record_preview_3x3_training_knockout()
 returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 w public.chaotic_preview_3x3_defense_windows;
 paid public.chaotic_preview_3x3_attack_spends;
 n integer;
 dead_count integer;
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
 or paid.catalog_attack_id not in ('105','111','112')
 or paid.attack_instance_id is distinct from w.attack_instance_id
 or not paid.training_points_paid or not paid.training_card_spent
 or paid.training_damage_applied
 or old.creature_instance_id is distinct from new.creature_instance_id
 or old.creature_name is distinct from new.creature_name
 or old.hp_max is distinct from new.hp_max
 or new.hp_remaining is distinct from greatest(0,old.hp_remaining-
    (case when paid.catalog_attack_id='111' then 10 else 5 end))
 or new.damage_events is distinct from old.damage_events+1
 then raise exception 'Nocaute 3x3 deve resultar do dano-base validado de Vento Forte';end if;

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
$fn$;

do $pub$ begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_3x3_training_attack_locks')
 then alter publication supabase_realtime
  add table public.chaotic_preview_3x3_training_attack_locks;end if;
end $pub$;