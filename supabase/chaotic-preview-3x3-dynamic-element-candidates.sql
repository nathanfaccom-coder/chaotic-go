-- Chaotic GO v0.1.45 — candidate dynamic elements for training 3x3.
-- Read-only review based on the two ORIGINAL creature effects:
-- Guru grants Air to other controlled champions while present;
-- Naty's variable elements depend on combat progression not tracked here.
-- Do not mutate element lists, equipment, official cards, HP or match results.

create table public.chaotic_preview_3x3_dynamic_element_checks (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attacker_slot smallint not null check(attacker_slot between 4 and 6),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 attacker_creature_instance_id text not null,
 defender_creature_instance_id text not null,
 attacker_creature_name text not null,
 defender_creature_name text not null,
 attack_instance_id text not null,
 catalog_attack_id text not null references public.chaotic_preview_3x3_element_catalog(attack_id),
 attack_air_component smallint not null check(attack_air_component between 0 and 100),
 attacker_guru_support_count smallint not null check(attacker_guru_support_count between 0 and 2),
 defender_guru_support_count smallint not null check(defender_guru_support_count between 0 and 2),
 attacker_guru_air_candidate boolean not null,
 defender_guru_air_candidate boolean not null,
 attacker_naty_variable_candidate boolean not null,
 defender_naty_variable_candidate boolean not null,
 attacker_air_attack_candidate boolean not null,
 dynamic_elements_resolved boolean not null default false check(dynamic_elements_resolved=false),
 air_bonus_applied boolean not null default false check(air_bonus_applied=false),
 effect_activated boolean not null default false check(effect_activated=false),
 defensive_immunity_applied boolean not null default false check(defensive_immunity_applied=false),
 final_damage_calculated boolean not null default false check(final_damage_calculated=false),
 training_hp_changed boolean not null default false check(training_hp_changed=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 inspection_scope text not null default 'dynamic_element_candidates_only'
  check(inspection_scope='dynamic_element_candidates_only'),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
  references public.chaotic_preview_3x3_creature_element_checks(lobby_id,turn_no)
  on delete cascade,
 check(attacker_id<>defender_id),
 check(attacker_guru_air_candidate=(attacker_guru_support_count>0)),
 check(defender_guru_air_candidate=(defender_guru_support_count>0)),
 check(attacker_air_attack_candidate=(attacker_guru_support_count>0 and attack_air_component>0))
);
alter table public.chaotic_preview_3x3_dynamic_element_checks enable row level security;
revoke all on public.chaotic_preview_3x3_dynamic_element_checks from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_dynamic_element_checks to authenticated;
create policy chaotic_preview_3x3_dynamic_member_read
on public.chaotic_preview_3x3_dynamic_element_checks
for select to authenticated using (
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_dynamic_element_checks.lobby_id
  and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
);

create or replace function public.chaotic_inspect_preview_3x3_dynamic_elements(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_dynamic_element_checks
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_defense_windows;
 original_attack public.chaotic_preview_3x3_elemental_inspections;
 creatures public.chaotic_preview_3x3_creature_element_checks;
 own_a public.chaotic_preview_3x3_allies;
 own_d public.chaotic_preview_3x3_allies;
 hp_a public.chaotic_preview_3x3_hp_wallets;
 hp_d public.chaotic_preview_3x3_hp_wallets;
 gurus_a integer;
 gurus_d integer;
 valid_guru integer;
 valid_naty integer;
 result public.chaotic_preview_3x3_dynamic_element_checks;
begin
 if actor is null then raise exception 'Faça login'; end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido para os elementos dinâmicos';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id)
 then raise exception 'Apenas participantes da partida ativa';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 não está pronta';end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.status<>'awaiting_defender'
  or w.defender_id is distinct from actor
  or w.attacker_id is distinct from m.current_player
 then raise exception 'Somente o defensor durante a resposta pendente';end if;
 select * into original_attack from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creatures from public.chaotic_preview_3x3_creature_element_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if original_attack.lobby_id is null or creatures.lobby_id is null
  or original_attack.attacker_id is distinct from w.attacker_id
  or original_attack.defender_id is distinct from actor
  or original_attack.attacker_slot is distinct from w.attacker_slot
  or original_attack.defender_slot is distinct from w.defender_slot
  or original_attack.attack_instance_id is distinct from w.attack_instance_id
  or creatures.attacker_id is distinct from w.attacker_id
  or creatures.defender_id is distinct from actor
  or creatures.attacker_slot is distinct from w.attacker_slot
  or creatures.defender_slot is distinct from w.defender_slot
  or creatures.final_damage_calculated or creatures.official_match_modified
 then raise exception 'As revisões canônicas de ataque/criaturas não correspondem à janela'; end if;
 if exists(select 1 from public.chaotic_preview_3x3_dynamic_element_checks
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Elementos dinâmicos já inspecionados neste turno';end if;
 select * into own_a from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=w.attacker_id and position=w.attacker_slot;
 select * into own_d from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=actor and position=w.defender_slot;
 select * into hp_a from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=w.attacker_id and position=w.attacker_slot for update;
 select * into hp_d from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor and position=w.defender_slot for update;
 if own_a.creature_instance_id is distinct from creatures.attacker_creature_instance_id
  or own_a.creature_name is distinct from creatures.attacker_creature_name
  or own_d.creature_instance_id is distinct from creatures.defender_creature_instance_id
  or own_d.creature_name is distinct from creatures.defender_creature_name
  or hp_a.creature_instance_id is distinct from creatures.attacker_creature_instance_id
  or hp_d.creature_instance_id is distinct from creatures.defender_creature_instance_id
  or hp_a.hp_remaining is distinct from original_attack.attacker_hp_at_contact
  or hp_d.hp_remaining is distinct from original_attack.defender_hp_at_contact
  or hp_a.hp_remaining<=0 or hp_d.hp_remaining<=0
 then raise exception 'Formação ou HP não corresponde ao contato original';end if;
 select count(*) into valid_guru from public.chaotic_preview_card_reference
  where kind='creature' and card_id='8' and card_name='Guru'
   and creature_elements ? 'ar';
 select count(*) into valid_naty from public.chaotic_preview_card_reference
  where kind='creature' and card_id='12' and card_name='Naty';
 if valid_guru<>1 or valid_naty<>1
 then raise exception 'Regras de Guru/Naty divergentes do catálogo original';end if;
 select count(*) into gurus_a
 from public.chaotic_preview_3x3_allies x
 join public.chaotic_preview_3x3_hp_wallets h
  on h.lobby_id=x.lobby_id and h.actor_id=x.actor_id
  and h.position=x.position and h.creature_instance_id=x.creature_instance_id
 where x.lobby_id=p_lobby_id and x.actor_id=w.attacker_id
  and x.position<>w.attacker_slot and x.creature_name='Guru'
  and h.hp_remaining>0;
 select count(*) into gurus_d
 from public.chaotic_preview_3x3_allies x
 join public.chaotic_preview_3x3_hp_wallets h
  on h.lobby_id=x.lobby_id and h.actor_id=x.actor_id
  and h.position=x.position and h.creature_instance_id=x.creature_instance_id
 where x.lobby_id=p_lobby_id and x.actor_id=actor
  and x.position<>w.defender_slot and x.creature_name='Guru'
  and h.hp_remaining>0;
 insert into public.chaotic_preview_3x3_dynamic_element_checks(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attacker_creature_instance_id,defender_creature_instance_id,
  attacker_creature_name,defender_creature_name,attack_instance_id,catalog_attack_id,
  attack_air_component,attacker_guru_support_count,defender_guru_support_count,
  attacker_guru_air_candidate,defender_guru_air_candidate,
  attacker_naty_variable_candidate,defender_naty_variable_candidate,
  attacker_air_attack_candidate
 ) values(
  p_lobby_id,p_expected_turn,w.attacker_id,actor,w.attacker_slot,w.defender_slot,
  own_a.creature_instance_id,own_d.creature_instance_id,
  own_a.creature_name,own_d.creature_name,
  original_attack.attack_instance_id,original_attack.catalog_attack_id,
  original_attack.air_component,gurus_a,gurus_d,gurus_a>0,gurus_d>0,
  own_a.creature_name='Naty',own_d.creature_name='Naty',
  gurus_a>0 and original_attack.air_component>0
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)
 to authenticated;
do $pub$ begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_3x3_dynamic_element_checks')
 then alter publication supabase_realtime
  add table public.chaotic_preview_3x3_dynamic_element_checks; end if;
end $pub$;