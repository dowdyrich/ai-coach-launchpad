import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import BasketballStage from "@/components/BasketballStage";
import PlayImporter, { type GeneratedPlay, type PlayStep } from "@/components/PlayImporter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface PlayOption {
  id: string;
  name: string;
  description: string | null;
  playbook_name: string;
}

export default function Visualizer() {
  const [steps, setSteps] = useState<PlayStep[]>([]);
  const [autoPlay, setAutoPlay] = useState(false);
  const [playName, setPlayName] = useState("");

  const [plays, setPlays] = useState<PlayOption[]>([]);
  const [loadingPlays, setLoadingPlays] = useState(true);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [selectedPlayId, setSelectedPlayId] = useState<string>("");

  // Fetch all plays with their playbook names
  useEffect(() => {
    const fetchPlays = async () => {
      const { data, error } = await supabase
        .from("plays")
        .select("id, name, description, playbooks(name)")
        .order("name");

      if (error) {
        console.error(error);
        setLoadingPlays(false);
        return;
      }

      const mapped: PlayOption[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        playbook_name: p.playbooks?.name || "Unknown",
      }));
      setPlays(mapped);
      setLoadingPlays(false);
    };
    fetchPlays();
  }, []);

  // Load play steps when a play is selected
  const handleSelectPlay = async (playId: string) => {
    setSelectedPlayId(playId);
    setAutoPlay(false);
    setLoadingSteps(true);

    const { data, error } = await supabase
      .from("play_steps")
      .select("*")
      .eq("play_id", playId)
      .order("step_number");

    if (error || !data || data.length === 0) {
      toast.error(data?.length === 0 ? "No steps found for this play." : "Failed to load play steps.");
      setLoadingSteps(false);
      return;
    }

    const play = plays.find((p) => p.id === playId);
    setPlayName(play?.name || "");

    // Convert play_steps rows to PlayStep format
    // Stored data uses x(0-50), y(0-94) → court uses x(-25 to 25), z(-47 to 47)
    const labels: Record<string, string> = { O1: "PG", O2: "SG", O3: "SF", O4: "PF", O5: "C" };
    const converted: PlayStep[] = data.map((row: any) => {
      const raw = row.players_data as Record<string, { x: number; y: number }>;
      const players: Record<string, { x: number; z: number; label: string }> = {};
      for (const key of ["O1", "O2", "O3", "O4", "O5"]) {
        if (raw[key]) {
          players[key] = {
            x: raw[key].x - 25,
            z: raw[key].y - 47,
            label: labels[key] || key,
          };
        }
      }
      return { step: row.step_number, description: row.description || "", players };
    });

    setSteps(converted);
    setLoadingSteps(false);
    setTimeout(() => setAutoPlay(true), 100);
  };

  const handlePlayGenerated = (play: GeneratedPlay) => {
    setAutoPlay(false);
    setSelectedPlayId("");
    setSteps(play.steps);
    setPlayName(play.name);
    setTimeout(() => setAutoPlay(true), 100);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">3D Play Visualizer</h1>
          <p className="text-muted-foreground mt-1">
            Select a saved play or import a new one to animate in 3D.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            {/* Play Selector */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Saved Plays
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPlays ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading plays...
                  </div>
                ) : (
                  <Select value={selectedPlayId} onValueChange={handleSelectPlay}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Select a play to visualize" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {plays.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ml-1 text-xs">({p.playbook_name})</span>
                        </SelectItem>
                      ))}
                      {plays.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No plays found</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
                {loadingSteps && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading steps...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Play Importer */}
            <PlayImporter onPlayGenerated={handlePlayGenerated} />

            {playName && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <span className="font-semibold text-foreground">Now showing:</span>{" "}
                <span className="text-muted-foreground">{playName} ({steps.length} steps)</span>
              </div>
            )}
          </div>
          <div className="lg:col-span-2">
            <BasketballStage steps={steps} autoPlay={autoPlay} />
          </div>
        </div>
      </div>
    </div>
  );
}
