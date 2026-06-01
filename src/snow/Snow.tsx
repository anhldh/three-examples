"use no memo";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { PerfMonitor } from "r3f-monitor";

/**
 * Tuyet bang GPU points + shader.
 * - Moi hat co vi tri + toc do roi rieng (attribute), lac ngang theo sin.
 * - Cham day thi recycle len dinh (mod) -> khong tao/huy hat.
 * - simple = true:  cham tron mem (procedural, khong can texture).
 * - simple = false: sample texture bong tuyet (PNG truyen qua prop), co xoay nhe.
 */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uWind;
  uniform float uHeight;   // chieu cao vung roi
  uniform float uSize;

  attribute float aSpeed;  // toc do roi rieng tung hat
  attribute float aSeed;   // pha lac rieng

  varying float vAlpha;
  varying float vRot;      // goc xoay rieng tung hat (cho bong tuyet)

  void main(){
    vec3 pos = position;

    // tong quang duong roi theo thoi gian
    float fall = uTime * uSpeed * aSpeed;

    // y giam dan, wrap trong [0, uHeight] (recycle)
    pos.y = mod(position.y - fall, uHeight);

    // lac ngang mem mai
    float sway = sin(uTime * 1.5 + aSeed * 6.28) * 1.2;
    pos.x += sway + uWind * (uHeight - pos.y) * 0.15;
    pos.z += cos(uTime * 1.2 + aSeed * 6.28) * 1.0;

    // moi hat xoay cham theo huong + toc do rieng
    vRot = uTime * (0.4 + aSeed * 0.8) + aSeed * 6.28;

    // mo dan o tren dinh va sat day cho muot
    vAlpha = smoothstep(0.0, 0.1, pos.y / uHeight) *
             (1.0 - smoothstep(0.85, 1.0, pos.y / uHeight));

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    // hat to nho theo seed cho tu nhien
    gl_PointSize = uSize * (0.6 + aSeed * 0.8) * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uSimple;   // 1 = cham tron, 0 = texture bong tuyet
  uniform vec3 uColor;
  uniform sampler2D uTex;
  uniform float uHasTex;   // 1 neu co texture, 0 neu chua

  varying float vAlpha;
  varying float vRot;

  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float shape;

    if (uSimple > 0.5 || uHasTex < 0.5) {
      // cham tron mem (fallback khi chua co texture)
      shape = smoothstep(0.5, 0.0, length(c));
    } else {
      // xoay UV quanh tam roi sample texture bong tuyet
      float s = sin(vRot), co = cos(vRot);
      vec2 uv = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5;
      shape = texture2D(uTex, uv).a;
    }

    float alpha = shape * vAlpha * 0.95;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

interface SnowProps {
  count?: number;
  area?: number; // be ngang vung roi (x,z)
  height?: number; // chieu cao vung roi
  speed?: number;
  wind?: number;
  size?: number;
  color?: string;
  simple?: boolean;
  /** URL anh PNG bong tuyet, vd "/snowflake.png" */
  texture?: string;
}

function makeParticles(count: number, area: number, height: number) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * area;
    positions[i * 3 + 1] = Math.random() * height;
    positions[i * 3 + 2] = (Math.random() - 0.5) * area;
    speeds[i] = 0.6 + Math.random() * 0.8;
    seeds[i] = Math.random();
  }
  return { positions, speeds, seeds };
}

export function Snow({
  count = 6000,
  area = 40,
  height = 28,
  speed = 1,
  wind = 0.3,
  size = 1,
  color = "#ffffff",
  simple = false,
  texture,
}: SnowProps) {
  const mat = useRef<THREE.ShaderMaterial>(null);

  // chi load texture khi co URL (drei useTexture nhan array de optional)
  const loaded = useTexture(texture ? [texture] : []);
  const tex = (loaded as THREE.Texture[])[0] ?? null;

  // sinh hat 1 lan
  const { positions, speeds, seeds } = useMemo(
    () => makeParticles(count, area, height),
    [count, area, height],
  );

  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uSpeed: { value: speed * 3 },
    uWind: { value: wind },
    uHeight: { value: height },
    uSize: { value: size * 4 },
    uSimple: { value: simple ? 1 : 0 },
    uColor: { value: new THREE.Color(color) },
    uTex: { value: tex },
    uHasTex: { value: tex ? 1 : 0 },
  }));

  useFrame((_, dt) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uTime.value += dt;
    u.uSpeed.value = speed * 3;
    u.uWind.value = wind;
    u.uSize.value = size * 4;
    u.uSimple.value = simple ? 1 : 0;
    (u.uColor.value as THREE.Color).set(color);
    u.uTex.value = tex;
    u.uHasTex.value = tex ? 1 : 0;
  });

  return (
    <points>
      <bufferGeometry key={count}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
        uniforms={uniforms}
      />
    </points>
  );
}

// ===================== DEMO SCENE =====================
export default function SnowScene() {
  const [count, setCount] = useState(4000);
  const [wind, setWind] = useState(0.3);
  const [speed, setSpeed] = useState(1);
  const [size, setSize] = useState(0.3);
  const [simple, setSimple] = useState(false);

  const bg = "#1a2030";

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        background: bg,
      }}
    >
      <Canvas camera={{ position: [0, 6, 18], fov: 55 }} frameloop="always">
        <PerfMonitor position="bottom-left" />
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, 15, 45]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#2a3548" roughness={0.9} />
        </mesh>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 12, 8]} intensity={0.6} />

        <mesh position={[-4, 1.5, 0]}>
          <boxGeometry args={[2, 3, 2]} />
          <meshStandardMaterial color="#3a4556" />
        </mesh>
        <mesh position={[4, 1, -3]}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#3a4556" />
        </mesh>

        <Snow
          count={count}
          area={40}
          height={28}
          speed={speed}
          wind={wind}
          size={size}
          simple={simple}
          // doi thanh duong dan PNG bong tuyet cua ban:
          texture="/particle.png"
        />

        <OrbitControls
          // enablePan={false}
          minDistance={6}
          maxDistance={35}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />
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
          Size: {size.toFixed(1)}x
        </div>
        <input
          type="range"
          min="0.3"
          max="3"
          step="0.1"
          value={size}
          onChange={(e) => setSize(parseFloat(e.target.value))}
        />

        <div style={{ fontSize: 11, opacity: 0.5 }}>
          Keo de xoay, cuon de zoom.
        </div>
      </div>
    </div>
  );
}
