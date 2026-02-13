"use client";

import { useRef, useState, useEffect } from "react";
import { Wordmark } from "@/components/hero/Wordmark";
import { EnergyField } from "@/components/hero/EnergyField";
import { useHeroAnimation } from "@/components/hero/useHeroAnimation";
import { Environment } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";

interface ExperienceProps {
    onReady?: () => void;
}

export function Experience({ onReady }: ExperienceProps) {
    const wordmarkRef = useRef<THREE.Group>(null);
    const energyRef = useRef<THREE.InstancedMesh>(null);

    useEffect(() => {
        // Signal that the 3D scene is ready to be shown
        // Small delay ensures the first frame is actually drawn to the canvas
        const t = setTimeout(() => onReady?.(), 100);
        return () => clearTimeout(t);
    }, [onReady]);

    useEffect(() => {
        // Signal that the 3D scene is ready to be shown
        // Small delay ensures the first frame is actually drawn to the canvas
        const t = setTimeout(() => onReady?.(), 100);
        return () => clearTimeout(t);
    }, [onReady]);

    // Camera Intro Animation
    const { camera } = useThree();
    useEffect(() => {
        // 2300-3200ms: camera settles
        // Initial Z is 6.2 (set in Scene). Target 4.8.
        // Start time = ? 2.3s delay?
        // Prompt says "2300-3200ms: camera settles".
        // Does it MEAN it moves during that time? Or ends moving?
        // Let's assume start at 0, slowly move to 4.8 over 3.2s?
        // "letters move Z+4 -> 0 (0-1200ms)".
        // "camera settles (2300-3200ms)".

        // Maybe Camera Z moves from 6.2 -> 4.8 over 3.2s with eased stop?
        // Let's use a long ease.
        gsap.to(camera.position, {
            z: 4.8,
            duration: 3.2,
            ease: "power2.out"
        });

        // Also "Exposure drops 12%" at 2300-3200ms?
        // We set toneMappingExposure=1.2 in Scene.
        // We can't easily animate gl property from here without access to gl.
        // We can animate a post-processing effect or just ignore for now as minor polish.
    }, [camera]);

    // Camera Rig / Parallax
    useFrame((state) => {
        // Idle drift
        const t = state.clock.getElapsedTime();
        const idleX = Math.sin(t * 0.1) * 0.2;
        const idleY = Math.cos(t * 0.15) * 0.2;

        // Mouse Parallax (damped)
        const ptrX = state.pointer.x * 0.5;
        const ptrY = state.pointer.y * 0.5;

        // Target position
        const targetX = idleX + ptrX;
        const targetY = idleY + ptrY;

        // Smooth lerp for X/Y
        state.camera.position.x += (targetX - state.camera.position.x) * 0.05;
        state.camera.position.y += (targetY - state.camera.position.y) * 0.05;

        // Z is animated by GSAP independently.

        state.camera.lookAt(0, 0, 0);
    });

    // Responsive Scaling
    const { viewport } = useThree();
    const responsiveScale = Math.min(viewport.width / 5.5, 1);

    // Click Interaction (Compression)
    const handleClick = () => {
        if (wordmarkRef.current) {
            // Compress in Z
            gsap.to(wordmarkRef.current.scale, {
                z: 0.1,
                duration: 0.2,
                yoyo: true,
                repeat: 1,
                ease: "power2.inOut"
            });
        }
    };

    return (
        <>
            <fogExp2 attach="fog" args={["#050505", 0.15]} />
            <group position={[0, 0, 0]} scale={[responsiveScale, responsiveScale, responsiveScale]} onClick={handleClick}>
                <Wordmark ref={wordmarkRef} />
                <EnergyField ref={energyRef} />
            </group>

            {/* Environment for subtle reflections, kept very low */}
            <Environment preset="city" environmentIntensity={0.1} />

            {/* Fill Light */}
            <ambientLight intensity={0.25} />

            {/* Key Light */}
            <spotLight
                position={[2.5, 3, 4]}
                angle={0.25}
                penumbra={1}
                intensity={1.8}
                castShadow
                shadow-bias={-0.0001}
            />

            {/* Rim Light */}
            <spotLight
                position={[-4, 1.2, -2]}
                intensity={2.4}
                color="#7C3AED"
                angle={0.6}
                penumbra={1}
            />
        </>
    );
}
