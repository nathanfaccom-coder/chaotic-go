-- Chaotic GO v0.1.47 — server-generated training knockouts and 3-creature team outcome.
-- Runs ONLY when the already-authorized Vento Forte (105) training HP settles.
-- Does not remove cards, end the official game, change XP/currency, or award victories.

create table public.chaotic_preview_3x3_training_knockouts (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 defender_creature_instance_id text not null check(length(defender_creature_instance_id) between 1 and 48),
 defender_creature_name text not null,
 attack_instance_id text not null,
 catalog_attack_id text not null default '105' check(catalog_attack_id='105'),
 hp_before integer not null check(hp_before between 1 and 5),
 hp_after integer not null default 0 check(hp_after=0),
 training_only boolean not null default true check(training_only),
 official_hp_changed boolean not null default false check(not official_hp_changed),
 official_match_modified boolean not null default false check(not official_match_modified),
 occurred_at timestamptz not null default now(),
 primary key(lobby_id,defender_id,defender_slot),
 unique(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
   public.chaotic_preview_3x3_defense_windows(lobby_id,turn_no) on delete cascade,
 foreign key(lobby_id,defender_id,defender_slot) references
   public.chaotic_preview_3x3_hp_wallets(lobby_id,actor_id,position) on delete cascade,
 check(attacker_id<>defender_id)
);
alter table public.chaotic_preview_3x3_training_knockouts enable row level security;
revoke all on public.chaotic_preview_3x3_training_knockouts from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_training_knockouts to authenticated;
create policy chaotic_preview_3x3_training_knockouts_members_read
 on public.chaotic_preview_3x3_training_knockouts for select to authenticated
 using(exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_training_knockouts.lobby_id
 and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id)));

create table public.chaotic_preview_3x3_training_outcomes (
 lobby_id uuid primary key references public.chaotic_match_turns(lobby_id) on delete cascade,
 decided_turn integer not null check(decided_turn between 1 and 120),
 winner_id uuid not null references auth.users(id),
 defeated_id uuid not null references auth.users(id),
 defeated_team_size smallint not null default 3 check(defeated_team_size=3),
 outcome_scope text not null default 'training_only_no_official_victory'
  check(outcome_scope='training_only_no_official_victory'),
 official_match_ended boolean not null default false check(not official_match_ended),
 official_match_modified boolean not null default false check(not official_match_modified),
 experience_awarded boolean not null default false check(not experience_awarded),
 currency_awarded boolean not null default false check(not currency_awarded),
 created_at timestamptz not null default now(),
 foreign key(lobby_id,decided_turn)
  references public.chaotic_preview_3x3_defense_windows(lobby_id,turn_no) on delete cascade,
 check(winner_id<>defeated_id)
);
alter table public.chaotic_preview_3x3_training_outcomes enable row level security;
revoke all on public.chaotic_preview_3x3_training_outcomes from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_training_outcomes to authenticated;
create policy chaotic_preview_3x3_training_outcomes_members_read
 on public.chaotic_preview_3x3_training_outcomes for select to authenticated
 using(exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_training_outcomes.lobby_id
 and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id)));

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
 or paid.catalog_attack_id<>'105'
 or paid.attack_instance_id is distinct from w.attack_instance_id
 or not paid.training_points_paid or not paid.training_card_spent
 or paid.training_damage_applied
 or old.creature_instance_id is distinct from new.creature_instance_id
 or old.creature_name is distinct from new.creature_name
 or old.hp_max is distinct from new.hp_max
 or new.hp_remaining is distinct from greatest(0,old.hp_remaining-5)
 or new.damage_events is distinct from old.damage_events+1
 then raise exception 'Nocaute 3x3 deve resultar do dano-base validado de Vento Forte';end if;

 insert into public.chaotic_preview_3x3_training_knockouts(
  lobby_id,turn_no,attacker_id,defender_id,defender_slot,
  defender_creature_instance_id,defender_creature_name,attack_instance_id,hp_before
 ) values(
  new.lobby_id,m.turn_no,actor,new.actor_id,new.position,
  new.creature_instance_id,new.creature_name,w.attack_instance_id,old.hp_remaining
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
revoke all on function public.chaotic_record_preview_3x3_training_knockout()
 from public,anon,authenticated;
create trigger chaotic_preview_3x3_training_knockout_after_hp
 after update of hp_remaining on public.chaotic_preview_3x3_hp_wallets
 for each row when(old.hp_remaining>0 and new.hp_remaining=0)
 execute function public.chaotic_record_preview_3x3_training_knockout();

do $pub$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
  and schemaname='public' and tablename='chaotic_preview_3x3_training_knockouts')
 then alter publication supabase_realtime
  add table public.chaotic_preview_3x3_training_knockouts;end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
  and schemaname='public' and tablename='chaotic_preview_3x3_training_outcomes')
 then alter publication supabase_realtime
  add table public.chaotic_preview_3x3_training_outcomes;end if;
end $pub$;