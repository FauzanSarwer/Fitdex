"use client";

import { useRef, useLayoutEffect, ForwardedRef, forwardRef } from "react";
import { Group, Vector3 } from "three";
import { Letter } from "@/components/hero/Letter";
import { Center } from "@react-three/drei";

// Manual spacing tweaks for Inter Bold
// F i t d e x
const LETTER_SPACING = [0, 0.7, 1.1, 1.6, 2.3, 2.95];
const CHARS = ["F", "i", "t", "d", "e", "x"];

export const Wordmark = forwardRef(function Wordmark(props, ref: ForwardedRef<Group>) {
    return (
        <group ref={ref} {...props}>
            <Center>
                <group>
                    {CHARS.map((char, index) => (
                        <Letter
                            key={index}
                            index={index}
                            char={char}
                            position={[LETTER_SPACING[index], 0, 0]}
                        />
                    ))}
                </group>
            </Center>
        </group>
    );
});
