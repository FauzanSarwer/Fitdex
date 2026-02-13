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
    "Use the Fitdex Health Calculator to estimate your score, calorie needs, and personalized fitness recommendations.",
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
            A deterministic scoring model built on BMI, BMR, activity load, and age-adjusted health factors.
          </p>
        </section>

        <section aria-labelledby="health-score-engine" className="space-y-4">
          <h2 id="health-score-engine" className="text-2xl font-semibold">
            Health Score Engine
          </h2>
          <AIHealthCalculatorClient />
        </section>

        <section aria-labelledby="how-it-works" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 id="how-it-works" className="text-2xl font-semibold">
            How the score works
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            The model uses fixed weightings for body composition, activity level, and age. Results are reproducible and
            easy to compare over time.
          </p>
          <p className="text-sm text-muted-foreground sm:text-base">
            Every recommendation is tied directly to measurable profile inputs.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 to-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold">Put your score into action</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Pair your results with local gym discovery to execute your plan with the right environment and support.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
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
              <h3 className="font-semibold">Weight Loss</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Use calorie targets and risk scoring to track fat-loss progression with objective baselines.
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-semibold">Muscle Gain</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Estimate maintenance needs and apply intake adjustments to improve lean-mass outcomes.
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-semibold">General Fitness Tracking</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Monitor score trends over time to guide sustainable habit improvements.
              </p>
            </article>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
