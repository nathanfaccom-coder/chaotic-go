-- Protect the declared combat action from post-insert rewriting.
-- Historical declarations remain untouched; this only rejects future mutations.
-- Prevents changing a validated creature into an attack, or swapping its deck
-- after the insert-only turn/deck guards have already run.
-- No rewards, wins, XP or currency are calculated by this migration.
create or replace function public.chaotic_guard_combat_declaration_payload_immutability()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind
     or new.deck_slot is distinct from old.deck_slot then
    raise exception 'Tipo e deck da declaração de combate são imutáveis'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists chaotic_combat_declaration_payload_immutability
  on public.chaotic_combat_declarations;
create trigger chaotic_combat_declaration_payload_immutability
before update of kind, deck_slot on public.chaotic_combat_declarations
for each row execute function public.chaotic_guard_combat_declaration_payload_immutability();
