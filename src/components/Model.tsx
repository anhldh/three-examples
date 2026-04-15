/* eslint-disable @typescript-eslint/no-explicit-any */
import { useGLTF, useAnimations } from "@react-three/drei";
import { useEffect } from "react";
import { useControls } from "leva";

interface ModelProps {
  url: string;
  scaleMultiplier?: number;
  position?: [number, number, number];
  animationIndex?: number;
  autoPlay?: boolean;
  enableCursor?: boolean;
}

export function Model({
  url,
  position = [0, 0, 0],
  animationIndex = 0,
  autoPlay = true,
}: ModelProps) {
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, scene);

  const { scale } = useControls("Model", {
    scale: { value: 1, min: 0.01, max: 20, step: 0.01 },
  });

  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (names.length > 0 && autoPlay) {
      const validIndex = Math.min(animationIndex, names.length - 1);
      const action = actions[names[validIndex]];

      if (action) {
        action.reset().fadeIn(0.5).play();
        return () => {
          action.fadeOut(0.5);
        };
      }
    }
  }, [actions, names, animationIndex, autoPlay]);

  return <primitive object={scene} scale={scale} position={position} />;
}
