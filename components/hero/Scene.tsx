"use client";

import { Canvas } from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense, useEffect, useState } from "react";
import { Experience } from "@/components/hero/Experience";
import * as THREE from "three";

interface SceneProps {
    onReady?: () => void;
}

export default function Scene({ onReady }: SceneProps) {
    const [dpr, setDpr] = useState(1);

    useEffect(() => {
        // Cap DPR at 2 for performance
        setDpr(Math.min(window.devicePixelRatio, 2));
    }, []);

    return (
        <Canvas
            dpr={dpr}
            camera={{ position: [0, 0, 6.2], fov: 32 }}
            gl={{
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.2,
                powerPreference: "high-performance",
            }}
            className="w-full h-full"
        >
            <color attach="background" args={["#050505"]} />

            <Suspense fallback={null}>
                <Experience onReady={onReady} />
                <EffectComposer enableNormalPass={false}>
                    <Bloom luminanceThreshold={1.2} mipmapBlur intensity={0.38} radius={0.52} />
                </EffectComposer>
                <Preload all />
            </Suspense>
        </Canvas>
    );
}
