"use client";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { PerfMonitor } from "r3f-monitor";
import { lazy, Suspense } from "react";

const ModelLod = lazy(() => import("./ModelLod"));

const LodViewer = () => {
  return (
    <Canvas>
      <PerfMonitor position="bottom-right" />
      <PerspectiveCamera />
      <OrbitControls />
      <Suspense fallback={null}>
        <ModelLod url="https://development.imaxhitech.com:9990/models/rPsVVr_M0A9xNNiQC_/lod/file.glb" />
      </Suspense>
    </Canvas>
  );
};

export default LodViewer;
