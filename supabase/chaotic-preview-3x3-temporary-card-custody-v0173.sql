-- Chaotic GO v0.1.73: PRIVATE training-only custody foundation for Mão Negra (102).
-- Preparation ONLY. Never grant 102 payment until stolen attacks can be played
-- through the authenticated cost/projection/spend/hand lifecycle.
create table if not exists public.chaotic_preview_3x3_temporary_card_custody(
 id uuid primary key default gen_random_uuid(),
 lobby_id uuid not null references public.chaotic_lobbies(id) on delete cascade,
 source_actor_id uuid not null,
 borrower_id uuid not null,
 source_card_slot smallint not null check(source_card_slot between 1 and 20),
 source_attack_instance_id text not null check(length(source_attack_instance_id) between 1 and 48),
 catalog_attack_id text not null check(catalog_attack_id ~ '^1(0[1-9]|1[0-5])$'),
 granted_turn integer not null check(granted_turn between 1 and 120),
 custody_state text not null default 'reserved' check(custody_state in('reserved','held','used','released')),
 training_only boolean not null default true check(training_only),
 created_at timestamptz not null default now(),
 released_turn integer check(released_turn between 1 and 120),
 constraint chaotic_preview_3x3_custody_other_player check(source_actor_id<>borrower_id),
 constraint chaotic_preview_3x3_custody_release_consistency check(
  (custody_state='released' and released_turn is not null)
  or (custody_state<>'released' and released_turn is null))
);
create unique index if not exists chaotic_preview_3x3_custody_one_active_per_source
on public.chaotic_preview_3x3_temporary_card_custody(lobby_id,source_actor_id,source_card_slot)
where custody_state in('reserved','held');
create index if not exists chaotic_preview_3x3_custody_borrower_lookup
on public.chaotic_preview_3x3_temporary_card_custody(lobby_id,borrower_id,custody_state);
alter table public.chaotic_preview_3x3_temporary_card_custody enable row level security;
revoke all on public.chaotic_preview_3x3_temporary_card_custody from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_temporary_card_custody to authenticated;
create policy chaotic_preview_3x3_custody_private_participants
on public.chaotic_preview_3x3_temporary_card_custody
for select to authenticated
using (
 (select auth.uid()) in(source_actor_id,borrower_id)
 and exists(select 1 from public.chaotic_match_turns m
  where m.lobby_id=lobby_id
    and m.host_id in(source_actor_id,borrower_id)
    and m.guest_id in(source_actor_id,borrower_id))
);
-- No INSERT/UPDATE/DELETE policy or privilege: the browser cannot create,
-- assign, steal or restore cards. The table is dormant until a separately
-- verified, server-authorized 102 resolution and card-use path is implemented.
