"use client";

import { Text3D, Center } from "@react-three/drei";
import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { HeroPhysicalMaterial } from "@/components/hero/HeroMaterial";
import gsap from "gsap";

interface LetterProps {
    char: string;
    index: number;
    position: [number, number, number];
}

export function Letter({ char, index, position }: LetterProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<any>(null);

    useEffect(() => {
        const mesh = meshRef.current;
        const material = materialRef.current;
        if (!mesh || !material) return;

        // Intro Timeline
        const tl = gsap.timeline({
            defaults: { ease: "power3.out" },
            onComplete: () => {
                // Start Idle Breathing
                // 0.6 <-> 0.7 over 9s
                gsap.to(material.userData.shader.uniforms.uEmissiveIntensity, {
                    value: 0.7,
                    duration: 4.5,
                    yoyo: true,
                    repeat: -1,
                    ease: "sine.inOut"
                });
            }
        });

        // 1. Z Move & Opacity (0-1200ms)
        // Stagger slightly based on index? Prompt implies unified "letters move Z +4 -> 0". 
        // Let's add very slight stagger for "Cinematic" feel.
        tl.fromTo(mesh.position,
            { z: 4 },
            { z: 0, duration: 1.2, ease: "power3.out" },
            0
        );

        // Ensure opacity uniform/prop is handled. 
        // We set opacity={0} in JSX. Tween to 1.
        tl.to(material, { opacity: 1, duration: 1.2 }, 0);

        // 2. Emissive Pulse (900-2300ms)
        // Pulse travels across glyphs.
        // We need to animate uLightProgress. 
        // Coordinate system: "FITDEX" is centered.
        // X ranges roughly from -3 to +3? 
        // Let's animate from -10 to 10 to be safe.
        // Start at 900ms (0.9s).

        // Also animate intensity: 0 -> 4.5 -> 0.6 (Idle base).
        // Since shader uses uEmissiveIntensity * mask, we animate uEmissiveIntensity.

        // Set initial
        if (material.userData.shader) {
            material.userData.shader.uniforms.uEmissiveIntensity.value = 0;
            material.userData.shader.uniforms.uLightProgress.value = -8;
        }

        // We need to wait for shader compilation for userData.shader to be populated?
        // onBeforeCompile happens before first render. 
        // But useEffect runs after mount. It should be fine.
        // BUT standard material propertis like opacity work differently than uniforms.

        // We use a proxy for uniforms to defer until shader is ready, 
        // or just rely on the fact that by 0.9s it is surely ready.

        const uniformProxy = {
            progress: -8,
            intensity: 0
        };

        const updateUniforms = () => {
            if (material.userData.shader) {
                material.userData.shader.uniforms.uLightProgress.value = uniformProxy.progress;
                material.userData.shader.uniforms.uEmissiveIntensity.value = uniformProxy.intensity;
            }
        };

        tl.to(uniformProxy, {
            progress: 8,
            duration: 1.4, // 900 to 2300 is 1.4s
            ease: "power1.inOut",
            onUpdate: updateUniforms
        }, 0.9);

        // Intensity: 0 -> 4.5 -> 0.6
        // 0 -> 4.5 peak at middle of travel? 
        // Prompt: "emissive intensity: 0 -> 4.5 -> 0.6".
        // Let's keyframe it.
        tl.to(uniformProxy, {
            intensity: 4.5,
            duration: 0.7,
            ease: "power2.out", // Fast attack
            onUpdate: updateUniforms
        }, 0.9);

        tl.to(uniformProxy, {
            intensity: 0.6,
            duration: 0.7,
            ease: "power2.in", // Slow decay
            onUpdate: updateUniforms
        }, 0.9 + 0.7);

        return () => {
            tl.kill();
        };
    }, []);

    const handlePointerOver = () => {
        // Simple hover effect
        // Maybe boost emissive slightly?
    };

    return (
        <group position={position}>
            <Center top>
                <Text3D
                    ref={meshRef}
                    font="/fonts/Inter_Bold.json"
                    size={0.8}
                    height={0.2}
                    curveSegments={12}
                    bevelEnabled
                    bevelThickness={0.02}
                    bevelSize={0.02}
                    bevelOffset={0}
                    bevelSegments={5}
                >
                    {char}
                    <HeroPhysicalMaterial ref={materialRef} />
                </Text3D>
            </Center>
        </group>
    );
}
