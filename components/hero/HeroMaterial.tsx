"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import React from 'react';

// Color stops
const COLOR_A = new THREE.Color("#7C3AED");
const COLOR_B = new THREE.Color("#06B6D4");
const COLOR_C = new THREE.Color("#22C55E"); // Added green for the tail/head variation

export function HeroPhysicalMaterial(props: any) {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  const checkUniforms = (shader: any) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uLightProgress = { value: -10 }; // Start outside
    shader.uniforms.uColorA = { value: COLOR_A };
    shader.uniforms.uColorB = { value: COLOR_B };
    shader.uniforms.uColorC = { value: COLOR_C };

    materialRef.current!.userData.shader = shader;
  };

  useFrame((state) => {
    if (materialRef.current && materialRef.current.userData.shader) {
      materialRef.current.userData.shader.uniforms.uTime.value = state.clock.getElapsedTime();
      // uLightProgress will be updated by GSAP from outside, accessing materialRef.current.userData.shader.uniforms.uLightProgress.value
    }
  });

  const onBeforeCompile = (shader: any) => {
    checkUniforms(shader);

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
            #include <common>
            varying vec3 vWorldPosition;
            `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
            #include <worldpos_vertex>
            vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
            `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
            #include <common>
            uniform float uTime;
            uniform float uLightProgress; // World X position of the pulse center
            uniform float uEmissiveIntensity; // Controls brightness/breathing
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            uniform vec3 uColorC;
            varying vec3 vWorldPosition;
            `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `
            #include <emissivemap_fragment>

            // Emissive Pulse Geometry (World Space)
            // Pulse moves from X -4 to X +4 (approx)
            float pulseWidth = 2.5;
            float dist = vWorldPosition.x - uLightProgress;
            
            // Interaction/Sweep mask
            float mask = smoothstep(pulseWidth, 0.0, abs(dist));
            
            // Gradient mapping based on distance from center of pulse
            // Center (0) -> Cyan, Edges -> Purple/Green
            vec3 pulseColor = mix(uColorA, uColorB, mask);
            pulseColor = mix(pulseColor, uColorC, smoothstep(0.5, 1.0, mask));
            
            // Intensity boost
            float intensity = uEmissiveIntensity * mask; 
            
            // Edge Fresnel (Grazing)
            // Re-calculate view direction in World Space for correctness
            vec3 viewDirView = normalize(-vViewPosition); // Vector from surface to camera
            float fresnel = pow(1.0 - saturate(dot(normal, viewDirView)), 3.0);
            
            vec3 rimColor = vec3(0.769, 0.71, 0.992); // #C4B5FD
            
            // Static Fresnel is constant, Pulse Fresnel adds to it
            vec3 staticFresnel = rimColor * fresnel * 0.5; 
            
            totalEmissiveRadiance += pulseColor * intensity;
            totalEmissiveRadiance += staticFresnel;
            `
    );
  };

  return (
    // @ts-ignore
    <meshPhysicalMaterial
      ref={materialRef}
      color="#0B0F19"
      metalness={0.82}
      roughness={0.18}
      clearcoat={0.35}
      clearcoatRoughness={0.1}
      emissive="#000000"
      onBeforeCompile={onBeforeCompile}
      // Enable transparency for the intro fade
      transparent={true}
      opacity={0}
      toneMapped={true}
      {...props}
    />
  );
}
