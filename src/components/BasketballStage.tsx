import { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, SkipForward, SkipBack } from "lucide-react";
import type { PlayStep } from "@/components/PlayImporter";

/* ─── constants ─── */
const COURT_W = 50;
const COURT_L = 94;
const HALF = COURT_L / 2;
const KEY_W = 12;
const KEY_L = 19;
const THREE_PT_R = 23.75;
const FT_R = 6;
const LINE_Y = 0.06;

/* ─── helpers ─── */
function LinePlane({ width, depth, position, rotation }: {
  width: number; depth: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation || [-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
    </mesh>
  );
}

function ArcLine({ radius, startAngle, endAngle, position, segments = 64 }: {
  radius: number; startAngle: number; endAngle: number;
  position: [number, number, number]; segments?: number;
}) {
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = startAngle + (endAngle - startAngle) * (i / segments);
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const shape = new THREE.Shape();
    const thickness = 0.2;
    pts.forEach((p, i) => {
      const next = pts[Math.min(i + 1, pts.length - 1)];
      const dir = new THREE.Vector3().subVectors(next, p).normalize();
      const norm = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(thickness / 2);
      if (i === 0) shape.moveTo(p.x + norm.x, p.z + norm.z);
      shape.lineTo(p.x + norm.x, p.z + norm.z);
    });
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      const next = pts[Math.min(i + 1, pts.length - 1)];
      const dir = new THREE.Vector3().subVectors(next, p).normalize();
      const norm = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(thickness / 2);
      shape.lineTo(p.x + norm.x, p.z + norm.z);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [radius, startAngle, endAngle, segments]);

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
      <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
    </mesh>
  );
}

function CourtMarkings() {
  const lw = 0.2;
  return (
    <group>
      <LinePlane width={COURT_W} depth={lw} position={[0, LINE_Y, HALF]} />
      <LinePlane width={COURT_W} depth={lw} position={[0, LINE_Y, -HALF]} />
      <LinePlane width={lw} depth={COURT_L} position={[COURT_W / 2, LINE_Y, 0]} />
      <LinePlane width={lw} depth={COURT_L} position={[-COURT_W / 2, LINE_Y, 0]} />
      <LinePlane width={COURT_W} depth={lw} position={[0, LINE_Y, 0]} />
      <ArcLine radius={FT_R} startAngle={0} endAngle={Math.PI * 2} position={[0, LINE_Y, 0]} />
      <LinePlane width={KEY_W} depth={lw} position={[0, LINE_Y, HALF - KEY_L]} />
      <LinePlane width={lw} depth={KEY_L} position={[KEY_W / 2, LINE_Y, HALF - KEY_L / 2]} />
      <LinePlane width={lw} depth={KEY_L} position={[-KEY_W / 2, LINE_Y, HALF - KEY_L / 2]} />
      <ArcLine radius={FT_R} startAngle={-Math.PI / 2} endAngle={Math.PI / 2} position={[0, LINE_Y, HALF - KEY_L]} />
      <LinePlane width={lw} depth={14} position={[22, LINE_Y, HALF - 7]} />
      <LinePlane width={lw} depth={14} position={[-22, LINE_Y, HALF - 7]} />
      <ArcLine radius={THREE_PT_R} startAngle={-1.22} endAngle={Math.PI + 1.22} position={[0, LINE_Y, HALF - 5.25]} segments={80} />
      <LinePlane width={6} depth={lw} position={[0, LINE_Y, HALF - 4]} />
      <ArcLine radius={0.75} startAngle={0} endAngle={Math.PI * 2} position={[0, LINE_Y, HALF - 5.25]} segments={24} />
      <LinePlane width={KEY_W} depth={lw} position={[0, LINE_Y, -(HALF - KEY_L)]} />
      <LinePlane width={lw} depth={KEY_L} position={[KEY_W / 2, LINE_Y, -(HALF - KEY_L / 2)]} />
      <LinePlane width={lw} depth={KEY_L} position={[-KEY_W / 2, LINE_Y, -(HALF - KEY_L / 2)]} />
      <ArcLine radius={FT_R} startAngle={Math.PI / 2} endAngle={Math.PI * 1.5} position={[0, LINE_Y, -(HALF - KEY_L)]} />
      <LinePlane width={lw} depth={14} position={[22, LINE_Y, -(HALF - 7)]} />
      <LinePlane width={lw} depth={14} position={[-22, LINE_Y, -(HALF - 7)]} />
      <ArcLine radius={THREE_PT_R} startAngle={Math.PI - 1.22} endAngle={2 * Math.PI + 1.22} position={[0, LINE_Y, -(HALF - 5.25)]} segments={80} />
      <LinePlane width={6} depth={lw} position={[0, LINE_Y, -(HALF - 4)]} />
      <ArcLine radius={0.75} startAngle={0} endAngle={Math.PI * 2} position={[0, LINE_Y, -(HALF - 5.25)]} segments={24} />
    </group>
  );
}

/* ─── animated player ─── */
interface AnimPlayerProps {
  fromPos: [number, number, number];
  toPos: [number, number, number];
  color: string;
  emissive: string;
  label: string;
  animating: boolean;
  speed?: number;
}

function AnimPlayer({ fromPos, toPos, color, emissive, label, animating, speed = 0.8 }: AnimPlayerProps) {
  const ref = useRef<THREE.Group>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (animating && progress.current < 1) {
      progress.current = Math.min(progress.current + delta * speed, 1);
      const t = progress.current;
      ref.current.position.x = THREE.MathUtils.lerp(fromPos[0], toPos[0], t);
      ref.current.position.z = THREE.MathUtils.lerp(fromPos[2], toPos[2], t);
    }
    if (!animating) {
      progress.current = 0;
      ref.current.position.set(...fromPos);
    }
  });

  return (
    <group ref={ref} position={fromPos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 4, 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.3} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.2} roughness={0.5} />
      </mesh>
      <Text position={[0, 5.8, 0]} fontSize={0.9} color="white" anchorX="center" anchorY="middle"
        outlineWidth={0.05} outlineColor="#000">
        {label}
      </Text>
    </group>
  );
}

/* ─── default positions ─── */
const DEFAULT_PLAYERS = ["O1", "O2", "O3", "O4", "O5"] as const;
const DEFAULT_POS: Record<string, { x: number; z: number; label: string }> = {
  O1: { x: 0, z: 30, label: "PG" },
  O2: { x: -12, z: 25, label: "SG" },
  O3: { x: 12, z: 25, label: "SF" },
  O4: { x: -8, z: 38, label: "PF" },
  O5: { x: 8, z: 38, label: "C" },
};

/* ─── scene ─── */
interface SceneProps {
  playing: boolean;
  steps: PlayStep[];
  currentStep: number;
}

function Scene({ playing, steps, currentStep }: SceneProps) {
  const fromStep = steps[currentStep] || null;
  const toStep = steps[Math.min(currentStep + 1, steps.length - 1)] || null;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[30, 50, 20]} intensity={1} castShadow />
      <directionalLight position={[-20, 30, -10]} intensity={0.4} />
      <pointLight position={[0, 40, 0]} intensity={0.6} color="#ffe4b5" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[COURT_W, COURT_L]} />
        <meshStandardMaterial color="#D2B48C" roughness={0.7} metalness={0.05} />
      </mesh>

      <CourtMarkings />

      {DEFAULT_PLAYERS.map((key) => {
        const from = fromStep?.players?.[key] || DEFAULT_POS[key];
        const to = toStep?.players?.[key] || from;
        return (
          <AnimPlayer
            key={key}
            fromPos={[from.x, 0, from.z]}
            toPos={[to.x, 0, to.z]}
            color="#2563eb"
            emissive="#1a3fa0"
            label={from.label || key}
            animating={playing}
          />
        );
      })}

      <OrbitControls enablePan enableZoom enableRotate minDistance={15} maxDistance={120} maxPolarAngle={Math.PI / 2.1} />
    </>
  );
}

/* ─── main export ─── */
interface BasketballStageProps {
  steps?: PlayStep[];
  autoPlay?: boolean;
}

export default function BasketballStage({ steps: externalSteps, autoPlay }: BasketballStageProps) {
  const defaultSteps: PlayStep[] = [{
    step: 1, description: "Initial",
    players: DEFAULT_POS,
  }];

  const steps = externalSteps && externalSteps.length > 0 ? externalSteps : defaultSteps;
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (autoPlay && steps.length > 1) {
      setCurrentStep(0);
      setPlaying(true);
    }
  }, [autoPlay, steps]);

  // Auto-advance steps
  useEffect(() => {
    if (!playing || currentStep >= steps.length - 1) return;
    const timer = setTimeout(() => {
      setPlaying(false);
      setTimeout(() => {
        setCurrentStep((s) => Math.min(s + 1, steps.length - 2));
        setPlaying(true);
      }, 200);
    }, 1500);
    return () => clearTimeout(timer);
  }, [playing, currentStep, steps.length]);

  const handleReset = () => {
    setPlaying(false);
    setCurrentStep(0);
  };

  const stepLabel = steps.length > 1
    ? `Step ${currentStep + 1}→${Math.min(currentStep + 2, steps.length)} of ${steps.length}`
    : "Default";

  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden border border-border bg-background">
      <Canvas camera={{ position: [45, 40, 45], fov: 50 }} shadows gl={{ antialias: true }}>
        <Scene playing={playing} steps={steps} currentStep={currentStep} />
      </Canvas>

      {/* Step description */}
      {steps.length > 1 && steps[currentStep]?.description && (
        <div className="absolute top-4 left-4 right-4 bg-background/80 backdrop-blur rounded-lg px-4 py-2 text-sm text-foreground">
          <span className="font-semibold text-primary">{stepLabel}:</span>{" "}
          {steps[currentStep].description}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 items-center">
        {steps.length > 1 && (
          <Button variant="outline" size="icon" onClick={() => { setPlaying(false); setCurrentStep(Math.max(0, currentStep - 1)); }} disabled={currentStep === 0}>
            <SkipBack className="w-4 h-4" />
          </Button>
        )}
        <Button onClick={() => setPlaying(true)} disabled={playing || currentStep >= steps.length - 1} className="gap-2" size="lg">
          <Play className="w-4 h-4" /> Play
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={!playing && currentStep === 0} className="gap-2" size="lg">
          <RotateCcw className="w-4 h-4" /> Reset
        </Button>
        {steps.length > 1 && (
          <Button variant="outline" size="icon" onClick={() => { setPlaying(false); setCurrentStep(Math.min(steps.length - 2, currentStep + 1)); }} disabled={currentStep >= steps.length - 2}>
            <SkipForward className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
