import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { gltfLodLoader } from "gltf-lod-loader";

const ModelLod = () => {
  const url =
    "https://development.imaxhitech.com:9990/models/mobilehomelod/model.glb";
  const { gl } = useThree();
  const { scene } = useGLTF(url, false, false, (loader) => {
    gltfLodLoader(loader as any, gl as any);
  });

  return <primitive object={scene} />;
};

export default ModelLod;
