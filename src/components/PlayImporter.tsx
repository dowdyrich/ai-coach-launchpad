import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface PlayStep {
  step: number;
  description: string;
  players: Record<string, { x: number; z: number; label: string }>;
}

export interface GeneratedPlay {
  name: string;
  description: string;
  steps: PlayStep[];
}

interface PlayImporterProps {
  onPlayGenerated: (play: GeneratedPlay) => void;
}

export default function PlayImporter({ onPlayGenerated }: PlayImporterProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim() || input.trim().length < 5) {
      toast.error("Please enter a longer play description.");
      return;
    }
    setIsLoading(true);
    setGenerated(false);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-play`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ description: input.trim() }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const play: GeneratedPlay = await resp.json();
      setGenerated(true);
      toast.success(`"${play.name}" generated with ${play.steps.length} steps!`);
      onPlayGenerated(play);
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze play");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Play Importer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Paste a play description or URL, e.g. 'Horns set: PG at top of key, bigs at elbows. PG passes to PF, sets a screen for SG who curls to the wing...'"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setGenerated(false);
          }}
          rows={4}
          className="resize-none"
          disabled={isLoading}
        />
        <Button
          onClick={handleAnalyze}
          disabled={isLoading || input.trim().length < 5}
          className="w-full gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing Play...
            </>
          ) : generated ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Re-Analyze
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analyze &amp; Generate 3D Play
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
