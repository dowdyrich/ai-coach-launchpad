import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { PlayerFigure } from "./PlayerFigure";
import { ActionLine3D } from "./ActionLine3D";

export type CourtMode = "full" | "half";

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
  waypoints?: { x: number; y: number }[];
  delay?: number;
}

interface Court3DProps {
  players: CourtPlayer[];
  actions: CourtAction[];
  selectedPlayer: string | null;
  onPlayerClick?: (id: string) => void;
  onCourtClick?: (x: number, y: number) => void;
  isAnimating?: boolean;
  onAnimationEnd?: () => void;
  animationSpeed?: number;
  courtMode?: CourtMode;
  /** Live preview waypoints for free-path drawing */
  drawingPreview?: { playerX: number; playerY: number; waypoints: { x: number; y: number }[] } | null;
}

// ── NBA Official Dimensions (in meters) ─────────────────────────
const FT = 0.3048;
const COURT_LENGTH = 94 * FT;    // 28.6512m
const COURT_WIDTH = 50 * FT;     // 15.24m
const HALF_L = COURT_LENGTH / 2; // 14.3256m
const HALF_W = COURT_WIDTH / 2;  // 7.62m

const BASKET_FROM_BASELINE = 5.25 * FT;   // 1.6002m (center of basket)
const KEY_WIDTH = 16 * FT;                  // 4.8768m (outside)
const KEY_HALF_W = KEY_WIDTH / 2;           // 2.4384m
const KEY_LENGTH = 19 * FT;                 // 5.7912m from baseline
const FT_CIRCLE_R = 6 * FT;                // 1.8288m free-throw circle
const THREE_PT_R = 23.75 * FT;             // 7.2390m
const THREE_PT_CORNER_DIST = 3 * FT;       // 0.9144m from sideline
const CENTER_CIRCLE_R = 6 * FT;            // 1.8288m
const RESTRICTED_R = 4 * FT;               // 1.2192m
const BASKET_RING_R = 0.2286;              // 9 inches = 0.2286m
const BACKBOARD_WIDTH = 6 * FT;            // 1.8288m
const BACKBOARD_FROM_BASELINE = 4 * FT;    // 1.2192m

// ── Court Floor ──────────────────────────────────────────────────
function CourtFloor({ mode }: { mode: CourtMode }) {
  const floorW = mode === "full" ? COURT_LENGTH + 1 : HALF_L + 1;
  const floorX = mode === "full" ? 0 : HALF_L / 2;

  return (
    <group>
      {/* Main court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[floorX, 0, 0]} receiveShadow>
        <planeGeometry args={[floorW, COURT_WIDTH + 1]} />
        <meshStandardMaterial color="hsl(25, 53%, 62%)" />
      </mesh>
      {/* Paint/key areas - slightly different color */}
      {(mode === "full" ? [1, -1] : [1]).map(side => {
        const baseX = side * HALF_L;
        const dir = -side;
        const paintX = baseX + dir * KEY_LENGTH / 2;
        return (
          <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[paintX, 0.001, 0]}>
            <planeGeometry args={[KEY_LENGTH, KEY_WIDTH]} />
            <meshStandardMaterial color="hsl(25, 45%, 55%)" />
          </mesh>
        );
      })}
      <CourtLines mode={mode} />
    </group>
  );
}

// ── Accurate NBA Court Lines ─────────────────────────────────────
function CourtLines({ mode }: { mode: CourtMode }) {
  const lines = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const Y = 0.01;
    const sides: (1 | -1)[] = mode === "full" ? [-1, 1] : [1];
    const minX = mode === "full" ? -HALF_L : 0;

    const pts = (...coords: [number, number][]) =>
      coords.map(([x, z]) => new THREE.Vector3(x, Y, z));

    const addLine = (points: THREE.Vector3[]) =>
      geos.push(new THREE.BufferGeometry().setFromPoints(points));

    const addArc = (cx: number, cz: number, r: number, startA: number, endA: number, segs = 48) => {
      const p: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = startA + (i / segs) * (endA - startA);
        p.push(new THREE.Vector3(cx + Math.cos(a) * r, Y, cz + Math.sin(a) * r));
      }
      addLine(p);
    };

    // ── Boundary ──
    addLine(pts(
      [minX, -HALF_W], [HALF_L, -HALF_W],
      [HALF_L, HALF_W], [minX, HALF_W], [minX, -HALF_W]
    ));

    // ── Half-court line ──
    if (mode === "full") {
      addLine(pts([0, -HALF_W], [0, HALF_W]));
    }

    // ── Center circle ──
    if (mode === "full") {
      addArc(0, 0, CENTER_CIRCLE_R, 0, Math.PI * 2, 64);
    } else {
      // Half circle on the half-court line side
      addArc(0, 0, CENTER_CIRCLE_R, -Math.PI / 2, Math.PI / 2, 32);
    }

    // ── Per-side elements ──
    for (const side of sides) {
      const baseX = side * HALF_L;
      const dir = -side; // direction toward center
      const basketX = baseX + dir * BASKET_FROM_BASELINE;

      // Key / Paint outline
      const keyEndX = baseX + dir * KEY_LENGTH;
      addLine(pts(
        [baseX, -KEY_HALF_W], [keyEndX, -KEY_HALF_W],
        [keyEndX, KEY_HALF_W], [baseX, KEY_HALF_W]
      ));

      // Free-throw line (connecting top of key)
      addLine(pts([keyEndX, -KEY_HALF_W], [keyEndX, KEY_HALF_W]));

      // Free-throw circle - solid half (toward basket)
      const ftSolidStart = side === 1 ? Math.PI / 2 : -Math.PI / 2;
      const ftSolidEnd = side === 1 ? (3 * Math.PI) / 2 : Math.PI / 2;
      addArc(keyEndX, 0, FT_CIRCLE_R, ftSolidStart, ftSolidEnd, 32);

      // Free-throw circle - dashed half (away from basket)
      const ftDashStart = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      const ftDashEnd = side === 1 ? Math.PI / 2 : (3 * Math.PI) / 2;
      const dashCount = 6;
      for (let d = 0; d < dashCount; d++) {
        if (d % 2 === 0) {
          const dStart = ftDashStart + (d / dashCount) * (ftDashEnd - ftDashStart);
          const dEnd = ftDashStart + ((d + 1) / dashCount) * (ftDashEnd - ftDashStart);
          addArc(keyEndX, 0, FT_CIRCLE_R, dStart, dEnd, 8);
        }
      }

      // Three-point line
      const tpCornerZ = HALF_W - THREE_PT_CORNER_DIST;
      const aCorner = Math.asin(Math.min(tpCornerZ / THREE_PT_R, 1));

      // Corner straight portions (from baseline to arc start)
      const cornerArcX = basketX + dir * Math.cos(aCorner) * THREE_PT_R * (-dir);
      // For side=1: corner x = basketX - cos(aCorner)*R (toward center)
      // For side=-1: corner x = basketX + cos(aCorner)*R (toward center)
      const cornerXStart = baseX;
      // Actually compute where arc meets the corner z line
      // Point on arc at corner: (basketX + R*cos(a), R*sin(a)) where sin(a) = cornerZ/R
      // For side=1, the arc points TOWARD center, so cos(a) is positive means toward baseline
      // We want the arc point x closer to baseline
      const arcCornerX_top = basketX + Math.cos(aCorner) * THREE_PT_R;
      const arcCornerX_bot = basketX + Math.cos(-aCorner) * THREE_PT_R;

      // Corner lines run from baseline straight toward center at ±tpCornerZ
      // Top corner (z = +tpCornerZ)
      if (side === 1) {
        addLine(pts([baseX, tpCornerZ], [basketX + Math.cos(aCorner) * THREE_PT_R, tpCornerZ]));
        addLine(pts([baseX, -tpCornerZ], [basketX + Math.cos(aCorner) * THREE_PT_R, -tpCornerZ]));
      } else {
        addLine(pts([baseX, tpCornerZ], [basketX - Math.cos(aCorner) * THREE_PT_R, tpCornerZ]));
        addLine(pts([baseX, -tpCornerZ], [basketX - Math.cos(aCorner) * THREE_PT_R, -tpCornerZ]));
      }

      // Three-point arc
      if (side === 1) {
        // Arc from bottom corner to top corner, sweeping through π (toward center)
        addArc(basketX, 0, THREE_PT_R, aCorner, 2 * Math.PI - aCorner, 64);
      } else {
        // Arc sweeping through 0 (toward center for left side)
        addArc(basketX, 0, THREE_PT_R, Math.PI + aCorner, -(Math.PI + aCorner) + 2 * Math.PI, 64);
      }

      // Restricted area arc
      if (side === 1) {
        addArc(basketX, 0, RESTRICTED_R, Math.PI / 2, (3 * Math.PI) / 2, 24);
        // Straight lines connecting to baseline
        addLine(pts([basketX, -RESTRICTED_R], [baseX, -RESTRICTED_R]));
        addLine(pts([basketX, RESTRICTED_R], [baseX, RESTRICTED_R]));
      } else {
        addArc(basketX, 0, RESTRICTED_R, -Math.PI / 2, Math.PI / 2, 24);
        addLine(pts([basketX, -RESTRICTED_R], [baseX, -RESTRICTED_R]));
        addLine(pts([basketX, RESTRICTED_R], [baseX, RESTRICTED_R]));
      }

      // Basket ring (on the floor as reference)
      addArc(basketX, 0, BASKET_RING_R, 0, Math.PI * 2, 24);

      // Lane hash marks (4 marks on each side of the key)
      const hashFt = [7, 8, 11, 14]; // feet from baseline
      for (const ft of hashFt) {
        const hx = baseX + dir * ft * FT;
        addLine(pts([hx, KEY_HALF_W], [hx, KEY_HALF_W + 0.2]));
        addLine(pts([hx, -KEY_HALF_W], [hx, -KEY_HALF_W - 0.2]));
      }
    }

    return geos.map((g, i) => ({ geometry: g, key: i }));
  }, [mode]);

  return (
    <group>
      {lines.map(({ geometry, key }) => (
        <lineSegments key={key} geometry={geometry}>
          <lineBasicMaterial color="white" linewidth={1} />
        </lineSegments>
      ))}
    </group>
  );
}

// ── Backboard & Hoop (3D) ────────────────────────────────────────
function BackboardAndHoop({ side }: { side: 1 | -1 }) {
  const bbX = side * (HALF_L - BACKBOARD_FROM_BASELINE);
  const basketX = side * (HALF_L - BASKET_FROM_BASELINE);

  return (
    <group>
      {/* Backboard */}
      <mesh position={[bbX, 2.8, 0]}>
        <boxGeometry args={[0.05, 1.1, BACKBOARD_WIDTH]} />
        <meshStandardMaterial color="white" transparent opacity={0.7} />
      </mesh>
      {/* Rim */}
      <mesh position={[basketX, 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BASKET_RING_R, 0.02, 8, 24]} />
        <meshStandardMaterial color="hsl(15, 90%, 50%)" />
      </mesh>
      {/* Support pole */}
      <mesh position={[side * (HALF_L - 0.15), 1.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.8]} />
        <meshStandardMaterial color="hsl(0, 0%, 40%)" />
      </mesh>
    </group>
  );
}

// ── Coordinate conversion ────────────────────────────────────────
// 2D canvas (0-800, 0-500) → 3D court coords
function toCourtPos(x: number, y: number, mode: CourtMode): [number, number, number] {
  if (mode === "half") {
    // Map to right half: x: [0, HALF_L], z: [-HALF_W, HALF_W]
    return [(x / 800) * HALF_L, 0, (y / 500) * COURT_WIDTH - HALF_W];
  }
  return [(x / 800) * COURT_LENGTH - HALF_L, 0, (y / 500) * COURT_WIDTH - HALF_W];
}

function fromCourtPos(px: number, pz: number, mode: CourtMode): [number, number] {
  if (mode === "half") {
    return [(px / HALF_L) * 800, ((pz + HALF_W) / COURT_WIDTH) * 500];
  }
  return [((px + HALF_L) / COURT_LENGTH) * 800, ((pz + HALF_W) / COURT_WIDTH) * 500];
}

// ── Animation helper ─────────────────────────────────────────────
function getAnimatedPlayerPositions(
  players: CourtPlayer[],
  actions: CourtAction[],
  progress: number,
  totalSteps: number,
  mode: CourtMode
): Map<string, THREE.Vector3> {
  const TOLERANCE = 50;
  const positions = new Map<string, THREE.Vector3>();
  const completedStep = Math.floor(progress);
  const frac = progress - completedStep;

  for (const player of players) {
    let cx = player.x;
    let cy = player.y;

    for (let step = 0; step <= Math.min(completedStep, totalSteps - 1); step++) {
      const act = actions.find(
        (a) =>
          a.stepIndex === step &&
          (a.type === "move" || a.type === "dribble" || a.type === "screen") &&
          Math.abs(a.fromX - cx) < TOLERANCE &&
          Math.abs(a.fromY - cy) < TOLERANCE
      );

      if (act) {
        // Calculate effective fraction considering delay
        const delay = act.delay || 0;
        const effectiveFrac = step < completedStep ? 1 : Math.max(0, (frac - delay) / (1 - delay));
        
        if (step < completedStep || effectiveFrac >= 1) {
          cx = act.toX;
          cy = act.toY;
        } else if (effectiveFrac > 0) {
          const allPoints = [
            { x: act.fromX, y: act.fromY },
            ...(act.waypoints || []),
            { x: act.toX, y: act.toY },
          ];
          const segments = allPoints.length - 1;
          const segProgress = effectiveFrac * segments;
          const segIdx = Math.min(Math.floor(segProgress), segments - 1);
          const segFrac = segProgress - segIdx;
          cx = allPoints[segIdx].x + (allPoints[segIdx + 1].x - allPoints[segIdx].x) * segFrac;
          cy = allPoints[segIdx].y + (allPoints[segIdx + 1].y - allPoints[segIdx].y) * segFrac;
        }
      }
    }

    const [px, , pz] = toCourtPos(cx, cy, mode);
    positions.set(player.id, new THREE.Vector3(px, 0, pz));
  }

  return positions;
}

// ── Animated Scene ───────────────────────────────────────────────
function AnimatedScene({
  players,
  actions,
  selectedPlayer,
  onPlayerClick,
  onCourtClick,
  isAnimating,
  onAnimationEnd,
  speed,
  courtMode,
  drawingPreview,
}: {
  players: CourtPlayer[];
  actions: CourtAction[];
  selectedPlayer: string | null;
  onPlayerClick?: (id: string) => void;
  onCourtClick?: (x: number, y: number) => void;
  isAnimating: boolean;
  onAnimationEnd?: () => void;
  speed: number;
  courtMode: CourtMode;
  drawingPreview?: { playerX: number; playerY: number; waypoints: { x: number; y: number }[] } | null;
}) {
  const totalSteps = actions.length > 0 ? Math.max(...actions.map((a) => a.stepIndex)) + 1 : 1;
  const progressRef = useRef(0);
  const playerRefs = useRef<Map<string, THREE.Group>>(new Map());
  const wasAnimating = useRef(false);
  const animationEndedRef = useRef(false);
  const visibleStepRef = useRef(-1);

  useEffect(() => {
    if (isAnimating && !wasAnimating.current) {
      progressRef.current = 0;
      animationEndedRef.current = false;
      visibleStepRef.current = -1;
    }
    if (!isAnimating) {
      animationEndedRef.current = false;
    }
    wasAnimating.current = isAnimating;
  }, [isAnimating]);

  useFrame((_, delta) => {
    if (!isAnimating || animationEndedRef.current) return;

    progressRef.current += delta * speed;

    if (progressRef.current >= totalSteps) {
      progressRef.current = totalSteps;
      visibleStepRef.current = totalSteps;
      const finalPositions = getAnimatedPlayerPositions(players, actions, totalSteps, totalSteps, courtMode);
      finalPositions.forEach((pos, id) => {
        const group = playerRefs.current.get(id);
        if (group) group.position.copy(pos);
      });
      animationEndedRef.current = true;
      setTimeout(() => onAnimationEnd?.(), 800);
      return;
    }

    const currentStep = Math.floor(progressRef.current);
    visibleStepRef.current = currentStep;

    const positions = getAnimatedPlayerPositions(players, actions, progressRef.current, totalSteps, courtMode);
    positions.forEach((pos, id) => {
      const group = playerRefs.current.get(id);
      if (group) group.position.lerp(pos, 0.15);
    });
  });

  const handlePointerDown = (e: any) => {
    if (e.object?.userData?.isFloor && onCourtClick) {
      const point = e.point;
      const [x, y] = fromCourtPos(point.x, point.z, courtMode);
      onCourtClick(x, y);
    }
  };

  const visibleActions = !isAnimating
    ? actions
    : actions.filter((a) => a.stepIndex <= visibleStepRef.current);

  // Camera position based on mode
  const camPos: [number, number, number] = courtMode === "half"
    ? [HALF_L / 2, 14, 14]
    : [0, 18, 16];

  const floorW = courtMode === "full" ? COURT_LENGTH + 2 : HALF_L + 2;
  const floorX = courtMode === "full" ? 0 : HALF_L / 2;

  return (
    <>
      <PerspectiveCamera makeDefault position={camPos} fov={50} />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        target={courtMode === "half" ? [HALF_L / 2, 0, 0] : [0, 0, 0]}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={6}
        maxDistance={35}
      />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 5]} intensity={1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />

      {/* Clickable floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[floorX, -0.01, 0]}
        onPointerDown={handlePointerDown}
        userData={{ isFloor: true }}
      >
        <planeGeometry args={[floorW, COURT_WIDTH + 2]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>

      <CourtFloor mode={courtMode} />

      {/* Backboards */}
      <BackboardAndHoop side={1} />
      {courtMode === "full" && <BackboardAndHoop side={-1} />}

      {/* Players */}
      {players.map((p) => {
        const [px, , pz] = toCourtPos(p.x, p.y, courtMode);
        return (
          <PlayerFigure
            key={p.id}
            ref={(ref: THREE.Group | null) => {
              if (ref) playerRefs.current.set(p.id, ref);
              else playerRefs.current.delete(p.id);
            }}
            position={[px, 0, pz]}
            number={p.number}
            team={p.team}
            isSelected={p.id === selectedPlayer}
            onClick={() => onPlayerClick?.(p.id)}
          />
        );
      })}

      {/* Action lines */}
      <group>
        {visibleActions.map((a, i) => {
          const [fx, , fz] = toCourtPos(a.fromX, a.fromY, courtMode);
          const [tx, , tz] = toCourtPos(a.toX, a.toY, courtMode);
          const wp = a.waypoints?.map(w => {
            const [wx, , wz] = toCourtPos(w.x, w.y, courtMode);
            return [wx, 0.5, wz] as [number, number, number];
          });
          return (
            <ActionLine3D
              key={`${a.id}-${i}`}
              from={[fx, 0.5, fz]}
              to={[tx, 0.5, tz]}
              type={a.type}
              waypoints={wp}
            />
          );
        })}
      </group>

      {/* Live drawing preview */}
      {drawingPreview && drawingPreview.waypoints.length > 0 && (
        <group>
          {(() => {
            const allPts = [
              { x: drawingPreview.playerX, y: drawingPreview.playerY },
              ...drawingPreview.waypoints,
            ];
            // Render preview segments
            return allPts.slice(0, -1).map((pt, i) => {
              const next = allPts[i + 1];
              const [fx, , fz] = toCourtPos(pt.x, pt.y, courtMode);
              const [tx, , tz] = toCourtPos(next.x, next.y, courtMode);
              return (
                <ActionLine3D
                  key={`preview-${i}`}
                  from={[fx, 0.5, fz]}
                  to={[tx, 0.5, tz]}
                  type="move"
                />
              );
            });
          })()}
          {/* Waypoint markers */}
          {drawingPreview.waypoints.map((wp, i) => {
            const [wx, , wz] = toCourtPos(wp.x, wp.y, courtMode);
            return (
              <mesh key={`wp-marker-${i}`} position={[wx, 0.5, wz]}>
                <sphereGeometry args={[0.12, 12, 12]} />
                <meshBasicMaterial color="hsl(50, 100%, 55%)" transparent opacity={0.8} />
              </mesh>
            );
          })}
        </group>
      )}
    </>
  );
}

// ── Main Export ───────────────────────────────────────────────────
export function Court3D({
  players,
  actions,
  selectedPlayer,
  onPlayerClick,
  onCourtClick,
  isAnimating,
  onAnimationEnd,
  animationSpeed = 0.5,
  courtMode = "full",
  drawingPreview,
}: Court3DProps) {
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  return (
    <div className="w-full aspect-[16/10] rounded-lg overflow-hidden border border-border bg-background relative">
      {contextLost && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90">
          <p className="text-sm text-muted-foreground mb-2">3D rendering was interrupted</p>
          <button
            className="text-sm text-primary underline"
            onClick={() => {
              setContextLost(false);
              setCanvasKey((k) => k + 1);
            }}
          >
            Click to reload
          </button>
        </div>
      )}
      <Canvas
        key={canvasKey}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "default" }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setContextLost(true);
          });
        }}
      >
        <AnimatedScene
          players={players}
          actions={actions}
          selectedPlayer={selectedPlayer}
          onPlayerClick={onPlayerClick}
          onCourtClick={onCourtClick}
          isAnimating={!!isAnimating}
          onAnimationEnd={onAnimationEnd}
          speed={animationSpeed}
          courtMode={courtMode}
          drawingPreview={drawingPreview}
        />
      </Canvas>
    </div>
  );
}
