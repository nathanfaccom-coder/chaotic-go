-- Keep a combatant's attack tied to the deck used for their selected creature.
-- Applies only to new declarations; does not rewrite historical training data.
-- No damage, victory, XP or coins are awarded by this guard.
create or replace function public.chaotic_guard_attack_deck_consistency()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_creature_deck_slot smallint;
begin
  if new.kind = 'attack' then
    select d.deck_slot into v_creature_deck_slot
    from public.chaotic_combat_declarations d
    where d.lobby_id = new.lobby_id
      and d.actor_id = new.actor_id
      and d.kind = 'creature'
    order by d.turn_no desc limit 1;
    if v_creature_deck_slot is null
       or new.deck_slot is distinct from v_creature_deck_slot then
      raise exception 'Ataque deve usar o mesmo deck da criatura selecionada'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists chaotic_attack_deck_consistency on public.chaotic_combat_declarations;
create trigger chaotic_attack_deck_consistency
before insert on public.chaotic_combat_declarations
for each row execute function public.chaotic_guard_attack_deck_consistency();
