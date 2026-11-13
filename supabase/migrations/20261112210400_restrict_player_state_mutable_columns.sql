-- Authenticated players may continue saving their album, profile and friends.
-- Ownership and creation timestamps must not be mutable through client updates.
REVOKE UPDATE ON TABLE public.chaotic_player_state FROM authenticated;
GRANT UPDATE (album, profile, friends, updated_at)
ON TABLE public.chaotic_player_state TO authenticated;
