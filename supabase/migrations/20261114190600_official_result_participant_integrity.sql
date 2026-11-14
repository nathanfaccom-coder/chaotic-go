-- Prevent a forged winner or self-play result from entering the official result ledger.
-- No reward logic is activated by this migration.
alter table public.chaotic_official_match_results add constraint chaotic_official_result_distinct_players check (host_id <> guest_id), add constraint chaotic_official_result_winner_member check (winner_id is null or winner_id = host_id or winner_id = guest_id);
