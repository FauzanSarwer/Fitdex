"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
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

  const scoreLabel = useMemo(() => {
    if (!result) return "";
    if (result.aiHealthScore >= 85) return "Excellent";
    if (result.aiHealthScore >= 70) return "Strong";
    if (result.aiHealthScore >= 50) return "Needs Improvement";
    return "Action Required";
  }, [result]);

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

    setResult(runAIHealthScoreEngine(form));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-xl">AI Health Score Engine</CardTitle>
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
              Generate AI-Powered Fitness Insights
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-xl">Fitdex AI Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result ? (
            <p className="text-sm text-muted-foreground">
              Submit your profile to view your score, risk profile, and deterministic recommendations.
            </p>
          ) : (
            <>
              <section>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Health Score</p>
                <p className="text-5xl font-bold leading-none">{result.aiHealthScore}</p>
                <p className="text-sm text-muted-foreground">{scoreLabel}</p>
              </section>

              <section>
                <h3 className="font-semibold">AI Health Risk Category</h3>
                <p className={riskTone[result.riskCategory] ?? "text-muted-foreground"}>{result.riskCategory}</p>
              </section>

              <section>
                <h3 className="font-semibold">AI Body Composition Insights</h3>
                <p className="text-sm text-muted-foreground">
                  BMI {result.bmi} ({result.bmiCategory}). {result.bodyCompositionInsights}
                </p>
              </section>

              <section>
                <h3 className="font-semibold">AI Calorie Recommendation</h3>
                <p className="text-sm text-muted-foreground">
                  BMR: {result.bmr} kcal/day. Maintenance: {result.maintenanceCalories} kcal/day. {result.calorieRecommendation}
                </p>
              </section>

              <section>
                <h3 className="font-semibold">AI Fitness Recommendation</h3>
                <p className="text-sm text-muted-foreground">{result.fitnessRecommendation}</p>
              </section>

              <section>
                <h3 className="font-semibold">AI Personalized Improvement Plan</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.personalizedImprovementPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
