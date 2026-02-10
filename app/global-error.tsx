"use client";

import { useEffect } from "react";
import { logClientError } from "../lib/logger";
import { sendErrorToTrackingService } from "../lib/error-tracking";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Defensive: log all errors with context, never leak sensitive info
    logClientError(error, {
      scope: "app/global-error",
      digest: error.digest,
    });

    // Optionally: send to external error tracking (Sentry, etc.)
    if (process.env.NODE_ENV === "production") {
      sendErrorToTrackingService(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <div
          className="min-h-screen flex flex-col items-center justify-center px-6 text-center animate-fade-in"
          role="alert"
          aria-live="assertive"
        >
          <h1 className="text-2xl md:text-3xl font-semibold mb-2">We hit a snag</h1>
          <p className="mt-3 text-muted-foreground max-w-md mb-6">
            A critical error occurred. Please try again or contact support if the issue persists.<br />
            <span className="text-xs text-muted-foreground">Error code: {error.digest ?? "unknown"}</span>
          </p>
          <div className="mt-6">
            <button
              onClick={() => reset()}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Recover from error"
            >
              Recover
            </button>
          </div>
        </div>
        <style>{`
          .animate-fade-in {
            animation: fadeIn 0.6s cubic-bezier(0.4,0,0.2,1);
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>
      </body>
    </html>
  );
}
