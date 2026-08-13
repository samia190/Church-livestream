import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface OrbitRingProps {
  radius: number;
  count: number;
  color: string;
  tilt: number;
  speed: number;
  size?: number;
}

function OrbitRing({ radius, count, color, tilt, speed, size = 0.045 }: OrbitRingProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const reduced = useReducedMotion();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.15;
      const r = radius + (Math.random() - 0.5) * 0.12;
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.08;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, [radius, count]);

  useFrame((_, delta) => {
    if (reduced || !pointsRef.current) return;
    pointsRef.current.rotation.y += delta * speed;
  });

  return (
    <points ref={pointsRef} rotation={[tilt, 0, tilt * 0.4]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={0.85} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Core() {
  const meshRef = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();

  useFrame((_, delta) => {
    if (reduced || !meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.18;
    meshRef.current.rotation.x += delta * 0.06;
  });

  return (
    <Float speed={reduced ? 0 : 1.3} rotationIntensity={reduced ? 0 : 0.35} floatIntensity={reduced ? 0 : 0.7}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.35, 1]} />
        <MeshDistortMaterial
          color="#b794f6"
          emissive="#7c3aed"
          emissiveIntensity={0.55}
          roughness={0.15}
          metalness={0.65}
          distort={reduced ? 0 : 0.22}
          speed={reduced ? 0 : 1.4}
        />
      </mesh>
    </Float>
  );
}

interface RadiantCoreProps {
  className?: string;
}

/**
 * The site's signature 3D element — a faceted "lantern" core with two
 * orbiting rings of light (dawn-ember + violet), evoking both a spiritual
 * light and a rotating beacon. Rendered transparent so it can sit over any
 * section background.
 */
export default function RadiantCore({ className }: RadiantCoreProps) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.45} />
        <pointLight position={[3, 3, 3]} intensity={45} color="#fbbf6a" />
        <pointLight position={[-3, -2, -3]} intensity={28} color="#7c3aed" />
        <Suspense fallback={null}>
          <Core />
          <OrbitRing radius={2.05} count={90} color="#fbbf6a" tilt={0.35} speed={0.09} />
          <OrbitRing radius={2.55} count={64} color="#a78bfa" tilt={-0.5} speed={-0.06} size={0.035} />
        </Suspense>
      </Canvas>
    </div>
  );
}
