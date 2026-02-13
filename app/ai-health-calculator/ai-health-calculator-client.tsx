"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type ActivityLevel,
  type AIHealthInput,
  type Gender,
  type AIHealthOutput,
  runAIHealthScoreEngine,
} from "@/src/lib/ai-health-engine";

const activityOptions: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Lightly Active" },
  { value: "moderate", label: "Moderately Active" },
  { value: "active", label: "Active" },
  { value: "athlete", label: "Athlete" },
];

const riskTone: Record<string, string> = {
  "Low Risk": "text-emerald-400",
  "Moderate Risk": "text-yellow-300",
  "Elevated Risk": "text-orange-300",
  "High Risk": "text-rose-300",
};

const initialState: AIHealthInput = {
  gender: "male",
  age: 30,
  heightFt: 5,
  heightIn: 8,
  weightKg: 70,
  activityLevel: "moderate",
};

export function AIHealthCalculatorClient(): JSX.Element {
  const [form, setForm] = useState<AIHealthInput>(initialState);
  const [result, setResult] = useState<AIHealthOutput | null>(null);
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreAnimationRef = useRef<number | null>(null);

  const scoreLabel = useMemo(() => {
    if (!result) {
      return "";
    }
    if (result.aiHealthScore >= 85) return "Excellent";
    if (result.aiHealthScore >= 70) return "Strong";
    if (result.aiHealthScore >= 50) return "Needs Improvement";
    return "Action Required";
  }, [result]);

  const progressTone =
    progress < 45
      ? "bg-gradient-to-r from-sky-500 to-indigo-500"
      : progress < 85
        ? "bg-gradient-to-r from-indigo-500 to-violet-500"
        : "bg-gradient-to-r from-emerald-400 to-cyan-400";

  const scoreTone =
    displayScore >= 85
      ? "text-emerald-300"
      : displayScore >= 70
        ? "text-cyan-300"
        : displayScore >= 50
          ? "text-yellow-300"
          : "text-rose-300";

  const clearTimers = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
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
    const duration = 900;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const progressRatio = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progressRatio, 3);
      setDisplayScore(Math.round(target * eased));
      if (progressRatio < 1) {
        scoreAnimationRef.current = requestAnimationFrame(animate);
      } else {
        scoreAnimationRef.current = null;
      }
    };

    setDisplayScore(0);
    scoreAnimationRef.current = requestAnimationFrame(animate);
  }, [result, showResult]);

  const onNumberChange =
    (field: "age" | "heightFt" | "heightIn" | "weightKg") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      setForm((prev) => ({ ...prev, [field]: Number.isFinite(parsed) ? parsed : 0 }));
    };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (form.age < 10 || form.age > 100) {
      setError("Enter an age between 10 and 100.");
      return;
    }
    if (form.heightFt < 3 || form.heightFt > 8 || form.heightIn < 0 || form.heightIn > 11) {
      setError("Enter a valid height.");
      return;
    }
    if (form.weightKg < 20 || form.weightKg > 300) {
      setError("Enter a weight between 20 kg and 300 kg.");
      return;
    }

    clearTimers();
    setResult(null);
    setShowResult(false);
    setDisplayScore(0);
    setProgress(8);
    setIsProcessing(true);

    const computedResult = runAIHealthScoreEngine(form);
    const milestones = [16, 28, 41, 55, 68, 79, 88, 94, 98];
    let index = 0;

    progressTimerRef.current = setInterval(() => {
      const next = milestones[index] ?? 98;
      setProgress(next);
      index += 1;
      if (index >= milestones.length && progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }, 170);

    completionTimerRef.current = setTimeout(() => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setProgress(100);
      setResult(computedResult);
      setShowResult(true);
      setIsProcessing(false);
    }, 1800);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-xl">Health Score Engine</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(value) => setForm((prev) => ({ ...prev, gender: value as Gender }))}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" min={10} max={100} value={form.age} onChange={onNumberChange("age")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="weightKg">Weight (kg)</Label>
                <Input
                  id="weightKg"
                  type="number"
                  min={20}
                  max={300}
                  step="0.1"
                  value={form.weightKg}
                  onChange={onNumberChange("weightKg")}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="heightFt">Height (ft)</Label>
                <Input
                  id="heightFt"
                  type="number"
                  min={3}
                  max={8}
                  value={form.heightFt}
                  onChange={onNumberChange("heightFt")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="heightIn">Height (in)</Label>
                <Input
                  id="heightIn"
                  type="number"
                  min={0}
                  max={11}
                  value={form.heightIn}
                  onChange={onNumberChange("heightIn")}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="activityLevel">Activity Level</Label>
              <Select
                value={form.activityLevel}
                onValueChange={(value) => setForm((prev) => ({ ...prev, activityLevel: value as ActivityLevel }))}
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
            </div>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <Button type="submit" className="w-full">
              Generate Fitness Insights
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-xl">Your Fitdex Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isProcessing ? (
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm text-muted-foreground">Processing your profile...</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`${progressTone} h-full w-full transition-[transform,opacity,background] duration-300`}
                  style={{ transform: `translateX(-${100 - progress}%)` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Calculating score</span>
                <span>{progress}%</span>
              </div>
            </div>
          ) : !result ? (
            <p className="text-sm text-muted-foreground">
              Submit your profile to view your score, risk profile, and deterministic recommendations.
            </p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: showResult ? 1 : 0, y: showResult ? 0 : 24 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="space-y-5"
            >
              <section className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Health score</p>
                <div className="mt-3 flex items-center gap-6">
                  <div
                    className="relative h-32 w-32 rounded-full p-2 transition-[transform,opacity] duration-500"
                    style={{
                      background: `conic-gradient(
                        ${displayScore >= 85 ? "#34d399" : displayScore >= 70 ? "#22d3ee" : displayScore >= 50 ? "#facc15" : "#fb7185"}
                        ${displayScore}%,
                        rgba(255,255,255,0.1) ${displayScore}% 100%
                      )`,
                    }}
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-card/90">
                      <p className={`text-3xl font-bold leading-none ${scoreTone}`}>{displayScore}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current level</p>
                    <p className="text-2xl font-semibold">{scoreLabel}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="font-semibold">Risk category</h3>
                <p className={riskTone[result.riskCategory] ?? "text-muted-foreground"}>{result.riskCategory}</p>
              </section>

              <section>
                <h3 className="font-semibold">Body composition insights</h3>
                <p className="text-sm text-muted-foreground">
                  BMI {result.bmi} ({result.bmiCategory}). {result.bodyCompositionInsights}
                </p>
              </section>

              <section>
                <h3 className="font-semibold">Calorie recommendation</h3>
                <p className="text-sm text-muted-foreground">
                  BMR: {result.bmr} kcal/day. Maintenance: {result.maintenanceCalories} kcal/day. {result.calorieRecommendation}
                </p>
              </section>

              <section>
                <h3 className="font-semibold">Fitness recommendation</h3>
                <p className="text-sm text-muted-foreground">{result.fitnessRecommendation}</p>
              </section>

              <section>
                <h3 className="font-semibold">Personalized improvement plan</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.personalizedImprovementPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
