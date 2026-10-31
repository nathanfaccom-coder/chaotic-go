-- Chaotic GO v0.1.18: persistent HYPOTHETICAL HP ledger for 1x1 testing.
-- Not the official battle engine. No changes to album, DNA, XP, currency, turns or victory.

create or replace function public.chaotic_preview_hp_seed(
 p_stats jsonb,p_tribe text,p_location_id integer
) returns integer
language plpgsql immutable security invoker set search_path=''
as $fn$
declare e integer;
begin
 if pg_catalog.jsonb_typeof(p_stats)<>'object'
  or coalesce(p_stats->>'e','') !~ '^[0-9]{1,3}$'
  or p_location_id not in (501,502,503) or p_location_id is null
 then raise exception 'DNA de energia ou Local de teste inválido';end if;
 e:=(p_stats->>'e')::integer;
 if e not between 1 and 500 then raise exception 'Energia inicial deve estar entre 1 e 500';end if;
 return e+case when p_location_id=501 and pg_catalog.btrim(coalesce(p_tribe,''))='Azul'
  then 10 else 0 end;
end;
$fn$;
create or replace function public.chaotic_preview_hp_remainder(
 p_before integer,p_indicative_damage integer
) returns integer
language plpgsql immutable security invoker set search_path=''
as $fn$
begin
 if p_before is null or p_before not between 0 and 550
  or p_indicative_damage is null or p_indicative_damage not between 0 and 1500
 then raise exception 'Energia ou dano de teste inválidos';end if;
 return greatest(0,p_before-p_indicative_damage);
end;
$fn$;
revoke all on function public.chaotic_preview_hp_seed(jsonb,text,integer)
 from public,anon,authenticated;
revoke all on function public.chaotic_preview_hp_remainder(integer,integer)
 from public,anon,authenticated;

create table if not exists public.chaotic_preview_hp_wallets (
 lobby_id uuid not null,
 actor_id uuid not null,
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 init_turn integer not null check(init_turn between 1 and 120),
 location_id integer not null check(location_id in (501,502,503)),
 hp_max integer not null check(hp_max between 1 and 550),
 hp_remaining integer not null check(hp_remaining between 0 and 550),
 projected_hits integer not null default 0 check(projected_hits between 0 and 120),
 prepared_at timestamptz not null default now(),
 primary key(lobby_id,actor_id),
 foreign key(lobby_id,actor_id) references public.chaotic_preview_loadouts(lobby_id,actor_id)
  on delete cascade,
 check(hp_remaining<=hp_max)
);

create table if not exists public.chaotic_preview_hp_events (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 victim_id uuid not null references auth.users(id),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 victim_creature_instance_id text not null check(length(victim_creature_instance_id) between 1 and 48),
 hp_before integer not null check(hp_before between 1 and 550),
 hp_after integer not null check(hp_after between 0 and 550),
 indicative_damage integer not null check(indicative_damage between 0 and 1500),
 hypothetical_applied_damage integer not null check(hypothetical_applied_damage between 0 and 550),
 projection_kind text not null default 'hypothetical_partial_damage'
  check(projection_kind='hypothetical_partial_damage'),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 final_damage_verified boolean not null default false check(final_damage_verified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
  references public.chaotic_preview_individual_damage(lobby_id,turn_no) on delete cascade,
 foreign key(lobby_id,victim_id)
  references public.chaotic_preview_hp_wallets(lobby_id,actor_id) on delete cascade,
 check(attacker_id<>victim_id),
 check(hp_after=greatest(0,hp_before-indicative_damage)),
 check(hypothetical_applied_damage=hp_before-hp_after)
);

alter table public.chaotic_preview_hp_wallets enable row level security;
alter table public.chaotic_preview_hp_events enable row level security;
revoke all on public.chaotic_preview_hp_wallets,public.chaotic_preview_hp_events
 from public,anon,authenticated;
grant select on public.chaotic_preview_hp_wallets,public.chaotic_preview_hp_events
 to authenticated;
drop policy if exists chaotic_hp_wallet_members on public.chaotic_preview_hp_wallets;
create policy chaotic_hp_wallet_members on public.chaotic_preview_hp_wallets
 for select to authenticated using(
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_hp_wallets.lobby_id
   and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );
drop policy if exists chaotic_hp_event_members on public.chaotic_preview_hp_events;
create policy chaotic_hp_event_members on public.chaotic_preview_hp_events
 for select to authenticated using(
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_hp_events.lobby_id
   and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_prepare_preview_hp(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 loc public.chaotic_preview_room_locations;
 host_unit public.chaotic_preview_loadouts;
 guest_unit public.chaotic_preview_loadouts;
 host_hp integer;
 guest_hp integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player<>actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Não é sua vez ou partida inválida';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 indisponível';end if;
 select * into loc from public.chaotic_preview_room_locations where lobby_id=p_lobby_id;
 if not found then raise exception 'Sorteie um Local antes de iniciar o HP de teste';end if;
 select * into host_unit from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=m.host_id;
 select * into guest_unit from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=m.guest_id;
 if host_unit.card_instance_id is null or guest_unit.card_instance_id is null
 then raise exception 'As duas criaturas precisam de DNA individual preparado';end if;
 if exists(select 1 from public.chaotic_preview_hp_wallets
   where lobby_id=p_lobby_id)
   or exists(select 1 from public.chaotic_preview_individual_damage
    where lobby_id=p_lobby_id)
 then raise exception 'HP de teste já inicializado ou simulações anteriores existem';end if;
 host_hp:=public.chaotic_preview_hp_seed(host_unit.stats,host_unit.tribe,loc.catalog_location_id);
 guest_hp:=public.chaotic_preview_hp_seed(guest_unit.stats,guest_unit.tribe,loc.catalog_location_id);
 insert into public.chaotic_preview_hp_wallets
  (lobby_id,actor_id,creature_instance_id,init_turn,location_id,hp_max,hp_remaining)
 values(p_lobby_id,m.host_id,host_unit.card_instance_id,p_expected_turn,
   loc.catalog_location_id,host_hp,host_hp),
 (p_lobby_id,m.guest_id,guest_unit.card_instance_id,p_expected_turn,
   loc.catalog_location_id,guest_hp,guest_hp);
 return pg_catalog.jsonb_build_object('status','initialized_hypothetical',
   'location_id',loc.catalog_location_id,'host_hp',host_hp,'guest_hp',guest_hp,
   'official_hp_changed',false);
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_hp(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_hp(uuid,integer) to authenticated;

create or replace function public.chaotic_apply_preview_hp_projection(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 dmg public.chaotic_preview_individual_damage;
 attack public.chaotic_preview_attack_instances;
 card public.chaotic_preview_attack_hand;
 unit_a public.chaotic_preview_hp_wallets;
 unit_d public.chaotic_preview_hp_wallets;
 remaining integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.current_player<>actor
  or m.turn_no<>p_expected_turn or actor not in (m.host_id,m.guest_id)
 then raise exception 'Turno ou participante não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 indisponível';end if;
 select * into dmg from public.chaotic_preview_individual_damage
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or dmg.attacker_id<>actor or dmg.defender_id not in(m.host_id,m.guest_id)
  or dmg.defender_id=actor or dmg.cost_status<>'test_spent'
  or dmg.calculation_status<>'partial_estimate'
  or dmg.preview_subtotal is null or dmg.preview_subtotal not between 0 and 1500
 then raise exception 'Dano ainda é indeterminado ou não foi pago no teste';end if;
 select * into attack from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or attack.actor_id<>actor
  or attack.attack_instance_id is distinct from dmg.attack_instance_id
  or attack.catalog_attack_id is distinct from dmg.catalog_attack_id
 then raise exception 'Ataque de teste não corresponde ao dano simulado';end if;
 select * into card from public.chaotic_preview_attack_hand
  where lobby_id=p_lobby_id and actor_id=actor
  and attack_instance_id=attack.attack_instance_id;
 if not found or card.card_state<>'spent' or card.spent_reason<>'attack'
  or card.spent_turn<>p_expected_turn
 then raise exception 'Carta não foi paga nesta vez';end if;
 if exists(select 1 from public.chaotic_preview_hp_events
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Dano de teste já acumulado neste turno';end if;
 select * into unit_a from public.chaotic_preview_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor;
 select * into unit_d from public.chaotic_preview_hp_wallets
  where lobby_id=p_lobby_id and actor_id=dmg.defender_id for update;
 if unit_a.creature_instance_id is distinct from dmg.attacker_instance_id
  or unit_d.creature_instance_id is distinct from dmg.defender_instance_id
  or unit_a.location_id is distinct from unit_d.location_id
  or unit_d.location_id is distinct from dmg.location_id
  or unit_a.hp_remaining<=0 or unit_d.hp_remaining<=0
 then raise exception 'HP de teste não corresponde às criaturas/Local ou já está zerado';end if;
 remaining:=public.chaotic_preview_hp_remainder(unit_d.hp_remaining,dmg.preview_subtotal);
 update public.chaotic_preview_hp_wallets
  set hp_remaining=remaining,projected_hits=projected_hits+1
  where lobby_id=p_lobby_id and actor_id=dmg.defender_id;
 insert into public.chaotic_preview_hp_events
 (lobby_id,turn_no,attacker_id,victim_id,attack_instance_id,victim_creature_instance_id,
  hp_before,hp_after,indicative_damage,hypothetical_applied_damage)
 values (p_lobby_id,p_expected_turn,actor,dmg.defender_id,dmg.attack_instance_id,
  dmg.defender_instance_id,unit_d.hp_remaining,remaining,dmg.preview_subtotal,
  unit_d.hp_remaining-remaining);
 return pg_catalog.jsonb_build_object('projection','hypothetical_partial_damage',
  'turn_no',p_expected_turn,'victim_id',dmg.defender_id,
  'hp_before',unit_d.hp_remaining,'hp_after',remaining,
  'indicative_damage',dmg.preview_subtotal,
  'hypothetical_applied_damage',unit_d.hp_remaining-remaining,
  'official_hp_changed',false,'final_damage_verified',false);
end;
$fn$;
revoke all on function public.chaotic_apply_preview_hp_projection(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_hp_projection(uuid,integer)
 to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_hp_wallets') then
  alter publication supabase_realtime add table public.chaotic_preview_hp_wallets;
 end if;
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_hp_events') then
  alter publication supabase_realtime add table public.chaotic_preview_hp_events;
 end if;
end $$;
