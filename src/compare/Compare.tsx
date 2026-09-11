import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PerfMonitor } from "r3f-monitor";
import { WebGLRenderer } from "three";
import { WebGPURenderer } from "three/webgpu";
import { createSimulation, type Backend } from "./simulation";
import { withWebGPUMonitor } from "./monitorAdapter";
import "./compare.css";

interface Settings { backend: Backend; count: number; substeps: number }

function Particles({ backend, count, substeps }: Settings) {
  const { scene, gl } = useThree();
  const simulationRef = useRef<ReturnType<typeof createSimulation> | null>(null);
  useEffect(() => {
    const next = createSimulation(backend, count, substeps);
    scene.add(next.mesh);
    simulationRef.current = next;
    return () => { simulationRef.current = null; scene.remove(next.mesh); next.dispose(); };
  }, [backend, count, substeps, scene]);
  useFrame(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    if (simulation.compute) {
      (gl as unknown as WebGPURenderer).compute(simulation.compute);
    } else {
      simulation.update();
    }
  });
  return null;
}

class SceneError extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    return this.state.error
      ? <div className="compare-status" role="alert">Không thể chạy demo: {this.state.error}. Hãy chọn lại WebGL hoặc đặt lại.</div>
      : this.props.children;
  }
}

function Run(settings: Settings) {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  // R3F defers root disposal by 500 ms. Avoid overlapping the monitor singleton.
  useEffect(() => {
    const timeout = window.setTimeout(() => setMounted(true), 600);
    return () => window.clearTimeout(timeout);
  }, []);
  return <>
    {!ready && !error && <div className="compare-status" role="status">Đang khởi tạo {settings.backend.toUpperCase()}…</div>}
    {error && <div className="compare-status" role="alert">{error}<br />Chọn WebGL để tiếp tục, hoặc thử lại trên trình duyệt hỗ trợ WebGPU qua localhost / HTTPS.</div>}
    {mounted && !error && <SceneError>
      <Canvas dpr={1} flat linear camera={{ position: [0, -65, 45], fov: 48, near: 0.1, far: 300 }}
        gl={async (props) => {
          if (settings.backend === "webgl") return new WebGLRenderer({ ...props, antialias: false, alpha: false });
          const renderer = new WebGPURenderer({ canvas: props.canvas as HTMLCanvasElement, antialias: false, alpha: false, powerPreference: "high-performance" });
          try {
            await renderer.init();
            if (!(renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
              throw new Error("Không có WebGPU adapter; renderer đã yêu cầu fallback WebGL.");
            }
            renderer.onDeviceLost = (info) => setError(`Mất kết nối GPU: ${info.message}`);
            return withWebGPUMonitor(renderer);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Khởi tạo WebGPU thất bại.");
            // Finish Canvas configuration so it can unmount without a rejected factory.
            return renderer;
          }
        }} onCreated={() => setReady(true)}>
        <color attach="background" args={["#060c16"]} />
        <Particles {...settings} />
        <OrbitControls enablePan={false} minDistance={40} maxDistance={150} />
        <PerfMonitor position="bottom-right" deepAnalyze={false} />
      </Canvas>
    </SceneError>}
  </>;
}

export default function Compare() {
  const [backend, setBackend] = useState<Backend>("webgl");
  const [count, setCount] = useState(524288);
  const [substeps, setSubsteps] = useState(32);
  const [run, setRun] = useState(0);
  return <section className="compare">
    <header className="compare-toolbar">
      <div className="compare-controls">
        <div className="compare-switch" role="group" aria-label="Chọn renderer">
          <button aria-pressed={backend === "webgl"} onClick={() => setBackend("webgl")}>WebGL</button>
          <button aria-pressed={backend === "webgpu"} onClick={() => setBackend("webgpu")}>WebGPU</button>
        </div>
        <label>Số hạt<select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[65536, 262144, 524288, 1048576].map((n) => <option key={n} value={n}>{n.toLocaleString("en-US")}</option>)}
        </select></label>
        <label>Bước tính / frame<select value={substeps} onChange={(e) => setSubsteps(Number(e.target.value))}>
          {[4, 16, 32, 64].map((n) => <option key={n} value={n}>{n}</option>)}
        </select></label>
        <button className="compare-reset" onClick={() => setRun((n) => n + 1)}>Đặt lại</button>
      </div>
      <p className="compare-description">
        Cùng mô phỏng hạt Lorenz: WebGL tính vị trí trên CPU rồi tải lên GPU; WebGPU tính và giữ vị trí trên GPU.
        {backend === "webgpu" && <span className="compare-timing"> GPU time trong PerfMonitor chưa hỗ trợ WebGPU.</span>}
      </p>
    </header>
    <div className="compare-viewport">
      <Run key={`${backend}-${count}-${substeps}-${run}`} backend={backend} count={count} substeps={substeps} />
    </div>
  </section>;
}
