"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACTIVITY_LEVEL_VALUES,
  DEFAULT_AI_HEALTH_INPUT,
  EXPERIENCE_LEVEL_VALUES,
  GOAL_VALUES,
  GENDER_VALUES,
  type ActivityLevel,
  type AIHealthFormField,
  type AIHealthInput,
  type AIHealthOutput,
  type ExperienceLevel,
  type FitnessGoal,
  type Gender,
  parseAIHealthInput,
} from "@/src/lib/ai-health-engine";

const activityOptions: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Lightly Active" },
  { value: "moderate", label: "Moderately Active" },
  { value: "active", label: "Active" },
  { value: "athlete", label: "Athlete" },
];

const goalOptions: { value: FitnessGoal; label: string }[] = [
  { value: "fat_loss", label: "Fat Loss" },
  { value: "recomposition", label: "Recomposition" },
  { value: "maintenance", label: "Maintenance" },
  { value: "muscle_gain", label: "Muscle Gain" },
];

const experienceOptions: { value: ExperienceLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const genderOptions: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
];

const riskTone: Record<string, string> = {
  "Low Risk": "text-emerald-300",
  "Moderate Risk": "text-yellow-300",
  "Elevated Risk": "text-orange-300",
  "High Risk": "text-rose-300",
};

const processingStages = [
  "Validating profile geometry",
  "Resolving body composition markers",
  "Calibrating energy expenditure",
  "Scoring risk and resilience",
  "Building personalized weekly plan",
] as const;

const REQUIRED_NUMBER_FIELDS = ["age", "heightFt", "heightIn", "weightKg", "sleepHours", "stressLevel", "dailySteps"] as const;
type RequiredNumberField = (typeof REQUIRED_NUMBER_FIELDS)[number];

type OptionalNumberField = "restingHeartRate" | "waistCm" | "bodyFatPercent";

type HealthApiSuccess = {
  ok: true;
  generatedAt: string;
  input: AIHealthInput;
  output: AIHealthOutput;
};

type HealthApiError = {
  error?: string;
  issues?: string[];
};

function isGender(value: string): value is Gender {
  return GENDER_VALUES.some((item) => item === value);
}

function isActivityLevel(value: string): value is ActivityLevel {
  return ACTIVITY_LEVEL_VALUES.some((item) => item === value);
}

function isGoal(value: string): value is FitnessGoal {
  return GOAL_VALUES.some((item) => item === value);
}

function isExperienceLevel(value: string): value is ExperienceLevel {
  return EXPERIENCE_LEVEL_VALUES.some((item) => item === value);
}

function isFormField(value: string): value is AIHealthFormField {
  return Object.prototype.hasOwnProperty.call(DEFAULT_AI_HEALTH_INPUT, value);
}

function toFieldErrors(issues: string[]): Partial<Record<AIHealthFormField, string>> {
  const fieldErrors: Partial<Record<AIHealthFormField, string>> = {};

  for (const issue of issues) {
    const [rawField, ...rest] = issue.split(":");
    const field = rawField?.trim();
    if (!field || !isFormField(field)) continue;
    if (fieldErrors[field]) continue;
    const message = rest.join(":").trim();
    fieldErrors[field] = message.length > 0 ? message : "Invalid value.";
  }

  return fieldErrors;
}

function scoreTone(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-cyan-300";
  if (score >= 50) return "text-yellow-300";
  return "text-rose-300";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Strong";
  if (score >= 65) return "Stable";
  if (score >= 50) return "Needs Work";
  return "Recovery Priority";
}

function toPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function AIHealthCalculatorClient(): JSX.Element {
  const [form, setForm] = useState<AIHealthInput>(DEFAULT_AI_HEALTH_INPUT);
  const [result, setResult] = useState<AIHealthOutput | null>(null);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AIHealthFormField, string>>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingLabel, setProcessingLabel] = useState<string>(processingStages[0]);
  const [displayScore, setDisplayScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreAnimationRef = useRef<number | null>(null);
  const stageIndexRef = useRef(0);

  const previewHeightCm = useMemo(() => {
    const totalInches = form.heightFt * 12 + form.heightIn;
    return Math.max(0, totalInches * 2.54);
  }, [form.heightFt, form.heightIn]);

  const previewBmi = useMemo(() => {
    const heightM = previewHeightCm / 100;
    if (!Number.isFinite(heightM) || heightM <= 0) return 0;
    const bmi = form.weightKg / (heightM * heightM);
    return Math.round(bmi * 10) / 10;
  }, [form.weightKg, previewHeightCm]);

  const progressTone =
    progress < 45
      ? "bg-gradient-to-r from-sky-500 to-indigo-500"
      : progress < 85
        ? "bg-gradient-to-r from-indigo-500 to-violet-500"
        : "bg-gradient-to-r from-emerald-400 to-cyan-400";

  const compactPlan = useMemo(() => {
    if (!result) return [];
    return [...result.personalizedImprovementPlan, ...result.weeklyFocus].slice(0, 2);
  }, [result]);

  const clinicalFindings = useMemo(() => {
    if (!result) return [];
    const findings: string[] = [];
    findings.push(`${result.riskCategory} overall risk tier with a health score of ${result.aiHealthScore}.`);
    findings.push(`Calorie target ${result.calorieTargets.primaryTarget} kcal/day with macros ${result.macroTargets.proteinG}g P / ${result.macroTargets.carbsG}g C / ${result.macroTargets.fatsG}g F.`);
    if (result.biometrics.waistToHeightRatio !== undefined) {
      findings.push(`Waist-to-height ratio ${result.biometrics.waistToHeightRatio.toFixed(2)} (${result.biometrics.waistRiskCategory}).`);
    }
    return findings.slice(0, 3);
  }, [result]);

  const clearTimers = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (scoreAnimationRef.current) {
      cancelAnimationFrame(scoreAnimationRef.current);
      scoreAnimationRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!result || !showResult) return;
    const target = result.aiHealthScore;
    const duration = 850;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setDisplayScore(Math.round(target * eased));
      if (ratio < 1) {
        scoreAnimationRef.current = requestAnimationFrame(animate);
      } else {
        scoreAnimationRef.current = null;
      }
    };

    setDisplayScore(0);
    scoreAnimationRef.current = requestAnimationFrame(animate);
  }, [result, showResult]);

  const onRequiredNumberChange =
    (field: RequiredNumberField) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      setForm((prev) => ({ ...prev, [field]: Number.isFinite(parsed) ? parsed : 0 }));
      if (fieldErrors[field]) {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const onOptionalNumberChange =
    (field: OptionalNumberField) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value.trim();
      setForm((prev) => ({
        ...prev,
        [field]: raw.length === 0 ? undefined : Number(raw),
      }));
      if (fieldErrors[field]) {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const parsed = parseAIHealthInput(form);
    if (!parsed.success) {
      setError(parsed.error);
      setFieldErrors(toFieldErrors(parsed.issues));
      return;
    }

    clearTimers();
    setIsProcessing(true);
    setShowResult(false);
    setResult(null);
    setDisplayScore(0);
    setProgress(9);
    setProcessingLabel(processingStages[0]);
    stageIndexRef.current = 0;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        const increment = 4 + Math.random() * 8;
        const next = Math.min(prev + increment, 95);

        const progressPerStage = 95 / processingStages.length;
        const nextStage = Math.min(
          Math.floor(next / progressPerStage),
          processingStages.length - 1
        );

        if (nextStage !== stageIndexRef.current) {
          stageIndexRef.current = nextStage;
          setProcessingLabel(processingStages[nextStage]);
        }

        return next;
      });
    }, 180);

    try {
      const response = await fetch("/api/health/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as HealthApiSuccess | HealthApiError;

      if (!response.ok) {
        const errorPayload = payload as HealthApiError;
        const fallback = "Unable to generate health insights right now.";
        const issues = Array.isArray(errorPayload.issues) ? errorPayload.issues : [];
        setError(errorPayload.error ?? fallback);
        if (issues.length > 0) {
          setFieldErrors(toFieldErrors(issues));
        }
        return;
      }

      if (!("ok" in payload) || payload.ok !== true || !payload.output) {
        setError("Received an unexpected response from the scoring service.");
        return;
      }

      setProgress(100);
      setProcessingLabel("Analysis complete");
      setForm(payload.input);
      setResult(payload.output);
      setShowResult(true);
    } catch {
      setError("Network error while calculating score. Please try again.");
    } finally {
      clearTimers();
      setIsProcessing(false);
    }
  };

  const renderFieldError = (field: AIHealthFormField) => {
    const message = fieldErrors[field];
    if (!message) return null;
    return <p className="text-xs text-rose-300">{message}</p>;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
      <Card className="border border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-xl">Personalized Inputs</CardTitle>
          <CardDescription>
            Add the core profile first, then optional biometrics for higher model confidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={form.gender}
                  onValueChange={(value) => {
                    if (!isGender(value)) return;
                    setForm((prev) => ({ ...prev, gender: value }));
                  }}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError("gender")}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" min={10} max={100} value={form.age} onChange={onRequiredNumberChange("age")} />
                {renderFieldError("age")}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="weightKg">Weight (kg)</Label>
                <Input
                  id="weightKg"
                  type="number"
                  min={20}
                  max={300}
                  step="0.1"
                  value={form.weightKg}
                  onChange={onRequiredNumberChange("weightKg")}
                />
                {renderFieldError("weightKg")}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dailySteps">Daily Steps</Label>
                <Input
                  id="dailySteps"
                  type="number"
                  min={0}
                  max={40000}
                  step="100"
                  value={form.dailySteps}
                  onChange={onRequiredNumberChange("dailySteps")}
                />
                {renderFieldError("dailySteps")}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="heightFt">Height (ft)</Label>
                <Input
                  id="heightFt"
                  type="number"
                  min={3}
                  max={8}
                  value={form.heightFt}
                  onChange={onRequiredNumberChange("heightFt")}
                />
                {renderFieldError("heightFt")}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="heightIn">Height (in)</Label>
                <Input
                  id="heightIn"
                  type="number"
                  min={0}
                  max={11}
                  value={form.heightIn}
                  onChange={onRequiredNumberChange("heightIn")}
                />
                {renderFieldError("heightIn")}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="activityLevel">Activity Level</Label>
                <Select
                  value={form.activityLevel}
                  onValueChange={(value) => {
                    if (!isActivityLevel(value)) return;
                    setForm((prev) => ({ ...prev, activityLevel: value }));
                  }}
                >
                  <SelectTrigger id="activityLevel">
                    <SelectValue placeholder="Select activity level" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError("activityLevel")}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="goal">Goal</Label>
                <Select
                  value={form.goal}
                  onValueChange={(value) => {
                    if (!isGoal(value)) return;
                    setForm((prev) => ({ ...prev, goal: value }));
                  }}
                >
                  <SelectTrigger id="goal">
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {goalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError("goal")}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="experienceLevel">Experience</Label>
                <Select
                  value={form.experienceLevel}
                  onValueChange={(value) => {
                    if (!isExperienceLevel(value)) return;
                    setForm((prev) => ({ ...prev, experienceLevel: value }));
                  }}
                >
                  <SelectTrigger id="experienceLevel">
                    <SelectValue placeholder="Experience" />
                  </SelectTrigger>
                  <SelectContent>
                    {experienceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError("experienceLevel")}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sleepHours">Sleep (hours)</Label>
                <Input
                  id="sleepHours"
                  type="number"
                  min={3}
                  max={12}
                  step="0.1"
                  value={form.sleepHours}
                  onChange={onRequiredNumberChange("sleepHours")}
                />
                {renderFieldError("sleepHours")}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stressLevel">Stress (1-10)</Label>
                <Input
                  id="stressLevel"
                  type="number"
                  min={1}
                  max={10}
                  value={form.stressLevel}
                  onChange={onRequiredNumberChange("stressLevel")}
                />
                {renderFieldError("stressLevel")}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-semibold">Optional Precision Inputs</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                These increase confidence and improve risk calibration.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="restingHeartRate">Resting HR</Label>
                  <Input
                    id="restingHeartRate"
                    type="number"
                    min={35}
                    max={130}
                    placeholder="e.g. 64"
                    value={form.restingHeartRate ?? ""}
                    onChange={onOptionalNumberChange("restingHeartRate")}
                  />
                  {renderFieldError("restingHeartRate")}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="waistCm">Waist (cm)</Label>
                  <Input
                    id="waistCm"
                    type="number"
                    min={40}
                    max={200}
                    placeholder="e.g. 84"
                    value={form.waistCm ?? ""}
                    onChange={onOptionalNumberChange("waistCm")}
                  />
                  {renderFieldError("waistCm")}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="bodyFatPercent">Body Fat (%)</Label>
                  <Input
                    id="bodyFatPercent"
                    type="number"
                    min={3}
                    max={70}
                    step="0.1"
                    placeholder="e.g. 21"
                    value={form.bodyFatPercent ?? ""}
                    onChange={onOptionalNumberChange("bodyFatPercent")}
                  />
                  {renderFieldError("bodyFatPercent")}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] p-4 text-xs text-muted-foreground">
              <p>
                Current profile preview: {previewHeightCm.toFixed(1)} cm height, {form.weightKg.toFixed(1)} kg weight, estimated BMI {previewBmi.toFixed(1)}.
              </p>
            </section>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <Button
              type="submit"
              className="fitdex-glass-button-vivid motion-accent-button motion-accent-button-calc w-full text-white hover:text-white"
              disabled={isProcessing}
            >
              {isProcessing ? "Analyzing..." : "Generate Report"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-xl">Your Health Snapshot</CardTitle>
          <CardDescription>
            Brief personalized summary with visual metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isProcessing ? (
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm text-muted-foreground">{processingLabel}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`${progressTone} h-full w-full transition-[transform,opacity,background] duration-300`}
                  style={{ transform: `translateX(-${100 - progress}%)` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Engine depth calibration</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          ) : !result ? (
            <p className="text-sm text-muted-foreground">
              Submit inputs to generate a concise personalized summary.
            </p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: showResult ? 1 : 0, y: showResult ? 0 : 20 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="space-y-4"
            >
              <section className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Clinical Summary</p>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  <div
                    className="relative h-32 w-32 rounded-full p-2"
                    style={{
                      background: `conic-gradient(${displayScore >= 85 ? "#34d399" : displayScore >= 70 ? "#22d3ee" : displayScore >= 50 ? "#facc15" : "#fb7185"} ${displayScore}%, rgba(255,255,255,0.1) ${displayScore}% 100%)`,
                    }}
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-card/90">
                      <p className={`text-3xl font-bold leading-none ${scoreTone(displayScore)}`}>{displayScore}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Score Tier: {scoreLabel(result.aiHealthScore)}</p>
                    <p className={`text-lg font-semibold ${riskTone[result.riskCategory] ?? "text-muted-foreground"}`}>
                      {result.riskCategory}
                    </p>
                    <p className="text-sm text-muted-foreground">Confidence: {result.confidenceScore}%</p>
                    <p className="text-sm text-muted-foreground">Metabolic age: {result.metabolicAge}</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">BMI</p>
                  <p className="mt-1 text-2xl font-semibold">{result.bmi}</p>
                  <p className="text-xs text-muted-foreground">{result.bmiCategory}</p>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                      style={{ width: `${toPercent(result.bmi, 16, 36)}%` }}
                    />
                  </div>
                </article>
                <article className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Body Fat</p>
                  <p className="mt-1 text-2xl font-semibold">{result.biometrics.bodyFatPercent.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{result.biometrics.bodyFatCategory}</p>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                      style={{ width: `${toPercent(result.biometrics.bodyFatPercent, 8, 38)}%` }}
                    />
                  </div>
                </article>
                <article className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Waist Ratio</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {result.biometrics.waistToHeightRatio !== undefined
                      ? result.biometrics.waistToHeightRatio.toFixed(2)
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{result.biometrics.waistRiskCategory ?? "Not provided"}</p>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400"
                      style={{
                        width:
                          result.biometrics.waistToHeightRatio !== undefined
                            ? `${toPercent(result.biometrics.waistToHeightRatio, 0.38, 0.7)}%`
                            : "0%",
                      }}
                    />
                  </div>
                </article>
                <article className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Energy Target</p>
                  <p className="mt-1 text-2xl font-semibold">{result.calorieTargets.primaryTarget}</p>
                  <p className="text-xs text-muted-foreground">kcal/day</p>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-sky-400"
                      style={{ width: `${toPercent(result.calorieTargets.primaryTarget, 1200, 3200)}%` }}
                    />
                  </div>
                </article>
              </section>

              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="font-semibold">Nutrition Prescription</h3>
                <p className="mt-1 text-sm text-muted-foreground">{result.calorieRecommendation}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Protein</p>
                    <p className="text-lg font-semibold">{result.macroTargets.proteinG}g</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Carbs</p>
                    <p className="text-lg font-semibold">{result.macroTargets.carbsG}g</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Fats</p>
                    <p className="text-lg font-semibold">{result.macroTargets.fatsG}g</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="font-semibold">Assessment & Plan</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {clinicalFindings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">{result.fitnessRecommendation}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {compactPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <p className="text-xs text-muted-foreground">{result.medicalDisclaimer}</p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
