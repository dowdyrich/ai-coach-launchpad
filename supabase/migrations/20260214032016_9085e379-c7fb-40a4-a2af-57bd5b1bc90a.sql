
-- Add voice_overlays column to plays table for timestamped audio data
ALTER TABLE public.plays ADD COLUMN voice_overlays jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for voice overlay audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-overlays', 'voice-overlays', false);

-- Storage policies for voice overlays
CREATE POLICY "Authenticated users can upload voice overlays"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-overlays' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view voice overlays"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-overlays' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own voice overlays"
ON storage.objects FOR DELETE
USING (bucket_id = 'voice-overlays' AND auth.role() = 'authenticated');
