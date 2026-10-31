-- v0.1.83: borrowed 105 can KO a creature without modifying the original 105 KO FK path.
alter table public.chaotic_preview_3x3_borrowed_105_base_events
 drop constraint chaotic_preview_3x3_borrowed_105_base_events_hp_before_check,
 drop constraint chaotic_preview_3x3_borrowed_105_base_events_check1;
alter table public.chaotic_preview_3x3_borrowed_105_base_events
 add constraint chaotic_preview_3x3_borrowed_105_base_events_hp_before_check
  check(hp_before between 1 and 500),
 add constraint chaotic_preview_3x3_borrowed_105_base_events_nonnegative_hp_check
  check(hp_after=greatest(0,hp_before-5) and hp_after between 0 and 499);
create table public.chaotic_preview_3x3_borrowed_105_knockouts (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 borrower_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 defender_creature_instance_id text not null check(length(defender_creature_instance_id) between 1 and 48),
 defender_creature_name text not null,
 custody_id uuid not null references public.chaotic_preview_3x3_temporary_card_custody(id),
 catalog_attack_id text not null default '105' check(catalog_attack_id='105'),
 hp_before integer not null check(hp_before between 1 and 5),
 hp_after integer not null default 0 check(hp_after=0),
 training_only boolean not null default true check(training_only),
 optional_reveal_applied boolean not null default false check(not optional_reveal_applied),
 original_owner_changed boolean not null default false check(not original_owner_changed),
 official_hp_changed boolean not null default false check(not official_hp_changed),
 official_match_modified boolean not null default false check(not official_match_modified),
 occurred_at timestamptz not null default now(),
 primary key(lobby_id,defender_id,defender_slot),
 unique(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
  public.chaotic_preview_3x3_borrowed_105_plans(lobby_id,turn_no)
  on delete cascade,
 check(borrower_id<>defender_id)
);
alter table public.chaotic_preview_3x3_borrowed_105_knockouts enable row level security;
revoke all on public.chaotic_preview_3x3_borrowed_105_knockouts
 from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_borrowed_105_knockouts to authenticated;
create policy chaotic_borrowed_105_knockouts_members_read
 on public.chaotic_preview_3x3_borrowed_105_knockouts
 for select to authenticated using (
  (select auth.uid())=borrower_id or (select auth.uid())=defender_id
 );