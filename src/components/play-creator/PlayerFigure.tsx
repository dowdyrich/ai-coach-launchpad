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
  label?: string;
}

const HOME_PRIMARY = "#2563eb";
const HOME_DARK = "#1d4ed8";
const AWAY_PRIMARY = "#ef4444";
const AWAY_DARK = "#dc2626";

export const PlayerFigure = forwardRef<THREE.Group, PlayerFigureProps>(
  ({ position, number, team, isSelected, onClick, label }, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const auraRef = useRef<THREE.Mesh>(null);
    const pulseRef = useRef(0);

    useImperativeHandle(ref, () => groupRef.current!, []);

    const primary = team === "home" ? HOME_PRIMARY : AWAY_PRIMARY;
    const dark = team === "home" ? HOME_DARK : AWAY_DARK;
    const skinColor = "#c8956c";
    const shortsColor = dark;
    const emissiveColor = team === "home" ? "#1a3fa0" : "#a01a1a";

    useFrame((state) => {
      pulseRef.current = state.clock.elapsedTime;

      if (glowRef.current && isSelected) {
        const s = 1 + Math.sin(pulseRef.current * 4) * 0.12;
        glowRef.current.scale.set(s, s, s);
      }

      if (auraRef.current) {
        const opacity = isSelected
          ? 0.35 + Math.sin(pulseRef.current * 3) * 0.15
          : 0.08;
        (auraRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
        const auraScale = isSelected ? 1.1 + Math.sin(pulseRef.current * 2) * 0.05 : 1;
        auraRef.current.scale.set(auraScale, 1, auraScale);
      }
    });

    return (
      <group ref={groupRef} position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {/* Ground aura / team glow */}
        <mesh ref={auraRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <circleGeometry args={[0.65, 32]} />
          <meshBasicMaterial color={primary} transparent opacity={0.08} />
        </mesh>

        {/* Selection ring - pulsing neon */}
        {isSelected && (
          <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <ringGeometry args={[0.55, 0.72, 32]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
          </mesh>
        )}

        {/* Shadow disc */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <circleGeometry args={[0.42, 20]} />
          <meshBasicMaterial color="black" transparent opacity={0.35} />
        </mesh>

        {/* Shoes - dark with subtle sheen */}
        <mesh position={[-0.12, 0.08, 0]}>
          <boxGeometry args={[0.14, 0.16, 0.22]} />
          <meshStandardMaterial color="#222" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0.12, 0.08, 0]}>
          <boxGeometry args={[0.14, 0.16, 0.22]} />
          <meshStandardMaterial color="#222" roughness={0.3} metalness={0.4} />
        </mesh>

        {/* Legs */}
        <mesh position={[-0.12, 0.45, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.55]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        <mesh position={[0.12, 0.45, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.55]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>

        {/* Shorts */}
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.22, 0.25, 0.25]} />
          <meshStandardMaterial color={shortsColor} roughness={0.5} metalness={0.1} />
        </mesh>

        {/* Torso / Jersey - emissive team color */}
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.18, 0.24, 0.55]} />
          <meshStandardMaterial
            color={primary}
            emissive={emissiveColor}
            emissiveIntensity={isSelected ? 0.6 : 0.2}
            roughness={0.4}
            metalness={0.15}
          />
        </mesh>

        {/* Jersey number on back */}
        <Text
          position={[0, 1.18, -0.2]}
          rotation={[0, Math.PI, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="black"
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
          outlineWidth={0.01}
          outlineColor="black"
        >
          {String(number)}
        </Text>

        {/* Arms */}
        <mesh position={[-0.3, 1.2, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.055, 0.06, 0.5]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        <mesh position={[0.3, 1.2, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.055, 0.06, 0.5]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 1.48, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.08]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.62, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.55} />
        </mesh>

        {/* Floating label above head - position name */}
        <Text
          position={[0, 1.98, 0]}
          fontSize={0.22}
          color={primary}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#fff"
          font={undefined}
        >
          {label || String(number)}
        </Text>

        {/* Label glow backdrop */}
        <mesh position={[0, 1.98, -0.01]}>
          <planeGeometry args={[0.5, 0.35]} />
          <meshBasicMaterial color={primary} transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }
);

PlayerFigure.displayName = "PlayerFigure";
