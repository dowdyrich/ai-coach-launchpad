import { useMemo } from "react";
import * as THREE from "three";

interface ActionLine3DProps {
  from: [number, number, number];
  to: [number, number, number];
  type: "pass" | "move" | "screen" | "dribble";
}

const ACTION_COLORS: Record<string, string> = {
  pass: "hsl(0, 0%, 100%)",
  move: "hsl(50, 100%, 55%)",
  screen: "hsl(0, 80%, 60%)",
  dribble: "hsl(120, 70%, 55%)",
};

export function ActionLine3D({ from, to, type }: ActionLine3DProps) {
  const color = ACTION_COLORS[type] || "white";

  const { tubeGeometry, arrowGeometry, arrowRotation } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    mid.y += 0.3;

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const tube = new THREE.TubeGeometry(curve, 20, 0.03, 8, false);

    // Arrowhead
    const dir = new THREE.Vector3().subVectors(end, mid).normalize();
    const cone = new THREE.ConeGeometry(0.1, 0.25, 8);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const euler = new THREE.Euler().setFromQuaternion(q);

    return { tubeGeometry: tube, arrowGeometry: cone, arrowRotation: euler };
  }, [from, to]);

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={to} rotation={arrowRotation} geometry={arrowGeometry}>
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
