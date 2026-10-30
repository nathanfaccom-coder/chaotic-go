-- Chaotic GO: progresso privado dos módulos do jogo completo (inclusive Decks).
-- Isolamento por usuário; nunca permitir acesso anônimo ou gravação em conta alheia.
create table if not exists public.chaotic_game_nodes (
  user_id uuid not null references auth.users(id) on delete cascade,
  node_path text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, node_path),
  constraint chaotic_game_nodes_path_len check (length(node_path) between 1 and 150)
);
alter table public.chaotic_game_nodes enable row level security;
revoke all on public.chaotic_game_nodes from public, anon, authenticated;
grant select, insert, update, delete on public.chaotic_game_nodes to authenticated;
create policy "chaotic_nodes_select_owner" on public.chaotic_game_nodes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chaotic_nodes_insert_owner" on public.chaotic_game_nodes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chaotic_nodes_update_owner" on public.chaotic_game_nodes
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "chaotic_nodes_delete_owner" on public.chaotic_game_nodes
  for delete to authenticated using ((select auth.uid()) = user_id);
