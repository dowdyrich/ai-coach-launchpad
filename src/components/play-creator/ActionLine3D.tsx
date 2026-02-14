import { useMemo } from "react";
import * as THREE from "three";

interface ActionLine3DProps {
  from: [number, number, number];
  to: [number, number, number];
  type: "pass" | "move" | "screen" | "dribble";
  waypoints?: [number, number, number][];
}

const ACTION_COLORS: Record<string, string> = {
  pass: "hsl(0, 0%, 100%)",
  move: "hsl(50, 100%, 55%)",
  screen: "hsl(0, 80%, 60%)",
  dribble: "hsl(120, 70%, 55%)",
};

export function ActionLine3D({ from, to, type, waypoints }: ActionLine3DProps) {
  const color = ACTION_COLORS[type] || "white";

  const { tubeGeometry, arrowGeometry, arrowRotation, dotPositions } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);

    let curve: THREE.Curve<THREE.Vector3>;
    const dots: THREE.Vector3[] = [];

    if (waypoints && waypoints.length > 0) {
      // Build a CatmullRom curve through all points
      const allPoints = [
        start,
        ...waypoints.map(w => new THREE.Vector3(...w)),
        end,
      ];
      // Store intermediate waypoints for dot markers
      waypoints.forEach(w => dots.push(new THREE.Vector3(...w)));
      curve = new THREE.CatmullRomCurve3(allPoints, false, "centripetal", 0.5);
    } else {
      const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
      mid.y += 0.3;
      curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    }

    const segments = waypoints && waypoints.length > 0 ? Math.max(40, waypoints.length * 16) : 20;
    const tube = new THREE.TubeGeometry(curve, segments, 0.03, 8, false);

    // Arrowhead direction from near-end of curve
    const nearEnd = curve.getPointAt(0.92);
    const dir = new THREE.Vector3().subVectors(end, nearEnd).normalize();
    const cone = new THREE.ConeGeometry(0.1, 0.25, 8);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const euler = new THREE.Euler().setFromQuaternion(q);

    return { tubeGeometry: tube, arrowGeometry: cone, arrowRotation: euler, dotPositions: dots };
  }, [from, to, waypoints]);

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={to} rotation={arrowRotation} geometry={arrowGeometry}>
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Waypoint dots */}
      {dotPositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
