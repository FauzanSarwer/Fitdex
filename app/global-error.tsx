"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError(error, {
      scope: "app/global-error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold">We hit a snag</h1>
          <p className="mt-3 text-muted-foreground max-w-md">
            A critical error occurred. You can try to recover or refresh the page.
          </p>
          <div className="mt-6">
            <button
              onClick={() => reset()}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Recover
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
