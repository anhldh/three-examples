import type { GLProps } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import WebGPU from "three/addons/capabilities/WebGPU.js";

export type RendererBackend = "webgpu" | "webgl";

type RendererWithBackendFlags = THREE.WebGPURenderer & {
  backend: {
    isWebGPUBackend?: boolean;
    isWebGLBackend?: boolean;
  };
};

export const getRendererBackend = (
  renderer: THREE.WebGPURenderer,
): RendererBackend =>
  (renderer as RendererWithBackendFlags).backend.isWebGPUBackend === true
    ? "webgpu"
    : "webgl";

export const createWebGPURenderer = (
  clearColor: THREE.ColorRepresentation,
  backend: RendererBackend = "webgpu",
): Extract<GLProps, (...args: never[]) => unknown> =>
  async (props) => {
    const renderer = new THREE.WebGPURenderer({
      canvas: props.canvas as HTMLCanvasElement,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      forceWebGL: backend === "webgl",
    });

    await renderer.init();

    const initializedBackend = getRendererBackend(renderer);

    if (initializedBackend !== backend) {
      renderer.dispose();
      throw new Error(
        `Requested ${backend.toUpperCase()}, but Three.js initialized ${initializedBackend.toUpperCase()}.`,
      );
    }

    renderer.setClearColor(clearColor, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    return renderer;
  };

export const isWebGPUAvailable = () => WebGPU.isAvailable();

export const panelStyle = {
  position: "absolute",
  zIndex: 2,
  pointerEvents: "none",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
} as const;
