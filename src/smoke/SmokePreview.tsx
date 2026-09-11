"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import TrainSmoke from "./TrainSmoke";

/**
 * Scene xem thử TrainSmoke.
 * Có một cái đầu máy dựng bằng vài khối cơ bản để lấy tỉ lệ —
 * khói mà không có vật thể tham chiếu thì rất khó đánh giá kích thước.
 */

function Locomotive() {
  return (
    <group>
      {/* nồi hơi */}
      <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 6, 24]} />
        <meshStandardMaterial color="#1e2529" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* cabin */}
      <mesh position={[0, 1.9, -3.4]} castShadow>
        <boxGeometry args={[2.2, 2.4, 2.2]} />
        <meshStandardMaterial color="#2b2320" roughness={0.7} />
      </mesh>

      {/* khung gầm */}
      <mesh position={[0, 0.45, -0.5]}>
        <boxGeometry args={[2.4, 0.6, 9]} />
        <meshStandardMaterial color="#15191c" roughness={0.9} />
      </mesh>

      {/* ống khói — miệng ở y = 3.2 */}
      <mesh position={[0, 2.6, 2.2]}>
        <cylinderGeometry args={[0.42, 0.3, 1.2, 20]} />
        <meshStandardMaterial color="#0f1214" roughness={0.8} />
      </mesh>

      {/* bánh xe */}
      {[-2.5, -0.5, 1.5].map((z) => (
        <group key={z}>
          {[-1.3, 1.3].map((x) => (
            <mesh key={x} position={[x, 0.7, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.7, 0.7, 0.2, 20]} />
              <meshStandardMaterial color="#3a2f28" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function SmokePreview() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#0d1116" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [11, 6, 11], fov: 45 }}
        gl={{ antialias: true }}
        onCreated={({ scene }) => {
          scene.fog = new THREE.Fog("#0d1116", 25, 70);
        }}
      >
        <color attach="background" args={["#0d1116"]} />

        <hemisphereLight args={["#8fa6bd", "#20160f", 0.7]} />
        <directionalLight
          position={[6, 12, 4]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        <Locomotive />

        <TrainSmoke
          position={[0, 3.2, 2.2]}
          wind={[0, 0, -1.3]}
          count={280}
          particlesPerPuff={14}
          lifetime={4.5}
          opacity={0.5}
        />

        {/* mặt đất */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[120, 120]} />
          <meshStandardMaterial color="#171c20" roughness={1} />
        </mesh>
        <gridHelper args={[120, 60, "#2a3238", "#1c2226"]} />

        <OrbitControls
          target={[0, 3, 0]}
          minDistance={5}
          maxDistance={45}
          maxPolarAngle={Math.PI / 2 - 0.03}
          enableDamping
        />
      </Canvas>
    </div>
  );
}
