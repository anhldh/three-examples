import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { gltfLodLoader } from "@anhldh/gltf-lod-loader";

const ModelLod = ({ url }: { url: string }) => {
  const { gl } = useThree();
  const { scene } = useGLTF(url, false, false, (loader) => {
    gltfLodLoader(loader as any, gl as any);
  });

  return <primitive object={scene} />;
};

export default ModelLod;
