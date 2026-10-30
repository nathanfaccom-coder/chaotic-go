-- v0.1.24: apply three canonical equipment reveal effects to an isolated
-- 1x1 TRAINING ledger, after defender PASS and a server-prepared LIFO plan.
-- Never touch original DNA, official HP, inventory, XP, match result or prizes.

create or replace function public.chaotic_preview_reveal_equipment_effect(
 p_equipment_name text,p_hp integer,p_hp_max integer,p_wisdom integer
) returns jsonb
language plpgsql immutable security invoker set search_path=''
as $fn$
declare key text:=pg_catalog.lower(pg_catalog.btrim(coalesce(p_equipment_name,'')));
begin
 if p_hp is null or p_hp_max is null or p_wisdom is null
   or p_hp not between 0 and 550 or p_hp_max not between 1 and 550
   or p_hp>p_hp_max or p_wisdom not between 0 and 999
 then raise exception 'Estado experimental de criatura inválido';end if;
 if key='anel precioso' then
   return pg_catalog.jsonb_build_object('effect_code','precious_ring_hp',
    'hp_after',greatest(0,p_hp-15),'hp_max_after',p_hp_max,
    'wisdom_after',p_wisdom,'supported',true);
 elsif key in('bastão da sabedoria','bastao da sabedoria') then
   return pg_catalog.jsonb_build_object('effect_code','wisdom_staff',
    'hp_after',p_hp,'hp_max_after',p_hp_max,
    'wisdom_after',p_wisdom+40,'supported',true);
 elsif key='bomba de fogo' then
   if p_hp_max>545 then raise exception 'HP máximo ultrapassa limite do teste';end if;
   return pg_catalog.jsonb_build_object('effect_code','fire_bomb_hp',
    'hp_after',p_hp+5,'hp_max_after',p_hp_max+5,
    'wisdom_after',p_wisdom,'supported',true);
 end if;
 raise exception 'Efeito ainda não implementado no motor de treinamento: %',p_equipment_name;
end;
$fn$;
revoke all on function public.chaotic_preview_reveal_equipment_effect(text,integer,integer,integer)
 from public,anon,authenticated;

create table if not exists public.chaotic_preview_burst_equipment_effects (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 equipment_instance_id text not null check(length(equipment_instance_id) between 1 and 48),
 equipment_name text not null check(length(equipment_name) between 1 and 120),
 effect_code text not null check(effect_code in
   ('precious_ring_hp','wisdom_staff','fire_bomb_hp')),
 hp_before integer not null check(hp_before between 0 and 550),
 hp_after integer not null check(hp_after between 0 and 550),
 hp_max_before integer not null check(hp_max_before between 1 and 550),
 hp_max_after integer not null check(hp_max_after between 1 and 550),
 wisdom_before integer not null check(wisdom_before between 0 and 999),
 wisdom_after integer not null check(wisdom_after between 0 and 1039),
 resolution_status text not null default 'training_ledger_applied'
  check(resolution_status='training_ledger_applied'),
 applied_to_training_ledger boolean not null default true
  check(applied_to_training_ledger=true),
 applied_to_official_match boolean not null default false
  check(applied_to_official_match=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 final_damage_verified boolean not null default false check(final_damage_verified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 unique(lobby_id,defender_id,equipment_instance_id),
 foreign key(lobby_id,turn_no)
  references public.chaotic_preview_burst_equipment_responses(lobby_id,turn_no)
   on delete cascade,
 foreign key(lobby_id,defender_id)
  references public.chaotic_preview_hp_wallets(lobby_id,actor_id)
   on delete cascade,
 check(attacker_id<>defender_id),
 check(hp_after<=hp_max_after),
 check(
  (effect_code='precious_ring_hp' and hp_after=greatest(0,hp_before-15)
     and hp_max_after=hp_max_before and wisdom_after=wisdom_before)
  or (effect_code='wisdom_staff' and hp_after=hp_before
     and hp_max_after=hp_max_before and wisdom_after=wisdom_before+40)
  or (effect_code='fire_bomb_hp' and hp_after=hp_before+5
     and hp_max_after=hp_max_before+5 and wisdom_after=wisdom_before)
 )
);
alter table public.chaotic_preview_burst_equipment_effects enable row level security;
revoke all on public.chaotic_preview_burst_equipment_effects from public,anon,authenticated;
grant select on public.chaotic_preview_burst_equipment_effects to authenticated;
drop policy if exists chaotic_burst_equipment_effects_members
 on public.chaotic_preview_burst_equipment_effects;
create policy chaotic_burst_equipment_effects_members
 on public.chaotic_preview_burst_equipment_effects for select to authenticated using(
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_burst_equipment_effects.lobby_id
    and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_apply_preview_burst_equipment_effect(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_equipment_effects
language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_burst_windows;
 q public.chaotic_preview_burst_equipment_responses;
 plan public.chaotic_preview_burst_order_plans;
 unit public.chaotic_preview_loadouts;
 wallet public.chaotic_preview_hp_wallets;
 result public.chaotic_preview_burst_equipment_effects;
 eff jsonb;
 prev_wisdom integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player<>actor or actor not in(m.host_id,m.guest_id)
 then raise exception 'Apenas atacante atual pode executar a etapa do teste';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 inválida';end if;
 select * into w from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into q from public.chaotic_preview_burst_equipment_responses
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into plan from public.chaotic_preview_burst_order_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if w.attacker_id is distinct from actor or w.status<>'defender_passed'
  or w.defender_response<>'pass' or q.defender_id is distinct from w.defender_id
  or q.resolution_status<>'queued_unexecuted'
  or plan.attacker_id is distinct from actor
  or plan.defender_response<>'pass'
  or plan.inspection_step_count<>2
  or plan.inspection_steps->0->>'stage'<>'inspect_queued_equipment_reveal'
  or plan.inspection_steps->1->>'stage'<>'inspect_attack'
 then raise exception 'Burst ainda não passou por resposta e ordem de inspeção validadas';end if;
 if exists(select 1 from public.chaotic_preview_burst_equipment_effects
  where lobby_id=p_lobby_id and
   (turn_no=p_expected_turn or
     (defender_id=q.defender_id and equipment_instance_id=q.equipment_instance_id)))
 then raise exception 'Efeito de equipamento já foi usado neste teste';end if;
 select * into unit from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=q.defender_id;
 if unit.card_instance_id is distinct from q.creature_instance_id
  or unit.equipment_instance_id is distinct from q.equipment_instance_id
  or unit.equipment_name is distinct from q.equipment_name
 then raise exception 'Equipamento ou criatura mudou desde a declaração';end if;
 if exists(select 1 from public.chaotic_preview_equipment_reveals
  where lobby_id=p_lobby_id and actor_id=q.defender_id)
 then raise exception 'Equipamento já revelado no modo de teste';end if;
 select * into wallet from public.chaotic_preview_hp_wallets
  where lobby_id=p_lobby_id and actor_id=q.defender_id for update;
 if not found or wallet.creature_instance_id is distinct from q.creature_instance_id
 then raise exception 'Inicie o HP de treinamento das duas criaturas antes do efeito';end if;
 if pg_catalog.jsonb_typeof(unit.stats)<>'object'
  or coalesce(unit.stats->>'s','') !~ '^[0-9]{1,3}$'
 then raise exception 'Sabedoria de DNA inválida';end if;
 select coalesce((
  select e.wisdom_after
   from public.chaotic_preview_burst_equipment_effects e
   where e.lobby_id=p_lobby_id and e.defender_id=q.defender_id
   order by e.turn_no desc limit 1
 ),(unit.stats->>'s')::integer) into prev_wisdom;
 eff:=public.chaotic_preview_reveal_equipment_effect(
  q.equipment_name,wallet.hp_remaining,wallet.hp_max,prev_wisdom);
 update public.chaotic_preview_hp_wallets
  set hp_remaining=(eff->>'hp_after')::integer,
      hp_max=(eff->>'hp_max_after')::integer
  where lobby_id=p_lobby_id and actor_id=q.defender_id;
 insert into public.chaotic_preview_burst_equipment_effects(
  lobby_id,turn_no,attacker_id,defender_id,creature_instance_id,
  equipment_instance_id,equipment_name,effect_code,
  hp_before,hp_after,hp_max_before,hp_max_after,wisdom_before,wisdom_after
 ) values(
  p_lobby_id,p_expected_turn,actor,q.defender_id,q.creature_instance_id,
  q.equipment_instance_id,q.equipment_name,eff->>'effect_code',
  wallet.hp_remaining,(eff->>'hp_after')::integer,
  wallet.hp_max,(eff->>'hp_max_after')::integer,
  prev_wisdom,(eff->>'wisdom_after')::integer
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_apply_preview_burst_equipment_effect(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_burst_equipment_effect(uuid,integer)
 to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_burst_equipment_effects') then
  alter publication supabase_realtime
   add table public.chaotic_preview_burst_equipment_effects;
 end if;
end $$;
