import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useAnimations,
  useGLTF,
  Bounds,
  PerspectiveCamera,
} from "@react-three/drei";
import { type Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PerfMonitor } from "r3f-monitor";

export interface GlbViewerProps {
  extendLoader?: (loader: GLTFLoader) => void;
}

export function GlbViewer({ extendLoader }: GlbViewerProps) {
  const url = "https://development.imaxhitech.com:9990/models/GDragon.glb";
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  // Nếu user đã upload thì dùng blob URL, không thì dùng prop url gốc
  const currentUrl = uploadedUrl ?? url;

  // Cleanup blob URL khi đổi file hoặc unmount để tránh rò rỉ bộ nhớ
  useEffect(() => {
    return () => {
      if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
    };
  }, [uploadedUrl]);

  const handleFile = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    setUploadedUrl(blobUrl);
    setUploadedName(file.name);
  };

  const handleReset = () => {
    setUploadedUrl(null);
    setUploadedName(null);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas style={{ width: "100%", height: "100%", background: "#fff" }}>
        <PerfMonitor position="bottom-left" />
        <PerspectiveCamera
          makeDefault
          position={[0, 0, 0.1]}
          fov={45}
          near={0.00001}
        />
        <Suspense fallback={null}>
          <Environment preset="city" />

          {/* key để force remount khi đổi URL, tránh useGLTF giữ cache của URL cũ */}
          <Model
            key={currentUrl}
            url={currentUrl}
            extendLoader={extendLoader}
          />
        </Suspense>

        <OrbitControls makeDefault />
      </Canvas>

      {/* Upload overlay */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "flex-end",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
        }}
      >
        <label
          style={{
            padding: "6px 12px",
            background: "rgba(20,20,24,0.85)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 4,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          Upload .glb / .gltf
          <input
            type="file"
            accept=".glb,.gltf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>

        {uploadedName && (
          <div
            style={{
              padding: "4px 8px",
              background: "rgba(20,20,24,0.85)",
              color: "#e8e8ec",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              maxWidth: 280,
            }}
          >
            <span
              style={{
                opacity: 0.85,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {uploadedName}
            </span>
            <button
              onClick={handleReset}
              style={{
                background: "transparent",
                color: "#999",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                padding: 0,
                lineHeight: 1,
              }}
              title="Reset về URL gốc"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Model({
  url,
  extendLoader,
}: {
  url: string;
  extendLoader?: (loader: GLTFLoader) => void;
}) {
  const groupRef = useRef<Group>(null);

  const { scene, animations } = useGLTF(url, false, false, extendLoader as any);

  const { actions } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (!actions) return;

    Object.values(actions).forEach((action) => {
      action?.reset().fadeIn(0.3).play();
    });

    return () => {
      Object.values(actions).forEach((action) => {
        action?.fadeOut(0.3);
      });
    };
  }, [actions]);

  return (
    <group ref={groupRef}>
      <Bounds fit clip observe>
        <primitive object={scene} />
      </Bounds>
    </group>
  );
}
