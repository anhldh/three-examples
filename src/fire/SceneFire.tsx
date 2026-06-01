// import { useRef, useMemo } from "react";
// import { Canvas, useFrame, useThree } from "@react-three/fiber";
// import { OrbitControls } from "@react-three/drei";
// import { EffectComposer, Bloom } from "@react-three/postprocessing";
// import * as THREE from "three";

// /**
//  * Volumetric fire bằng raymarching trong fragment shader.
//  * - Một box bao quanh thể tích lửa.
//  * - Mỗi pixel bắn tia từ camera, đi qua box, lấy mẫu density 3D noise.
//  * - Density: hình giọt lửa (hẹp dần lên đỉnh) * warped fbm cuộn lên theo thời gian.
//  * - Màu theo nhiệt (density + độ cao), HDR ở lõi để Bloom loé sáng.
//  * Đắt: nhiều step * nhiều octave noise mỗi pixel. Đúng tinh thần "demo, kệ nặng".
//  */

// const FIRE_GLSL = /* glsl */ `
//   precision highp float;

//   uniform float uTime;
//   uniform vec3  uCamPos;     // camera pos trong local space cua box
//   uniform vec3  uColdColor;
//   uniform vec3  uHotColor;
//   uniform float uIntensity;
//   uniform int   uSteps;

//   varying vec3 vLocalPos;    // vi tri fragment tren mat box (local space)

//   // ---- simplex noise 3D (Ashima) ----
//   vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
//   vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
//   vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
//   vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
//   float snoise(vec3 v){
//     const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
//     vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
//     vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
//     vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
//     i=mod289(i);
//     vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
//     float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
//     vec4 j=p-49.0*floor(p*ns.z*ns.z);
//     vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
//     vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
//     vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
//     vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
//     vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
//     vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
//     vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
//     p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
//     vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
//     return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
//   }
//   float fbm(vec3 p){
//     float v=0.0,a=0.5;
//     for(int i=0;i<5;i++){v+=a*snoise(p);p*=2.0;a*=0.5;}
//     return v;
//   }

//   // density tai mot diem trong the tich (p in [-1,1]^3 cua box)
//   float density(vec3 p){
//     // hinh giot lua: ban kinh ngang cho phep hep dan khi len cao
//     float y = p.y * 0.5 + 0.5;              // 0 (day) -> 1 (dinh)
//     float radius = mix(0.55, 0.05, y);      // hep dan len tren
//     float rxz = length(p.xz);
//     float shape = smoothstep(radius, 0.0, rxz);   // 1 o loi, 0 o ngoai ban kinh
//     shape *= smoothstep(1.0, 0.2, y);             // tat dan o dinh
//     shape *= smoothstep(-1.05, -0.7, p.y);        // bo gon o day

//     // noise cuon LEN + warp cho cuon xoay
//     vec3 q = p * 2.2;
//     q.y -= uTime * 1.6;
//     vec3 w = vec3(fbm(q), fbm(q + 3.1), fbm(q + 7.7));
//     float n = fbm(q + 1.5 * w);
//     n = n * 0.5 + 0.5;

//     float d = shape * n;
//     d = smoothstep(0.18, 0.7, d);   // ngưỡng cho lua "dac" hon, rìa van mem
//     return d;
//   }

//   // mau theo nhiet (t: 0 nguoi -> 1 nong), HDR o loi cho bloom
//   vec3 fireColor(float t){
//     vec3 c = mix(uColdColor, uHotColor, smoothstep(0.0, 0.5, t));
//     c = mix(c, vec3(1.0, 0.8, 0.3), smoothstep(0.45, 0.8, t));
//     c = mix(c, vec3(2.0, 1.7, 1.1), smoothstep(0.8, 1.0, t)); // >1 => bloom
//     return c;
//   }

//   // giao tia voi box [-1,1]^3 -> tra ve (tNear, tFar)
//   vec2 intersectBox(vec3 ro, vec3 rd){
//     vec3 inv = 1.0 / rd;
//     vec3 t0 = (vec3(-1.0) - ro) * inv;
//     vec3 t1 = (vec3( 1.0) - ro) * inv;
//     vec3 tmin = min(t0, t1);
//     vec3 tmax = max(t0, t1);
//     float tN = max(max(tmin.x, tmin.y), tmin.z);
//     float tF = min(min(tmax.x, tmax.y), tmax.z);
//     return vec2(tN, tF);
//   }

//   void main(){
//     vec3 ro = uCamPos;                       // goc tia = camera (local)
//     vec3 rd = normalize(vLocalPos - uCamPos); // huong tia

//     vec2 t = intersectBox(ro, rd);
//     float tNear = max(t.x, 0.0);
//     float tFar  = t.y;
//     if (tFar <= tNear) discard;

//     int STEPS = uSteps;
//     float dt = (tFar - tNear) / float(STEPS);

//     vec3  acc = vec3(0.0);   // mau tich luy (emission)
//     float trans = 1.0;       // do trong suot con lai (front-to-back)

//     for (int i = 0; i < 128; i++) {
//       if (i >= STEPS) break;
//       float tt = tNear + (float(i) + 0.5) * dt;
//       vec3 pos = ro + rd * tt;

//       float d = density(pos);
//       if (d > 0.001) {
//         // nhiet: dac hon + cao hon = nong hon
//         float y = pos.y * 0.5 + 0.5;
//         float heat = clamp(d * 1.2 + (1.0 - y) * 0.5, 0.0, 1.0);
//         vec3 col = fireColor(heat) * d * uIntensity;

//         // emission-absorption: front-to-back compositing
//         float a = d * dt * 6.0;
//         a = clamp(a, 0.0, 1.0);
//         acc += trans * col * a;
//         trans *= (1.0 - a);
//         if (trans < 0.01) break;
//       }
//     }

//     float alpha = 1.0 - trans;
//     if (alpha < 0.001) discard;
//     gl_FragColor = vec4(acc, alpha);
//   }
// `;

// const VERT = /* glsl */ `
//   varying vec3 vLocalPos;
//   void main(){
//     vLocalPos = position;  // position cua box geometry (local, [-1,1])
//     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//   }
// `;

// interface FireColor {
//   cold: string;
//   hot: string;
// }

// interface VolFireProps {
//   color: FireColor;
//   intensity?: number;
//   steps?: number;
// }

// function VolumetricFireMesh({
//   color,
//   intensity = 1.0,
//   steps = 80,
// }: VolFireProps) {
//   const mesh = useRef<THREE.Mesh>(null);
//   const mat = useRef<THREE.ShaderMaterial>(null);
//   const { camera } = useThree();

//   const uniforms = useMemo(
//     () => ({
//       uTime: { value: 0 },
//       uCamPos: { value: new THREE.Vector3() },
//       uColdColor: { value: new THREE.Color(color.cold) },
//       uHotColor: { value: new THREE.Color(color.hot) },
//       uIntensity: { value: intensity },
//       uSteps: { value: steps },
//     }),
//     [], // eslint-disable-line react-hooks/exhaustive-deps
//   );

//   const invMat = useMemo(() => new THREE.Matrix4(), []);
//   const camLocal = useMemo(() => new THREE.Vector3(), []);

//   useFrame((_, dt) => {
//     if (!mat.current || !mesh.current) return;
//     const u = mat.current.uniforms;
//     u.uTime.value += dt;
//     u.uIntensity.value = intensity;
//     u.uSteps.value = steps;
//     (u.uColdColor.value as THREE.Color).set(color.cold);
//     (u.uHotColor.value as THREE.Color).set(color.hot);

//     // chuyen camera pos sang local space cua box -> ro cua raymarch
//     invMat.copy(mesh.current.matrixWorld).invert();
//     camLocal.copy(camera.position).applyMatrix4(invMat);
//     (u.uCamPos.value as THREE.Vector3).copy(camLocal);
//   });

//   return (
//     <mesh ref={mesh} scale={[1.2, 1.8, 1.2]}>
//       <boxGeometry args={[2, 2, 2]} />
//       <shaderMaterial
//         ref={mat}
//         vertexShader={VERT}
//         fragmentShader={FIRE_GLSL}
//         transparent
//         depthWrite={false}
//         side={THREE.BackSide}
//         blending={THREE.AdditiveBlending}
//         uniforms={uniforms}
//       />
//     </mesh>
//   );
// }

// const PRESETS: Record<string, FireColor & { label: string }> = {
//   classic: { cold: "#3a0800", hot: "#ff6a00", label: "Cam" },
//   blue: { cold: "#001440", hot: "#2aa0ff", label: "Xanh" },
//   green: { cold: "#062200", hot: "#39ff14", label: "Doc" },
//   purple: { cold: "#220040", hot: "#d62af0", label: "Tim" },
// };

// export default function ExplosionScene() {
//   const color = PRESETS.classic;

//   return (
//     <div style={{ width: "100%", height: "100vh", background: "#02030a" }}>
//       <Canvas
//         camera={{ position: [0, 0.3, 5], fov: 50 }}
//         gl={{ toneMapping: THREE.ACESFilmicToneMapping, antialias: true }}
//         frameloop="always"
//       >
//         <color attach="background" args={["#02030a"]} />
//         <VolumetricFireMesh color={color} intensity={1.1} steps={90} />
//         <OrbitControls enablePan={false} minDistance={3} maxDistance={12} />
//         <EffectComposer>
//           <Bloom
//             intensity={1.6}
//             luminanceThreshold={0.55}
//             luminanceSmoothing={0.5}
//             mipmapBlur
//           />
//         </EffectComposer>
//       </Canvas>
//     </div>
//   );
// }

// export { VolumetricFireMesh };
// export type { FireColor };
import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Billboard } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { PerfMonitor } from "r3f-monitor";

/**
 * Lua decor dat duoc vao scene 3D, nhe.
 * Moi "cuc lua" = vai lop Billboard plane xep chong, lech nhe ve do sau/scale.
 * Shader ve ngon lua 2D bang noise cuon len. Nhieu lop -> ao giac khoi.
 * Cuc re: moi plane = 2 tam giac. Dat nhieu cuc van muot.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSeed;
  uniform vec3  uColdColor;
  uniform vec3  uHotColor;

  // value noise 2D
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), u.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v += a*noise(p); p*=2.0; a*=0.5; }
    return v;
  }

  void main(){
    vec2 uv = vUv;

    // toa do "ngon lua": goc duoi giua, cao len tren
    vec2 p = vec2((uv.x - 0.5) * 2.0, uv.y);

    // noise cuon LEN + lac ngang theo thoi gian
    vec2 q = vec2(p.x * 2.0, p.y * 2.5);
    q.y -= uTime * 1.8;
    q.x += sin(uv.y * 6.0 + uTime * 2.0 + uSeed) * 0.15;
    float n = fbm(q + uSeed * 10.0);

    // hinh ngon lua: hep dan len dinh, meo theo noise
    float flame = p.y + (n - 0.5) * 0.9;
    // tat dan ra ria ngang (hep hon o tren)
    float width = mix(0.9, 0.25, uv.y);
    float edge = smoothstep(width, 0.0, abs(p.x));

    float intensity = (1.0 - flame) * edge;
    intensity = clamp(intensity, 0.0, 1.0);
    intensity = pow(intensity, 1.4);

    // mau theo nhiet, HDR o loi cho bloom
    vec3 col = mix(uColdColor, uHotColor, intensity);
    col = mix(col, vec3(1.0, 0.9, 0.5), smoothstep(0.5, 0.85, intensity));
    col = mix(col, vec3(1.8, 1.5, 1.0), smoothstep(0.85, 1.0, intensity)); // bloom

    // alpha: tat o dinh va ria, goc lua dac
    float alpha = intensity * smoothstep(0.0, 0.15, uv.y);
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

interface FireColor {
  cold: string;
  hot: string;
}

interface FireLayerProps {
  seed: number;
  color: FireColor;
  scale: [number, number];
  z: number;
}

function FireLayer({ seed, color, scale, z }: FireLayerProps) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uSeed: { value: seed },
    uColdColor: { value: new THREE.Color(color.cold) },
    uHotColor: { value: new THREE.Color(color.hot) },
  }));

  useFrame((_, dt) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uTime.value += dt;
    (u.uColdColor.value as THREE.Color).set(color.cold);
    (u.uHotColor.value as THREE.Color).set(color.hot);
  });

  return (
    <mesh position={[0, scale[1] / 2, z]} scale={[scale[0], scale[1], 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
      />
    </mesh>
  );
}

interface FireDecorProps {
  position?: [number, number, number];
  scale?: number;
  color?: FireColor;
  layers?: number;
}

/**
 * Component dat vao scene: <FireDecor position={[x,y,z]} scale={1.5} />
 * Tu billboard nen luon huong ve camera. Nhieu lop tao chieu sau.
 */
export function FireDecor({
  position = [0, 0, 0],
  scale = 1,
  color = { cold: "#5a0e00", hot: "#ff7b00" },
  layers = 4,
}: FireDecorProps) {
  const layerData = useMemo(
    () =>
      Array.from({ length: layers }, (_, i) => {
        const t = i / Math.max(1, layers - 1);
        return {
          seed: i * 1.37 + 0.5,
          // lop sau to hon, lop truoc nho & nong hon
          w: (1.2 - t * 0.5) * scale,
          h: (1.8 - t * 0.4) * scale,
          z: (t - 0.5) * 0.3 * scale,
        };
      }),
    [layers, scale],
  );

  return (
    <group position={position}>
      <Billboard>
        {layerData.map((l, i) => (
          <FireLayer
            key={i}
            seed={l.seed}
            color={color}
            scale={[l.w, l.h]}
            z={l.z}
          />
        ))}
      </Billboard>
    </group>
  );
}

// ===================== DEMO SCENE =====================
const PRESETS: Record<string, FireColor> = {
  classic: { cold: "#5a0e00", hot: "#ff7b00" },
  blue: { cold: "#001a4d", hot: "#2aa0ff" },
};

export default function ExplosionScene() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#0a0a0f" }}>
      <Canvas
        camera={{ position: [0, 1.5, 6], fov: 50 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
        frameloop="always"
      >
        <PerfMonitor position="top-left" />
        <color attach="background" args={["#0a0a0f"]} />

        {/* san de thay lua dat tren be mat */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#15151c" />
        </mesh>
        <ambientLight intensity={0.15} />

        {/* nhieu cuc lua dat rai rac nhu mot vu chay */}
        <FireDecor position={[0, 0, 0]} scale={1.6} color={PRESETS.classic} />
        <OrbitControls
          enablePan={true}
          minDistance={3}
          maxDistance={14}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={1.3}
            luminanceThreshold={0.6}
            luminanceSmoothing={0.5}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

export type { FireColor };
