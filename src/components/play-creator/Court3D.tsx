import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { PlayerFigure } from "./PlayerFigure";
import { ActionLine3D } from "./ActionLine3D";

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

interface Court3DProps {
  players: CourtPlayer[];
  actions: CourtAction[];
  selectedPlayer: string | null;
  onPlayerClick?: (id: string) => void;
  onCourtClick?: (x: number, y: number) => void;
  activeStep?: number;
}

function CourtFloor() {
  return (
    <group>
      {/* Main court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[28.65, 15.24]} />
        <meshStandardMaterial color="hsl(25, 53%, 62%)" />
      </mesh>

      {/* Court boundary lines */}
      <CourtLines />
    </group>
  );
}

function CourtLines() {
  const lines = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Boundary
    const boundary = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-14, 0.01, -7.5),
      new THREE.Vector3(14, 0.01, -7.5),
      new THREE.Vector3(14, 0.01, 7.5),
      new THREE.Vector3(-14, 0.01, 7.5),
      new THREE.Vector3(-14, 0.01, -7.5),
    ]);
    geometries.push(boundary);

    // Half court line
    const half = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.01, -7.5),
      new THREE.Vector3(0, 0.01, 7.5),
    ]);
    geometries.push(half);

    // Center circle
    const circlePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      circlePoints.push(new THREE.Vector3(Math.cos(angle) * 1.8, 0.01, Math.sin(angle) * 1.8));
    }
    geometries.push(new THREE.BufferGeometry().setFromPoints(circlePoints));

    // Three-point arcs
    for (const side of [-1, 1]) {
      const arcPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= 32; i++) {
        const angle = -Math.PI / 2.5 + (i / 32) * (Math.PI / 1.25);
        arcPoints.push(new THREE.Vector3(side * 12.5 + Math.cos(angle) * side * -5.5, 0.01, Math.sin(angle) * 5.5));
      }
      geometries.push(new THREE.BufferGeometry().setFromPoints(arcPoints));
    }

    // Keys (paint areas)
    for (const side of [-1, 1]) {
      const keyX = side * 14;
      const keyW = side * -5.8;
      const keyPoints = [
        new THREE.Vector3(keyX, 0.01, -2.44),
        new THREE.Vector3(keyX + keyW, 0.01, -2.44),
        new THREE.Vector3(keyX + keyW, 0.01, 2.44),
        new THREE.Vector3(keyX, 0.01, 2.44),
      ];
      geometries.push(new THREE.BufferGeometry().setFromPoints(keyPoints));
    }

    // Baskets
    for (const side of [-1, 1]) {
      const basketPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        basketPts.push(new THREE.Vector3(side * 13.1 + Math.cos(angle) * 0.23, 0.01, Math.sin(angle) * 0.23));
      }
      geometries.push(new THREE.BufferGeometry().setFromPoints(basketPts));
    }

    return geometries.map((g, i) => ({ geometry: g, key: i }));
  }, []);

  return (
    <group>
      {lines.map(({ geometry, key }) => (
        <lineSegments key={key} geometry={geometry}>
          <lineBasicMaterial color="white" />
        </lineSegments>
      ))}
    </group>
  );
}

function BackboardAndHoop({ side }: { side: 1 | -1 }) {
  return (
    <group position={[side * 13.4, 0, 0]}>
      {/* Backboard */}
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[0.05, 1.1, 1.8]} />
        <meshStandardMaterial color="white" transparent opacity={0.7} />
      </mesh>
      {/* Rim */}
      <mesh position={[side * -0.4, 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.02, 8, 24]} />
        <meshStandardMaterial color="hsl(15, 90%, 50%)" />
      </mesh>
      {/* Pole */}
      <mesh position={[side * 0.15, 1.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.8]} />
        <meshStandardMaterial color="hsl(0, 0%, 40%)" />
      </mesh>
    </group>
  );
}

export function Court3D({ players, actions, selectedPlayer, onPlayerClick, onCourtClick, activeStep }: Court3DProps) {
  // Convert 2D canvas coords (0-800, 0-500) to 3D court coords
  const toCourtPos = (x: number, y: number): [number, number, number] => {
    return [(x / 800) * 28.65 - 14.325, 0, (y / 500) * 15.24 - 7.62];
  };

  const handlePointerDown = (e: any) => {
    if (e.object?.userData?.isFloor && onCourtClick) {
      const point = e.point;
      // Convert back to 2D coords
      const x = ((point.x + 14.325) / 28.65) * 800;
      const y = ((point.z + 7.62) / 15.24) * 500;
      onCourtClick(x, y);
    }
  };

  const filteredActions = activeStep !== undefined
    ? actions.filter(a => a.stepIndex <= activeStep)
    : actions;

  return (
    <div className="w-full aspect-[16/10] rounded-lg overflow-hidden border border-border bg-background">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 18, 16]} fov={50} />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          maxPolarAngle={Math.PI / 2.2}
          minDistance={8}
          maxDistance={35}
        />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 15, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-5, 10, -5]} intensity={0.3} />

        {/* Court floor (clickable) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
          onPointerDown={handlePointerDown}
          userData={{ isFloor: true }}
        >
          <planeGeometry args={[30, 17]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>

        <CourtFloor />
        <BackboardAndHoop side={1} />
        <BackboardAndHoop side={-1} />

        {/* Players */}
        {players.map((p) => {
          const [px, , pz] = toCourtPos(p.x, p.y);
          return (
            <PlayerFigure
              key={p.id}
              position={[px, 0, pz]}
              number={p.number}
              team={p.team}
              isSelected={p.id === selectedPlayer}
              onClick={() => onPlayerClick?.(p.id)}
            />
          );
        })}

        {/* Action lines */}
        {filteredActions.map((a, i) => {
          const [fx, , fz] = toCourtPos(a.fromX, a.fromY);
          const [tx, , tz] = toCourtPos(a.toX, a.toY);
          return (
            <ActionLine3D
              key={i}
              from={[fx, 0.5, fz]}
              to={[tx, 0.5, tz]}
              type={a.type}
            />
          );
        })}
      </Canvas>
    </div>
  );
}
