-- Chaotic GO v0.1.43 — canonical base creature elements: read-only 3x3 defender preview.
-- Dynamic elements (Guru, Naty, equipment, abilities), immunity, dice and HP
-- intentionally remain unresolved. Existing cards/assets/official gameplay untouched.

create table if not exists public.chaotic_preview_3x3_creature_element_checks (
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
 attacker_base_elements jsonb not null check(jsonb_typeof(attacker_base_elements)='array'),
 defender_base_elements jsonb not null check(jsonb_typeof(defender_base_elements)='array'),
 fire_base_match boolean not null,
 water_base_match boolean not null,
 earth_base_match boolean not null,
 air_base_match boolean not null,
 rex_air_immunity_candidate boolean not null default false,
 effective_elements_verified boolean not null default false check(effective_elements_verified=false),
 dynamic_effects_verified boolean not null default false check(dynamic_effects_verified=false),
 defender_equipment_verified boolean not null default false check(defender_equipment_verified=false),
 final_damage_calculated boolean not null default false check(final_damage_calculated=false),
 training_hp_changed boolean not null default false check(training_hp_changed=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 inspection_scope text not null default 'base_creature_elements_only'
   check(inspection_scope='base_creature_elements_only'),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
   public.chaotic_preview_3x3_elemental_inspections(lobby_id,turn_no) on delete cascade,
 check(attacker_id<>defender_id)
);
alter table public.chaotic_preview_3x3_creature_element_checks enable row level security;
revoke all on public.chaotic_preview_3x3_creature_element_checks from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_creature_element_checks to authenticated;
create policy chaotic_preview_3x3_creature_check_member_read
 on public.chaotic_preview_3x3_creature_element_checks for select to authenticated
 using (exists(
  select 1 from public.chaotic_match_turns m
  where m.lobby_id=chaotic_preview_3x3_creature_element_checks.lobby_id
   and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id)
 ));

create or replace function public.chaotic_inspect_preview_3x3_creature_elements(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_creature_element_checks
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_defense_windows;
 review public.chaotic_preview_3x3_elemental_inspections;
 contact public.chaotic_preview_3x3_contact_intents;
 attacker public.chaotic_preview_3x3_allies;
 defender public.chaotic_preview_3x3_allies;
 attacker_hp public.chaotic_preview_3x3_hp_wallets;
 defender_hp public.chaotic_preview_3x3_hp_wallets;
 a_elements jsonb;
 d_elements jsonb;
 a_count integer;
 d_count integer;
 result public.chaotic_preview_3x3_creature_element_checks;
begin
 if actor is null then raise exception 'Faça login'; end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno de conferência de criatura inválido'; end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente participante da partida ativa'; end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 não pronta'; end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.status<>'awaiting_defender'
  or w.defender_id is distinct from actor
  or w.attacker_id is distinct from m.current_player
 then raise exception 'Somente o defensor na janela pendente pode conferir'; end if;
 select * into review from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or review.attacker_id is distinct from w.attacker_id
  or review.defender_id is distinct from actor
  or review.attacker_slot is distinct from w.attacker_slot
  or review.defender_slot is distinct from w.defender_slot
  or review.attack_instance_id is distinct from w.attack_instance_id
  or review.final_damage_calculated or review.training_hp_changed
  or review.official_hp_changed or review.official_match_modified
 then raise exception 'Inspecione primeiro o ataque original, sem efeitos'; end if;
 if exists(select 1 from public.chaotic_preview_3x3_creature_element_checks
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Elementos básicos já registrados neste turno'; end if;
 select * into contact from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or contact.attacker_id is distinct from w.attacker_id
  or contact.defender_id is distinct from actor
  or contact.attacker_slot is distinct from w.attacker_slot
  or contact.defender_slot is distinct from w.defender_slot
  or contact.attacker_creature_instance_id is null
  or contact.defender_creature_instance_id is null
 then raise exception 'Contato não corresponde às criaturas desta janela'; end if;
 select * into attacker from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=w.attacker_id and position=w.attacker_slot;
 select * into defender from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=actor and position=w.defender_slot;
 if attacker.creature_instance_id is distinct from contact.attacker_creature_instance_id
  or defender.creature_instance_id is distinct from contact.defender_creature_instance_id
 then raise exception 'Instâncias das criaturas não conferem com a formação'; end if;
 select * into attacker_hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=w.attacker_id and position=w.attacker_slot for update;
 select * into defender_hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor and position=w.defender_slot for update;
 if attacker_hp.creature_instance_id is distinct from attacker.creature_instance_id
  or defender_hp.creature_instance_id is distinct from defender.creature_instance_id
  or attacker_hp.hp_remaining is distinct from review.attacker_hp_at_contact
  or defender_hp.hp_remaining is distinct from review.defender_hp_at_contact
  or attacker_hp.hp_remaining<1 or defender_hp.hp_remaining<1
 then raise exception 'HP ou instância alterados após contato'; end if;
 select count(*),min(c.creature_elements::text)::jsonb
  into a_count,a_elements
  from public.chaotic_preview_card_reference c
  where c.kind='creature' and c.card_name=attacker.creature_name;
 select count(*),min(c.creature_elements::text)::jsonb
  into d_count,d_elements
  from public.chaotic_preview_card_reference c
  where c.kind='creature' and c.card_name=defender.creature_name;
 if a_count<>1 or d_count<>1 or a_elements is null or d_elements is null
  or pg_catalog.jsonb_typeof(a_elements)<>'array'
  or pg_catalog.jsonb_typeof(d_elements)<>'array'
 then raise exception 'Criatura ausente ou duplicada no catálogo original'; end if;
 insert into public.chaotic_preview_3x3_creature_element_checks(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attacker_creature_instance_id,defender_creature_instance_id,
  attacker_creature_name,defender_creature_name,
  attacker_base_elements,defender_base_elements,
  fire_base_match,water_base_match,earth_base_match,air_base_match,
  rex_air_immunity_candidate
 ) values (
  p_lobby_id,p_expected_turn,w.attacker_id,actor,w.attacker_slot,w.defender_slot,
  attacker.creature_instance_id,defender.creature_instance_id,
  attacker.creature_name,defender.creature_name,a_elements,d_elements,
  review.fire_component>0 and a_elements ? 'fogo',
  review.water_component>0 and a_elements ? 'agua',
  review.earth_component>0 and a_elements ? 'terra',
  review.air_component>0 and a_elements ? 'ar',
  defender.creature_name='Rex' and review.air_component>0
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_inspect_preview_3x3_creature_elements(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_inspect_preview_3x3_creature_elements(uuid,integer)
 to authenticated;
do $pub$ begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_3x3_creature_element_checks')
 then alter publication supabase_realtime
  add table public.chaotic_preview_3x3_creature_element_checks; end if;
end $pub$;