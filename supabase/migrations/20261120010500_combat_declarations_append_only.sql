-- Combat declarations are server-issued evidence, never editable records.
-- Additive migration: existing rows remain intact; no economy or rewards touched.
-- UPDATE is forbidden even for columns added in future migrations.
-- The existing foreign-key ON DELETE CASCADE remains available for lobby cleanup.
create or replace function public.chaotic_reject_combat_declaration_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Declarações de combate são registros imutáveis'
    using errcode = '23514';
end;
$$;

drop trigger if exists chaotic_combat_declarations_append_only
  on public.chaotic_combat_declarations;
create trigger chaotic_combat_declarations_append_only
before update on public.chaotic_combat_declarations
for each row
execute function public.chaotic_reject_combat_declaration_update();

revoke all on function public.chaotic_reject_combat_declaration_update()
  from public, anon, authenticated;
