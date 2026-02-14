import { useState, useCallback, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MousePointer2, Circle, ArrowRight, Move,
  Trash2, ChevronLeft, ChevronRight, Play, Pause, Save, ArrowLeftIcon, Loader2,
  Shield, Swords, UserPlus, X, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Court3D } from "@/components/play-creator/Court3D";
import { VoiceOverlay, VoiceOverlayEntry } from "@/components/play-creator/VoiceOverlay";
import { toast } from "sonner";

type Tool = "select" | "player-offense" | "player-defense" | "move" | "pass" | "screen" | "dribble";

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

        // Load players - convert from template format if needed
        const rawPlayers = (data.players_data as any[]) || [];
        const playersData: CourtPlayer[] = rawPlayers.map((p: any) => {
          const isTemplateFormat = p.x <= 100 && p.y <= 100 && (p.team === "offense" || p.team === "defense" || p.label);
          return {
            id: p.id || crypto.randomUUID(),
            x: isTemplateFormat ? (p.x / 100) * 800 : p.x,
            y: isTemplateFormat ? (p.y / 100) * 500 : p.y,
            number: p.number ?? (typeof p.label === "number" ? p.label : parseInt(p.label) || 1),
            team: (p.team === "offense" || p.team === "home") ? "home" as const : "away" as const,
          };
        });
        setPlayers(playersData);
        const homeCount = playersData.filter((p) => p.team === "home").length;
        const awayCount = playersData.filter((p) => p.team === "away").length;
        setPlayerCount({ home: homeCount, away: awayCount });

        // Load actions - convert from template format if needed
        const rawActions = (data.actions_data as any[]) || [];
        const hasCoordinateActions = rawActions.length > 0 && rawActions[0].fromX !== undefined;
        if (hasCoordinateActions) {
          setActions(rawActions as CourtAction[]);
        } else {
          const playerMap = new Map(playersData.map(p => [
            rawPlayers.find((rp: any) => {
              const rpNum = rp.number ?? (typeof rp.label === "number" ? rp.label : parseInt(rp.label) || 0);
              return rpNum === p.number;
            })?.id || p.id,
            p,
          ]));

          const convertedActions: CourtAction[] = [];
          rawActions.forEach((a: any, i: number) => {
            const player = a.player ? playerMap.get(a.player) : null;
            if (a.type === "move" && player) {
              const moveDir = player.y > 250 ? -80 : 80;
              convertedActions.push({
                id: crypto.randomUUID(),
                type: "move",
                fromX: player.x,
                fromY: player.y,
                toX: player.x + (Math.random() - 0.5) * 120,
                toY: player.y + moveDir,
                stepIndex: i,
              });
            } else if (a.type === "pass" && a.from && a.to) {
              const fromPlayer = playerMap.get(a.from);
              const toPlayer = playerMap.get(a.to);
              if (fromPlayer && toPlayer) {
                convertedActions.push({
                  id: crypto.randomUUID(),
                  type: "pass",
                  fromX: fromPlayer.x,
                  fromY: fromPlayer.y,
                  toX: toPlayer.x,
                  toY: toPlayer.y,
                  stepIndex: i,
                });
              }
            } else if (a.type === "screen" && a.from && a.to) {
              const fromPlayer = playerMap.get(a.from);
              const toPlayer = playerMap.get(a.to);
              if (fromPlayer && toPlayer) {
                convertedActions.push({
                  id: crypto.randomUUID(),
                  type: "screen",
                  fromX: fromPlayer.x,
                  fromY: fromPlayer.y,
                  toX: toPlayer.x,
                  toY: toPlayer.y,
                  stepIndex: i,
                });
              }
            }
          });
          setActions(convertedActions);
        }

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
    if (tool === "player-offense" || tool === "player-defense") {
      const team = tool === "player-offense" ? "home" : "away";
      const count = team === "home" ? playerCount.home : playerCount.away;
      if (count >= 5) {
        toast.error(`Maximum 5 ${team === "home" ? "offense" : "defense"} players reached`);
        return;
      }
      const newPlayer: CourtPlayer = {
        id: crypto.randomUUID(),
        x,
        y,
        number: count + 1,
        team,
      };
      setPlayers((prev) => [...prev, newPlayer]);
      setPlayerCount((prev) => ({ ...prev, [team]: prev[team] + 1 }));
      toast.success(`${team === "home" ? "Offense" : "Defense"} player #${count + 1} added`);
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
        toast.success(`${tool.charAt(0).toUpperCase() + tool.slice(1)} action added`);
      }
    }
  }, [tool, playerCount, selectedPlayer, players, currentStep]);

  const handlePlayerClick = useCallback((id: string) => {
    setSelectedPlayer(id);
    // Auto-switch to select mode if in player-add mode
    if (tool === "player-offense" || tool === "player-defense") {
      setTool("select");
    }
  }, [tool]);

  const removeSelectedPlayer = useCallback(() => {
    if (!selectedPlayer) return;
    const player = players.find(p => p.id === selectedPlayer);
    if (player) {
      setPlayers(prev => prev.filter(p => p.id !== selectedPlayer));
      setActions(prev => prev.filter(a => {
        const [fx, fy] = [a.fromX, a.fromY];
        return !(Math.abs(fx - player.x) < 30 && Math.abs(fy - player.y) < 30);
      }));
      setPlayerCount(prev => ({
        ...prev,
        [player.team]: prev[player.team] - 1,
      }));
      setSelectedPlayer(null);
      toast.success("Player removed");
    }
  }, [selectedPlayer, players]);

  const toggleAnimation = () => {
    setIsAnimating((prev) => !prev);
  };

  const selectedPlayerData = players.find(p => p.id === selectedPlayer);

  // Contextual hint based on current tool
  const getToolHint = (): string => {
    switch (tool) {
      case "select": return selectedPlayer ? "Player selected — choose an action tool or click elsewhere to deselect" : "Click a player to select it";
      case "player-offense": return `Click on the court to place an offense player (${playerCount.home}/5)`;
      case "player-defense": return `Click on the court to place a defense player (${playerCount.away}/5)`;
      case "move": return selectedPlayer ? "Click on the court to set the move destination" : "Select a player first, then click to set destination";
      case "pass": return selectedPlayer ? "Click on the court to set the pass target" : "Select a player first, then click the pass target";
      case "screen": return selectedPlayer ? "Click on the court to set the screen position" : "Select a player first, then click the screen position";
      case "dribble": return selectedPlayer ? "Click on the court to set the dribble path" : "Select a player first, then click to set path";
      default: return "";
    }
  };

  if (loadingPlay) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {playMeta && (
              <Link to={`/playbooks/${playMeta.playbook_id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeftIcon className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <h1 className="text-2xl font-bold">{playName}</h1>
            {playMeta?.type && (
              <Badge variant="secondary" className="capitalize text-xs">
                {playMeta.type.replace("_", " ")}
              </Badge>
            )}
          </div>
          {playId && (
            <Button onClick={savePlay} disabled={saving} className="gradient-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] gap-4">
          {/* Left Sidebar — Tools */}
          <div className="space-y-3">
            {/* Players section */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Players</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === "player-offense" ? "default" : "outline"}
                      className={cn(
                        "w-full justify-start h-9 text-sm",
                        tool === "player-offense" && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => setTool("player-offense")}
                    >
                      <Swords className="w-3.5 h-3.5 mr-2" />
                      Offense
                      <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                        {playerCount.home}/5
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Add offensive player to court</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === "player-defense" ? "default" : "outline"}
                      className={cn(
                        "w-full justify-start h-9 text-sm",
                        tool === "player-defense" && "bg-destructive text-destructive-foreground"
                      )}
                      onClick={() => setTool("player-defense")}
                    >
                      <Shield className="w-3.5 h-3.5 mr-2" />
                      Defense
                      <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                        {playerCount.away}/5
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Add defensive player to court</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>

            {/* Actions section */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === "select" ? "default" : "ghost"}
                      className={cn("w-full justify-start h-9 text-sm", tool === "select" && "gradient-primary")}
                      onClick={() => setTool("select")}
                    >
                      <MousePointer2 className="w-3.5 h-3.5 mr-2" />
                      Select
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Click to select a player</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === "move" ? "default" : "ghost"}
                      className={cn("w-full justify-start h-9 text-sm", tool === "move" && "bg-warning text-warning-foreground")}
                      onClick={() => setTool("move")}
                      disabled={!selectedPlayer}
                    >
                      <Move className="w-3.5 h-3.5 mr-2" />
                      Move
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Draw a movement path for selected player</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === "pass" ? "default" : "ghost"}
                      className={cn("w-full justify-start h-9 text-sm", tool === "pass" && "bg-foreground text-background")}
                      onClick={() => setTool("pass")}
                      disabled={!selectedPlayer}
                    >
                      <ArrowRight className="w-3.5 h-3.5 mr-2" />
                      Pass
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Draw a pass from selected player</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === "screen" ? "default" : "ghost"}
                      className={cn("w-full justify-start h-9 text-sm", tool === "screen" && "bg-destructive text-destructive-foreground")}
                      onClick={() => setTool("screen")}
                      disabled={!selectedPlayer}
                    >
                      <Circle className="w-3.5 h-3.5 mr-2" />
                      Screen
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Set a screen position for selected player</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === "dribble" ? "default" : "ghost"}
                      className={cn("w-full justify-start h-9 text-sm", tool === "dribble" && "bg-accent text-accent-foreground")}
                      onClick={() => setTool("dribble")}
                      disabled={!selectedPlayer}
                    >
                      <Move className="w-3.5 h-3.5 mr-2" />
                      Dribble
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Draw a dribble path for selected player</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>

            {/* Clear */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-destructive h-8 text-xs"
              onClick={() => {
                setPlayers([]); setActions([]); setPlayerCount({ home: 0, away: 0 });
                setVoiceOverlays([]); setCurrentStep(0); setSelectedPlayer(null);
              }}
            >
              <Trash2 className="w-3 h-3 mr-2" /> Clear All
            </Button>
          </div>

          {/* Center — 3D Court */}
          <div className="space-y-2">
            {/* Contextual hint bar */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground min-h-[36px]">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>{getToolHint()}</span>
            </div>

            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <Court3D
                  players={players}
                  actions={actions}
                  selectedPlayer={selectedPlayer}
                  onPlayerClick={handlePlayerClick}
                  onCourtClick={handleCourtClick}
                  isAnimating={isAnimating}
                  onAnimationEnd={() => setIsAnimating(false)}
                />
              </CardContent>
            </Card>

            {/* Court legend */}
            <div className="flex items-center gap-4 px-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary" /> Offense ({playerCount.home}/5)
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive" /> Defense ({playerCount.away}/5)
              </span>
              <span className="ml-auto">Drag to orbit · Scroll to zoom</span>
            </div>
          </div>

          {/* Right Sidebar — Steps, Selection, Voice */}
          <div className="space-y-3">
            {/* Selected Player Info */}
            {selectedPlayerData && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="px-3 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => setSelectedPlayer(null)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground",
                      selectedPlayerData.team === "home" ? "bg-primary" : "bg-destructive"
                    )}>
                      {selectedPlayerData.number}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Player #{selectedPlayerData.number}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {selectedPlayerData.team === "home" ? "Offense" : "Defense"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={removeSelectedPlayer}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Remove Player
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Play Steps */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <div className="text-center">
                    <span className="text-sm font-semibold">Step {currentStep + 1}</span>
                    <span className="text-xs text-muted-foreground ml-1">/ {totalSteps}</span>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => setCurrentStep(currentStep + 1)}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
                {/* Step indicator dots */}
                {totalSteps > 1 && (
                  <div className="flex gap-1 justify-center">
                    {Array.from({ length: totalSteps }, (_, i) => (
                      <button
                        key={i}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          i === currentStep ? "bg-primary scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        )}
                        onClick={() => setCurrentStep(i)}
                      />
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant={isAnimating ? "destructive" : "default"}
                  className={cn("w-full h-9", !isAnimating && "gradient-primary")}
                  onClick={toggleAnimation}
                >
                  {isAnimating ? <Pause className="w-3.5 h-3.5 mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                  {isAnimating ? "Stop" : "Animate Play"}
                </Button>
              </CardContent>
            </Card>

            {/* Actions on current step */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {currentStep + 1} Actions ({actions.filter(a => a.stepIndex === currentStep).length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {actions.filter(a => a.stepIndex === currentStep).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No actions on this step. Select a player and choose an action tool.</p>
                ) : (
                  <div className="space-y-1">
                    {actions.filter(a => a.stepIndex === currentStep).map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-xs">
                        <span className="capitalize font-medium">{a.type}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-destructive"
                          onClick={() => setActions(prev => prev.filter(act => act.id !== a.id))}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
        </div>
      </div>
    </TooltipProvider>
  );
}