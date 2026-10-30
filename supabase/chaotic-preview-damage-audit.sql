-- Chaotic GO 0.1.19: authoritative blockers-to-final-damage audit for preview 1x1.
-- NO final damage, true HP mutation, card effects or PvP victory is authorized.
-- The source catalog remains unchanged. Every entry is explicitly "incomplete".

create or replace function public.chaotic_preview_resolution_blockers(
 p_attack_catalog_id text,p_attacker_name text,p_defender_name text,
 p_attacker_equipment text,p_defender_equipment text,
 p_location_id integer,p_calculation_status text,p_subtotal integer
) returns text[]
language plpgsql immutable security invoker set search_path=''
as $fn$
declare
 issues text[]:=array['burst_unresolved','creature_abilities_unresolved',
  'official_turn_and_hp_unintegrated','card_ownership_not_authoritative'];
begin
 if p_attack_catalog_id is null or
  p_attack_catalog_id not in
  ('101','102','103','104','105','106','107','108','109','110','111','112','113','114','115')
 then raise exception 'Modelo de ataque não suportado pela auditoria';end if;
 if p_location_id is not null and p_location_id not in (501,502,503) then
  raise exception 'Local inválido';end if;
 if p_calculation_status is distinct from 'partial_estimate' or p_subtotal is null then
  issues:=array_append(issues,'damage_formula_incomplete');
 end if;
 if p_subtotal is not null and p_subtotal<0 then
  raise exception 'Dano parcial inválido';end if;
 if p_attack_catalog_id='104' then
  issues:=array_append(issues,'die_roll_or_special_resolution');
 elsif p_attack_catalog_id in ('113','114') then
  issues:=array_append(issues,'graveyard_scaling_unresolved');
 elsif p_attack_catalog_id in ('102','103','108','109','110','115') then
  issues:=array_append(issues,'hand_draw_heal_or_other_action_unresolved');
 elsif p_attack_catalog_id='101' then
  issues:=array_append(issues,'opponent_equipment_removal_unresolved');
 elsif p_attack_catalog_id='105' then
  issues:=array_append(issues,'hidden_creature_reveal_unresolved');
 elsif p_attack_catalog_id='106' then
  issues:=array_append(issues,'poison_over_future_turns_unresolved');
 elsif p_attack_catalog_id='107' then
  issues:=array_append(issues,'vine_turn_skip_requires_final_damage');
 elsif p_attack_catalog_id='111' then
  issues:=array_append(issues,'electronic_attack_lock_requires_final_damage');
 elsif p_attack_catalog_id='112' then
  issues:=array_append(issues,'hand_attack_lock_requires_final_damage');
 end if;
 if nullif(pg_catalog.btrim(coalesce(p_attacker_equipment,'')),'') is not null
  or nullif(pg_catalog.btrim(coalesce(p_defender_equipment,'')),'') is not null then
  issues:=array_append(issues,'equipment_full_effects_unresolved');
 end if;
 if p_attacker_name is null or p_defender_name is null then
  issues:=array_append(issues,'creature_name_not_validated');
 end if;
 if p_location_id is null then
  issues:=array_append(issues,'location_not_selected');
 end if;
 return issues;
end;
$fn$;
revoke all on function public.chaotic_preview_resolution_blockers(
 text,text,text,text,text,integer,text,integer) from public,anon,authenticated;

create table if not exists public.chaotic_preview_resolution_audits (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 victim_id uuid not null references auth.users(id),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 catalog_attack_id text not null,
 blocker_codes text[] not null check(cardinality(blocker_codes)>0),
 blocker_count integer generated always as (cardinality(blocker_codes)) stored,
 damage_status text not null check(length(damage_status) between 1 and 60),
 review_status text not null default 'incomplete' check(review_status='incomplete'),
 final_damage_verified boolean not null default false check(final_damage_verified=false),
 applied_to_official_match boolean not null default false check(applied_to_official_match=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
   public.chaotic_preview_individual_damage(lobby_id,turn_no) on delete cascade,
 check(actor_id<>victim_id)
);

alter table public.chaotic_preview_resolution_audits enable row level security;
revoke all on public.chaotic_preview_resolution_audits from public,anon,authenticated;
grant select on public.chaotic_preview_resolution_audits to authenticated;
drop policy if exists chaotic_resolution_audits_member_read
 on public.chaotic_preview_resolution_audits;
create policy chaotic_resolution_audits_member_read
 on public.chaotic_preview_resolution_audits
 for select to authenticated using(
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_resolution_audits.lobby_id
    and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_audit_preview_damage(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_resolution_audits
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 dmg public.chaotic_preview_individual_damage;
 atk public.chaotic_preview_attack_instances;
 clash public.chaotic_preview_clashes;
 hand_card public.chaotic_preview_attack_hand;
 offensive public.chaotic_preview_loadouts;
 defensive public.chaotic_preview_loadouts;
 codes text[];
 result public.chaotic_preview_resolution_audits;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.current_player<>actor
  or m.turn_no<>p_expected_turn or actor not in(m.host_id,m.guest_id) then
  raise exception 'Turno ou jogador não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
  raise exception 'Sala 1x1 inválida';end if;
 select * into dmg from public.chaotic_preview_individual_damage
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into atk from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into clash from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if dmg.attacker_id is distinct from actor or
   dmg.defender_id not in(m.host_id,m.guest_id) or
   dmg.defender_id=actor or dmg.cost_status is distinct from 'test_spent'
   or atk.actor_id is distinct from actor
   or atk.attack_instance_id is distinct from dmg.attack_instance_id
   or atk.catalog_attack_id is distinct from dmg.catalog_attack_id
   or clash.attacker_id is distinct from actor
   or clash.defender_id is distinct from dmg.defender_id
   or clash.attack_card is distinct from dmg.attack_instance_id
 then raise exception 'Ataque, dano e pagamento devem corresponder ao confronto';end if;
 select * into hand_card from public.chaotic_preview_attack_hand h
   where h.lobby_id=p_lobby_id and h.actor_id=actor
    and h.card_slot=atk.card_slot and h.attack_instance_id=atk.attack_instance_id;
 if not found or hand_card.card_state<>'spent' or
   hand_card.spent_reason<>'attack' or hand_card.spent_turn<>p_expected_turn then
  raise exception 'Carta não foi paga nesta vez de teste';end if;
 select * into offensive from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 select * into defensive from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=dmg.defender_id;
 if offensive.card_instance_id is distinct from dmg.attacker_instance_id
   or defensive.card_instance_id is distinct from dmg.defender_instance_id then
  raise exception 'Criaturas não correspondem ao DNA do confronto';end if;
 if exists(select 1 from public.chaotic_preview_resolution_audits
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
  raise exception 'Auditoria já registrada';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference
   where kind='attack' and card_id=atk.catalog_attack_id) then
  raise exception 'Ataque fora do catálogo original';end if;
 codes:=public.chaotic_preview_resolution_blockers(
  atk.catalog_attack_id,offensive.creature_name,defensive.creature_name,
  offensive.equipment_name,defensive.equipment_name,dmg.location_id,
  dmg.calculation_status,dmg.preview_subtotal);
 insert into public.chaotic_preview_resolution_audits(
  lobby_id,turn_no,actor_id,victim_id,attack_instance_id,catalog_attack_id,
  blocker_codes,damage_status
 ) values(
  p_lobby_id,p_expected_turn,actor,dmg.defender_id,dmg.attack_instance_id,
  dmg.catalog_attack_id,codes,dmg.calculation_status
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_audit_preview_damage(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_audit_preview_damage(uuid,integer)
 to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_resolution_audits') then
  alter publication supabase_realtime add table public.chaotic_preview_resolution_audits;
 end if;
end $$;
