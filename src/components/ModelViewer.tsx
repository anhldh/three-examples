import { Canvas } from "@react-three/fiber";
import { Model } from "./Model";
import { Lighting } from "./Lighting";
import { Bvh, Environment, OrbitControls } from "@react-three/drei";
import { useControls } from "leva";
import { Suspense } from "react";
import { PerfMonitor } from "r3f-monitor";

const MODELS: Record<string, string> = {
  City: "https://development.imaxhitech.com:9990/models/m-jGnn7M0DEF6xbrAN2P.glb",
  Khoai:
    "https://development.imaxhitech.com:9990/models/m-nNIpJ_hR62w-927CD8.glb",
  // Thêm model tùy ý
};

export default function ModelViewer() {
  const { ambientIntensity, ambientColor } = useControls("Ambient Light", {
    ambientColor: { value: "#ffffff", label: "Color" },
    ambientIntensity: {
      value: 1,
      min: 0,
      max: 5,
      step: 0.1,
      label: "Intensity",
    },
  });

  const { bgIntensity, bgBlurriness, envIntensity } = useControls(
    "Environment",
    {
      bgIntensity: {
        value: 0.4,
        min: 0,
        max: 2,
        step: 0.01,
        label: "BG Intensity",
      },
      bgBlurriness: {
        value: 0.0,
        min: 0,
        max: 1,
        step: 0.01,
        label: "BG Blur",
      },
      envIntensity: {
        value: 0.1,
        min: 0,
        max: 2,
        step: 0.01,
        label: "Env Intensity",
      },
    },
  );

  const ground = useControls("Ground", {
    posY: { value: -44, min: -50, max: 50, step: 0.1, label: "Height" },
    opacity: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Shadow Opacity",
    },
    size: { value: 500, min: 10, max: 1000, step: 10, label: "Size" },
    visible: { value: true },
  });

  const { model } = useControls("Model Select", {
    model: { value: "City", options: Object.keys(MODELS) },
  });

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#333",
      }}
    >
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 50 }} dpr={[0.5, 2]}>
        <ambientLight intensity={ambientIntensity} color={ambientColor} />
        <Suspense fallback={null}>
          <Bvh>
            <Model url={MODELS[model]} autoPlay={true} />
          </Bvh>
        </Suspense>
        {ground.visible && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, ground.posY, 0]}
            receiveShadow
          >
            <planeGeometry args={[ground.size, ground.size]} />
            <shadowMaterial opacity={ground.opacity} />
          </mesh>
        )}
        <Lighting />
        <PerfMonitor position="top-left" />
        <Environment
          files={`/sky.hdr`}
          background
          backgroundIntensity={bgIntensity}
          backgroundBlurriness={bgBlurriness}
          environmentIntensity={envIntensity}
        />
        <OrbitControls
          makeDefault
          enableRotate={true}
          rotateSpeed={1}
          dampingFactor={0.1}
        />
      </Canvas>
    </div>
  );
}
