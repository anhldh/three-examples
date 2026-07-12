// MuseumControlsDemo.tsx
// pnpm add three @react-three/fiber @react-three/drei
// pnpm add -D @types/three
// (drei's <CameraControls /> đã bundle sẵn thư viện camera-controls,
//  nên import type từ 'camera-controls' dùng được luôn, không cần cài riêng)
//
// Demo 3 thứ:
// 1. Click vào object -> camera bay đến, nhìn đối diện theo normal mặt bị click, khoảng cách fit khung hình
// 2. colliderMeshes: xoay orbit mà bị tường/cột che -> camera tự kéo vào trước vật chắn (kiểu Metastep)
// 3. Zoom sát (distance < ngưỡng) -> WASD đi bộ qua controls.forward/truck, vẫn ăn collider

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { CameraControls, Grid } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import * as THREE from "three";

const WALK_DISTANCE = 3.5; // distance nhỏ hơn ngưỡng này -> bật WASD mode
const WALK_SPEED = 4;

type ControlsRef = RefObject<CameraControlsImpl | null>;

// ---------- click-to-focus ----------
function useFocusObject(controlsRef: ControlsRef) {
  const { camera } = useThree();

  return (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const obj = e.object;
    const controls = controlsRef.current;
    if (!controls || !e.face) return;
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // normal world-space của mặt bị click
    let dir = e.face.normal.clone().transformDirection(obj.matrixWorld);

    // click trúng mặt trên (tượng, bàn) -> normal chỉ lên trời, fallback hướng ngang từ camera
    if (Math.abs(dir.y) > 0.6) {
      dir = camera.position.clone().sub(center).setY(0).normalize();
    }

    // khoảng cách để object vừa khung hình + margin 35%
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitH = size.y / (2 * Math.tan(fov / 2));
    const fitW =
      Math.max(size.x, size.z) / (2 * Math.tan(fov / 2) * camera.aspect);
    const dist = Math.max(fitH, fitW, 1.0) * 1.35;

    const camPos = center.clone().addScaledVector(dir, dist);

    void controls.setLookAt(
      camPos.x,
      camPos.y,
      camPos.z,
      center.x,
      center.y,
      center.z,
      true, // smooth transition (collider vẫn chạy trong lúc transition)
    );
  };
}

// ---------- WASD khi zoom sát ----------
function useWasdWalk(
  controlsRef: ControlsRef,
  setWalkMode: (v: boolean) => void,
) {
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const walking = controls.distance < WALK_DISTANCE;
    setWalkMode(walking);
    if (!walking) return;

    const k = keys.current;
    const step = WALK_SPEED * dt;
    // đi qua camera-controls -> colliderMeshes áp dụng luôn cho chế độ đi bộ
    if (k.KeyW) void controls.forward(step, false);
    if (k.KeyS) void controls.forward(-step, false);
    if (k.KeyA) void controls.truck(-step, 0, false);
    if (k.KeyD) void controls.truck(step, 0, false);
  });
}

// ---------- scene ----------
function Museum() {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const collidersRef = useRef<THREE.Mesh[]>([]);
  const [walkMode, setWalkMode] = useState(false);

  const focusObject = useFocusObject(controlsRef);
  useWasdWalk(controlsRef, setWalkMode);

  // gom collider meshes rồi gán cho camera-controls
  const addCollider = (mesh: THREE.Mesh | null) => {
    if (mesh && !collidersRef.current.includes(mesh)) {
      collidersRef.current.push(mesh);
      if (controlsRef.current) {
        controlsRef.current.colliderMeshes = [...collidersRef.current];
      }
    }
  };

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.colliderMeshes = [...collidersRef.current];
    }
  }, []);

  return (
    <>
      <CameraControls
        ref={controlsRef}
        makeDefault
        smoothTime={0.1} // default 0.25 — càng nhỏ càng "bám tay"
        draggingSmoothTime={0.06} // đây là thủ phạm chính của cảm giác lag khi kéo (default 0.125)
        dollySpeed={1}
        azimuthRotateSpeed={1}
        polarRotateSpeed={1}
        dollyToCursor
      />

      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} />

      {/* sàn */}
      <Grid
        args={[24, 24]}
        cellColor="#666"
        sectionColor="#999"
        position={[0, 0.001, 0]}
      />
      <mesh ref={addCollider} rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#dcdcdc" />
      </mesh>

      {/* 2 bức tường - vừa là collider vừa treo "tranh" */}
      <mesh ref={addCollider} position={[0, 2, -6]}>
        <boxGeometry args={[16, 4, 0.3]} />
        <meshStandardMaterial color="#e8e2d5" />
      </mesh>
      <mesh ref={addCollider} position={[-8, 2, 0]} rotation-y={Math.PI / 2}>
        <boxGeometry args={[12, 4, 0.3]} />
        <meshStandardMaterial color="#e8e2d5" />
      </mesh>

      {/* "tranh" trên tường sau - click để focus */}
      {[-4, 0, 4].map((x, i) => (
        <mesh key={i} position={[x, 2, -5.8]} onClick={focusObject}>
          <boxGeometry args={[2, 1.4, 0.1]} />
          <meshStandardMaterial color={["#c0392b", "#2980b9", "#27ae60"][i]} />
        </mesh>
      ))}

      {/* "tranh" trên tường trái - normal quay theo hướng khác để test transformDirection */}
      <mesh
        position={[-7.8, 2, 2]}
        rotation-y={Math.PI / 2}
        onClick={focusObject}
      >
        <boxGeometry args={[2.4, 1.6, 0.1]} />
        <meshStandardMaterial color="#8e44ad" />
      </mesh>

      {/* tượng sphere trên bệ - click mặt trên sẽ fallback hướng ngang */}
      <group position={[3, 0, 2]}>
        <mesh ref={addCollider} position={[0, 0.5, 0]} onClick={focusObject}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#95a5a6" />
        </mesh>
        <mesh position={[0, 1.5, 0]} onClick={focusObject}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial
            color="#f39c12"
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* cột to giữa phòng - đứng orbit xoay quanh sẽ thấy camera tự né (auto zoom in) */}
      <mesh ref={addCollider} position={[-2, 2, 0]}>
        <boxGeometry args={[1.2, 4, 1.2]} />
        <meshStandardMaterial color="#7f8c8d" />
      </mesh>

      {/* HUD nhỏ báo mode */}
      <WalkModeHud walkMode={walkMode} />
    </>
  );
}

function WalkModeHud({ walkMode }: { walkMode: boolean }) {
  useEffect(() => {
    let el = document.getElementById("walk-hud");
    if (!el) {
      el = document.createElement("div");
      el.id = "walk-hud";
      el.style.cssText =
        "position:fixed;top:12px;left:12px;padding:6px 12px;border-radius:6px;" +
        "font:13px monospace;color:#fff;pointer-events:none;z-index:10";
      document.body.appendChild(el);
    }
    el.textContent = walkMode
      ? "WALK MODE - WASD di chuyen"
      : "ORBIT MODE - zoom sat de di bo";
    el.style.background = walkMode ? "#27ae60" : "#34495e";
  }, [walkMode]);
  return null;
}

export default function MuseumControlsDemo() {
  return (
    <Canvas
      camera={{ position: [8, 6, 10], fov: 55 }}
      style={{ width: "100vw", height: "100vh" }}
    >
      <Museum />
    </Canvas>
  );
}
