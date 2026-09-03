import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, StatsGl } from "@react-three/drei";
import TornadoScene from "./TornadoScene";
import { WebGPUPage, WebGPUUnsupported } from "./WebGPUCanvas";
import {
  createWebGPURenderer,
  isWebGPUAvailable,
  panelStyle,
  type RendererBackend,
} from "./webgpuSupport";
import { PerfMonitor } from "r3f-monitor";

const webGPUAvailable = isWebGPUAvailable();
const rendererCleanupDelay = 650;

const backendLabel: Record<RendererBackend, string> = {
  webgpu: "WEBGPU",
  webgl: "WEBGL 2",
};

const WebGPUTornadoExample = () => {
  const [selectedBackend, setSelectedBackend] = useState<RendererBackend>(() =>
    webGPUAvailable ? "webgpu" : "webgl",
  );
  const [mountedBackend, setMountedBackend] = useState<RendererBackend | null>(
    () => (webGPUAvailable ? "webgpu" : "webgl"),
  );
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
      <div style={{ ...panelStyle, top: 24, left: 26, textAlign: "left" }}>
        <div
          style={{
            color: "#ff9b68",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
          }}
        >
          {isSwitching ? "SWITCHING" : backendLabel[selectedBackend]} / TSL VFX
        </div>
        <div
          style={{
            marginTop: 7,
            color: "#fff2ea",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          Procedural tornado
        </div>
        <div style={{ marginTop: 5, color: "#a7847d", fontSize: 11 }}>
          {isSwitching
            ? "Releasing previous renderer"
            : backendLabel[selectedBackend]}{" "}
          · node displacement · noise · bloom
        </div>
      </div>

      <div
        aria-label="Renderer backend"
        style={{
          position: "absolute",
          zIndex: 3,
          top: 22,
          right: 24,
          display: "flex",
          gap: 4,
          padding: 4,
          border: "1px solid rgba(255, 180, 145, 0.18)",
          borderRadius: 8,
          background: "rgba(31, 18, 18, 0.78)",
          backdropFilter: "blur(10px)",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        {(["webgpu", "webgl"] as const).map((option) => {
          const active = option === selectedBackend;
          const unavailable = option === "webgpu" && !webGPUAvailable;
          const disabled =
            isSwitching || unavailable;

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
                background: active ? "#ff8b4d" : "transparent",
                color: active ? "#24100a" : disabled ? "#624a45" : "#caa49a",
                fontFamily: "inherit",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "background 150ms ease, color 150ms ease",
              }}
            >
              {backendLabel[option]}
            </button>
          );
        })}
      </div>

      <div
        style={{
          ...panelStyle,
          right: 24,
          bottom: 22,
          color: "#9b7770",
          fontSize: 10,
          letterSpacing: "0.08em",
        }}
      >
        DRAG TO ORBIT · SCROLL TO ZOOM
      </div>

      {mountedBackend && rendererFactory ? (
        <Canvas
          key={mountedBackend}
          gl={rendererFactory}
          camera={{ position: [1, 1, 3], fov: 25, near: 0.1, far: 50 }}
          dpr={[1, 1.75]}
          fallback={<WebGPUUnsupported />}
        >
          <PerfMonitor position="top-left" />
          <StatsGl className="stats" />

          <TornadoScene />
          <OrbitControls
            makeDefault
            target={[0, 0.4, 0]}
            enableDamping
            minDistance={1.5}
            maxDistance={10}
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

export default WebGPUTornadoExample;
