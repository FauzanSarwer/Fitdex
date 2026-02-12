import type { Metadata } from "next";
import Link from "next/link";
import { getBaseUrl } from "@/lib/site";
import { AIHealthCalculatorClient } from "./ai-health-calculator-client";

const BASE_URL = getBaseUrl();

export const metadata: Metadata = {
  title: "AI Health Calculator | Fitdex",
  description:
    "Use the Fitdex AI Health Calculator to generate your AI Health Score, calorie needs, and personalized fitness recommendations.",
  alternates: {
    canonical: `${BASE_URL}/ai-health-calculator`,
  },
};

export default function AIHealthCalculatorPage(): JSX.Element {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] p-8">
        <h1 className="text-3xl font-bold sm:text-4xl">Fitdex AI Health Calculator</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
          Generate AI-Powered Fitness Insights through a deterministic scoring model built on BMI, BMR, activity load,
          and age-adjusted health factors.
        </p>
      </section>

      <section aria-labelledby="ai-health-score-engine" className="space-y-4">
        <h2 id="ai-health-score-engine" className="text-2xl font-semibold">
          AI Health Score Engine
        </h2>
        <AIHealthCalculatorClient />
      </section>

      <section aria-labelledby="why-smarter" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 id="why-smarter" className="text-2xl font-semibold">
          Why Fitdex AI Is Smarter
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          The AI Health Score Engine applies a fixed, auditable model with weighted inputs for body composition,
          activity level, and age. Results are reproducible, data-based, and free from non-deterministic behavior.
        </p>
        <p className="text-sm text-muted-foreground sm:text-base">
          This keeps recommendations clear: every output comes from measurable user metrics and explicit scoring rules.
        </p>
      </section>

      <section aria-labelledby="use-cases" className="space-y-4">
        <h2 id="use-cases" className="text-2xl font-semibold">
          Real-World Use Cases
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
              Monitor AI Health Score trends over time to guide sustainable habit improvements.
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 to-white/[0.03] p-8">
        <h2 className="text-2xl font-semibold">Find Gyms Recommended by Fitdex AI</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Pair your score with local gym discovery to execute your plan with the right environment and support.
        </p>
        <Link
          href="/explore"
          className="mt-5 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Explore Gyms
        </Link>
      </section>
    </main>
  );
}
