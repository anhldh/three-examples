import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Billboard } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { PerfMonitor } from "r3f-monitor";

/**
 * Hieu ung no lua + khoi cho game (vd: bom roi xuong no).
 * Moi vu no co `age` 0->1 dieu khien cac lop:
 *   - flash: chop sang bung tuc thi roi tat (rat nhanh)
 *   - fireball: qua cau lua phinh ra nhanh roi mo
 *   - smoke: khoi cuon len, phinh to, ton tai lau nhat
 * Spawn nhieu vu doc lap, moi vu tu huy khi age >= 1.
 * Dung billboard -> nhe, spawn nhieu cung luc van muot.
 */

// ---------- shaders ----------
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// fireball: noise tron, nong o loi, mo dan ra ria
const FIRE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAge;
  uniform float uSeed;
  uniform vec3 uColdColor;
  uniform vec3 uHotColor;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;} return v; }

  void main(){
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;

    float n = fbm(vUv * 4.0 + uSeed * 7.0 + vec2(0.0, -uTime * 1.5));
    float radius = 0.6 + n * 0.5;

    float core = smoothstep(radius, 0.0, r);   // 1 o loi, 0 o ria
    float heat = clamp(core * (1.0 - uAge * 0.7), 0.0, 1.0);

    vec3 col = mix(uColdColor, uHotColor, heat);
    col = mix(col, vec3(1.0, 0.9, 0.5), smoothstep(0.5, 0.85, heat));
    col = mix(col, vec3(2.0, 1.6, 1.0), smoothstep(0.85, 1.0, heat)); // bloom

    // fade theo tuoi: lua tat nhanh sau ~40% vong doi
    float lifeFade = 1.0 - smoothstep(0.25, 0.6, uAge);
    float alpha = core * lifeFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

// smoke: noise cuon, mau toi, ton tai lau, NormalBlending
const SMOKE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAge;
  uniform float uSeed;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;} return v; }

  void main(){
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;

    float n = fbm(vUv * 3.0 + uSeed * 5.0 + vec2(0.0, -uTime * 0.6));
    float puff = smoothstep(0.9 + n * 0.3, 0.2, r);

    // mau khoi: toi luc dau (con lan lua), sang dan -> xam khi nguoi
    float warmth = 1.0 - smoothstep(0.0, 0.4, uAge);
    vec3 dark = vec3(0.05);
    vec3 grey = vec3(0.32, 0.30, 0.30);
    vec3 ember = vec3(0.5, 0.2, 0.05);
    vec3 col = mix(grey, mix(dark, ember, 0.4), warmth);

    // khoi hien sau lua mot chut, dam dan roi tan
    float appear = smoothstep(0.05, 0.3, uAge);
    float fade = 1.0 - smoothstep(0.55, 1.0, uAge);
    float alpha = puff * appear * fade * 0.55;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col * n * 1.4, alpha);
  }
`;

// ---------- types ----------
interface Burst {
  id: number;
  position: [number, number, number];
  seed: number;
  duration: number;
}

interface FireColor {
  cold: string;
  hot: string;
}

// ---------- mot vu no don le ----------
function smoothstepJS(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface BurstViewProps {
  burst: Burst;
  color: FireColor;
  onDone: () => void;
}

function BurstView({ burst, color, onDone }: BurstViewProps) {
  const fireMat = useRef<THREE.ShaderMaterial>(null);
  const smokeMat = useRef<THREE.ShaderMaterial>(null);
  const fireMesh = useRef<THREE.Mesh>(null);
  const smokeMesh = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const flashMat = useRef<THREE.MeshBasicMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const age = useRef(0);
  const done = useRef(false);

  const [fireUniforms] = useState(() => ({
    uTime: { value: 0 },
    uAge: { value: 0 },
    uSeed: { value: burst.seed },
    uColdColor: { value: new THREE.Color(color.cold) },
    uHotColor: { value: new THREE.Color(color.hot) },
  }));
  const [smokeUniforms] = useState(() => ({
    uTime: { value: 0 },
    uAge: { value: 0 },
    uSeed: { value: burst.seed + 3.3 },
  }));

  useFrame((_, dt) => {
    if (done.current) return;
    age.current += dt / burst.duration;
    const a = age.current;

    if (a >= 1) {
      done.current = true;
      onDone(); // báo cha xóa
      return;
    }

    if (fireMat.current && fireMesh.current) {
      fireMat.current.uniforms.uTime.value += dt;
      fireMat.current.uniforms.uAge.value = a;
      const s = 0.4 + smoothstepJS(0, 0.3, a) * 1.6;
      fireMesh.current.scale.setScalar(s);
    }
    if (smokeMat.current && smokeMesh.current) {
      smokeMat.current.uniforms.uTime.value += dt;
      smokeMat.current.uniforms.uAge.value = a;
      const s = 0.6 + smoothstepJS(0, 1, a) * 2.6;
      smokeMesh.current.scale.setScalar(s);
      smokeMesh.current.position.y = a * 1.8;
    }
    if (flashRef.current && flashMat.current) {
      const f = 1 - smoothstepJS(0, 0.08, a);
      flashMat.current.opacity = f;
      flashRef.current.scale.setScalar(1.5 + (1 - f) * 1.5);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 12 * (1 - smoothstepJS(0.0, 0.4, a));
    }
  });

  return (
    <group position={burst.position}>
      <pointLight
        ref={lightRef}
        color={color.hot}
        intensity={12}
        distance={10}
      />
      <Billboard>
        <mesh ref={flashRef}>
          <circleGeometry args={[0.6, 24]} />
          <meshBasicMaterial
            ref={flashMat}
            color="#fff6e0"
            transparent
            opacity={1}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh ref={smokeMesh}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={smokeMat}
            vertexShader={VERT}
            fragmentShader={SMOKE_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
            uniforms={smokeUniforms}
          />
        </mesh>
        <mesh ref={fireMesh}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={fireMat}
            vertexShader={VERT}
            fragmentShader={FIRE_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={fireUniforms}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

// ---------- manager: giu danh sach vu no, tu huy khi xong ----------
interface ExplosionManagerHandle {
  spawn: (position: [number, number, number]) => void;
}

interface ExplosionFieldProps {
  color: FireColor;
  registerSpawn: (fn: (p: [number, number, number]) => void) => void;
}

function ExplosionField({ color, registerSpawn }: ExplosionFieldProps) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);

  // spawn: thêm vào state
  const spawn = useCallback((position: [number, number, number]) => {
    setBursts((prev) => [
      ...prev,
      {
        id: nextId.current++,
        position,
        seed: Math.random() * 10,
        duration: 1.6 + Math.random() * 0.4,
      },
    ]);
  }, []);

  // mỗi BurstView tự báo khi chạy xong -> xóa khỏi state
  const removeBurst = useCallback((id: number) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // đăng ký spawn ra ngoài — làm trong effect, KHÔNG trong render
  useEffect(() => {
    registerSpawn(spawn);
  }, [registerSpawn, spawn]);

  return (
    <>
      {bursts.map((b) => (
        <BurstView
          key={b.id}
          burst={b}
          color={color}
          onDone={() => removeBurst(b.id)}
        />
      ))}
    </>
  );
}
// ===================== DEMO SCENE =====================
const PRESET: FireColor = { cold: "#5a0e00", hot: "#ff7b00" };

export default function ExplosionFXScene() {
  const spawnRef = useRef<((p: [number, number, number]) => void) | null>(null);

  const registerSpawn = useCallback(
    (fn: (p: [number, number, number]) => void) => {
      spawnRef.current = fn;
    },
    [],
  );

  // no ngau nhien tren mat dat
  const boom = useCallback(() => {
    const x = (Math.random() - 0.5) * 6;
    const z = (Math.random() - 0.5) * 6;
    spawnRef.current?.([x, 0.5, z]);
  }, []);

  // "tha bom": no lien tiep vai qua
  const carpetBomb = useCallback(() => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const x = -4 + i * 2 + (Math.random() - 0.5);
        spawnRef.current?.([x, 0.5, (Math.random() - 0.5) * 2]);
      }, i * 180);
    }
  }, []);

  const btn: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid rgba(255,140,0,0.4)",
    background: "rgba(255,120,0,0.15)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "ui-monospace, monospace",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        background: "#0a0a10",
      }}
    >
      <Canvas
        camera={{ position: [0, 3, 9], fov: 50 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
        frameloop="always"
      >
        <PerfMonitor position="top-left" />
        <color attach="background" args={["#0a0a10"]} />
        <fog attach="fog" args={["#0a0a10", 10, 24]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#16161e" />
        </mesh>
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 10, 5]} intensity={0.4} />

        <ExplosionField color={PRESET} registerSpawn={registerSpawn} />

        <OrbitControls
          minDistance={4}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={1.4}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.5}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 12,
        }}
      >
        <button style={btn} onClick={boom}>
          NO 1 QUA
        </button>
        <button style={btn} onClick={carpetBomb}>
          THA BOM (5 qua)
        </button>
      </div>
    </div>
  );
}

export { ExplosionField };
export type { FireColor, ExplosionManagerHandle };
