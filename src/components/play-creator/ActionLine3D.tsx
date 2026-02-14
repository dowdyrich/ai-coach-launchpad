import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ActionLine3DProps {
  from: [number, number, number];
  to: [number, number, number];
  type: "pass" | "move" | "screen" | "dribble";
  waypoints?: [number, number, number][];
}

const ACTION_COLORS: Record<string, string> = {
  pass: "#ffffff",
  move: "#fbbf24",
  screen: "#ef4444",
  dribble: "#22c55e",
};

const ACTION_EMISSIVE: Record<string, string> = {
  pass: "#aabbff",
  move: "#fbbf24",
  screen: "#ff4444",
  dribble: "#22ff55",
};

export function ActionLine3D({ from, to, type, waypoints }: ActionLine3DProps) {
  const color = ACTION_COLORS[type] || "white";
  const emissive = ACTION_EMISSIVE[type] || "#ffffff";
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
    }
  });

  const { tubeGeometry, glowTubeGeometry, arrowGeometry, arrowRotation, dotPositions } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);

    let curve: THREE.Curve<THREE.Vector3>;
    const dots: THREE.Vector3[] = [];

    if (waypoints && waypoints.length > 0) {
      const allPoints = [
        start,
        ...waypoints.map(w => new THREE.Vector3(...w)),
        end,
      ];
      waypoints.forEach(w => dots.push(new THREE.Vector3(...w)));
      curve = new THREE.CatmullRomCurve3(allPoints, false, "centripetal", 0.5);
    } else {
      const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
      mid.y += 0.3;
      curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    }

    const segments = waypoints && waypoints.length > 0 ? Math.max(40, waypoints.length * 16) : 20;
    const tube = new THREE.TubeGeometry(curve, segments, 0.035, 8, false);
    const glowTube = new THREE.TubeGeometry(curve, segments, 0.12, 8, false);

    const nearEnd = curve.getPointAt(0.92);
    const dir = new THREE.Vector3().subVectors(end, nearEnd).normalize();
    const cone = new THREE.ConeGeometry(0.12, 0.3, 8);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const euler = new THREE.Euler().setFromQuaternion(q);

    return { tubeGeometry: tube, glowTubeGeometry: glowTube, arrowGeometry: cone, arrowRotation: euler, dotPositions: dots };
  }, [from, to, waypoints]);

  return (
    <group>
      {/* Core line */}
      <mesh geometry={tubeGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.3}
          transparent
          opacity={0.95}
        />
      </mesh>
      {/* Glow tube */}
      <mesh ref={glowRef} geometry={glowTubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      {/* Arrowhead */}
      <mesh position={to} rotation={arrowRotation} geometry={arrowGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={1}
          roughness={0.2}
        />
      </mesh>
      {/* Waypoint dots - glowing */}
      {dotPositions.map((pos, i) => (
        <group key={i}>
          <mesh position={pos}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.2} />
          </mesh>
          <mesh position={pos}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
