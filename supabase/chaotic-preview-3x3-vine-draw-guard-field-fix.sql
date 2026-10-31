-- v0.1.53: safe trigger record field access on all four supported tables.
create or replace function public.chaotic_guard_preview_3x3_training_attack_lock()
 returns trigger language plpgsql security definer set search_path=''
as $guard$
declare actor uuid; turn_num integer; draw_event boolean:=false;
 draw_inserted boolean:=false;
begin
 if tg_table_name='chaotic_preview_3x3_contact_intents' then
  actor:=new.attacker_id;
 elsif tg_table_name in('chaotic_preview_3x3_attack_projections',
                        'chaotic_preview_3x3_attack_spends') then
  actor:=new.actor_id;
 elsif tg_table_name='chaotic_preview_3x3_hand_draw_events' then
  actor:=new.actor_id;draw_event:=true;draw_inserted:=new.drew_card;
 else raise exception 'Unsupported training lock surface';end if;
 turn_num:=new.turn_no;
 if exists(select 1 from public.chaotic_preview_3x3_training_attack_locks l
  where l.lobby_id=new.lobby_id and l.defender_id=actor
   and turn_num>l.inflicted_turn and turn_num<=l.last_blocked_turn
   and (not draw_event or (l.blocks_draw and draw_inserted)))
 then raise exception 'Sua equipe está impedida de % neste turno de treino',
   case when draw_event then 'comprar cartas' else 'atacar' end;
 end if;
 return new;
end;
$guard$;