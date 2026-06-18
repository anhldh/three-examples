import { Canvas } from "@react-three/fiber";
import { PerfMonitor } from "r3f-monitor";
import SimpleRain from "./ComputeRain";
import { OrbitControls } from "@react-three/drei";

const RainScene = () => {
  return (
    <Canvas>
      <PerfMonitor position="top-left" />
      <OrbitControls makeDefault />
      <SimpleRain count={8000} area={100} topY={25} rangeY={25} opacity={0.2} />
    </Canvas>
  );
};

export default RainScene;
