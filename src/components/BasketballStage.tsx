import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

/* ─── constants ─── */
const COURT_W = 50; // width (sideline-to-sideline)
const COURT_L = 94; // length (baseline-to-baseline)
const HALF = COURT_L / 2;
const KEY_W = 12;
const KEY_L = 19;
const THREE_PT_R = 23.75;
const FT_R = 6;
const LINE_Y = 0.06;
const LINE_H = 0.02;

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

/* ─── arc helper ─── */
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
      if (i === 0) {
        shape.moveTo(p.x + norm.x, p.z + norm.z);
      }
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

/* ─── court markings ─── */
function CourtMarkings() {
  const lw = 0.2; // line width
  return (
    <group>
      {/* Boundary */}
      <LinePlane width={COURT_W} depth={lw} position={[0, LINE_Y, HALF]} />
      <LinePlane width={COURT_W} depth={lw} position={[0, LINE_Y, -HALF]} />
      <LinePlane width={lw} depth={COURT_L} position={[COURT_W / 2, LINE_Y, 0]} />
      <LinePlane width={lw} depth={COURT_L} position={[-COURT_W / 2, LINE_Y, 0]} />
      {/* Half-court */}
      <LinePlane width={COURT_W} depth={lw} position={[0, LINE_Y, 0]} />
      {/* Center circle */}
      <ArcLine radius={FT_R} startAngle={0} endAngle={Math.PI * 2} position={[0, LINE_Y, 0]} />

      {/* Near key */}
      <LinePlane width={KEY_W} depth={lw} position={[0, LINE_Y, HALF - KEY_L]} />
      <LinePlane width={lw} depth={KEY_L} position={[KEY_W / 2, LINE_Y, HALF - KEY_L / 2]} />
      <LinePlane width={lw} depth={KEY_L} position={[-KEY_W / 2, LINE_Y, HALF - KEY_L / 2]} />
      <ArcLine radius={FT_R} startAngle={-Math.PI / 2} endAngle={Math.PI / 2} position={[0, LINE_Y, HALF - KEY_L]} />
      {/* Near 3pt */}
      <LinePlane width={lw} depth={14} position={[22, LINE_Y, HALF - 7]} />
      <LinePlane width={lw} depth={14} position={[-22, LINE_Y, HALF - 7]} />
      <ArcLine radius={THREE_PT_R} startAngle={-1.22} endAngle={Math.PI + 1.22} position={[0, LINE_Y, HALF - 5.25]} segments={80} />
      {/* Backboard & rim (near) */}
      <LinePlane width={6} depth={lw} position={[0, LINE_Y, HALF - 4]} />
      <ArcLine radius={0.75} startAngle={0} endAngle={Math.PI * 2} position={[0, LINE_Y, HALF - 5.25]} segments={24} />

      {/* Far key (mirror) */}
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

/* ─── player cylinder ─── */
interface PlayerCylProps {
  startPos: [number, number, number];
  targetPos?: [number, number, number];
  color: string;
  emissive: string;
  label: string;
  animating: boolean;
}

function PlayerCyl({ startPos, targetPos, color, emissive, label, animating }: PlayerCylProps) {
  const ref = useRef<THREE.Group>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current || !targetPos) return;
    if (animating && progress.current < 1) {
      progress.current = Math.min(progress.current + delta * 0.8, 1);
      const t = progress.current;
      ref.current.position.x = THREE.MathUtils.lerp(startPos[0], targetPos[0], t);
      ref.current.position.z = THREE.MathUtils.lerp(startPos[2], targetPos[2], t);
    }
    if (!animating) {
      progress.current = 0;
      ref.current.position.set(...startPos);
    }
  });

  return (
    <group ref={ref} position={startPos}>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 4, 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.3} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 4.5, 0]}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.2} roughness={0.5} />
      </mesh>
      {/* Label */}
      <Text position={[0, 5.8, 0]} fontSize={0.9} color="white" anchorX="center" anchorY="middle"
        outlineWidth={0.05} outlineColor="#000">
        {label}
      </Text>
    </group>
  );
}

/* ─── offensive positions (near basket, half court) ─── */
const OFFENSE: { pos: [number, number, number]; label: string }[] = [
  { pos: [0, 0, 30], label: "PG" },
  { pos: [-12, 0, 25], label: "SG" },
  { pos: [12, 0, 25], label: "SF" },
  { pos: [-8, 0, 38], label: "PF" },
  { pos: [8, 0, 38], label: "C" },
];

const DEFENSE: { pos: [number, number, number]; label: string }[] = [
  { pos: [0, 0, 33], label: "D1" },
  { pos: [-10, 0, 28], label: "D2" },
  { pos: [10, 0, 28], label: "D3" },
  { pos: [-6, 0, 40], label: "D4" },
  { pos: [6, 0, 40], label: "D5" },
];

/* ─── scene ─── */
function Scene({ playing }: { playing: boolean }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[30, 50, 20]} intensity={1} castShadow />
      <directionalLight position={[-20, 30, -10]} intensity={0.4} />
      <pointLight position={[0, 40, 0]} intensity={0.6} color="#ffe4b5" />

      {/* Court floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[COURT_W, COURT_L]} />
        <meshStandardMaterial color="#D2B48C" roughness={0.7} metalness={0.05} />
      </mesh>

      <CourtMarkings />

      {/* Offense (blue) */}
      {OFFENSE.map((p, i) => (
        <PlayerCyl
          key={`o${i}`}
          startPos={p.pos}
          targetPos={i === 0 ? [10, 0, 40] : undefined}
          color="#2563eb"
          emissive="#1a3fa0"
          label={p.label}
          animating={playing}
        />
      ))}

      {/* Defense (red) */}
      {DEFENSE.map((p, i) => (
        <PlayerCyl
          key={`d${i}`}
          startPos={p.pos}
          color="#ef4444"
          emissive="#a01a1a"
          label={p.label}
          animating={playing}
        />
      ))}

      {/* Camera controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={15}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

/* ─── main export ─── */
export default function BasketballStage() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden border border-border bg-background">
      <Canvas
        camera={{ position: [45, 40, 45], fov: 50 }}
        shadows
        gl={{ antialias: true }}
      >
        <Scene playing={playing} />
      </Canvas>

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
        <Button
          onClick={() => setPlaying(true)}
          disabled={playing}
          className="gap-2"
          size="lg"
        >
          <Play className="w-4 h-4" />
          Play
        </Button>
        <Button
          variant="outline"
          onClick={() => setPlaying(false)}
          disabled={!playing}
          className="gap-2"
          size="lg"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}
