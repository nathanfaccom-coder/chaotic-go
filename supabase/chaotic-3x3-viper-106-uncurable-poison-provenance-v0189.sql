-- Chaotic GO v0.1.89: source-backed Viper Trap (106) poison scaffolding.
-- IMPORTANT ORIGINAL RULE: attack 106 explicitly says its poison CANNOT be cured.
-- 206 Crystal Bracelet may cure other curable poison sources once implemented.
-- This table records provenance; it DOES NOT apply 5-HP ticks or activate a cure.
create table public.chaotic_preview_3x3_poison_statuses(
 lobby_id uuid not null,
 actor_id uuid not null references auth.users(id),
 position smallint not null check(position between 4 and 6),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 source_turn integer not null check(source_turn between 1 and 120),
 source_attacker_id uuid not null references auth.users(id),
 source_catalog_attack_id text not null default '106' check(source_catalog_attack_id='106'),
 poison_kind text not null default 'viper_uncurable'
  check(poison_kind='viper_uncurable'),
 poison_state text not null default 'pending_turn_tick_integration'
  check(poison_state='pending_turn_tick_integration'),
 base_energy_loss_per_victim_turn integer not null default 5
  check(base_energy_loss_per_victim_turn=5),
 next_tick_enabled boolean not null default false check(not next_tick_enabled),
 ticks_applied integer not null default 0 check(ticks_applied=0),
 curable boolean not null default false check(not curable),
 crystal_206_cure_allowed boolean not null default false check(not crystal_206_cure_allowed),
 poison_source_verified boolean not null default true check(poison_source_verified),
 official_match_modified boolean not null default false check(not official_match_modified),
 official_hp_changed boolean not null default false check(not official_hp_changed),
 recorded_at timestamptz not null default now(),
 primary key(lobby_id,actor_id,position),
 foreign key(lobby_id,actor_id,position) references
  public.chaotic_preview_3x3_hp_wallets(lobby_id,actor_id,position)
  on delete cascade,
 foreign key(lobby_id,source_turn) references
  public.chaotic_preview_3x3_training_damage_events(lobby_id,turn_no)
  on delete cascade,
 check(source_attacker_id<>actor_id)
);
alter table public.chaotic_preview_3x3_poison_statuses enable row level security;
revoke all on public.chaotic_preview_3x3_poison_statuses
 from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_poison_statuses to authenticated;
create policy chaotic_preview_3x3_poison_only_victim
 on public.chaotic_preview_3x3_poison_statuses
 for select to authenticated using((select auth.uid())=actor_id);

-- A forged 106 identifier or a victim from a different contact is never enough.
-- Verify a REAL paid and damaged 106 attack in the original 3x3 ledger.
create or replace function public.chaotic_guard_preview_3x3_poison_source()
returns trigger language plpgsql security definer set search_path=''
as $poison$
declare
 hit public.chaotic_preview_3x3_training_damage_events;
 spend public.chaotic_preview_3x3_attack_spends;
 hp public.chaotic_preview_3x3_hp_wallets;
 contact public.chaotic_preview_3x3_contact_intents;
 turn_row public.chaotic_match_turns;
begin
 if tg_op='UPDATE' or tg_op='DELETE'
 then raise exception 'Estado de veneno não pode ser alterado por esta via';end if;
 select * into turn_row from public.chaotic_match_turns
  where lobby_id=new.lobby_id for update;
 select * into hit from public.chaotic_preview_3x3_training_damage_events
  where lobby_id=new.lobby_id and turn_no=new.source_turn for update;
 select * into spend from public.chaotic_preview_3x3_attack_spends
  where lobby_id=new.lobby_id and turn_no=new.source_turn for update;
 select * into contact from public.chaotic_preview_3x3_contact_intents
  where lobby_id=new.lobby_id and turn_no=new.source_turn for update;
 select * into hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=new.lobby_id and actor_id=new.actor_id
    and position=new.position for update;
 if turn_row.lobby_id is null or turn_row.status<>'active'
  or new.actor_id not in(turn_row.host_id,turn_row.guest_id)
  or new.source_attacker_id not in(turn_row.host_id,turn_row.guest_id)
  or hit.lobby_id is null or spend.lobby_id is null or contact.lobby_id is null
  or new.source_turn<>turn_row.turn_no
  or hit.catalog_attack_id<>'106' or spend.catalog_attack_id<>'106'
  or not spend.training_points_paid or not spend.training_card_spent
  or not spend.training_damage_applied
  or spend.actor_id is distinct from new.source_attacker_id
  or hit.attacker_id is distinct from new.source_attacker_id
  or hit.defender_id is distinct from new.actor_id
  or hit.defender_slot is distinct from new.position
  or hit.attack_instance_id is distinct from spend.attack_instance_id
  or hit.damage_dealt<=0 or hit.hp_after<=0
  or hit.hp_after is distinct from hp.hp_remaining
  or contact.attacker_id is distinct from new.source_attacker_id
  or contact.defender_id is distinct from new.actor_id
  or contact.defender_slot is distinct from new.position
  or contact.defender_creature_instance_id is distinct from new.creature_instance_id
  or hp.creature_instance_id is distinct from new.creature_instance_id
  or hp.hp_remaining<=0
  or hit.official_match_modified or hit.official_hp_changed
  or spend.official_match_modified or spend.official_hp_changed
  or exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
    where o.lobby_id=new.lobby_id)
 then raise exception 'Veneno 106 requer dano real e criatura viva no treino ativo';end if;
 return new;
end;
$poison$;
revoke all on function public.chaotic_guard_preview_3x3_poison_source()
 from public,anon,authenticated;
create trigger chaotic_preview_3x3_poison_source_required
 before insert or update or delete on public.chaotic_preview_3x3_poison_statuses
 for each row execute function public.chaotic_guard_preview_3x3_poison_source();
