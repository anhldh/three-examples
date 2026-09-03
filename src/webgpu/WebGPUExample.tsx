import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import LinkedParticles from "./LinkedParticles";
import { WebGPUPage, WebGPUUnsupported } from "./WebGPUCanvas";
import {
  createWebGPURenderer,
  isWebGPUAvailable,
  panelStyle,
} from "./webgpuSupport";
import { PerfMonitor } from "r3f-monitor";

const linkedParticlesRenderer = createWebGPURenderer(0x03050b);

const WebGPUExample = () => {
  if (!isWebGPUAvailable()) {
    return <WebGPUUnsupported />;
  }

  return (
    <WebGPUPage background="#03050b">
      <div style={{ ...panelStyle, top: 24, left: 26, textAlign: "left" }}>
        <div
          style={{
            color: "#79a8ff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
          }}
        >
          WEBGPU / TSL COMPUTE
        </div>
        <div
          style={{
            marginTop: 7,
            color: "#eff5ff",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          Linked particles
        </div>
        <div style={{ marginTop: 5, color: "#74819e", fontSize: 11 }}>
          1,024 particles · nearest-neighbour links
        </div>
      </div>

      <div
        style={{
          ...panelStyle,
          right: 24,
          bottom: 22,
          color: "#71809f",
          fontSize: 10,
          letterSpacing: "0.08em",
        }}
      >
        MOVE POINTER · DRAG TO ORBIT · SCROLL TO ZOOM
      </div>

      <Canvas
        gl={linkedParticlesRenderer}
        camera={{ position: [0, 0, 7], fov: 58, near: 0.1, far: 100 }}
        dpr={[1, 1.75]}
        fallback={<WebGPUUnsupported />}
      >
        <PerfMonitor position="top-left" />
        <LinkedParticles />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.35}
          minDistance={3.5}
          maxDistance={14}
        />
      </Canvas>
    </WebGPUPage>
  );
};

export default WebGPUExample;
