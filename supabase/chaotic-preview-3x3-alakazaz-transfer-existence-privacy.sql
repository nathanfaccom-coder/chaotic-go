-- v0.1.59: a token transfer is an Alakazaz-only action.
-- Masking names but still RETURNING the event reveals who the donor must be.
-- Exclude enemy transfer records entirely while the donor remains facedown;
-- the owner still sees their history, and after the donor is revealed the
-- opponent may see a sanitized record (receiver can stay facedown).
create or replace function public.chaotic_get_preview_3x3_safe_state(p_lobby_id uuid)
 returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 host_user uuid;
 guest_user uuid;
 friends jsonb;
 health jsonb;
 positions jsonb;
 movements jsonb;
 transfers jsonb;
begin
 if actor is null or p_lobby_id is null then raise exception 'Faça login e selecione a sala';end if;
 select m.host_id,m.guest_id into host_user,guest_user
 from public.chaotic_match_turns m
 join public.chaotic_lobbies l on l.id=m.lobby_id
 where m.lobby_id=p_lobby_id and l.mode='3x3'
   and l.host_id=m.host_id and l.guest_id=m.guest_id;
 if not found or actor not in(host_user,guest_user)
 then raise exception 'Acesso à formação 3x3 negado';end if;
 -- A facedown enemy must not leak names, source deck slots, card IDs or
 -- token signature. Face state missing => assume FACE DOWN, not face-up.
 select coalesce(pg_catalog.jsonb_agg(
  case when a.actor_id=actor or coalesce(f.face_up,false)
   then to_jsonb(a)
   else to_jsonb(a)||pg_catalog.jsonb_build_object(
     'creature_instance_id',null,'creature_name',null,
     'deck_slot',null,'starting_tokens',null,'remaining_tokens',null,
     'received_tokens',null)
  end order by a.actor_id,a.position),'[]'::jsonb)
 into friends
 from public.chaotic_preview_3x3_allies a
 left join public.chaotic_preview_3x3_face_states f
  on f.lobby_id=a.lobby_id and f.actor_id=a.actor_id and f.position=a.position
 where a.lobby_id=p_lobby_id;
 -- Enemy still-facedown HP is represented only as alive/dead (1 or 0).
 -- Do not expose HP totals or damage counters which can fingerprint species.
 select coalesce(pg_catalog.jsonb_agg(
  case when h.actor_id=actor or coalesce(f.face_up,false)
   then to_jsonb(h)
   else to_jsonb(h)||pg_catalog.jsonb_build_object(
    'creature_instance_id',null,'creature_name',null,
    'hp_initial',null,'hp_max',null,
    'hp_remaining',case when h.hp_remaining>0 then 1 else 0 end,
    'damage_events',null,'healing_events',null)
  end order by h.actor_id,h.position),'[]'::jsonb)
 into health
 from public.chaotic_preview_3x3_hp_wallets h
 left join public.chaotic_preview_3x3_face_states f
  on f.lobby_id=h.lobby_id and f.actor_id=h.actor_id and f.position=h.position
 where h.lobby_id=p_lobby_id;
 select coalesce(pg_catalog.jsonb_agg(
  case when b.actor_id=actor or coalesce(f.face_up,false)
   then to_jsonb(b)
   else to_jsonb(b)||pg_catalog.jsonb_build_object(
    'creature_instance_id',null)
  end order by b.actor_id,b.formation_slot),'[]'::jsonb)
 into positions
 from public.chaotic_preview_3x3_board_positions b
 left join public.chaotic_preview_3x3_face_states f
  on f.lobby_id=b.lobby_id and f.actor_id=b.actor_id
   and f.position=b.formation_slot
 where b.lobby_id=p_lobby_id;
 select coalesce(pg_catalog.jsonb_agg(
  case when ev.actor_id=actor or coalesce(f.face_up,false)
   then to_jsonb(ev)
   else to_jsonb(ev)||pg_catalog.jsonb_build_object(
    'creature_instance_id',null)
  end order by ev.turn_no desc),'[]'::jsonb)
 into movements
 from (select * from public.chaotic_preview_3x3_move_events
   where lobby_id=p_lobby_id order by turn_no desc limit 60) ev
 left join public.chaotic_preview_3x3_face_states f
  on f.lobby_id=ev.lobby_id and f.actor_id=ev.actor_id
   and f.position=ev.formation_slot;
 select coalesce(pg_catalog.jsonb_agg(
  case when t.actor_id=actor or
     (coalesce(fd.face_up,false) and coalesce(fr.face_up,false))
   then to_jsonb(t)
   else to_jsonb(t)||pg_catalog.jsonb_build_object(
    'donor_creature_instance_id',null,'receiver_creature_instance_id',null,
    'donor_creature_name',null,'donor_before',null,'donor_after',null,
    'receiver_before',null,'receiver_after',null)
  end order by t.turn_no desc),'[]'::jsonb)
 into transfers
 from (select * from public.chaotic_preview_3x3_token_transfers
   where lobby_id=p_lobby_id order by turn_no desc limit 50) t
 left join public.chaotic_preview_3x3_face_states fd
  on fd.lobby_id=t.lobby_id and fd.actor_id=t.actor_id
   and fd.position=t.donor_position
 left join public.chaotic_preview_3x3_face_states fr
  on fr.lobby_id=t.lobby_id and fr.actor_id=t.actor_id
   and fr.position=t.receiver_position
 -- A transfer event is an Alakazaz-only action. Even its EXISTENCE reveals
 -- the donor's identity; never return a placeholder while still facedown.
 where t.actor_id=actor or coalesce(fd.face_up,false);
 return pg_catalog.jsonb_build_object(
 'allies',friends,'hp_wallets',health,'board_positions',positions,
 'move_events',movements,'token_transfers',transfers);
end;
$fn$;
