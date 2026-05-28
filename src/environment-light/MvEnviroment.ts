import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PMREMGenerator } from "three";
import EnvironmentScene from "./EnvironmentScene";

export function MVEnvironment({
  variant = "neutral",
}: {
  variant?: "legacy" | "neutral";
}) {
  const get = useThree((s) => s.get); // hàm get của store, ổn định

  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const envScene = new EnvironmentScene(variant);
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    return () => {
      scene.environment = null;
      envMap.dispose();
      pmrem.dispose();
    };
  }, [get, variant]);

  return null;
}
