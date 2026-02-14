import { useRef, forwardRef, useImperativeHandle } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface PlayerFigureProps {
  position: [number, number, number];
  number: number;
  team: "home" | "away";
  isSelected: boolean;
  onClick: () => void;
}

export const PlayerFigure = forwardRef<THREE.Group, PlayerFigureProps>(
  ({ position, number, team, isSelected, onClick }, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    useImperativeHandle(ref, () => groupRef.current!, []);

    const teamColor = team === "home" ? "hsl(221, 83%, 53%)" : "hsl(0, 84%, 60%)";
    const skinColor = "hsl(30, 50%, 65%)";
    const shortsColor = team === "home" ? "hsl(221, 83%, 40%)" : "hsl(0, 84%, 45%)";

    useFrame((state) => {
      if (glowRef.current && isSelected) {
        const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
        glowRef.current.scale.set(s, s, s);
      }
    });

    return (
      <group ref={groupRef} position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {/* Selection glow ring */}
        {isSelected && (
          <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.6, 0.75, 32]} />
            <meshBasicMaterial color="hsl(50, 100%, 60%)" transparent opacity={0.8} />
          </mesh>
        )}

        {/* Shadow disc */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <circleGeometry args={[0.4, 16]} />
          <meshBasicMaterial color="black" transparent opacity={0.2} />
        </mesh>

        {/* Shoes */}
        <mesh position={[-0.12, 0.08, 0]}>
          <boxGeometry args={[0.14, 0.16, 0.22]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[0.12, 0.08, 0]}>
          <boxGeometry args={[0.14, 0.16, 0.22]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Legs */}
        <mesh position={[-0.12, 0.45, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.55]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        <mesh position={[0.12, 0.45, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.55]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>

        {/* Shorts */}
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.22, 0.25, 0.25]} />
          <meshStandardMaterial color={shortsColor} />
        </mesh>

        {/* Torso / Jersey */}
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.18, 0.24, 0.55]} />
          <meshStandardMaterial color={teamColor} />
        </mesh>

        {/* Jersey number on back */}
        <Text
          position={[0, 1.18, -0.2]}
          rotation={[0, Math.PI, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-bold.woff"
        >
          {String(number)}
        </Text>

        {/* Jersey number on front */}
        <Text
          position={[0, 1.18, 0.2]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-bold.woff"
        >
          {String(number)}
        </Text>

        {/* Arms */}
        <mesh position={[-0.3, 1.2, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.055, 0.06, 0.5]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        <mesh position={[0.3, 1.2, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.055, 0.06, 0.5]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 1.48, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.08]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.62, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>

        {/* Floating number above head */}
        <Text
          position={[0, 1.95, 0]}
          fontSize={0.22}
          color={teamColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="white"
          font="/fonts/inter-bold.woff"
        >
          {String(number)}
        </Text>
      </group>
    );
  }
);

PlayerFigure.displayName = "PlayerFigure";
