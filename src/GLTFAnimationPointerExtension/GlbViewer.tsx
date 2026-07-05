import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useAnimations,
  useGLTF,
  Bounds,
  PerspectiveCamera,
  AdaptiveDpr,
  AdaptiveEvents,
  useBounds,
} from "@react-three/drei";
import { type Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PerfMonitor } from "r3f-monitor";
import { GLTFAnimationPointerExtension } from "@anhldh/gltf-animation-pointer-extensions";
import { gltfLodLoader } from "@anhldh/gltf-lod-loader";
import { EffectComposer, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";

export interface GlbViewerProps {
  extendLoader?: (loader: GLTFLoader) => void;
}

export function GlbViewer({ extendLoader }: GlbViewerProps) {
  const url = "https://development.imaxhitech.com:9990/models/GDragon.glb";
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const [bgColor, setBgColor] = useState("#ffffff");

  const [clips, setClips] = useState<string[]>([]);
  const [active, setActive] = useState<Record<string, boolean>>({});

  const toggleClip = (name: string) => {
    setActive((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // reset animation state khi đổi model
  const handleAnimationsLoaded = (names: string[]) => {
    setClips(names);
    setActive(names.length ? { [names[0]]: true } : {});
  };

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

  const acceptFile = (file: File | undefined | null) => {
    if (!file) return;
    const ok =
      /\.(glb|gltf)$/i.test(file.name) ||
      file.type === "model/gltf-binary" ||
      file.type === "model/gltf+json";
    if (ok) handleFile(file);
  };

  // Drag handlers — dùng counter để tránh nhấp nháy khi rê qua các phần tử con
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Canvas
        gl={{ antialias: false }}
        dpr={[1, 2]}
        style={{ width: "100%", height: "100%", background: bgColor }}
      >
        <PerfMonitor position="top-right" />
        <AdaptiveDpr />
        <AdaptiveEvents />
        <PerspectiveCamera
          makeDefault
          position={[0, 0, 0.1]}
          fov={45}
          near={0.00001}
        />
        <Suspense fallback={null}>
          <Environment files={"/neutral.hdr"} />

          {/* key để force remount khi đổi URL, tránh useGLTF giữ cache của URL cũ */}
          <Model
            key={currentUrl}
            url={currentUrl}
            extendLoader={extendLoader}
            active={active}
            onAnimationsLoaded={handleAnimationsLoaded}
          />
        </Suspense>
        <EffectComposer multisampling={0}>
          <SMAA />
        </EffectComposer>
        <OrbitControls makeDefault enableDamping={false} />
      </Canvas>

      {/* Drop overlay — hiện khi đang kéo file vào */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(20,20,24,0.45)",
            border: "2px dashed rgba(255,255,255,0.6)",
            borderRadius: 8,
            color: "#fff",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 16,
            pointerEvents: "none",
            backdropFilter: "blur(2px)",
            zIndex: 10,
          }}
        >
          Thả file .glb / .gltf vào đây để thay thế
        </div>
      )}

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
              acceptFile(e.target.files?.[0]);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "rgba(20,20,24,0.85)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 4,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          <span>Màu nền</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            style={{
              width: 28,
              height: 20,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
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
      {/* Animation checkbox panel */}
      {clips.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "8px 10px",
            background: "rgba(20,20,24,0.85)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 4,
            backdropFilter: "blur(8px)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            maxHeight: "60%",
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          {clips.map((name) => (
            <label
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={!!active[name]}
                onChange={() => toggleClip(name)}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
            </label>
          ))}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#000",
          fontSize: 15,
          fontWeight: 600,
          zIndex: 10,
          textAlign: "center",
        }}
      >
        <span>
          Trang ví dụ này sẽ ngừng support chức năng upload trong thời gian tới.
          Vui lòng dùng{" "}
          <a
            href="https://gltf-info.anhldh.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#f90404", textDecoration: "underline" }}
          >
            trang xem model
          </a>{" "}
          để upload file .glb.
        </span>
      </div>
    </div>
  );
}
function FitOnce({ deps }: { deps: any }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [bounds, deps]); // chỉ fit khi scene đổi, không fit theo anim
  return null;
}

function Model({
  url,
  active,
  onAnimationsLoaded,
}: {
  url: string;
  extendLoader?: (loader: GLTFLoader) => void;
  active: Record<string, boolean>;
  onAnimationsLoaded: (names: string[]) => void;
}) {
  const groupRef = useRef<Group>(null);
  const gl = useThree((state) => state.gl);

  const { scene, animations } = useGLTF(url, false, false, (loader) => {
    gltfLodLoader(loader as any, gl as any);
    loader.register(
      (parser) => new GLTFAnimationPointerExtension(parser as any) as any,
    );
  });
  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        o.frustumCulled = false;
      }
    });
  }, [scene]);
  // useEffect(() => {
  //   scene.traverse((obj: any) => {
  //     if (obj.isMesh && obj.material?.transparent) {
  //       obj.material.depthWrite = true;
  //       obj.material.needsUpdate = true;
  //     }
  //   });
  // }, [scene]);

  const { actions } = useAnimations(animations, groupRef);
  useEffect(() => {
    const seen = new Map<string, THREE.Texture>();
    scene.traverse((o: any) => {
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m: any) => {
        if (!m.map) return;
        if (seen.has(m.map.uuid)) {
          const cloned = m.map.clone();
          cloned.needsUpdate = true;
          m.map = cloned;
        } else {
          seen.set(m.map.uuid, m.map);
        }
      });
    });
  }, [scene]);
  // báo danh sách clip lên parent khi load xong
  useEffect(() => {
    onAnimationsLoaded(animations.map((a) => a.name));
  }, [animations, onAnimationsLoaded]);

  // play/stop theo state active
  useEffect(() => {
    if (!actions) return;
    Object.entries(actions).forEach(([name, action]) => {
      if (!action) return;
      if (active[name]) {
        if (!action.isRunning()) action.reset().fadeIn(0.3).play();
      } else {
        action.fadeOut(0.3);
      }
    });
  }, [actions, active]);

  return (
    <group ref={groupRef}>
      <Bounds>
        <primitive object={scene} />
        <FitOnce deps={scene} />
      </Bounds>
    </group>
  );
}
