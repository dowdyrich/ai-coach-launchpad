import { useRef, useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Eraser, Trash2, Download, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawTool = "pen" | "eraser";

const COLORS = [
  "hsl(221, 83%, 53%)", // primary blue
  "hsl(0, 84%, 60%)",   // red
  "hsl(142, 71%, 45%)", // green
  "hsl(38, 92%, 50%)",  // orange
  "hsl(262, 83%, 58%)", // purple
  "hsl(0, 0%, 100%)",   // white
  "hsl(0, 0%, 0%)",     // black
];

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [lineWidth, setLineWidth] = useState(3);

  const W = 1000;
  const H = 600;

  // Draw court background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCourtBackground(ctx);
  }, []);

  const drawCourtBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "hsl(25, 53%, 72%)";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.beginPath();
    ctx.moveTo(W / 2, 30);
    ctx.lineTo(W / 2, H - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 50, 0, Math.PI * 2);
    ctx.stroke();
  };

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
  };

  const startDraw = (e: React.MouseEvent) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.strokeStyle = tool === "eraser" ? "hsl(25, 53%, 72%)" : color;
    ctx.lineWidth = tool === "eraser" ? 20 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawCourtBackground(ctx);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Whiteboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <Card className="lg:w-56">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Drawing Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant={tool === "pen" ? "default" : "ghost"}
              className={cn("w-full justify-start", tool === "pen" && "gradient-primary")}
              onClick={() => setTool("pen")}
            >
              <Pencil className="w-4 h-4 mr-2" /> Pen
            </Button>
            <Button
              variant={tool === "eraser" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setTool("eraser")}
            >
              <Eraser className="w-4 h-4 mr-2" /> Eraser
            </Button>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Palette className="w-3 h-3" /> Colors
              </p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      color === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">Line Width</p>
              <input
                type="range"
                min="1"
                max="10"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="border-t pt-3">
              <Button variant="ghost" className="w-full justify-start text-destructive" onClick={clearCanvas}>
                <Trash2 className="w-4 h-4 mr-2" /> Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="w-full rounded-lg cursor-crosshair border"
              style={{ aspectRatio: `${W}/${H}` }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
