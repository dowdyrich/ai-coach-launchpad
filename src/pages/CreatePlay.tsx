import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MousePointer2, Circle, ArrowRight, Move, Undo2, Pencil,
  Trash2, ChevronLeft, ChevronRight, Play, Pause, Save, ArrowLeftIcon, Loader2,
  Shield, Swords, X, Info, Check, Target, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Court3D, CourtMode } from "@/components/play-creator/Court3D";
import { VoiceOverlay, VoiceOverlayEntry } from "@/components/play-creator/VoiceOverlay";
import { ActionTimeline } from "@/components/play-creator/ActionTimeline";
import { toast } from "sonner";

type Tool = "select" | "player-offense" | "player-defense" | "move" | "pass" | "screen" | "screen-player" | "dribble" | "draw-path";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
type Position = typeof POSITIONS[number];

interface CourtPlayer {
  id: string;
  x: number;
  y: number;
  number: number;
  team: "home" | "away";
  position?: Position;
}

interface CourtAction {
  id: string;
  type: "pass" | "move" | "screen" | "dribble";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  stepIndex: number;
  waypoints?: { x: number; y: number }[];
  delay?: number;
}

// Compute a player's effective position after all actions before the given step
function getPlayerPositionAtStep(
  player: CourtPlayer,
  actions: CourtAction[],
  targetStep: number
): { x: number; y: number } {
  const TOLERANCE = 50;
  let cx = player.x;
  let cy = player.y;
  for (let step = 0; step < targetStep; step++) {
    const act = actions.find(
      (a) =>
        a.stepIndex === step &&
        (a.type === "move" || a.type === "dribble" || a.type === "screen") &&
        Math.abs(a.fromX - cx) < TOLERANCE &&
        Math.abs(a.fromY - cy) < TOLERANCE
    );
    if (act) {
      cx = act.toX;
      cy = act.toY;
    }
  }
  return { x: cx, y: cy };
}

export default function CreatePlay() {
  const [searchParams] = useSearchParams();
  const playId = searchParams.get("playId");
  const { user } = useAuth();

  const [tool, setTool] = useState<Tool>("select");
  const [pendingPosition, setPendingPosition] = useState<{ team: "home" | "away"; position: Position } | null>(null);
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
  const [drawingWaypoints, setDrawingWaypoints] = useState<{ x: number; y: number }[]>([]);
  const [drawPathType, setDrawPathType] = useState<"move" | "dribble">("move");
  const [courtMode, setCourtMode] = useState<CourtMode>("half");

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
    if ((tool === "player-offense" || tool === "player-defense") && pendingPosition) {
      const team = pendingPosition.team;
      const position = pendingPosition.position;
      const posIndex = POSITIONS.indexOf(position);
      const count = team === "home" ? playerCount.home : playerCount.away;
      // Check if position already placed
      const alreadyPlaced = players.some(p => p.team === team && p.position === position);
      if (alreadyPlaced) {
        toast.error(`${position} already placed for ${team === "home" ? "offense" : "defense"}`);
        return;
      }
      const newPlayer: CourtPlayer = {
        id: crypto.randomUUID(),
        x,
        y,
        number: posIndex + 1,
        team,
        position,
      };
      setPlayers((prev) => [...prev, newPlayer]);
      setPlayerCount((prev) => ({ ...prev, [team]: prev[team] + 1 }));
      setPendingPosition(null);
      setTool("select");
      toast.success(`${team === "home" ? "Offense" : "Defense"} ${position} added`);
    } else if (tool === "select") {
      setSelectedPlayer(null);
    } else if (tool === "draw-path" && selectedPlayer) {
      setDrawingWaypoints(prev => [...prev, { x, y }]);
    } else if (tool === "screen" && selectedPlayer) {
      // Screen to location: move to spot and set screen
      const player = players.find(p => p.id === selectedPlayer);
      if (player) {
        const pos = getPlayerPositionAtStep(player, actions, currentStep);
        setActions(prev => [...prev, {
          id: crypto.randomUUID(),
          type: "screen",
          fromX: pos.x,
          fromY: pos.y,
          toX: x,
          toY: y,
          stepIndex: currentStep,
        }]);
        toast.success("Screen (move to location) added");
      }
    } else if ((tool === "pass" || tool === "move" || tool === "dribble") && selectedPlayer) {
      const player = players.find(p => p.id === selectedPlayer);
      if (player) {
        const pos = getPlayerPositionAtStep(player, actions, currentStep);
        setActions(prev => [...prev, {
          id: crypto.randomUUID(),
          type: tool,
          fromX: pos.x,
          fromY: pos.y,
          toX: x,
          toY: y,
          stepIndex: currentStep,
        }]);
        toast.success(`${tool.charAt(0).toUpperCase() + tool.slice(1)} action added`);
      }
    }
  }, [tool, pendingPosition, playerCount, selectedPlayer, players, actions, currentStep]);

  // Screen-for-player: clicking another player to set screen near them
  const handlePlayerClick = useCallback((id: string) => {
    if (tool === "screen-player" && selectedPlayer && id !== selectedPlayer) {
      const screener = players.find(p => p.id === selectedPlayer);
      const target = players.find(p => p.id === id);
      if (screener && target) {
        const screenerPos = getPlayerPositionAtStep(screener, actions, currentStep);
        const targetPos = getPlayerPositionAtStep(target, actions, currentStep);
        const offsetX = targetPos.x + (screenerPos.x > targetPos.x ? -30 : 30);
        setActions(prev => [...prev, {
          id: crypto.randomUUID(),
          type: "screen",
          fromX: screenerPos.x,
          fromY: screenerPos.y,
          toX: offsetX,
          toY: targetPos.y,
          stepIndex: currentStep,
        }]);
        toast.success(`Screen set for Player #${target.number}`);
        setTool("select");
      }
      return;
    }
    setSelectedPlayer(id);
    if (tool === "player-offense" || tool === "player-defense") {
      setTool("select");
    }
  }, [tool, selectedPlayer, players, actions, currentStep]);

  const finishDrawPath = useCallback(() => {
    if (!selectedPlayer || drawingWaypoints.length === 0) return;
    const player = players.find(p => p.id === selectedPlayer);
    if (!player) return;
    const pos = getPlayerPositionAtStep(player, actions, currentStep);
    const lastPoint = drawingWaypoints[drawingWaypoints.length - 1];
    const middleWaypoints = drawingWaypoints.length > 1 ? drawingWaypoints.slice(0, -1) : undefined;
    setActions(prev => [...prev, {
      id: crypto.randomUUID(),
      type: drawPathType,
      fromX: pos.x,
      fromY: pos.y,
      toX: lastPoint.x,
      toY: lastPoint.y,
      stepIndex: currentStep,
      waypoints: middleWaypoints,
    }]);
    setDrawingWaypoints([]);
    toast.success(`Free path (${drawPathType}) added with ${drawingWaypoints.length} points`);
  }, [selectedPlayer, drawingWaypoints, drawPathType, players, actions, currentStep]);

  const cancelDrawPath = useCallback(() => {
    setDrawingWaypoints([]);
    setTool("select");
  }, []);

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

  const undoLastAction = useCallback(() => {
    if (actions.length === 0) return;
    const removed = actions[actions.length - 1];
    setActions(prev => prev.slice(0, -1));
    toast.success(`Undid ${removed.type} action`);
  }, [actions]);

  const updateActionDelay = useCallback((actionId: string, delay: number) => {
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, delay } : a));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoLastAction();
      }
      if (e.key === "Enter" && tool === "draw-path" && drawingWaypoints.length > 0) {
        e.preventDefault();
        finishDrawPath();
      }
      if (e.key === "Escape" && tool === "draw-path") {
        e.preventDefault();
        cancelDrawPath();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoLastAction, tool, drawingWaypoints, finishDrawPath, cancelDrawPath]);

  const selectedPlayerData = players.find(p => p.id === selectedPlayer);

  // Build drawing preview data for Court3D
  const drawingPreview = useMemo(() => {
    if (tool !== "draw-path" || !selectedPlayer || drawingWaypoints.length === 0) return null;
    const player = players.find(p => p.id === selectedPlayer);
    if (!player) return null;
    return { playerX: player.x, playerY: player.y, waypoints: drawingWaypoints };
  }, [tool, selectedPlayer, drawingWaypoints, players]);

  const getToolHint = (): string => {
    switch (tool) {
      case "select": return selectedPlayer ? "Player selected — choose an action tool or click elsewhere to deselect" : "Click a player to select it";
      case "player-offense": return pendingPosition ? `Click on the court to place offense ${pendingPosition.position}` : "Select a position to place";
      case "player-defense": return pendingPosition ? `Click on the court to place defense ${pendingPosition.position}` : "Select a position to place";
      case "move": return selectedPlayer ? "Click on the court to set the move destination" : "Select a player first, then click to set destination";
      case "pass": return selectedPlayer ? "Click on the court to set the pass target" : "Select a player first, then click the pass target";
      case "screen": return selectedPlayer ? "Click on the court to move and set a screen at that location" : "Select a player first";
      case "screen-player": return selectedPlayer ? "Click on a teammate to set a screen near them" : "Select a player first";
      case "dribble": return selectedPlayer ? "Click on the court to set the dribble path" : "Select a player first, then click to set path";
      case "draw-path": return drawingWaypoints.length === 0
        ? "Click points on the court to draw a free path — press Enter to finish"
        : `Drawing path: ${drawingWaypoints.length} point${drawingWaypoints.length > 1 ? "s" : ""} — click more or press Enter to finish (Esc to cancel)`;
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

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_240px] gap-4">
          {/* Left Sidebar — Tools */}
          <div className="space-y-3">
            {/* Offense Players */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Swords className="w-3 h-3" />
                  Offense
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">{playerCount.home}/5</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 grid grid-cols-5 gap-1">
                {POSITIONS.map((pos) => {
                  const placed = players.some(p => p.team === "home" && p.position === pos);
                  const isActive = tool === "player-offense" && pendingPosition?.position === pos && pendingPosition?.team === "home";
                  return (
                    <Tooltip key={pos}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isActive ? "default" : placed ? "secondary" : "outline"}
                          className={cn(
                            "h-9 px-0 text-xs font-bold",
                            isActive && "bg-primary text-primary-foreground ring-2 ring-primary/50",
                            placed && !isActive && "opacity-50 cursor-default"
                          )}
                          disabled={placed}
                          onClick={() => {
                            setPendingPosition({ team: "home", position: pos });
                            setTool("player-offense");
                          }}
                        >
                          {pos}
                          {placed && <Check className="w-2.5 h-2.5 ml-0.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{placed ? `${pos} already placed` : `Place offense ${pos} on court`}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </CardContent>
            </Card>

            {/* Defense Players */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  Defense
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">{playerCount.away}/5</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 grid grid-cols-5 gap-1">
                {POSITIONS.map((pos) => {
                  const placed = players.some(p => p.team === "away" && p.position === pos);
                  const isActive = tool === "player-defense" && pendingPosition?.position === pos && pendingPosition?.team === "away";
                  return (
                    <Tooltip key={pos}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isActive ? "default" : placed ? "secondary" : "outline"}
                          className={cn(
                            "h-9 px-0 text-xs font-bold",
                            isActive && "bg-destructive text-destructive-foreground ring-2 ring-destructive/50",
                            placed && !isActive && "opacity-50 cursor-default"
                          )}
                          disabled={placed}
                          onClick={() => {
                            setPendingPosition({ team: "away", position: pos });
                            setTool("player-defense");
                          }}
                        >
                          {pos}
                          {placed && <Check className="w-2.5 h-2.5 ml-0.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{placed ? `${pos} already placed` : `Place defense ${pos} on court`}</TooltipContent>
                    </Tooltip>
                  );
                })}
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

                {/* Separator */}
                <div className="border-t border-border my-1" />

                {/* Screen tools */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Screen</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={tool === "screen" ? "default" : "ghost"}
                        className={cn("w-full justify-start h-8 text-xs", tool === "screen" && "bg-destructive text-destructive-foreground")}
                        onClick={() => setTool("screen")}
                        disabled={!selectedPlayer}
                      >
                        <Target className="w-3 h-3 mr-2" />
                        Screen Location
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Move player to a court spot and set screen</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={tool === "screen-player" ? "default" : "ghost"}
                        className={cn("w-full justify-start h-8 text-xs", tool === "screen-player" && "bg-destructive text-destructive-foreground")}
                        onClick={() => setTool("screen-player")}
                        disabled={!selectedPlayer}
                      >
                        <Users className="w-3 h-3 mr-2" />
                        Screen for Player
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Click a teammate to screen for them</TooltipContent>
                  </Tooltip>
                </div>

                {/* Separator */}
                <div className="border-t border-border my-1" />

                {/* Free Path Draw */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === "draw-path" ? "default" : "ghost"}
                      className={cn("w-full justify-start h-9 text-sm", tool === "draw-path" && "bg-primary text-primary-foreground")}
                      onClick={() => { setTool("draw-path"); setDrawingWaypoints([]); }}
                      disabled={!selectedPlayer}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-2" />
                      Free Path
                      {drawingWaypoints.length > 0 && (
                        <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                          {drawingWaypoints.length}pt
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Draw a custom multi-point path</TooltipContent>
                </Tooltip>

                {/* Draw path type toggle & finish buttons */}
                {tool === "draw-path" && (
                  <div className="space-y-1.5 pl-1">
                    <div className="flex gap-1">
                      <Button
                        variant={drawPathType === "move" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setDrawPathType("move")}
                      >
                        Move
                      </Button>
                      <Button
                        variant={drawPathType === "dribble" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setDrawPathType("dribble")}
                      >
                        Dribble
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs gap-1"
                        onClick={finishDrawPath}
                        disabled={drawingWaypoints.length === 0}
                      >
                        <Check className="w-3 h-3" /> Finish
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs gap-1"
                        onClick={cancelDrawPath}
                      >
                        <X className="w-3 h-3" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}
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
              <span className="flex-1">{getToolHint()}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1.5 shrink-0"
                    onClick={undoLastAction}
                    disabled={actions.length === 0}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Undo
                    <kbd className="hidden sm:inline-flex ml-1 px-1 py-0.5 rounded bg-muted text-[10px] font-mono border border-border">⌘Z</kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo last action (⌘Z / Ctrl+Z)</TooltipContent>
              </Tooltip>
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
                  courtMode={courtMode}
                  currentStep={currentStep}
                  drawingPreview={drawingPreview}
                />
              </CardContent>
            </Card>

            {/* Court legend + mode toggle */}
            <div className="flex items-center gap-4 px-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary" /> Offense ({playerCount.home}/5)
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive" /> Defense ({playerCount.away}/5)
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    className={cn(
                      "px-2 py-1 text-xs font-medium transition-colors",
                      courtMode === "half" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                    )}
                    onClick={() => setCourtMode("half")}
                  >
                    Half Court
                  </button>
                  <button
                    className={cn(
                      "px-2 py-1 text-xs font-medium transition-colors",
                      courtMode === "full" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                    )}
                    onClick={() => setCourtMode("full")}
                  >
                    Full Court
                  </button>
                </div>
              </div>
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

            {/* Actions on current step — with timeline */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {currentStep + 1} Actions ({actions.filter(a => a.stepIndex === currentStep).length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <ActionTimeline
                  actions={actions}
                  stepIndex={currentStep}
                  onUpdateDelay={updateActionDelay}
                  onRemoveAction={(id) => setActions(prev => prev.filter(a => a.id !== id))}
                />
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
