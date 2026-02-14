
CREATE TABLE public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view messages"
  ON public.team_messages FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Team members can send messages"
  ON public.team_messages FOR INSERT
  WITH CHECK (is_team_member(team_id) AND sender_id = auth.uid());

CREATE POLICY "Senders can delete own messages"
  ON public.team_messages FOR DELETE
  USING (sender_id = auth.uid());

CREATE INDEX idx_team_messages_team_id ON public.team_messages(team_id);
CREATE INDEX idx_team_messages_created_at ON public.team_messages(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
