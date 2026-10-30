-- Chaotic GO: propagação em tempo real de coleções privadas e salas de teste.
-- O RLS das tabelas permanece responsável por filtrar dados dos participantes.
do $$
begin
  if not exists (select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public'
       and tablename='chaotic_game_nodes') then
    alter publication supabase_realtime add table public.chaotic_game_nodes;
  end if;
  if not exists (select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public'
       and tablename='chaotic_lobbies') then
    alter publication supabase_realtime add table public.chaotic_lobbies;
  end if;
  if not exists (select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public'
       and tablename='chaotic_match_turns') then
    alter publication supabase_realtime add table public.chaotic_match_turns;
  end if;
end $$;
