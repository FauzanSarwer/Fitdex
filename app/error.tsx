"use client";

import Link from "next/link";
import { useEffect } from "react";
import { logClientError } from "@/lib/logger";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError(error, {
      scope: "app/error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl md:text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground max-w-md">
        We ran into an unexpected error. Try again, or return to the homepage.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => reset()}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
