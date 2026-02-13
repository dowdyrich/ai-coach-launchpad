
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'coach' CHECK (role IN ('coach', 'player')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create team_memberships table
CREATE TABLE public.team_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('coach', 'player')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

-- Create playbooks table
CREATE TABLE public.playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'offense',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

-- Create plays table
CREATE TABLE public.plays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'offense' CHECK (type IN ('offense', 'defense', 'special', 'press_break', 'out_of_bounds')),
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  canvas_data JSONB DEFAULT '{}',
  players_data JSONB DEFAULT '[]',
  actions_data JSONB DEFAULT '[]',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plays ENABLE ROW LEVEL SECURITY;

-- Create play_templates table (shared library)
CREATE TABLE public.play_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'offense',
  category TEXT DEFAULT 'general',
  difficulty TEXT DEFAULT 'intermediate',
  canvas_data JSONB DEFAULT '{}',
  players_data JSONB DEFAULT '[]',
  actions_data JSONB DEFAULT '[]',
  coaching_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.play_templates ENABLE ROW LEVEL SECURITY;

-- Create videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_team_owner(team_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE id = team_uuid AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_team_member(team_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE id = team_uuid AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.team_memberships WHERE team_id = team_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_playbooks_updated_at BEFORE UPDATE ON public.playbooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_plays_updated_at BEFORE UPDATE ON public.plays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- Profiles
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Teams
CREATE POLICY "Members can view their teams" ON public.teams FOR SELECT USING (public.is_team_member(id));
CREATE POLICY "Authenticated users can create teams" ON public.teams FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update teams" ON public.teams FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete teams" ON public.teams FOR DELETE USING (owner_id = auth.uid());

-- Team memberships
CREATE POLICY "Members can view team memberships" ON public.team_memberships FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY "Team owners can add members" ON public.team_memberships FOR INSERT WITH CHECK (public.is_team_owner(team_id) AND user_id != auth.uid());
CREATE POLICY "Team owners can remove members" ON public.team_memberships FOR DELETE USING (public.is_team_owner(team_id) OR user_id = auth.uid());

-- Playbooks
CREATE POLICY "Team members can view playbooks" ON public.playbooks FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY "Team owners can create playbooks" ON public.playbooks FOR INSERT WITH CHECK (public.is_team_owner(team_id));
CREATE POLICY "Team owners can update playbooks" ON public.playbooks FOR UPDATE USING (public.is_team_owner(team_id));
CREATE POLICY "Team owners can delete playbooks" ON public.playbooks FOR DELETE USING (public.is_team_owner(team_id));

-- Plays (need to check via playbook's team)
CREATE POLICY "Team members can view plays" ON public.plays FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playbooks pb WHERE pb.id = playbook_id AND public.is_team_member(pb.team_id))
);
CREATE POLICY "Team owners can create plays" ON public.plays FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.playbooks pb WHERE pb.id = playbook_id AND public.is_team_owner(pb.team_id))
);
CREATE POLICY "Team owners can update plays" ON public.plays FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.playbooks pb WHERE pb.id = playbook_id AND public.is_team_owner(pb.team_id))
);
CREATE POLICY "Team owners can delete plays" ON public.plays FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.playbooks pb WHERE pb.id = playbook_id AND public.is_team_owner(pb.team_id))
);

-- Play templates (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view templates" ON public.play_templates FOR SELECT USING (auth.role() = 'authenticated');

-- Videos
CREATE POLICY "Team members can view videos" ON public.videos FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY "Team owners can upload videos" ON public.videos FOR INSERT WITH CHECK (public.is_team_owner(team_id) AND uploaded_by = auth.uid());
CREATE POLICY "Uploaders can update videos" ON public.videos FOR UPDATE USING (uploaded_by = auth.uid());
CREATE POLICY "Team owners can delete videos" ON public.videos FOR DELETE USING (public.is_team_owner(team_id));

-- Storage bucket for videos
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);
CREATE POLICY "Team members can view video files" ON storage.objects FOR SELECT USING (bucket_id = 'videos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can upload videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own video files" ON storage.objects FOR DELETE USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
