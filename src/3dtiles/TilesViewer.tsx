"use client";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { PerfMonitor } from "r3f-monitor";
import { useState } from "react";
import {
  EnvironmentControls,
  TilesPlugin,
  TilesRenderer,
} from "3d-tiles-renderer/r3f";
import {
  CesiumIonAuthPlugin,
  GLTFExtensionsPlugin,
  ReorientationPlugin,
  TilesFadePlugin,
} from "3d-tiles-renderer/plugins";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { createIonSchemaPlugin } from "./ionSchemaPlugin";

const dracoLoader = new DRACOLoader().setDecoderPath("/draco/gltf/");

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;
const ION_ASSET_ID = "5069750";

const ionSchemaPlugin = createIonSchemaPlugin(ION_ASSET_ID, ION_TOKEN);

const TilesViewer = () => {
  const [info, setInfo] = useState<string[] | null>(null);

  const handleClick = async (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();

    const { meshFeatures, structuralMetadata } = event.object.userData;
    if (!meshFeatures || !structuralMetadata || event.faceIndex === undefined) {
      setInfo(null);
      return;
    }
    const [featureId] = await meshFeatures.getFeaturesAsync(
      event.faceIndex,
      event.barycoord,
    );
    if (featureId === null || featureId === undefined) {
      setInfo(null);
      return;
    }

    const tableIndex = meshFeatures.getFeatureInfo()[0].propertyTable;
    const data = structuralMetadata.getPropertyTableData(tableIndex, featureId);

    setInfo([
      `featureId: ${featureId}`,
      ...Object.entries(data)
        .filter(
          ([, value]) => value !== undefined && value !== null && value !== "",
        )
        .map(([key, value]) => `${key}: ${value}`),
    ]);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [20, 10, 20], near: 0.1, far: 10000 }}>
        <PerfMonitor position="bottom-right" />
        <directionalLight position={[1, 2, 3]} intensity={2} />
        <ambientLight intensity={0.5} />
        <TilesRenderer
          errorTarget={12}
          group={{ onClick: handleClick } as never}
        >
          <TilesPlugin
            plugin={CesiumIonAuthPlugin}
            args={[{ apiToken: ION_TOKEN, assetId: ION_ASSET_ID }]}
          />
          <TilesPlugin
            plugin={GLTFExtensionsPlugin}
            args={[
              {
                dracoLoader,
                meshoptDecoder: MeshoptDecoder,
                plugins: [ionSchemaPlugin],
              },
            ]}
          />
          <TilesPlugin
            plugin={ReorientationPlugin}
            args={[{ recenter: true }]}
          />
          <TilesPlugin plugin={TilesFadePlugin} />
          <EnvironmentControls enableDamping={true} />
        </TilesRenderer>
      </Canvas>

      {info && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            maxHeight: "60%",
            overflow: "auto",
            padding: "10px 14px",
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            borderRadius: 6,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {info.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TilesViewer;
