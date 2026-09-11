import { Center, useAnimations, useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { gltfLodLoader, LODsManager } from "@anhldh/gltf-lod-loader";
import { useEffect, useMemo } from "react";

const ModelLod = ({ url }: { url: string }) => {
  const { gl } = useThree();
  const { scene, animations } = useGLTF(url, false, false, (loader) => {
    gltfLodLoader(loader as any, gl as any);
  });

  const lods = useMemo(() => LODsManager.get(gl), [gl]);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    lods.updateConfig({
      targetTriangleDensity: 30_000,
      textureScreenCoverageFactor: 3.5,
      minLodLevel: 0,
      maxConcurrentDownloads: 50,
    });
  }, [lods]);

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
    <Center>
      <primitive object={scene} />
    </Center>
  );
};

export default ModelLod;
