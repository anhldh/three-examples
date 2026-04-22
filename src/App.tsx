import { useState } from "react";
import ModelViewer from "./components/ModelViewer";
import PLYViewer from "./ply/PlyViewer";
import Home, { type ExampleId } from "./components/Home";
import LodViewer from "./lod/LodViewer";
import SparkViewer from "./spark/SparkViewer";
import { GlbViewer } from "./GLTFAnimationPointerExtension/GlbViewer";
import { GLTFAnimationPointerExtension } from "./GLTFAnimationPointerExtension/GtlfAnimationExt";

function App() {
  const [current, setCurrent] = useState<ExampleId | null>(null);

  if (current === null) {
    return <Home onSelect={setCurrent} />;
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <button
        onClick={() => setCurrent(null)}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 9999,
          background: "rgba(10,10,15,0.85)",
          color: "#e0e2e8",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.5,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        ← Examples
      </button>

      {current === "model" && <ModelViewer />}
      {current === "ply" && <PLYViewer />}
      {current === "lod" && <LodViewer />}
      {current === "spark" && <SparkViewer />}
      {current === "animation-pointer" && (
        <GlbViewer
          extendLoader={(loader) => {
            loader.register(
              (parser) => new GLTFAnimationPointerExtension(parser),
            );
          }}
        />
      )}
    </div>
  );
}

export default App;
