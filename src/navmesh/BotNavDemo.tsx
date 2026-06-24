import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  Suspense,
  useCallback,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  init as initRecast,
  importNavMesh,
  NavMesh,
  NavMeshQuery,
} from "recast-navigation";

/*
  Bot Navigation Demo — load PRE-BAKED navmesh (.bin)
  ---------------------------------------------------
  Flow:
    1. Load the model (for display + click raycasting only).
    2. Fetch a pre-baked navmesh (.bin exported via exportNavMesh) and import it.
       -> No runtime voxelization. WASM is still initialised because Detour
          (the query side) runs in WASM.
    3. Click on the surface -> bot pathfinds there, walks, then "presents".

  Baking side (server / script):
    import { exportNavMesh } from "recast-navigation";
    const bytes = exportNavMesh(navMesh);          // Uint8Array
    fs.writeFileSync("navmesh.bin", Buffer.from(bytes));

  IMPORTANT: the bot's size must match the walkableRadius used at bake time,
  otherwise it may clip walls or get stuck near edges.

  Install:
    npm i three @react-three/fiber @react-three/drei recast-navigation
    npm i -D @types/three
*/

const MODEL_URL = "https://anhldh.com/models/baotang.glb";
const NAVMESH_URL = "/navmesh.bin";

// ---- Recast init (singleton) -------------------------------------------------
let recastReady: Promise<unknown> | null = null;
function ensureRecast(): Promise<unknown> {
  if (!recastReady) recastReady = initRecast();
  return recastReady;
}

// ---- Load pre-baked navmesh from .bin ---------------------------------------
async function loadNavMesh(url: string): Promise<NavMesh> {
  await ensureRecast(); // WASM needed for the query side (Detour)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch navmesh ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const result = importNavMesh(bytes);
  // importNavMesh returns { navMesh } (solo) or { navMesh, tileCache } (tilecache)
  return result.navMesh;
}

type MeshesReadyHandler = (meshes: THREE.Mesh[]) => void;

// ---- Loaded model (display + raycast target only) ----------------------------
function Model({ url, onReady }: { url: string; onReady: MeshesReadyHandler }) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((c: THREE.Object3D) => {
      if ((c as THREE.Mesh).isMesh) {
        const m = c as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        meshes.push(m);
      }
    });
    onReady(meshes);
  }, [scene, onReady]);
  return <primitive object={scene} />;
}

// ---- The bot -----------------------------------------------------------------
interface BotProps {
  navMesh: NavMesh;
  targetRef: React.MutableRefObject<THREE.Vector3 | null>;
  targetVersion: number;
  onArrive?: () => void;
}

function Bot({ navMesh, targetRef, targetVersion, onArrive }: BotProps) {
  const botRef = useRef<THREE.Group>(null);
  const query = useMemo<NavMeshQuery>(
    () => new NavMeshQuery(navMesh),
    [navMesh],
  );
  const pathRef = useRef<THREE.Vector3[]>([]);
  const idxRef = useRef(0);
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const [presenting, setPresenting] = useState(false);

  // recompute path whenever a new target is set
  useEffect(() => {
    const end = targetRef.current;
    if (!end) return;
    const start = pos.current;
    try {
      // Recast requires start/end to lie ON the navmesh, so snap both first.
      const s = query.findClosestPoint({ x: start.x, y: start.y, z: start.z });
      const e = query.findClosestPoint({ x: end.x, y: end.y, z: end.z });

      const { success, path } = query.computePath(s.point ?? s, e.point ?? e);

      if (success && path && path.length) {
        pathRef.current = path.map(
          (p: { x: number; y: number; z: number }) =>
            new THREE.Vector3(p.x, p.y, p.z),
        );
        idxRef.current = 0;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPresenting(false);
      } else {
        console.warn("[nav] no path", { success, pathLen: path?.length, s, e });
      }
    } catch (err) {
      console.warn("[nav] computePath failed", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, targetVersion]);

  useFrame((_, dt) => {
    const path = pathRef.current;
    const group = botRef.current;
    if (!group || idxRef.current >= path.length) return;

    const target = path[idxRef.current];
    const cur = pos.current;
    const dir = new THREE.Vector3().subVectors(target, cur);
    const dist = dir.length();
    const speed = 2.5;
    const step = speed * dt;

    if (dist <= step) {
      cur.copy(target);
      idxRef.current += 1;
      if (idxRef.current >= path.length) {
        setPresenting(true);
        onArrive?.();
      }
    } else {
      dir.normalize();
      cur.addScaledVector(dir, step);
      group.rotation.y = Math.atan2(dir.x, dir.z); // face movement
    }
    group.position.set(cur.x, cur.y + 0.5, cur.z);
  });

  return (
    <group ref={botRef}>
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 1, 16]} />
        <meshStandardMaterial color={presenting ? "#ffd166" : "#4cc9f0"} />
      </mesh>
      <mesh castShadow position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color={presenting ? "#ffd166" : "#4cc9f0"} />
      </mesh>
      <mesh position={[0, 0.65, 0.26]}>
        <boxGeometry args={[0.08, 0.08, 0.12]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {presenting && (
        <Html position={[0, 1.4, 0]} center distanceFactor={10}>
          <div
            style={{
              background: "rgba(20,20,28,0.92)",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            Xin chào! Tôi đã tới nơi 👋
          </div>
        </Html>
      )}
    </group>
  );
}

// ---- Click handler: raycast to walkable meshes, set target -------------------
interface ClickTargetProps {
  targetRef: React.MutableRefObject<THREE.Vector3 | null>;
  bumpTarget: () => void;
  walkables: React.MutableRefObject<THREE.Mesh[]>;
}

function ClickTarget({ targetRef, bumpTarget, walkables }: ClickTargetProps) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    const dom = gl.domElement;
    const onClick = (e: MouseEvent) => {
      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects<THREE.Object3D>(
        walkables.current,
        true,
      );
      if (hits.length) {
        targetRef.current = hits[0].point.clone();
        bumpTarget();
      }
    };
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [camera, gl, raycaster, targetRef, bumpTarget, walkables]);

  return null;
}

// ---- Scene orchestration -----------------------------------------------------
function Scene({ onStatus }: { onStatus: (s: string) => void }) {
  const [navMesh, setNavMesh] = useState<NavMesh | null>(null);
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const walkables = useRef<THREE.Mesh[]>([]);
  const [targetVersion, setTargetVersion] = useState(0);
  const bumpTarget = useCallback(() => setTargetVersion((v) => v + 1), []);

  // model load -> only feeds raycast targets; navmesh is NOT built from it
  const handleMeshesReady = useCallback<MeshesReadyHandler>((meshes) => {
    walkables.current = meshes;
  }, []);

  // load the pre-baked navmesh once
  useEffect(() => {
    let alive = true;
    onStatus("Đang tải navmesh…");
    loadNavMesh(NAVMESH_URL)
      .then((nm) => {
        if (!alive) return;
        setNavMesh(nm);
        onStatus("Sẵn sàng — click lên sàn để bot di chuyển");
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        onStatus("Lỗi tải navmesh: " + (e instanceof Error ? e.message : e));
      });
    return () => {
      alive = false;
    };
  }, [onStatus]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Environment preset="city" />

      <Suspense fallback={null}>
        <Model url={MODEL_URL} onReady={handleMeshesReady} />
      </Suspense>

      {navMesh && (
        <Bot
          navMesh={navMesh}
          targetRef={targetRef}
          targetVersion={targetVersion}
        />
      )}

      <ClickTarget
        targetRef={targetRef}
        bumpTarget={bumpTarget}
        walkables={walkables}
      />

      <OrbitControls makeDefault target={[0, 0, 0]} />
    </>
  );
}

export default function BotNavDemo() {
  const [status, setStatus] = useState("Đang khởi tạo recast…");
  const onStatus = useCallback((s: string) => setStatus(s), []);
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#1a1d24",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          background: "rgba(20,20,28,0.85)",
          color: "#fff",
          padding: "10px 16px",
          borderRadius: 10,
          fontSize: 13,
          fontFamily: "system-ui, sans-serif",
          pointerEvents: "none",
        }}
      >
        {status}
      </div>
      <Canvas shadows camera={{ position: [8, 8, 8], fov: 50 }}>
        <Scene onStatus={onStatus} />
      </Canvas>
    </div>
  );
}
