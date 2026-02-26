import BasketballStage from "@/components/BasketballStage";

export default function Visualizer() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">3D Play Visualizer</h1>
          <p className="text-muted-foreground mt-1">
            Rotate, zoom, and watch plays animate in a 2K-style isometric view.
          </p>
        </div>
        <BasketballStage />
      </div>
    </div>
  );
}
