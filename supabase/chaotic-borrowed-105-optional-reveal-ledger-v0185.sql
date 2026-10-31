-- Chaotic GO 0.1.85: optional original Vento Forte reveal for a PAID borrowed 105.
-- Independent of the original owned 105 reveal event; no replay or card loss.
create table public.chaotic_preview_3x3_borrowed_105_reveal_events(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 revealed_slot smallint check(revealed_slot between 4 and 6),
 skipped boolean not null,
 training_only boolean not null default true check(training_only),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
   references public.chaotic_preview_3x3_borrowed_105_base_events(lobby_id,turn_no)
   on delete cascade,
 check((skipped and revealed_slot is null) or
       (not skipped and revealed_slot is not null)),
 check(attacker_id<>defender_id)
);
alter table public.chaotic_preview_3x3_borrowed_105_reveal_events enable row level security;
revoke all on public.chaotic_preview_3x3_borrowed_105_reveal_events from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_borrowed_105_reveal_events to authenticated;
create policy chaotic_3x3_borrowed_105_reveal_members
 on public.chaotic_preview_3x3_borrowed_105_reveal_events
 for select to authenticated
 using ((select auth.uid())=attacker_id or (select auth.uid())=defender_id);
