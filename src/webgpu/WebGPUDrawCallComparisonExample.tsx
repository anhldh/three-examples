import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PerfMonitor } from "r3f-monitor";
import DrawCallField from "./DrawCallField";
import { WebGPUPage, WebGPUUnsupported } from "./WebGPUCanvas";
import {
  createWebGPURenderer,
  isWebGPUAvailable,
  panelStyle,
  type RendererBackend,
} from "./webgpuSupport";

const webGPUAvailable = isWebGPUAvailable();
const rendererCleanupDelay = 650;
const meshCounts = [1_000, 4_000, 10_000] as const;

const backendLabel: Record<RendererBackend, string> = {
  webgpu: "WEBGPU",
  webgl: "WEBGL 2",
};

const formatCount = (count: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" })
    .format(count)
    .toUpperCase();

const WebGPUDrawCallComparisonExample = () => {
  const initialBackend: RendererBackend = webGPUAvailable ? "webgpu" : "webgl";
  const [selectedBackend, setSelectedBackend] =
    useState<RendererBackend>(initialBackend);
  const [mountedBackend, setMountedBackend] = useState<RendererBackend | null>(
    initialBackend,
  );
  const [meshCount, setMeshCount] = useState<number>(meshCounts[1]);
  const switchTimer = useRef<number | null>(null);
  const rendererFactory = useMemo(
    () =>
      mountedBackend ? createWebGPURenderer(0x05070c, mountedBackend) : null,
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
    <WebGPUPage background="#05070c">
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
            color: "#70e6ff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
          }}
        >
          {isSwitching ? "SWITCHING" : backendLabel[selectedBackend]} / DRAW
          CALL STRESS
        </div>
        <div
          style={{
            marginTop: 7,
            color: "#f0fbff",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {meshCount.toLocaleString()} individual meshes
        </div>
        <div style={{ marginTop: 5, color: "#78929c", fontSize: 11 }}>
          Shared geometry + material · no instancing · no batching
        </div>
      </div>

      <div
        aria-label="Draw call controls"
        style={{
          position: "absolute",
          zIndex: 3,
          top: 22,
          right: 24,
          display: "grid",
          gap: 8,
          padding: 5,
          border: "1px solid rgba(112, 230, 255, 0.2)",
          borderRadius: 9,
          background: "rgba(5, 10, 16, 0.82)",
          backdropFilter: "blur(10px)",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        <div aria-label="Renderer backend" style={{ display: "flex", gap: 4 }}>
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
                  background: active ? "#70e6ff" : "transparent",
                  color: active ? "#041217" : disabled ? "#40545a" : "#94b3bc",
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

        <div aria-label="Mesh count" style={{ display: "flex", gap: 4 }}>
          {meshCounts.map((count) => {
            const active = count === meshCount;

            return (
              <button
                key={count}
                type="button"
                aria-pressed={active}
                onClick={() => setMeshCount(count)}
                style={{
                  flex: 1,
                  padding: "7px 8px",
                  border: 0,
                  borderRadius: 5,
                  background: active
                    ? "rgba(112, 230, 255, 0.2)"
                    : "transparent",
                  color: active ? "#bcefff" : "#617a82",
                  fontFamily: "inherit",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                }}
              >
                {formatCount(count)}
              </button>
            );
          })}
        </div>
      </div>

      {mountedBackend && rendererFactory ? (
        <Canvas
          key={mountedBackend}
          gl={rendererFactory}
          camera={{ position: [0, 0.4, 8.5], fov: 50, near: 0.1, far: 50 }}
          dpr={[1, 1.5]}
          fallback={<WebGPUUnsupported />}
          onCreated={({ gl }) => {
            gl.sortObjects = false;
          }}
        >
          <PerfMonitor position="top-left" />
          <DrawCallField meshCount={meshCount} />
          <OrbitControls
            makeDefault
            enableDamping
            autoRotate
            autoRotateSpeed={0.3}
            minDistance={5}
            maxDistance={14}
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
            color: "#78929c",
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

export default WebGPUDrawCallComparisonExample;
