"use client";
import {
  Environment,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { PerfMonitor } from "r3f-monitor";
import { lazy, Suspense } from "react";

const ModelLod = lazy(() => import("./ModelLod"));

const LodViewer = () => {
  return (
    <Canvas>
      <PerfMonitor />
      <PerspectiveCamera />
      <OrbitControls />
      <ambientLight intensity={1} />
      <Suspense fallback={null}>
        <ModelLod />
      </Suspense>
      <Environment preset="city" background />
    </Canvas>
  );
};

export default LodViewer;
