-- Chaotic GO — esquema independente, sem afetar as tabelas de outros jogos.
-- Executar no SQL Editor do projeto Supabase destinado ao Chaotic GO.
-- Nunca usar uma chave service_role no frontend.
create table if not exists public.chaotic_player_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  album jsonb not null default '[]'::jsonb,
  profile jsonb not null default '{}'::jsonb,
  friends jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chaotic_album_array check (jsonb_typeof(album) = 'array'),
  constraint chaotic_profile_object check (jsonb_typeof(profile) = 'object'),
  constraint chaotic_friends_array check (jsonb_typeof(friends) = 'array')
);
alter table public.chaotic_player_state enable row level security;
revoke all on table public.chaotic_player_state from public, anon, authenticated;
grant select, insert, update on table public.chaotic_player_state to authenticated;

drop policy if exists "chaotic_select_own" on public.chaotic_player_state;
create policy "chaotic_select_own"
on public.chaotic_player_state for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "chaotic_insert_own" on public.chaotic_player_state;
create policy "chaotic_insert_own"
on public.chaotic_player_state for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "chaotic_update_own" on public.chaotic_player_state;
create policy "chaotic_update_own"
on public.chaotic_player_state for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
