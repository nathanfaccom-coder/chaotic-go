-- Chaotic GO v0.1.42: canonical Attack elemental metadata and defender-only
-- inspection of unresolved 3x3 training combat. No elemental bonuses are applied.
-- Data transcribed from original cartas.js ATAQUES 101..115 (2026-10-30).
-- For 104 the original code has flat attributes (fogo,agua,terra,ar)
-- and a 6-sided dice effect: NEVER imply the listed fire bonus is final damage.

create table if not exists public.chaotic_preview_3x3_element_catalog (
 attack_id text primary key check(attack_id ~ '^1(0[1-9]|1[0-5])$'),
 attack_name text not null,
 element_fire smallint not null check(element_fire between 0 and 100),
 element_water smallint not null check(element_water between 0 and 100),
 element_earth smallint not null check(element_earth between 0 and 100),
 element_air smallint not null check(element_air between 0 and 100),
 element_data_shape text not null check(element_data_shape in ('danoElemental','flat_fire_fields')),
 special_resolution text not null check(special_resolution in ('none','six_sided_base_multiplier')),
 effects_pending boolean not null default true check(effects_pending=true)
);
alter table public.chaotic_preview_3x3_element_catalog enable row level security;
revoke all on public.chaotic_preview_3x3_element_catalog from public,anon,authenticated;
insert into public.chaotic_preview_3x3_element_catalog(
 attack_id,attack_name,element_fire,element_water,element_earth,element_air,element_data_shape,special_resolution
) values
 ('101','Ácido Gástrico',5,5,0,0,'danoElemental','none'),
 ('102','Mão Negra',0,0,0,0,'danoElemental','none'),
 ('103','Aliança',0,0,0,0,'danoElemental','none'),
 ('104','Fogo Primordial 2.0',5,0,0,0,'flat_fire_fields','six_sided_base_multiplier'),
 ('105','Vento Forte',0,0,0,0,'danoElemental','none'),
 ('106','Armadilha de Víbora',0,0,0,0,'danoElemental','none'),
 ('107','Armadilha de Vinha',0,0,5,0,'danoElemental','none'),
 ('108','SPEED',0,0,0,0,'danoElemental','none'),
 ('109','TORNADO',0,0,0,0,'danoElemental','none'),
 ('110','SONAR',0,0,10,10,'danoElemental','none'),
 ('111','MÃO ELETRÔNICA',0,0,0,0,'danoElemental','none'),
 ('112','MÃO MÃO',0,0,0,0,'danoElemental','none'),
 ('113','PURGATÓRIO',0,0,0,0,'danoElemental','none'),
 ('114','ESQUELETO',0,0,0,0,'danoElemental','none'),
 ('115','SOPRO',0,0,0,0,'danoElemental','none')
on conflict(attack_id) do update set attack_name=excluded.attack_name,
 element_fire=excluded.element_fire,element_water=excluded.element_water,
 element_earth=excluded.element_earth,element_air=excluded.element_air,
 element_data_shape=excluded.element_data_shape,special_resolution=excluded.special_resolution;

create table if not exists public.chaotic_preview_3x3_elemental_inspections (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attacker_slot smallint not null check(attacker_slot between 4 and 6),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 catalog_attack_id text not null references public.chaotic_preview_3x3_element_catalog(attack_id),
 attack_name text not null,
 base_damage integer not null check(base_damage between 0 and 500),
 fire_component smallint not null check(fire_component between 0 and 100),
 water_component smallint not null check(water_component between 0 and 100),
 earth_component smallint not null check(earth_component between 0 and 100),
 air_component smallint not null check(air_component between 0 and 100),
 special_resolution text not null check(special_resolution in ('none','six_sided_base_multiplier')),
 attacker_hp_at_contact integer not null check(attacker_hp_at_contact between 1 and 500),
 defender_hp_at_contact integer not null check(defender_hp_at_contact between 1 and 500),
 elemental_eligibility_verified boolean not null default false check(elemental_eligibility_verified=false),
 special_effect_executed boolean not null default false check(special_effect_executed=false),
 defender_equipment_verified boolean not null default false check(defender_equipment_verified=false),
 final_damage_calculated boolean not null default false check(final_damage_calculated=false),
 training_hp_changed boolean not null default false check(training_hp_changed=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 inspection_scope text not null default 'canonical_attack_components_only'
   check(inspection_scope='canonical_attack_components_only'),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_3x3_defense_windows(lobby_id,turn_no)
   on delete cascade,
 check(attacker_id<>defender_id)
);
alter table public.chaotic_preview_3x3_elemental_inspections enable row level security;
revoke all on public.chaotic_preview_3x3_elemental_inspections from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_elemental_inspections to authenticated;
create policy chaotic_preview_3x3_element_inspection_members_read
 on public.chaotic_preview_3x3_elemental_inspections for select to authenticated
 using(exists(select 1 from public.chaotic_match_turns m
  where m.lobby_id=chaotic_preview_3x3_elemental_inspections.lobby_id
   and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id)));

create or replace function public.chaotic_inspect_preview_3x3_elemental_defense(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_elemental_inspections
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_defense_windows;
 attack public.chaotic_preview_3x3_attack_projections;
 contact public.chaotic_preview_3x3_contact_intents;
 paid public.chaotic_preview_3x3_attack_spends;
 source_card public.chaotic_preview_3x3_element_catalog;
 defense_hp public.chaotic_preview_3x3_hp_wallets;
 attack_hp public.chaotic_preview_3x3_hp_wallets;
 result public.chaotic_preview_3x3_elemental_inspections;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno de revisão elemental inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente participante autenticado pode inspecionar';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 não pronta';end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.defender_id is distinct from actor
  or w.attacker_id is distinct from m.current_player
  or w.status<>'awaiting_defender'
 then raise exception 'Somente o defensor com janela pendente pode conferir elementos';end if;
 if exists(select 1 from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Revisão elemental já preparada neste turno';end if;
 select * into attack from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into contact from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into paid from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if attack.actor_id is distinct from w.attacker_id
  or attack.defender_id is distinct from actor
  or attack.attack_instance_id is distinct from w.attack_instance_id
  or attack.attack_cost is distinct from w.training_attack_cost
  or paid.attack_instance_id is distinct from attack.attack_instance_id
  or paid.training_attack_cost is distinct from attack.attack_cost
  or not paid.training_points_paid or not paid.training_card_spent
  or contact.attacker_id is distinct from w.attacker_id
  or contact.defender_id is distinct from actor
  or contact.attacker_slot is distinct from w.attacker_slot
  or contact.defender_slot is distinct from w.defender_slot
  or contact.attacker_creature_instance_id is null
  or contact.defender_creature_instance_id is null
 then raise exception 'Contato, pagamento ou carta não correspondem à janela';end if;
 select * into source_card from public.chaotic_preview_3x3_element_catalog
  where attack_id=attack.catalog_attack_id;
 if not found or source_card.attack_name is distinct from attack.attack_name
 then raise exception 'Ataque fora do catálogo original de elementos';end if;
 select * into defense_hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor and position=w.defender_slot;
 select * into attack_hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=w.attacker_id and position=w.attacker_slot;
 if defense_hp.creature_instance_id is distinct from contact.defender_creature_instance_id
  or defense_hp.hp_remaining is distinct from contact.defender_hp_at_contact
  or defense_hp.hp_remaining<=0
  or attack_hp.creature_instance_id is distinct from contact.attacker_creature_instance_id
  or attack_hp.hp_remaining is distinct from contact.attacker_hp_at_contact
  or attack_hp.hp_remaining<=0
 then raise exception 'HP alterado ou criatura divergente do contato';end if;
 insert into public.chaotic_preview_3x3_elemental_inspections(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,catalog_attack_id,attack_name,base_damage,
  fire_component,water_component,earth_component,air_component,special_resolution,
  attacker_hp_at_contact,defender_hp_at_contact
 ) values(
  p_lobby_id,p_expected_turn,w.attacker_id,actor,w.attacker_slot,w.defender_slot,
  attack.attack_instance_id,source_card.attack_id,source_card.attack_name,attack.base_damage,
  source_card.element_fire,source_card.element_water,source_card.element_earth,
  source_card.element_air,source_card.special_resolution,
  contact.attacker_hp_at_contact,contact.defender_hp_at_contact
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_inspect_preview_3x3_elemental_defense(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_inspect_preview_3x3_elemental_defense(uuid,integer)
 to authenticated;

do $pub$
begin
 if not exists(select 1 from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public'
 and tablename='chaotic_preview_3x3_elemental_inspections')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_elemental_inspections;end if;
end $pub$;