import { useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Grid } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/baked/baked.glb";
const MANIFEST_URL = "/baked/lightmap_manifest.json";

type ManifestEntry = {
  object: string;
  original: string;
  lightmap: string;
  uvChannel: number;
};

type LightmapMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

function isLightmapMaterial(mat: THREE.Material): mat is LightmapMaterial {
  return (
    (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial === true ||
    (mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial === true
  );
}

function applyLightmaps(
  scene: THREE.Object3D,
  manifest: ManifestEntry[],
  enabled: boolean,
  intensity: number,
  emissiveDebug: boolean,
  forceChannel0: boolean,
): void {
  const byName = new Map(manifest.map((e) => [e.object, e]));
  const loader = new THREE.TextureLoader();
  const cache = new Map<string, THREE.Texture>();

  // glTF splits a multi-material object into primitives named "<obj>_1", "_2"...
  // Strip a trailing _<number> so they map back to the baked object entry.
  const resolveEntry = (name: string): ManifestEntry | undefined => {
    if (byName.has(name)) return byName.get(name);
    const stripped = name.replace(/_\d+$/, "");
    return byName.get(stripped);
  };

  const stats = {
    meshes: 0,
    matched: 0,
    notMatched: 0,
    notStandardMat: 0,
    missingUV1: 0,
    applied: 0,
  };
  const sample: string[] = [];

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    stats.meshes++;

    const entry = resolveEntry(obj.name);
    if (!entry) {
      stats.notMatched++;
      if (sample.length < 8) sample.push(`NO MATCH: "${obj.name}"`);
      return;
    }
    stats.matched++;

    const hasUV1 = !!mesh.geometry?.attributes?.uv1;
    if (!hasUV1) stats.missingUV1++;

    const mats: THREE.Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    mats.forEach((mat) => {
      if (!isLightmapMaterial(mat)) {
        stats.notStandardMat++;
        if (sample.length < 8)
          sample.push(`NOT STD MAT: "${obj.name}" -> ${mat.type}`);
        return;
      }

      if (!enabled) {
        mat.lightMap = null;
        mat.needsUpdate = true;
        return;
      }

      const ch = forceChannel0 ? 0 : entry.uvChannel;
      const cacheKey = `${entry.lightmap}#${ch}`;
      let tex = cache.get(cacheKey);
      if (!tex) {
        tex = loader.load(`/baked/${entry.lightmap}`, (t) => {
          console.log(
            `[lightmap] loaded ${entry.lightmap} ${t.image?.width}x${t.image?.height}`,
          );
        });
        tex.flipY = false;
        tex.colorSpace = THREE.NoColorSpace;
        tex.channel = ch;
        cache.set(cacheKey, tex);
      }

      if (emissiveDebug) {
        // DEBUG: pipe the lightmap into emissive so it's visible regardless of
        // lighting. If THIS shows the baked light, texture + UV are correct and
        // the problem is purely that lightMap isn't being lit.
        mat.lightMap = null;
        mat.emissive = new THREE.Color(0xffffff);
        mat.emissiveMap = tex;
        mat.emissiveIntensity = intensity;
        mat.needsUpdate = true;
        stats.applied++;
        return;
      }

      mat.emissiveMap = null;
      mat.emissive = new THREE.Color(0x000000);
      mat.lightMap = tex;
      mat.lightMapIntensity = intensity;
      mat.needsUpdate = true;
      stats.applied++;

      if (sample.length < 8)
        sample.push(
          `OK: "${obj.name}" mat=${mat.type} uv1=${hasUV1} lm=${entry.lightmap}`,
        );
    });
  });

  console.log("[lightmap] stats", stats);
  console.log("[lightmap] sample:\n" + sample.join("\n"));
}

type ModelProps = {
  manifest: ManifestEntry[];
  lightmapOn: boolean;
  intensity: number;
  emissiveDebug: boolean;
  forceChannel0: boolean;
};

function Model({
  manifest,
  lightmapOn,
  intensity,
  emissiveDebug,
  forceChannel0,
}: ModelProps) {
  const { scene } = useGLTF(MODEL_URL);
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    applyLightmaps(
      model,
      manifest,
      lightmapOn,
      intensity,
      emissiveDebug,
      forceChannel0,
    );
  }, [model, manifest, lightmapOn, intensity, emissiveDebug, forceChannel0]);

  return <primitive object={model} />;
}

type ToggleProps = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <label style={styles.row}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function LightmapViewer() {
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [lightmapOn, setLightmapOn] = useState<boolean>(true);
  const [intensity, setIntensity] = useState<number>(1);
  const [envOn, setEnvOn] = useState<boolean>(true);
  const [emissiveDebug, setEmissiveDebug] = useState<boolean>(false);
  const [forceChannel0, setForceChannel0] = useState<boolean>(false);

  useEffect(() => {
    fetch(MANIFEST_URL)
      .then((r) => r.json())
      .then((data: ManifestEntry[]) => setManifest(data))
      .catch((e) => console.error("manifest load failed", e));
  }, []);

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <h3 style={styles.title}>Lightmap diagnostics</h3>

        <Toggle label="Lightmap" value={lightmapOn} onChange={setLightmapOn} />

        <label style={styles.row}>
          <span>Intensity {intensity.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={4}
            step={0.05}
            value={intensity}
            onChange={(e) => setIntensity(parseFloat(e.target.value))}
          />
        </label>

        <Toggle label="Scene light (env)" value={envOn} onChange={setEnvOn} />
        <Toggle
          label="DEBUG: as emissive"
          value={emissiveDebug}
          onChange={setEmissiveDebug}
        />
        <Toggle
          label="DEBUG: force UV0"
          value={forceChannel0}
          onChange={setForceChannel0}
        />

        <p style={styles.hint}>
          {manifest.length} lightmaps. <b>Turn env OFF</b> then toggle{" "}
          <b>as emissive</b>: if the bake shows up only as emissive, the texture
          is fine and lightMap just isn't being lit.
        </p>
      </div>

      <Canvas
        shadows
        camera={{ position: [4, 3, 6], fov: 45 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#1a1a1f"]} />

        {envOn && <Environment preset="city" />}
        {envOn && <ambientLight intensity={0.2} />}

        {manifest.length > 0 && (
          <Model
            manifest={manifest}
            lightmapOn={lightmapOn}
            intensity={intensity}
            emissiveDebug={emissiveDebug}
            forceChannel0={forceChannel0}
          />
        )}

        <Grid
          args={[20, 20]}
          cellColor="#333"
          sectionColor="#555"
          position={[0, -0.01, 0]}
          infiniteGrid
        />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: "relative", width: "100%", height: "100vh" },
  panel: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    background: "rgba(20,20,26,0.85)",
    color: "#e6e6ea",
    padding: "16px 18px",
    borderRadius: 10,
    width: 240,
    fontFamily: "ui-monospace, monospace",
    fontSize: 13,
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  title: { margin: "0 0 12px", fontSize: 14, fontWeight: 600 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    margin: "8px 0",
  },
  hint: { marginTop: 14, fontSize: 11, lineHeight: 1.5, color: "#9a9aa5" },
};
