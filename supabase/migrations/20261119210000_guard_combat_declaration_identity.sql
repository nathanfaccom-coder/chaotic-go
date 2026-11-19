-- Prevent retargeting an already recorded combat declaration to another
-- lobby, actor, turn or timestamp. This does not modify existing rows.
create or replace function public.chaotic_guard_combat_declaration_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lobby_id is distinct from old.lobby_id
     or new.turn_no is distinct from old.turn_no
     or new.actor_id is distinct from old.actor_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Identidade e turno da declaração de combate são imutáveis'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists chaotic_combat_declaration_identity_immutability
  on public.chaotic_combat_declarations;
create trigger chaotic_combat_declaration_identity_immutability
before update of lobby_id, turn_no, actor_id, created_at
on public.chaotic_combat_declarations
for each row
execute function public.chaotic_guard_combat_declaration_identity();
