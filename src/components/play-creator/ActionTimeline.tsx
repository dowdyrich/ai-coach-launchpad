import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { X, Clock, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const ACTION_COLORS: Record<string, string> = {
  pass: "bg-foreground",
  move: "bg-warning",
  screen: "bg-destructive",
  dribble: "bg-accent",
};

const ACTION_BAR_COLORS: Record<string, string> = {
  pass: "bg-foreground/80",
  move: "bg-warning/80",
  screen: "bg-destructive/80",
  dribble: "bg-accent/80",
};

interface ActionTimelineProps {
  actions: CourtAction[];
  stepIndex: number;
  onUpdateDelay: (actionId: string, delay: number) => void;
  onRemoveAction: (actionId: string) => void;
  maxDelay?: number;
}

export function ActionTimeline({
  actions,
  stepIndex,
  onUpdateDelay,
  onRemoveAction,
  maxDelay = 3,
}: ActionTimelineProps) {
  const stepActions = actions.filter((a) => a.stepIndex === stepIndex);

  if (stepActions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No actions on this step. Select a player and choose an action tool.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Timeline header */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span>0s</span>
        <span className="flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" /> Delay
        </span>
        <span>{maxDelay}s</span>
      </div>

      {stepActions.map((a) => (
        <div key={a.id} className="group relative">
          <div className="flex items-center gap-1.5">
            {/* Action type label */}
            <div className="flex items-center gap-1 min-w-[60px]">
              <div className={cn("w-2 h-2 rounded-full shrink-0", ACTION_COLORS[a.type])} />
              <span className="capitalize text-[11px] font-medium truncate">{a.type}</span>
            </div>

            {/* Timeline bar */}
            <div className="flex-1 relative h-6 flex items-center">
              {/* Background track */}
              <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />
              {/* Delay indicator bar */}
              <div
                className={cn("absolute h-1.5 rounded-full transition-all", ACTION_BAR_COLORS[a.type])}
                style={{
                  left: `${((a.delay || 0) / maxDelay) * 100}%`,
                  right: "0%",
                }}
              />
              {/* Slider control */}
              <Slider
                value={[a.delay || 0]}
                min={0}
                max={maxDelay}
                step={0.25}
                onValueChange={([val]) => onUpdateDelay(a.id, val)}
                className="absolute inset-x-0"
              />
            </div>

            {/* Delay value */}
            <span className="text-[10px] text-muted-foreground w-6 text-right tabular-nums">
              {(a.delay || 0).toFixed(1)}s
            </span>

            {/* Remove button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemoveAction(a.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
