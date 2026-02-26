
CREATE TABLE public.play_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  play_id UUID REFERENCES public.plays(id) ON DELETE CASCADE NOT NULL,
  step_number INTEGER NOT NULL,
  players_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.play_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view play steps" ON public.play_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plays p
      JOIN playbooks pb ON pb.id = p.playbook_id
      WHERE p.id = play_steps.play_id AND is_team_member(pb.team_id)
    )
  );

CREATE POLICY "Team owners can insert play steps" ON public.play_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM plays p
      JOIN playbooks pb ON pb.id = p.playbook_id
      WHERE p.id = play_steps.play_id AND is_team_owner(pb.team_id)
    )
  );

CREATE POLICY "Team owners can delete play steps" ON public.play_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM plays p
      JOIN playbooks pb ON pb.id = p.playbook_id
      WHERE p.id = play_steps.play_id AND is_team_owner(pb.team_id)
    )
  );
