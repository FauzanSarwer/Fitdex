"use client";

import { useRef, useMemo, useEffect, forwardRef, ForwardedRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const PARTICLE_COUNT = 800;

export const EnergyField = forwardRef(function EnergyField(props, ref: ForwardedRef<THREE.InstancedMesh>) {
    // Use a local ref if none provided, but we need to expose it.
    // We can use useImperativeHandle or just expect ref to be passed.
    // Simpler: use the forwarded ref directly if guaranteed, or a combined ref.
    // For this specific use case, we'll assume the parent passes a valid ref object.
    const meshRef = ref as React.MutableRefObject<THREE.InstancedMesh>;
    const localRef = useRef<THREE.InstancedMesh>(null);
    const targetRef = meshRef || localRef;

    // Custom shader material for particles
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const { vec, transform } = useMemo(() => {
        const vec = new THREE.Vector3();
        const transform = new THREE.Matrix4();
        return { vec, transform };
    }, []);

    useEffect(() => {
        if (!targetRef.current) return;

        // Initial random positions
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Box distribution around text
            const x = (Math.random() - 0.5) * 10;
            const y = (Math.random() - 0.5) * 4;
            const z = (Math.random() - 0.5) * 4;

            transform.setPosition(x, y, z);
            targetRef.current.setMatrixAt(i, transform);

            // Store random attributes like scale or speed if needed in userData or attributes
        }
        targetRef.current.instanceMatrix.needsUpdate = true;
    }, [transform]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
        }
    });

    const particleMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: {
                uTime: { value: 0 },
                uExpansion: { value: 0 }, // Driven by GSAP
                uColor: { value: new THREE.Color("#4f46e5") }, // Indigo-ish
            },
            vertexShader: `
        uniform float uTime;
        uniform float uExpansion;
        
        attribute float aRandom;
        
        varying float vAlpha;
        
        void main() {
          vec3 pos = position;
          
          // Instance matrix handles initial position
          vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
          
          // Expansion logic: Push outward from center based on uExpansion
          vec3 center = vec3(0.0, 0.0, 0.0);
          vec3 dir = normalize(worldPos.xyz - center);
          float dist = length(worldPos.xyz - center);
          
          // Noise-like movement
          float drift = sin(uTime * 0.5 + worldPos.x) * 0.1;
          
          // Apply expansion
          vec3 expandedPos = worldPos.xyz + dir * (uExpansion * 5.0 * (1.0 + drift));
          
          // Twinkle alpha
          float twinkle = 0.5 + 0.5 * sin(uTime * 2.0 + worldPos.x * 10.0);
          vAlpha = twinkle * smoothstep(0.0, 0.2, uExpansion); // Only show when expanding? Or always ambient?
          // Let's make them ambiently visible but explode out
          vAlpha = twinkle * 0.6;

          vec4 mvPosition = modelViewMatrix * vec4(expandedPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = (100.0 / -mvPosition.z) * 0.15; // Scale by distance
        }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        
        void main() {
          // Circular particle
          float r = distance(gl_PointCoord, vec2(0.5));
          if (r > 0.5) discard;
          
          // Soft edge
          float glow = 1.0 - (r * 2.0);
          glow = pow(glow, 1.5);
          
          gl_FragColor = vec4(uColor, vAlpha * glow);
        }
      `
        });
    }, []);

    return (
        <instancedMesh ref={targetRef} args={[undefined, undefined, PARTICLE_COUNT]}>
            <planeGeometry args={[0.2, 0.2]} />
            <primitive object={particleMaterial} ref={materialRef} attach="material" />
        </instancedMesh>
    );
});
