"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

interface WebGLHeroProps {
    onSceneReady?: () => void;
}

const Scene = dynamic(() => import("@/components/hero/Scene"), { ssr: false });

export function WebGLHero({ onSceneReady }: WebGLHeroProps) {
    return (
        <div className="absolute inset-0 z-0">
            <Suspense fallback={null}>
                {/* @ts-ignore dynamic component props inference can be tricky */}
                <Scene onReady={onSceneReady} />
            </Suspense>
        </div>
    );
}
