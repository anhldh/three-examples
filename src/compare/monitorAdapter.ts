import type { WebGPURenderer } from "three/webgpu";

/** r3f-monitor 2.2.1 expects WebGL metadata and timer-query methods.
 * Only the public facade changes; Three's backend retains its native context/info.
 * Returning null for extensions disables unsupported GPU timing (UI shows N/A).
 */
export function withWebGPUMonitor(renderer: WebGPURenderer): WebGPURenderer {
  const context = {
    VERSION: 0x1f02,
    RENDERER: 0x1f01,
    getExtension: () => null,
    getParameter: (parameter: number) =>
      parameter === 0x1f02 ? "WebGPU" : "WebGPU compute",
  };
  const render = new Proxy(renderer.info.render, {
    get(target, key) {
      return key === "calls" ? target.drawCalls : Reflect.get(target, key);
    },
  });
  const info = new Proxy(renderer.info, {
    get(target, key) {
      if (key === "render") return render;
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return new Proxy(renderer, {
    get(target, key) {
      if (key === "getContext") return () => context;
      if (key === "info") return info;
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
