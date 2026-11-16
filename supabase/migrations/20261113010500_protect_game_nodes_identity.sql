-- Protect ownership and logical identity of legacy game nodes.
-- Existing inserts and deletes retain their previous grants and RLS policies.
-- Table-level UPDATE must be revoked: column-level REVOKE alone is insufficient
-- when the role already holds a table-wide UPDATE grant.
REVOKE UPDATE ON TABLE public.chaotic_game_nodes FROM authenticated;
GRANT UPDATE (data, updated_at) ON TABLE public.chaotic_game_nodes TO authenticated;
