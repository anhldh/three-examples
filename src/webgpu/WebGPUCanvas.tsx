import type { ReactNode } from "react";

export const WebGPUPage = ({
  background,
  children,
}: {
  background: string;
  children: ReactNode;
}) => (
  <section
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background,
    }}
  >
    {children}
  </section>
);

export const WebGPUUnsupported = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "grid",
      placeItems: "center",
      boxSizing: "border-box",
      padding: 32,
      background:
        "radial-gradient(circle at 50% 45%, #111b37 0%, #050710 48%, #020308 100%)",
      color: "#dbe6ff",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}
  >
    <div style={{ maxWidth: 520, textAlign: "center" }}>
      <div style={{ color: "#79a8ff", fontSize: 13, letterSpacing: "0.18em" }}>
        WEBGPU NOT AVAILABLE
      </div>
      <p style={{ color: "#8f9bb6", fontSize: 13, lineHeight: 1.7 }}>
        Demo này cần trình duyệt hỗ trợ WebGPU và chạy trong secure context
        (HTTPS hoặc localhost). Hãy thử phiên bản Chrome/Edge mới nhất.
      </p>
    </div>
  </div>
);
