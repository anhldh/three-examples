import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, StatsGl } from "@react-three/drei";
import { PerfMonitor } from "r3f-monitor";
import GalaxyScene from "./GalaxyScene";
import { WebGPUPage, WebGPUUnsupported } from "./WebGPUCanvas";
import {
  createWebGPURenderer,
  isWebGPUAvailable,
  panelStyle,
  type RendererBackend,
} from "./webgpuSupport";

const webGPUAvailable = isWebGPUAvailable();
const rendererCleanupDelay = 650;
const particleCounts = [20_000, 100_000, 250_000] as const;

const backendLabel: Record<RendererBackend, string> = {
  webgpu: "WEBGPU",
  webgl: "WEBGL 2",
};

const formatParticleCount = (count: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" })
    .format(count)
    .toUpperCase();

const WebGPUGalaxyExample = () => {
  const initialBackend: RendererBackend = webGPUAvailable ? "webgpu" : "webgl";
  const [selectedBackend, setSelectedBackend] =
    useState<RendererBackend>(initialBackend);
  const [mountedBackend, setMountedBackend] =
    useState<RendererBackend | null>(initialBackend);
  const [particleCount, setParticleCount] = useState<number>(particleCounts[0]);
  const switchTimer = useRef<number | null>(null);
  const rendererFactory = useMemo(
    () =>
      mountedBackend
        ? createWebGPURenderer(0x201919, mountedBackend)
        : null,
    [mountedBackend],
  );
  const isSwitching = mountedBackend === null;

  useEffect(
    () => () => {
      if (switchTimer.current !== null) {
        window.clearTimeout(switchTimer.current);
      }
    },
    [],
  );

  const switchBackend = (nextBackend: RendererBackend) => {
    if (nextBackend === selectedBackend || isSwitching) return;

    setSelectedBackend(nextBackend);
    setMountedBackend(null);

    switchTimer.current = window.setTimeout(() => {
      setMountedBackend(nextBackend);
      switchTimer.current = null;
    }, rendererCleanupDelay);
  };

  return (
    <WebGPUPage background="#201919">
      <div
        style={{
          ...panelStyle,
          left: 26,
          bottom: 24,
          textAlign: "left",
        }}
      >
        <div
          style={{
            color: "#ffa575",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
          }}
        >
          {isSwitching ? "SWITCHING" : backendLabel[selectedBackend]} / TSL
          GALAXY
        </div>
        <div
          style={{
            marginTop: 7,
            color: "#fff2ea",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {particleCount.toLocaleString()} particles
        </div>
        <div style={{ marginTop: 5, color: "#a7847d", fontSize: 11 }}>
          Identical scene and shader on both backends
        </div>
      </div>

      <div
        aria-label="Galaxy controls"
        style={{
          position: "absolute",
          zIndex: 3,
          top: 22,
          right: 24,
          display: "grid",
          gap: 8,
          padding: 5,
          border: "1px solid rgba(255, 180, 145, 0.18)",
          borderRadius: 9,
          background: "rgba(31, 18, 18, 0.78)",
          backdropFilter: "blur(10px)",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        <div
          aria-label="Renderer backend"
          style={{ display: "flex", gap: 4 }}
        >
          {(["webgpu", "webgl"] as const).map((option) => {
            const active = option === selectedBackend;
            const unavailable = option === "webgpu" && !webGPUAvailable;
            const disabled = isSwitching || unavailable;

            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                title={
                  unavailable
                    ? "WebGPU không khả dụng trên trình duyệt này"
                    : isSwitching
                      ? "Đang chuyển renderer"
                      : `Render bằng ${backendLabel[option]}`
                }
                aria-pressed={active}
                onClick={() => switchBackend(option)}
                style={{
                  minWidth: 82,
                  padding: "8px 11px",
                  border: 0,
                  borderRadius: 5,
                  background: active ? "#ff9b68" : "transparent",
                  color: active
                    ? "#24100a"
                    : disabled
                      ? "#624a45"
                      : "#caa49a",
                  fontFamily: "inherit",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {backendLabel[option]}
              </button>
            );
          })}
        </div>

        <div
          aria-label="Particle count"
          style={{ display: "flex", gap: 4 }}
        >
          {particleCounts.map((count) => {
            const active = count === particleCount;

            return (
              <button
                key={count}
                type="button"
                aria-pressed={active}
                onClick={() => setParticleCount(count)}
                style={{
                  flex: 1,
                  padding: "7px 8px",
                  border: 0,
                  borderRadius: 5,
                  background: active
                    ? "rgba(255, 165, 117, 0.2)"
                    : "transparent",
                  color: active ? "#ffc2a2" : "#8e7069",
                  fontFamily: "inherit",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                }}
              >
                {formatParticleCount(count)}
              </button>
            );
          })}
        </div>
      </div>

      {mountedBackend && rendererFactory ? (
        <Canvas
          key={mountedBackend}
          gl={rendererFactory}
          camera={{ position: [4, 2, 5], fov: 50, near: 0.1, far: 100 }}
          dpr={[1, 1.75]}
          fallback={<WebGPUUnsupported />}
        >
          <PerfMonitor position="top-left" />
          <StatsGl className="stats" />
          <GalaxyScene particleCount={particleCount} />
          <OrbitControls
            makeDefault
            enableDamping
            minDistance={0.1}
            maxDistance={50}
          />
        </Canvas>
      ) : (
        <div
          role="status"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#a7847d",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 11,
            letterSpacing: "0.1em",
          }}
        >
          SWITCHING RENDERER…
        </div>
      )}
    </WebGPUPage>
  );
};

export default WebGPUGalaxyExample;
