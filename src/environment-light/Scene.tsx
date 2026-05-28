"use client";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { PerfMonitor } from "r3f-monitor";
import { lazy, Suspense } from "react";
import { MVEnvironment } from "./MvEnviroment";

const ModelLod = lazy(() => import("../lod/ModelLod"));

const EnvironmentScene = () => {
  return (
    <Canvas>
      <PerfMonitor position="top-left" />
      <PerspectiveCamera />
      <OrbitControls />
      <Suspense fallback={null}>
        <ModelLod url="https://development.imaxhitech.com:9990/models/2bjQHAZrFJrmNIxfZn/lod/file.glb" />
      </Suspense>
      <MVEnvironment variant="neutral" />
    </Canvas>
  );
};

export default EnvironmentScene;
