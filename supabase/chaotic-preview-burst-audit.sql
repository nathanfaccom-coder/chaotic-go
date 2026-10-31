-- v0.1.20: append status of the defender's response window to the damage audit.
-- A pass never eliminates burst_unresolved and never certifies final damage.
create or replace function public.chaotic_audit_preview_damage(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_resolution_audits
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 dmg public.chaotic_preview_individual_damage;
 atk public.chaotic_preview_attack_instances;
 clash public.chaotic_preview_clashes;
 hand_card public.chaotic_preview_attack_hand;
 offensive public.chaotic_preview_loadouts;
 defensive public.chaotic_preview_loadouts;
 codes text[];
 win public.chaotic_preview_burst_windows;
 result public.chaotic_preview_resolution_audits;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.current_player<>actor
  or m.turn_no<>p_expected_turn or actor not in(m.host_id,m.guest_id) then
  raise exception 'Turno ou jogador não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
  raise exception 'Sala 1x1 inválida';end if;
 select * into dmg from public.chaotic_preview_individual_damage
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into atk from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into clash from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if dmg.attacker_id is distinct from actor or
   dmg.defender_id not in(m.host_id,m.guest_id) or
   dmg.defender_id=actor or dmg.cost_status is distinct from 'test_spent'
   or atk.actor_id is distinct from actor
   or atk.attack_instance_id is distinct from dmg.attack_instance_id
   or atk.catalog_attack_id is distinct from dmg.catalog_attack_id
   or clash.attacker_id is distinct from actor
   or clash.defender_id is distinct from dmg.defender_id
   or clash.attack_card is distinct from dmg.attack_instance_id
 then raise exception 'Ataque, dano e pagamento devem corresponder ao confronto';end if;
 select * into hand_card from public.chaotic_preview_attack_hand h
   where h.lobby_id=p_lobby_id and h.actor_id=actor
    and h.card_slot=atk.card_slot and h.attack_instance_id=atk.attack_instance_id;
 if not found or hand_card.card_state<>'spent' or
   hand_card.spent_reason<>'attack' or hand_card.spent_turn<>p_expected_turn then
  raise exception 'Carta não foi paga nesta vez de teste';end if;
 select * into offensive from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 select * into defensive from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=dmg.defender_id;
 if offensive.card_instance_id is distinct from dmg.attacker_instance_id
   or defensive.card_instance_id is distinct from dmg.defender_instance_id then
  raise exception 'Criaturas não correspondem ao DNA do confronto';end if;
 if exists(select 1 from public.chaotic_preview_resolution_audits
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
  raise exception 'Auditoria já registrada';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference
   where kind='attack' and card_id=atk.catalog_attack_id) then
  raise exception 'Ataque fora do catálogo original';end if;
 codes:=public.chaotic_preview_resolution_blockers(
  atk.catalog_attack_id,offensive.creature_name,defensive.creature_name,
  offensive.equipment_name,defensive.equipment_name,dmg.location_id,
  dmg.calculation_status,dmg.preview_subtotal);
 select * into win from public.chaotic_preview_burst_windows
   where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found then
   codes:=array_append(codes,'burst_window_not_opened');
 elsif win.attacker_id is distinct from actor
   or win.defender_id is distinct from dmg.defender_id
   or win.attack_instance_id is distinct from dmg.attack_instance_id then
   raise exception 'Janela Burst incompatível com o confronto';
 elsif win.status='awaiting_defender' then
   codes:=array_append(codes,'burst_defender_response_pending');
 else
   -- A defensive PASS is verified, but the Burst stack is still not resolved:
   -- abilities, equipment and server-side counters are not migrated.
   codes:=array_append(codes,'burst_defender_passed_preview_only');
 end if;
 insert into public.chaotic_preview_resolution_audits(
  lobby_id,turn_no,actor_id,victim_id,attack_instance_id,catalog_attack_id,
  blocker_codes,damage_status
 ) values(
  p_lobby_id,p_expected_turn,actor,dmg.defender_id,dmg.attack_instance_id,
  dmg.catalog_attack_id,codes,dmg.calculation_status
 ) returning * into result;
 return result;
end;
$fn$;

revoke all on function public.chaotic_audit_preview_damage(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_audit_preview_damage(uuid,integer)
 to authenticated;