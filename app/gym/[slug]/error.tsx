"use client";

export default function GymDetailError() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-muted-foreground">
        Something went wrong while loading this gym.
      </div>
    </div>
  );
}
