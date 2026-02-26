import { useState } from "react";
import BasketballStage from "@/components/BasketballStage";
import PlayImporter, { type GeneratedPlay, type PlayStep } from "@/components/PlayImporter";

export default function Visualizer() {
  const [steps, setSteps] = useState<PlayStep[]>([]);
  const [autoPlay, setAutoPlay] = useState(false);
  const [playName, setPlayName] = useState("");

  const handlePlayGenerated = (play: GeneratedPlay) => {
    setAutoPlay(false);
    setSteps(play.steps);
    setPlayName(play.name);
    // Trigger auto-play after a tick
    setTimeout(() => setAutoPlay(true), 100);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">3D Play Visualizer</h1>
          <p className="text-muted-foreground mt-1">
            Import a play description and watch it animate in 3D.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <PlayImporter onPlayGenerated={handlePlayGenerated} />
            {playName && (
              <div className="mt-3 p-3 rounded-lg bg-muted text-sm">
                <span className="font-semibold text-foreground">Generated:</span>{" "}
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
