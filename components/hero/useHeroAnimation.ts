import { useEffect, RefObject } from "react";
import gsap from "gsap";
import * as THREE from "three";

interface AnimationRefs {
    wordmarkRef: RefObject<THREE.Group>;
    energyRef: RefObject<THREE.InstancedMesh>;
}

export function useHeroAnimation({ wordmarkRef, energyRef }: AnimationRefs) {
    useEffect(() => {
        const wordmark = wordmarkRef.current;
        const energy = energyRef.current;

        if (!wordmark || !energy) return;

        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                defaults: { ease: "expo.out" },
                delay: 0.5,
            });

            // 1. Assembly: Letters from depth
            const letters = wordmark.children;

            // Initial states
            gsap.set(letters.map(l => l.position), { z: -10 });
            gsap.set(letters.map(l => l.rotation), { x: -0.5 });

            // Animate Assembly
            tl.to(letters.map(l => l.position), {
                z: 0,
                duration: 2.5,
                stagger: 0.1,
            }, 0);

            tl.to(letters.map(l => l.rotation), {
                x: 0,
                duration: 2.5,
                stagger: 0.1,
            }, 0);

            // 2. Light Sweep (Shader Uniforms)
            const materials: THREE.ShaderMaterial[] = [];
            wordmark.traverse((obj: any) => {
                if (obj.material && obj.material.uniforms) {
                    materials.push(obj.material);
                }
            });

            if (materials.length > 0) {
                tl.to(materials.map(m => m.uniforms.uLightProgress), {
                    value: 1.5, // Sweep from 0 to 1.5
                    duration: 2.0,
                    ease: "power2.inOut",
                }, 1.5); // Start sweep mid-assembly
            }

            // 3. Energy Expansion
            // EnergyField uses <primitive object={particleMaterial} ... />
            // So checks mesh.material
            let particleMat = energy.material as THREE.ShaderMaterial;

            if (particleMat && particleMat.uniforms) {
                tl.to(particleMat.uniforms.uExpansion, {
                    value: 1,
                    duration: 3.5,
                    ease: "power3.out"
                }, 2.0);
            }

            // Reduced Motion Check
            const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
            if (mediaQuery.matches) {
                tl.progress(1);
            }

        });

        return () => ctx.revert();
    }, []);
}
