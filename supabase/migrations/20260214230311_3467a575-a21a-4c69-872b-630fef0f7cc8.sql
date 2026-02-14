
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  opponent text NOT NULL,
  game_date timestamp with time zone NOT NULL,
  location text,
  notes text,
  result text, -- 'win', 'loss', 'draw', or null if not played yet
  team_score integer,
  opponent_score integer,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view games"
  ON public.games FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Team owners can create games"
  ON public.games FOR INSERT
  WITH CHECK (is_team_owner(team_id) AND created_by = auth.uid());

CREATE POLICY "Team owners can update games"
  ON public.games FOR UPDATE
  USING (is_team_owner(team_id));

CREATE POLICY "Team owners can delete games"
  ON public.games FOR DELETE
  USING (is_team_owner(team_id));

CREATE INDEX idx_games_team_date ON public.games(team_id, game_date);

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
