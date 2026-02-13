import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MousePointer2, Circle, ArrowRight, Move, Hand,
  Undo, Redo, Trash2, Download
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "select" | "player" | "move" | "pass" | "screen" | "dribble";

interface CourtPlayer {
  id: string;
  x: number;
  y: number;
  number: number;
  team: "home" | "away";
}

interface CourtAction {
  type: "pass" | "move" | "screen" | "dribble";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export default function CreatePlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [players, setPlayers] = useState<CourtPlayer[]>([]);
  const [actions, setActions] = useState<CourtAction[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [playerCount, setPlayerCount] = useState({ home: 0, away: 0 });

  const COURT_WIDTH = 800;
  const COURT_HEIGHT = 500;

  const drawCourt = useCallback((ctx: CanvasRenderingContext2D) => {
    // Court background
    ctx.fillStyle = "hsl(25, 53%, 72%)";
    ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

    // Court lines
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;

    // Boundary
    ctx.strokeRect(20, 20, COURT_WIDTH - 40, COURT_HEIGHT - 40);

    // Half court
    ctx.beginPath();
    ctx.moveTo(COURT_WIDTH / 2, 20);
    ctx.lineTo(COURT_WIDTH / 2, COURT_HEIGHT - 20);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(COURT_WIDTH / 2, COURT_HEIGHT / 2, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Left three-point arc
    ctx.beginPath();
    ctx.arc(100, COURT_HEIGHT / 2, 120, -Math.PI / 2.5, Math.PI / 2.5);
    ctx.stroke();

    // Right three-point arc
    ctx.beginPath();
    ctx.arc(COURT_WIDTH - 100, COURT_HEIGHT / 2, 120, Math.PI - Math.PI / 2.5, Math.PI + Math.PI / 2.5);
    ctx.stroke();

    // Left key
    ctx.strokeRect(20, COURT_HEIGHT / 2 - 60, 120, 120);

    // Right key
    ctx.strokeRect(COURT_WIDTH - 140, COURT_HEIGHT / 2 - 60, 120, 120);

    // Left basket
    ctx.beginPath();
    ctx.arc(50, COURT_HEIGHT / 2, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Right basket
    ctx.beginPath();
    ctx.arc(COURT_WIDTH - 50, COURT_HEIGHT / 2, 8, 0, Math.PI * 2);
    ctx.stroke();
  }, []);

  const drawPlayers = useCallback((ctx: CanvasRenderingContext2D) => {
    players.forEach((p) => {
      const isSelected = p.id === selectedPlayer;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = p.team === "home" ? "hsl(221, 83%, 53%)" : "hsl(0, 84%, 60%)";
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.fillStyle = "white";
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p.number), p.x, p.y);
    });
  }, [players, selectedPlayer]);

  const drawActions = useCallback((ctx: CanvasRenderingContext2D) => {
    actions.forEach((a) => {
      ctx.beginPath();
      ctx.moveTo(a.fromX, a.fromY);
      ctx.lineTo(a.toX, a.toY);

      if (a.type === "pass") {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.setLineDash([]);
      } else if (a.type === "move") {
        ctx.strokeStyle = "rgba(255,255,0,0.8)";
        ctx.setLineDash([8, 4]);
      } else if (a.type === "screen") {
        ctx.strokeStyle = "rgba(255,100,100,0.8)";
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = "rgba(100,255,100,0.8)";
        ctx.setLineDash([2, 6]);
      }
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const angle = Math.atan2(a.toY - a.fromY, a.toX - a.fromX);
      ctx.beginPath();
      ctx.moveTo(a.toX, a.toY);
      ctx.lineTo(a.toX - 10 * Math.cos(angle - 0.3), a.toY - 10 * Math.sin(angle - 0.3));
      ctx.lineTo(a.toX - 10 * Math.cos(angle + 0.3), a.toY - 10 * Math.sin(angle + 0.3));
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    });
  }, [actions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, COURT_WIDTH, COURT_HEIGHT);
    drawCourt(ctx);
    drawActions(ctx);
    drawPlayers(ctx);
  }, [drawCourt, drawPlayers, drawActions]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scaleX = COURT_WIDTH / rect.width;
    const scaleY = COURT_HEIGHT / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const findPlayerAt = (x: number, y: number) =>
    players.find((p) => Math.hypot(p.x - x, p.y - y) < 20);

  const handleCanvasClick = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    if (tool === "player") {
      const team = playerCount.home <= playerCount.away ? "home" : "away";
      const count = team === "home" ? playerCount.home : playerCount.away;
      if (count >= 5) return;
      setPlayers((prev) => [
        ...prev,
        { id: crypto.randomUUID(), x: pos.x, y: pos.y, number: count + 1, team },
      ]);
      setPlayerCount((prev) => ({ ...prev, [team]: prev[team] + 1 }));
    } else if (tool === "select") {
      const p = findPlayerAt(pos.x, pos.y);
      setSelectedPlayer(p?.id || null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === "select" || tool === "move") {
      const pos = getCanvasPos(e);
      const p = findPlayerAt(pos.x, pos.y);
      if (p) {
        setSelectedPlayer(p.id);
        setIsDragging(true);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedPlayer) return;
    const pos = getCanvasPos(e);
    setPlayers((prev) => prev.map((p) => (p.id === selectedPlayer ? { ...p, x: pos.x, y: pos.y } : p)));
  };

  const handleMouseUp = () => setIsDragging(false);

  const tools: { id: Tool; icon: typeof MousePointer2; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "player", icon: Circle, label: "Add Player" },
    { id: "move", icon: Move, label: "Move" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Play Creator</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* Toolbar */}
        <Card className="lg:w-56">
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
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setPlayers([]); setActions([]); setPlayerCount({ home: 0, away: 0 }); }}>
              <Trash2 className="w-4 h-4 mr-2" /> Clear All
            </Button>
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card>
          <CardContent className="p-4">
            <canvas
              ref={canvasRef}
              width={COURT_WIDTH}
              height={COURT_HEIGHT}
              className="w-full rounded-lg cursor-crosshair border"
              style={{ aspectRatio: `${COURT_WIDTH}/${COURT_HEIGHT}` }}
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary" /> Home ({playerCount.home}/5)
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-destructive" /> Away ({playerCount.away}/5)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
