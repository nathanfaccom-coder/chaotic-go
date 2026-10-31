-- Supersedes the legacy native-only result FK with a shared validated contact FK.
-- The legacy FK was dropped as part of the preparatory migration.
alter table public.chaotic_preview_3x3_training_outcomes
 add constraint chaotic_3x3_result_contact_v0184_fk
 foreign key(lobby_id,decided_turn)
 references public.chaotic_preview_3x3_contact_intents(lobby_id,turn_no)
 on delete cascade;