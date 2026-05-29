import { useAnimations, useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { gltfLodLoader } from "@anhldh/gltf-lod-loader";
import { useEffect } from "react";

const ModelLod = ({ url }: { url: string }) => {
  const { gl } = useThree();
  const { scene, animations } = useGLTF(url, false, false, (loader) => {
    gltfLodLoader(loader as any, gl as any);
  });

  const { actions } = useAnimations(animations, scene);

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

  return <primitive object={scene} />;
};

export default ModelLod;
