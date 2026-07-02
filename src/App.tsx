import { useState } from "react";
import ModelViewer from "./components/ModelViewer";
import PLYViewer from "./ply/PlyViewer";
import Home, { type ExampleId } from "./components/Home";
import LodViewer from "./lod/LodViewer";
import SparkViewer from "./spark/SparkViewer";
import { GlbViewer } from "./GLTFAnimationPointerExtension/GlbViewer";
import ModelViewerGoogle from "./model-viewer/ModelViewer";
import EnvironmentScene from "./environment-light/Scene";
import ExplosionScene from "./fire/SceneFire";
import ExplosionFx from "./explosionfx/ExplosionFx";
import SnowScene from "./snow/SnowScene";
import LightmapViewer from "./baked/BakedModel";
import RainScene from "./rain/RainScene";
import BotNavDemo from "./navmesh/BotNavDemo";

function App() {
  const [current, setCurrent] = useState<ExampleId | null>(null);

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      <Home current={current} onSelect={setCurrent} />

      <main
        style={{
          flex: 1,
          position: "relative",
          height: "100vh",
          background: "#000",
          overflow: "hidden",
        }}
      >
        {current === null && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#777799",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 15,
            }}
          >
            Select an example from the sidebar
          </div>
        )}

        {current === "model" && <ModelViewer />}
        {current === "ply" && <PLYViewer />}
        {current === "lod" && <LodViewer />}
        {current === "spark" && <SparkViewer />}
        {current === "animation-pointer" && <GlbViewer />}
        {current === "model-viewer" && <ModelViewerGoogle />}
        {current === "environment-light" && <EnvironmentScene />}
        {current === "fireball" && <ExplosionScene />}
        {current === "explosion" && <ExplosionFx />}
        {current === "snows" && <SnowScene />}
        {current === "baked" && <LightmapViewer />}
        {current === "rain" && <RainScene />}
        {current === "path" && <BotNavDemo />}
      </main>
    </div>
  );
}

export default App;
