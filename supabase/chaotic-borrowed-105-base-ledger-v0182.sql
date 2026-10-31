-- v0.1.82: strictly scoped base-only training settlement, never official.
-- A borrowed card is either fully resolved with cost+HP or not charged at all.
alter table public.chaotic_preview_3x3_borrowed_105_plans
 drop constraint chaotic_preview_3x3_borrowed_105_plans_state_check,
 drop constraint chaotic_preview_3x3_borrowed_105_plans_payment_applied_check,
 drop constraint chaotic_preview_3x3_borrowed_105_plans_damage_applied_check;
alter table public.chaotic_preview_3x3_borrowed_105_plans
 add constraint chaotic_preview_3x3_borrowed_105_plans_state_check check(
  state in('planned','awaiting_defender','defender_passed_preview','cancelled',
           'base_resolved_no_optional_reveal')),
 add constraint chaotic_preview_3x3_borrowed_105_plans_settlement_consistency check(
  (state='base_resolved_no_optional_reveal' and payment_applied and damage_applied)
  or (state<>'base_resolved_no_optional_reveal' and not payment_applied and not damage_applied));
alter table public.chaotic_preview_3x3_borrowed_105_plans
 add column settled_at timestamptz,
 add constraint chaotic_preview_3x3_borrowed_105_settled_time check(
  (state='base_resolved_no_optional_reveal')=(settled_at is not null));
-- Replace priority consistency only to allow the new settled state.
alter table public.chaotic_preview_3x3_borrowed_105_plans
 drop constraint chaotic_preview_3x3_borrowed_105_priority_consistency,
 add constraint chaotic_preview_3x3_borrowed_105_priority_consistency check (
  (state='planned' and priority_opened_at is null and defender_passed_at is null)
  or (state='awaiting_defender' and priority_opened_at is not null and defender_passed_at is null)
  or (state in('defender_passed_preview','base_resolved_no_optional_reveal')
     and priority_opened_at is not null and defender_passed_at is not null)
  or state='cancelled');
create table public.chaotic_preview_3x3_borrowed_105_base_events(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 borrower_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 custody_id uuid not null references public.chaotic_preview_3x3_temporary_card_custody(id),
 attack_name text not null default 'Vento Forte' check(attack_name='Vento Forte'),
 attack_cost integer not null default 1 check(attack_cost=1),
 base_damage integer not null default 5 check(base_damage=5),
 points_before integer not null check(points_before between 1 and 65),
 points_after integer not null check(points_after=points_before-1),
 hp_before integer not null check(hp_before between 6 and 500),
 hp_after integer not null check(hp_after=hp_before-5 and hp_after>0),
 training_only boolean not null default true check(training_only),
 optional_reveal_applied boolean not null default false check(not optional_reveal_applied),
 original_owner_changed boolean not null default false check(not original_owner_changed),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
  references public.chaotic_preview_3x3_borrowed_105_plans(lobby_id,turn_no)
  on delete cascade,
 unique(custody_id),
 check(borrower_id<>defender_id)
);
alter table public.chaotic_preview_3x3_borrowed_105_base_events enable row level security;
revoke all on public.chaotic_preview_3x3_borrowed_105_base_events from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_borrowed_105_base_events to authenticated;
create policy chaotic_preview_3x3_borrowed_105_base_members
 on public.chaotic_preview_3x3_borrowed_105_base_events
 for select to authenticated using ((select auth.uid())=borrower_id
  or (select auth.uid())=defender_id);
