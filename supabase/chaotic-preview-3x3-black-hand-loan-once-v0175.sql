-- v0.1.75: a released stolen card cannot be borrowed twice in same turn.
create unique index if not exists chaotic_preview_3x3_custody_one_loan_per_borrower_turn
on public.chaotic_preview_3x3_temporary_card_custody(lobby_id,borrower_id,granted_turn);
CREATE OR REPLACE FUNCTION public.chaotic_internal_hold_preview_3x3_black_hand(p_lobby_id uuid, p_expected_turn integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 contact public.chaotic_preview_3x3_contact_intents;
 projection public.chaotic_preview_3x3_attack_projections;
 paid public.chaotic_preview_3x3_attack_spends;
 own_wallet public.chaotic_preview_3x3_attack_wallets;
 their_wallet public.chaotic_preview_3x3_attack_wallets;
 victim public.chaotic_preview_3x3_attack_hand;
 original_album jsonb;
 album_records jsonb;
 original_card jsonb;
 found_count integer;
 catalog text;
 held_count integer;
 our_hand_count integer;
 borrowed_id uuid;
begin
 if actor is null or p_lobby_id is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno do empréstimo inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null or m.status<>'active'
  or m.turn_no<>p_expected_turn or m.current_player is distinct from actor
  or actor not in(m.host_id,m.guest_id) or l.mode<>'3x3' or l.status<>'ready'
  or l.expires_at<=pg_catalog.statement_timestamp()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Mão Negra reservada ao atacante da sala 3x3 no turno atual';end if;
 select * into contact from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into projection from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into paid from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if contact.lobby_id is null or projection.lobby_id is null or paid.lobby_id is null
  or contact.attacker_id is distinct from actor
  or contact.defender_id is distinct from (case when actor=m.host_id then m.guest_id else m.host_id end)
  or projection.actor_id is distinct from actor
  or projection.defender_id is distinct from contact.defender_id
  or projection.catalog_attack_id<>'102' or projection.attack_name<>'Mão Negra'
  or projection.attack_cost<>0 or projection.base_damage<>0
  or paid.actor_id is distinct from actor
  or paid.catalog_attack_id<>'102' or paid.training_attack_cost<>0
  or paid.attack_instance_id is distinct from projection.attack_instance_id
  or not paid.training_points_paid or not paid.training_card_spent
  or paid.training_damage_applied
 then raise exception 'Mão Negra não foi paga e validada de modo íntegro';end if;
 if exists(select 1 from public.chaotic_preview_3x3_temporary_card_custody
  where lobby_id=p_lobby_id and granted_turn=p_expected_turn
    and borrower_id=actor)
 then raise exception 'Empréstimo da Mão Negra já executado neste turno (antirreplay)';end if;
 select * into own_wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 select * into their_wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=contact.defender_id for update;
 if own_wallet.lobby_id is null or their_wallet.lobby_id is null
  or own_wallet.last_draw_turn<>p_expected_turn
 then raise exception 'Mãos de treinamento não preparadas';end if;
 select count(*) into our_hand_count from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=actor and card_state='hand';
 select count(*) into held_count from public.chaotic_preview_3x3_temporary_card_custody
  where lobby_id=p_lobby_id and borrower_id=actor and custody_state in('reserved','held');
 if our_hand_count+held_count>=5
 then raise exception 'Mão do tomador cheia, não pode roubar outra carta';end if;
 select * into victim from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=contact.defender_id and card_state='hand'
  order by pg_catalog.random() limit 1 for update;
 if not found then raise exception 'O adversário não tem carta na mão para roubar';end if;
 select g.data into original_album from public.chaotic_game_nodes g
  where g.user_id=contact.defender_id and g.node_path='album';
 if pg_catalog.jsonb_typeof(original_album)='array' then
  album_records:=original_album;
 elsif pg_catalog.jsonb_typeof(original_album)='object' then
  select coalesce(pg_catalog.jsonb_agg(e.value),'[]'::jsonb)
    into album_records from pg_catalog.jsonb_each(original_album) e;
 else raise exception 'Álbum original do defensor não validável';end if;
 select count(*),min(v.value::text)::jsonb into found_count,original_card
  from pg_catalog.jsonb_array_elements(album_records) v(value)
  where v.value->>'id'=victim.attack_instance_id
    and v.value->>'tipoCarta'='Ataque';
 if found_count<>1 then raise exception 'Carta roubada diverge do álbum original';end if;
 select ref.card_id into catalog from public.chaotic_preview_card_reference ref
  where ref.kind='attack' and ref.card_name=original_card->>'nome';
 if catalog is null then raise exception 'Carta roubada fora do catálogo original';end if;
 update public.chaotic_preview_3x3_attack_hand
  set card_state='loaned'
  where lobby_id=p_lobby_id and actor_id=contact.defender_id
   and card_slot=victim.card_slot and card_state='hand';
 if not found then raise exception 'Carta do defensor mudou durante a reserva';end if;
 insert into public.chaotic_preview_3x3_temporary_card_custody(
  lobby_id,source_actor_id,borrower_id,source_card_slot,
  source_attack_instance_id,catalog_attack_id,granted_turn,custody_state
 ) values(p_lobby_id,contact.defender_id,actor,victim.card_slot,
  victim.attack_instance_id,catalog,p_expected_turn,'held')
 returning id into borrowed_id;
 return borrowed_id;
end;
$function$;
revoke all on function public.chaotic_internal_hold_preview_3x3_black_hand(uuid,integer) from public,anon,authenticated;