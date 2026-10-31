create table if not exists public.chaotic_preview_3x3_borrowed_105_plans(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 borrower_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 custody_id uuid not null references public.chaotic_preview_3x3_temporary_card_custody(id),
 attacker_slot smallint not null check(attacker_slot between 4 and 6),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 points_available integer not null check(points_available between 1 and 65),
 hp_before integer not null check(hp_before between 1 and 500),
 hp_base_after integer not null check(hp_base_after=greatest(0,hp_before-5)),
 state text not null default 'planned' check(state in('planned','cancelled')),
 payment_applied boolean not null default false check(not payment_applied),
 damage_applied boolean not null default false check(not damage_applied),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_3x3_contact_intents(lobby_id,turn_no) on delete cascade,
 check(borrower_id<>defender_id)
);
alter table public.chaotic_preview_3x3_borrowed_105_plans enable row level security;
revoke all on public.chaotic_preview_3x3_borrowed_105_plans from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_borrowed_105_plans to authenticated;
create policy chaotic_preview_3x3_105_plans_private on public.chaotic_preview_3x3_borrowed_105_plans
for select to authenticated using (borrower_id=(select auth.uid()));