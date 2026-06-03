import {
  Environment,
  OrbitControls,
  PerspectiveCamera,
  useAnimations,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Snow from "./Snow";
import { PUBLIC_ASSETS_URL } from "../config/constant";

// tinh do day tuyet tu count * size, clamp + normalize ve [0,1]
function computeSnowLevel(count: number, size: number) {
  const raw = count * size;
  return (THREE.MathUtils.clamp(raw, 20000, 300000) - 20000) / 280000;
}

const Frieren = ({ snowLevel }: { snowLevel: number }) => {
  const { scene, animations } = useGLTF(
    `${PUBLIC_ASSETS_URL}/models/frieren/frieren.glb`,
  );
  const { actions, names } = useAnimations(animations, scene);

  // 3 texture rieng tu cung 1 anh — vi offset cua eye/mouth phai doc lap
  const [bodyTex, eyeTex, mouthTex] = useTexture(
    [
      `${PUBLIC_ASSETS_URL}/models/frieren/snowfrieren.webp`,
      `${PUBLIC_ASSETS_URL}/models/frieren/snowfrieren.webp`,
      `${PUBLIC_ASSETS_URL}/models/frieren/snowfrieren.webp`,
    ],
    (loaded) => {
      (loaded as THREE.Texture[]).forEach((t) => {
        t.flipY = false;
        t.colorSpace = THREE.SRGBColorSpace;
      });
    },
  );

  // gan material unlit theo dung mapping cua ho
  useEffect(() => {
    const set = (name: string, tex?: THREE.Texture, color?: number) => {
      const mesh = scene.getObjectByName(name) as THREE.Mesh | null;
      if (!mesh) return;
      mesh.material = tex
        ? new THREE.MeshBasicMaterial({ map: tex })
        : new THREE.MeshBasicMaterial({ color });
    };
    set("Cube017", bodyTex);
    set("Cube017_1", eyeTex);
    set("Cube017_2", mouthTex);
    set("Cube017_3", undefined, 0x320032); // outline tim
  }, [scene, bodyTex, eyeTex, mouthTex]);

  // doi anim + bieu cam theo nguong tuyet 0.3
  const isCold = snowLevel > 0.3;
  useEffect(() => {
    if (!actions || names.length < 2) return;
    const normal = actions[names[0]]; // sitting
    const cold = actions[names[1]]; // sitting cold

    if (isCold) {
      normal?.stop();
      cold?.reset().play();
      eyeTex.offset.set(0, 0.25);
      mouthTex.offset.set(0, 0.3125);
    } else {
      cold?.stop();
      normal?.reset().play();
      eyeTex.offset.set(0, 0);
      mouthTex.offset.set(0, 0);
    }
  }, [isCold, actions, names, eyeTex, mouthTex]);

  return <primitive object={scene} />;
};

const Floor = ({ snowLevel }: { snowLevel: number }) => {
  const { scene } = useGLTF(`${PUBLIC_ASSETS_URL}/models/frieren/floor.glb`);
  const staffTex = useTexture(
    `${PUBLIC_ASSETS_URL}/models/frieren/snowstaff.webp`,
    (t) => {
      const tex = t as THREE.Texture;
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
    },
  );

  // luu cac mesh co morph target de update moi khi snowLevel doi
  const morphMeshes = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    morphMeshes.current = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetInfluences?.length) {
        morphMeshes.current.push(mesh);
      }
    });

    // staff: unlit + texture
    const staff = scene.getObjectByName("staffgeo") as THREE.Mesh | null;
    if (staff) staff.material = new THREE.MeshBasicMaterial({ map: staffTex });
  }, [scene, staffTex]);

  // blend morph target theo do tuyet
  useEffect(() => {
    morphMeshes.current.forEach((mesh) => {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = snowLevel;
    });
  }, [snowLevel]);

  return <primitive object={scene} />;
};
const SnowScene = () => {
  const [count, setCount] = useState(6000);
  const [wind, setWind] = useState(0.3);
  const [speed, setSpeed] = useState(1);
  const [size, setSize] = useState(0.05);
  const [simple, setSimple] = useState(false);
  const [bg, setBg] = useState("#7fb1b8");
  const snowLevel = useMemo(
    () => computeSnowLevel(count, size * 300),
    [count, size],
  );
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: bg,
      }}
    >
      <Canvas
        gl={{
          toneMapping: THREE.NeutralToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 5, 10]} />
        <OrbitControls makeDefault minDistance={5} maxDistance={10} />
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, 15, 45]} />
        <Floor snowLevel={snowLevel} />
        <Frieren snowLevel={snowLevel} />

        <Snow
          count={count}
          area={10}
          height={10}
          speed={speed}
          wind={wind}
          size={size}
          simple={simple}
          texture="/particle.png"
        />
        <Environment files="/neutral.hdr" />
      </Canvas>
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 16,
          borderRadius: 12,
          background: "rgba(8,12,20,0.7)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          fontFamily: "ui-monospace, monospace",
          maxWidth: 220,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>TUYET</div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={simple}
            onChange={(e) => setSimple(e.target.checked)}
          />
          Simple (cham tron)
        </label>

        <div style={{ fontSize: 12, opacity: 0.7 }}>So hat: {count}</div>
        <input
          type="range"
          min="1000"
          max="20000"
          step="1000"
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value))}
        />

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Toc do: {speed.toFixed(1)}x
        </div>
        <input
          type="range"
          min="0.3"
          max="2.5"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
        />

        <div style={{ fontSize: 12, opacity: 0.7 }}>Gio: {wind.toFixed(1)}</div>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.1"
          value={wind}
          onChange={(e) => setWind(parseFloat(e.target.value))}
        />

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Size: {size.toFixed(2)}x
        </div>
        <input
          type="range"
          min="0.05"
          max="0.3"
          step="0.01"
          value={size}
          onChange={(e) => setSize(parseFloat(e.target.value))}
        />

        <div style={{ fontSize: 11, opacity: 0.5 }}>
          Keo de xoay, cuon de zoom.
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Nen</div>
        <input
          type="color"
          value={bg}
          onChange={(e) => setBg(e.target.value)}
          style={{
            width: "100%",
            height: 32,
            border: "none",
            borderRadius: 6,
            background: "transparent",
            cursor: "pointer",
          }}
        />
      </div>
    </div>
  );
};

export default SnowScene;
