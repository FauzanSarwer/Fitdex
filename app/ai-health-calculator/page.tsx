import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getBaseUrl } from "@/lib/site";
import { SiteShell } from "@/components/layout/site-shell";

const AIHealthCalculatorClient = dynamic(
  () => import("./ai-health-calculator-client").then((mod) => mod.AIHealthCalculatorClient),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-muted-foreground">
        Loading calculator...
      </div>
    ),
  }
);

const BASE_URL = getBaseUrl();

export const metadata: Metadata = {
  title: "Health Calculator | Fitdex",
  description:
    "Use the Fitdex Health Calculator for robust personalized scoring with a clean visual summary.",
  alternates: {
    canonical: `${BASE_URL}/ai-health-calculator`,
  },
};

export default function AIHealthCalculatorPage(): JSX.Element {
  return (
    <SiteShell>
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] p-8">
          <h1 className="text-3xl font-bold sm:text-4xl">Fitdex AI Health Calculator</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Robust personalized logic under the hood, delivered as a brief visual report you can act on quickly.
          </p>
        </section>

        <section aria-labelledby="health-score-engine" className="space-y-4">
          <h2 id="health-score-engine" className="text-2xl font-semibold">
            Personalized Health Engine
          </h2>
          <AIHealthCalculatorClient />
        </section>

        <section aria-labelledby="how-it-works" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 id="how-it-works" className="text-2xl font-semibold">
            How this upgraded model works
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            The backend combines body composition, activity, recovery, and metabolic markers into one robust score.
          </p>
          <p className="text-sm text-muted-foreground sm:text-base">
            You get a concise output with visuals, brief guidance, and actionable targets.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 to-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold">Put your score into action</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Use your output with local gym discovery to execute the exact training environment and structure your plan needs.
          </p>
          <Link
            href="/explore"
            className="fitdex-health-cta mt-5 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
          >
            Explore Gyms
          </Link>
        </section>

        <section aria-labelledby="use-cases" className="space-y-4">
          <h2 id="use-cases" className="text-2xl font-semibold">
            Use cases
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-semibold">Precision Fat Loss</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Align calorie deficits, steps, and recovery constraints so fat loss is steady without destroying performance.
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-semibold">Lean Muscle Gain</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Use macro splits, hydration, and workload guidance tuned to your profile and training experience level.
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-semibold">Long-Term Tracking</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Re-run the score with fresh measurements and monitor whether risk markers and behavior scores improve month over month.
              </p>
            </article>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
