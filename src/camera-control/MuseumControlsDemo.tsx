// MuseumControlsDemo.tsx
// pnpm add three @react-three/fiber @react-three/drei @react-three/rapier
// (@react-three/rapier kéo theo @dimforge/rapier3d-compat, import type từ đó dùng được luôn)
//
// Thay đổi so với bản colliderMeshes:
// - Camera = ball collider kinematic, chạy qua KinematicCharacterController của rapier
//   -> bị tường chắn thì TRƯỢT dọc tường, không auto dolly-in nữa
// - Walk mode: có gravity nhẹ + autostep -> đi lên/xuống cầu thang được
// - Tường/cột/sàn/thang là RigidBody fixed, không cần gom mesh thủ công

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { CameraControls, Grid, Html } from "@react-three/drei";
import { Physics, RigidBody, useRapier } from "@react-three/rapier";
import * as THREE from "three";

const WALK_DISTANCE = 3.5; // distance nhỏ hơn ngưỡng này -> bật WASD mode
const WALK_SPEED = 4;
const WALK_GRAVITY = 5; // chỉ áp khi walk mode, để dính đất / xuống thang

type ControlsRef = RefObject<any | null>;

// ---------- camera collision qua rapier ----------
const CAMERA_RADIUS = 0.35;
const EYE_HEIGHT = 1.6; // mắt cách mặt đất khi đi bộ
const EYE_OFFSET = EYE_HEIGHT - CAMERA_RADIUS; // 1.25 — mắt cao hơn tâm ball "chân"

function CameraCollision({ controlsRef }: { controlsRef: ControlsRef }) {
  const { world, rapier } = useRapier();
  const { camera } = useThree();
  const s = useRef<{
    collider: any;
    ctrl: any;
    feet: THREE.Vector3; // tâm ball (chân)
    offset: number; // mắt cao hơn chân bao nhiêu, lerp 0 <-> EYE_OFFSET
  } | null>(null);
  const _target = useMemo(() => new THREE.Vector3(), []);
  const _delta = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const collider = world.createCollider(
      rapier.ColliderDesc.ball(CAMERA_RADIUS),
    );
    const ctrl = world.createCharacterController(0.02);
    ctrl.enableAutostep(0.25, 0.1, false);
    ctrl.enableSnapToGround(0.3);
    s.current = { collider, ctrl, feet: camera.position.clone(), offset: 0 };
    return () => {
      world.removeCollider(collider, false);
      world.removeCharacterController(ctrl);
      s.current = null;
    };
  }, [world, rapier, camera]);

  useFrame((_, dt) => {
    const st = s.current;
    const controls = controlsRef.current;
    if (!st || !controls) return;

    const walking = controls.distance < WALK_DISTANCE;

    // vào walk mode -> "đứng dậy" dần; ra orbit -> offset tụt về 0
    st.offset = THREE.MathUtils.damp(
      st.offset,
      walking ? EYE_OFFSET : 0,
      6,
      dt,
    );

    const desiredEye = camera.position;
    const move = {
      x: desiredEye.x - st.feet.x,
      y: desiredEye.y - st.offset - st.feet.y, // chân đuổi theo (mắt - offset)
      z: desiredEye.z - st.feet.z,
    };
    if (walking) move.y -= WALK_GRAVITY * dt;

    st.collider.setTranslation(st.feet);
    st.ctrl.computeColliderMovement(st.collider, move);
    const ok = st.ctrl.computedMovement();
    st.feet.x += ok.x;
    st.feet.y += ok.y;
    st.feet.z += ok.z;

    // mắt = chân + offset
    _delta.set(st.feet.x, st.feet.y + st.offset, st.feet.z).sub(desiredEye);
    const blocked = _delta.lengthSq() > 1e-6;
    const eyeX = st.feet.x,
      eyeY = st.feet.y + st.offset,
      eyeZ = st.feet.z;

    if (walking && blocked) {
      const t = controls.getTarget(_target);
      controls.setLookAt(
        eyeX,
        eyeY,
        eyeZ,
        t.x + _delta.x,
        t.y + _delta.y,
        t.z + _delta.z,
        false,
      );
      camera.position.set(eyeX, eyeY, eyeZ);
    } else {
      camera.position.set(eyeX, eyeY, eyeZ);
      camera.lookAt(controls.getTarget(_target));
    }
  });

  return null;
}
// ---------- sim painting (giữ nguyên) ----------
const PX = { w: 800, h: 500 };

function SimPainting({
  position,
  rotationY = 0,
  url,
  worldW = 3.2,
  onFocus,
}: {
  position: [number, number, number];
  rotationY?: number;
  url: string;
  worldW?: number;
  onFocus: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const [active, setActive] = useState(false);
  const worldH = worldW * (PX.h / PX.w);

  return (
    <group position={position} rotation-y={rotationY}>
      <mesh
        onClick={(e) => {
          onFocus(e);
          setActive(true);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <boxGeometry args={[worldW + 0.15, worldH + 0.15, 0.08]} />
        <meshStandardMaterial color="#4a3527" />
      </mesh>

      {active && (
        <Html
          transform
          position={[0, 0, 0.06]}
          scale={0.15}
          zIndexRange={[10, 0]}
          style={{ width: PX.w, height: PX.h }}
        >
          <iframe
            src={url}
            sandbox="allow-scripts"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              borderRadius: 4,
            }}
          />
        </Html>
      )}
    </group>
  );
}

// ---------- click-to-focus (giữ nguyên) ----------
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

    let dir = e.face.normal.clone().transformDirection(obj.matrixWorld);
    if (Math.abs(dir.y) > 0.6) {
      dir = camera.position.clone().sub(center).setY(0).normalize();
    }

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
      true,
    );
  };
}

// ---------- WASD (giữ nguyên, collision giờ do rapier lo) ----------
function useWasdWalk(
  controlsRef: ControlsRef,
  setWalkMode: (v: boolean) => void,
) {
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
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
    if (k.KeyW) void controls.forward(step, false);
    if (k.KeyS) void controls.forward(-step, false);
    if (k.KeyA) void controls.truck(-step, 0, false);
    if (k.KeyD) void controls.truck(step, 0, false);
  });
}

// ---------- scene ----------
function Museum() {
  const controlsRef = useRef<any>(null);
  const [walkMode, setWalkMode] = useState(false);

  const focusObject = useFocusObject(controlsRef);
  useWasdWalk(controlsRef, setWalkMode);

  return (
    <>
      <CameraControls
        ref={controlsRef}
        makeDefault
        smoothTime={0.1}
        draggingSmoothTime={0.06}
        dollySpeed={0.5}
        azimuthRotateSpeed={0.5}
        polarRotateSpeed={0.5}
        // dollyToCursor
      />

      <CameraCollision controlsRef={controlsRef} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} />

      <Grid
        args={[24, 24]}
        cellColor="#666"
        sectionColor="#999"
        position={[0, 0.001, 0]}
      />

      {/* sàn - box mỏng thay vì plane (plane không có bề dày, dễ tunnel) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[24, 0.2, 24]} />
          <meshStandardMaterial color="#dcdcdc" />
        </mesh>
      </RigidBody>

      {/* 2 bức tường */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 2, -6]}>
          <boxGeometry args={[16, 4, 0.3]} />
          <meshStandardMaterial color="#e8e2d5" />
        </mesh>
        <mesh position={[-8, 2, 0]} rotation-y={Math.PI / 2}>
          <boxGeometry args={[12, 4, 0.3]} />
          <meshStandardMaterial color="#e8e2d5" />
        </mesh>
      </RigidBody>

      <SimPainting
        position={[0, 2, -5.8]}
        url="/gravity.html"
        onFocus={focusObject}
      />

      {/* tranh tường trái */}
      <mesh
        position={[-7.8, 2, 2]}
        rotation-y={Math.PI / 2}
        onClick={focusObject}
      >
        <boxGeometry args={[2.4, 1.6, 0.1]} />
        <meshStandardMaterial color="#8e44ad" />
      </mesh>

      {/* tượng sphere trên bệ */}
      <group position={[3, 0, 2]}>
        <RigidBody type="fixed" colliders="cuboid">
          <mesh position={[0, 0.5, 0]} onClick={focusObject}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#95a5a6" />
          </mesh>
        </RigidBody>
        <RigidBody type="fixed" colliders="ball">
          <mesh position={[0, 1.5, 0]} onClick={focusObject}>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial
              color="#f39c12"
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
        </RigidBody>
      </group>

      {/* cột giữa phòng - giờ orbit quanh nó camera sẽ TRƯỢT né chứ không dolly-in */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[-2, 2, 0]}>
          <boxGeometry args={[1.2, 4, 1.2]} />
          <meshStandardMaterial color="#7f8c8d" />
        </mesh>
      </RigidBody>

      {/* CẦU THANG + sàn lửng - zoom sát rồi WASD đi lên thử */}
      <RigidBody type="fixed" colliders="cuboid">
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[6, 0.09 + i * 0.18, -1 - i * 0.35]}>
            <boxGeometry args={[2.4, 0.18, 0.35]} />
            <meshStandardMaterial color="#b8a88a" />
          </mesh>
        ))}
        <mesh position={[6, 1.35, -4.4]}>
          <boxGeometry args={[2.4, 0.18, 3]} />
          <meshStandardMaterial color="#b8a88a" />
        </mesh>
      </RigidBody>

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
      <Physics gravity={[0, 0, 0]}>
        <Museum />
      </Physics>
    </Canvas>
  );
}
