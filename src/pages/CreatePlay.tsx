import { useState, useCallback, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MousePointer2, Circle, ArrowRight, Move,
  Undo, Redo, Trash2, ChevronLeft, ChevronRight, Play, Pause, Save, ArrowLeftIcon, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Court3D } from "@/components/play-creator/Court3D";
import { VoiceOverlay, VoiceOverlayEntry } from "@/components/play-creator/VoiceOverlay";
import { toast } from "sonner";

type Tool = "select" | "player" | "move" | "pass" | "screen" | "dribble";

interface CourtPlayer {
  id: string;
  x: number;
  y: number;
  number: number;
  team: "home" | "away";
}

interface CourtAction {
  id: string;
  type: "pass" | "move" | "screen" | "dribble";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  stepIndex: number;
}

export default function CreatePlay() {
  const [searchParams] = useSearchParams();
  const playId = searchParams.get("playId");
  const { user } = useAuth();

  const [tool, setTool] = useState<Tool>("select");
  const [players, setPlayers] = useState<CourtPlayer[]>([]);
  const [actions, setActions] = useState<CourtAction[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState({ home: 0, away: 0 });
  const [currentStep, setCurrentStep] = useState(0);
  const [voiceOverlays, setVoiceOverlays] = useState<VoiceOverlayEntry[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);
  const [playName, setPlayName] = useState("Untitled Play");
  const [playMeta, setPlayMeta] = useState<any>(null);
  const [loadingPlay, setLoadingPlay] = useState(!!playId);
  const [saving, setSaving] = useState(false);

  // Load play data if playId provided
  useEffect(() => {
    if (!playId) return;
    setLoadingPlay(true);
    supabase
      .from("plays")
      .select("*")
      .eq("id", playId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Failed to load play");
          setLoadingPlay(false);
          return;
        }
        setPlayName(data.name);
        setPlayMeta(data);

        // Load players
        const playersData = (data.players_data as unknown as CourtPlayer[]) || [];
        setPlayers(playersData);
        const homeCount = playersData.filter((p: CourtPlayer) => p.team === "home").length;
        const awayCount = playersData.filter((p: CourtPlayer) => p.team === "away").length;
        setPlayerCount({ home: homeCount, away: awayCount });

        // Load actions
        setActions((data.actions_data as unknown as CourtAction[]) || []);

        // Load voice overlays
        setVoiceOverlays((data.voice_overlays as unknown as VoiceOverlayEntry[]) || []);

        setLoadingPlay(false);
      });
  }, [playId]);

  const savePlay = async () => {
    if (!playId || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("plays")
      .update({
        players_data: players as any,
        actions_data: actions as any,
        voice_overlays: voiceOverlays as any,
      })
      .eq("id", playId);
    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Play saved!");
    }
    setSaving(false);
  };

  const totalSteps = actions.length > 0 ? Math.max(...actions.map(a => a.stepIndex)) + 1 : 1;

  const handleCourtClick = useCallback((x: number, y: number) => {
    if (tool === "player") {
      const team = playerCount.home <= playerCount.away ? "home" : "away";
      const count = team === "home" ? playerCount.home : playerCount.away;
      if (count >= 5) return;
      setPlayers((prev) => [
        ...prev,
        { id: crypto.randomUUID(), x, y, number: count + 1, team },
      ]);
      setPlayerCount((prev) => ({ ...prev, [team]: prev[team] + 1 }));
    } else if (tool === "select") {
      setSelectedPlayer(null);
    } else if ((tool === "pass" || tool === "move" || tool === "screen" || tool === "dribble") && selectedPlayer) {
      const player = players.find(p => p.id === selectedPlayer);
      if (player) {
        setActions(prev => [...prev, {
          id: crypto.randomUUID(),
          type: tool,
          fromX: player.x,
          fromY: player.y,
          toX: x,
          toY: y,
          stepIndex: currentStep,
        }]);
      }
    }
  }, [tool, playerCount, selectedPlayer, players, currentStep]);

  const handlePlayerClick = useCallback((id: string) => {
    setSelectedPlayer(id);
  }, []);

  const toggleAnimation = () => {
    if (isAnimating) {
      setIsAnimating(false);
      return;
    }
    setIsAnimating(true);
    setAnimationStep(0);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= totalSteps) {
        clearInterval(interval);
        setIsAnimating(false);
        setAnimationStep(0);
        return;
      }
      setAnimationStep(step);
    }, 1500);
  };

  const tools: { id: Tool; icon: typeof MousePointer2; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "player", icon: Circle, label: "Add Player" },
    { id: "move", icon: Move, label: "Move Path" },
    { id: "pass", icon: ArrowRight, label: "Pass" },
    { id: "screen", icon: Circle, label: "Screen" },
    { id: "dribble", icon: Move, label: "Dribble" },
  ];

  if (loadingPlay) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {playMeta && (
            <Link to={`/playbooks/${playMeta.playbook_id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeftIcon className="w-4 h-4" />
              </Button>
            </Link>
          )}
          <h1 className="text-3xl font-bold">{playName}</h1>
        </div>
        {playId && (
          <Button onClick={savePlay} disabled={saving} className="gradient-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Play
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {tools.map((t) => (
                <Button
                  key={t.id}
                  variant={tool === t.id ? "default" : "ghost"}
                  className={cn("w-full justify-start", tool === t.id && "gradient-primary")}
                  onClick={() => setTool(t.id)}
                >
                  <t.icon className="w-4 h-4 mr-2" />
                  {t.label}
                </Button>
              ))}
              <div className="border-t my-3" />
              <Button variant="ghost" className="w-full justify-start" onClick={() => {
                setPlayers([]); setActions([]); setPlayerCount({ home: 0, away: 0 });
                setVoiceOverlays([]); setCurrentStep(0);
              }}>
                <Trash2 className="w-4 h-4 mr-2" /> Clear All
              </Button>
            </CardContent>
          </Card>

          {/* Step controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Play Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="text-sm font-medium">Step {currentStep + 1}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCurrentStep(currentStep + 1)}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={toggleAnimation}>
                {isAnimating ? <Pause className="w-3 h-3 mr-1.5" /> : <Play className="w-3 h-3 mr-1.5" />}
                {isAnimating ? "Stop" : "Animate Play"}
              </Button>
            </CardContent>
          </Card>

          {/* Voice Overlays */}
          <VoiceOverlay
            overlays={voiceOverlays}
            onOverlaysChange={setVoiceOverlays}
            currentStep={currentStep}
            totalSteps={totalSteps}
          />
        </div>

        {/* 3D Court */}
        <Card>
          <CardContent className="p-4">
            <Court3D
              players={players}
              actions={actions}
              selectedPlayer={selectedPlayer}
              onPlayerClick={handlePlayerClick}
              onCourtClick={handleCourtClick}
              activeStep={isAnimating ? animationStep : undefined}
            />
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary" /> Home ({playerCount.home}/5)
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-destructive" /> Away ({playerCount.away}/5)
              </span>
              <span className="ml-auto text-xs">Drag to orbit • Scroll to zoom</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
