-- Permitir atualizações em tempo real do histórico de uma sala privada.
-- Leitura apenas pelos participantes, protegida pelas políticas RLS existentes.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='chaotic_match_events') then
    alter publication supabase_realtime add table public.chaotic_match_events;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='chaotic_combat_declarations') then
    alter publication supabase_realtime add table public.chaotic_combat_declarations;
  end if;
end $$;
