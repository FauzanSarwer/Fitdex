import { z } from "zod";

export const GENDER_VALUES = ["male", "female", "non_binary"] as const;
export type Gender = (typeof GENDER_VALUES)[number];

export const ACTIVITY_LEVEL_VALUES = ["sedentary", "light", "moderate", "active", "athlete"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVEL_VALUES)[number];

export const GOAL_VALUES = ["fat_loss", "recomposition", "maintenance", "muscle_gain"] as const;
export type FitnessGoal = (typeof GOAL_VALUES)[number];

export const EXPERIENCE_LEVEL_VALUES = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVEL_VALUES)[number];

const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      return value;
    },
    z.coerce.number().min(min).max(max).optional()
  );

export const aiHealthInputSchema = z.object({
  gender: z.enum(GENDER_VALUES),
  age: z.coerce.number().int().min(10).max(100),
  heightFt: z.coerce.number().int().min(3).max(8),
  heightIn: z.coerce.number().int().min(0).max(11),
  weightKg: z.coerce.number().min(20).max(300),
  activityLevel: z.enum(ACTIVITY_LEVEL_VALUES),
  goal: z.enum(GOAL_VALUES).default("maintenance"),
  experienceLevel: z.enum(EXPERIENCE_LEVEL_VALUES).default("beginner"),
  sleepHours: z.coerce.number().min(3).max(12).default(7),
  stressLevel: z.coerce.number().int().min(1).max(10).default(5),
  dailySteps: z.coerce.number().int().min(0).max(40000).default(6500),
  restingHeartRate: optionalNumber(35, 130),
  waistCm: optionalNumber(40, 200),
  bodyFatPercent: optionalNumber(3, 70),
});

export type AIHealthInput = z.infer<typeof aiHealthInputSchema>;
export type AIHealthFormField = keyof AIHealthInput;

export interface AIHealthValidationIssue {
  field: AIHealthFormField | "form";
  message: string;
}

export interface ComponentScores {
  bodyComposition: number;
  cardioFitness: number;
  recoveryReadiness: number;
  metabolicHealth: number;
  lifestyleConsistency: number;
  ageResilience: number;
}

export interface BiometricsSnapshot {
  heightCm: number;
  weightKg: number;
  bmi: number;
  bmiCategory: string;
  healthyWeightMinKg: number;
  healthyWeightMaxKg: number;
  bodyFatPercent: number;
  bodyFatCategory: string;
  leanBodyMassKg: number;
  ffmi: number;
  ffmiCategory: string;
  waistToHeightRatio?: number;
  waistRiskCategory?: string;
}

export interface CalorieTargets {
  fatLossAggressive: number;
  fatLossModerate: number;
  recomposition: number;
  maintenance: number;
  muscleGain: number;
  primaryTarget: number;
  primaryLabel: string;
}

export interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  fiberG: number;
}

export interface AIHealthOutput {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  maintenanceCalories: number;
  calorieRecommendation: string;
  aiHealthScore: number;
  riskCategory: string;
  bodyCompositionInsights: string;
  fitnessRecommendation: string;
  personalizedImprovementPlan: string[];
  confidenceScore: number;
  healthPersona: string;
  metabolicAge: number;
  hydrationLiters: number;
  componentScores: ComponentScores;
  biometrics: BiometricsSnapshot;
  calorieTargets: CalorieTargets;
  macroTargets: MacroTargets;
  weeklyFocus: string[];
  positiveSignals: string[];
  cautionSignals: string[];
  reasoningTrace: string[];
  medicalDisclaimer: string;
}

export const DEFAULT_AI_HEALTH_INPUT: AIHealthInput = {
  gender: "male",
  age: 30,
  heightFt: 5,
  heightIn: 8,
  weightKg: 70,
  activityLevel: "moderate",
  goal: "maintenance",
  experienceLevel: "beginner",
  sleepHours: 7,
  stressLevel: 5,
  dailySteps: 6500,
  restingHeartRate: undefined,
  waistCm: undefined,
  bodyFatPercent: undefined,
};

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

const ACTIVITY_SCORE: Record<ActivityLevel, number> = {
  sedentary: 45,
  light: 62,
  moderate: 78,
  active: 90,
  athlete: 97,
};

const STEP_TARGETS: Record<ActivityLevel, number> = {
  sedentary: 7000,
  light: 8500,
  moderate: 10000,
  active: 11500,
  athlete: 13000,
};

const ACTIVITY_HYDRATION_BONUS: Record<ActivityLevel, number> = {
  sedentary: 0,
  light: 0.15,
  moderate: 0.3,
  active: 0.5,
  athlete: 0.7,
};

const GOAL_LABELS: Record<FitnessGoal, string> = {
  fat_loss: "fat loss",
  recomposition: "body recomposition",
  maintenance: "maintenance",
  muscle_gain: "lean muscle gain",
};

const GOAL_BASE_WEIGHTS: Record<FitnessGoal, ComponentScores> = {
  fat_loss: {
    bodyComposition: 0.3,
    cardioFitness: 0.2,
    recoveryReadiness: 0.15,
    metabolicHealth: 0.23,
    lifestyleConsistency: 0.12,
    ageResilience: 0,
  },
  recomposition: {
    bodyComposition: 0.25,
    cardioFitness: 0.18,
    recoveryReadiness: 0.2,
    metabolicHealth: 0.2,
    lifestyleConsistency: 0.1,
    ageResilience: 0.07,
  },
  maintenance: {
    bodyComposition: 0.22,
    cardioFitness: 0.2,
    recoveryReadiness: 0.2,
    metabolicHealth: 0.19,
    lifestyleConsistency: 0.12,
    ageResilience: 0.07,
  },
  muscle_gain: {
    bodyComposition: 0.18,
    cardioFitness: 0.17,
    recoveryReadiness: 0.25,
    metabolicHealth: 0.18,
    lifestyleConsistency: 0.1,
    ageResilience: 0.12,
  },
};

const GENDER_OPTIONS_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  non_binary: "Non-binary",
};

const GOAL_PROTEIN_FACTORS: Record<FitnessGoal, number> = {
  fat_loss: 2.1,
  recomposition: 2,
  maintenance: 1.8,
  muscle_gain: 2,
};

const GOAL_FAT_FACTORS: Record<FitnessGoal, number> = {
  fat_loss: 0.8,
  recomposition: 0.85,
  maintenance: 0.9,
  muscle_gain: 1,
};

const EXPERIENCE_RECOVERY_LOAD: Record<ExperienceLevel, number> = {
  beginner: 0.85,
  intermediate: 1,
  advanced: 1.1,
};

const GENDER_BMR_CONSTANT: Record<Gender, number> = {
  male: 5,
  female: -161,
  non_binary: -78,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const round = (value: number, precision = 1): number => {
  const base = 10 ** precision;
  return Math.round(value * base) / base;
};

const gaussianScore = (value: number, target: number, tolerance: number): number => {
  const normalized = (value - target) / Math.max(tolerance, 0.0001);
  return clamp(Math.exp((-normalized * normalized) / 2) * 100, 0, 100);
};

const rangeScore = (value: number, minIdeal: number, maxIdeal: number, softness: number): number => {
  if (value >= minIdeal && value <= maxIdeal) return 100;
  const distance = value < minIdeal ? minIdeal - value : value - maxIdeal;
  const linearPenalty = (distance / Math.max(softness, 0.001)) * 24;
  const curvedPenalty = ((distance * distance) / Math.max(softness * softness, 0.001)) * 7;
  return clamp(100 - linearPenalty - curvedPenalty, 0, 100);
};

const weightedAverage = (parts: Array<{ score: number; weight: number }>): number => {
  const safeParts = parts.filter((part) => Number.isFinite(part.score) && part.weight > 0);
  const denominator = safeParts.reduce((acc, part) => acc + part.weight, 0);
  if (denominator <= 0) return 0;
  const numerator = safeParts.reduce((acc, part) => acc + part.score * part.weight, 0);
  return numerator / denominator;
};

function getHeightCm(heightFt: number, heightIn: number): number {
  const totalInches = heightFt * 12 + heightIn;
  return totalInches * 2.54;
}

export function calculateBMI(weightKg: number, heightFt: number, heightIn: number): number {
  const heightM = getHeightCm(heightFt, heightIn) / 100;
  if (heightM <= 0) return 0;
  return weightKg / (heightM * heightM);
}

export function getBMICategory(bmi: number): string {
  if (bmi < 16) return "Severe Underweight";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  if (bmi < 35) return "Obesity Class I";
  if (bmi < 40) return "Obesity Class II";
  return "Obesity Class III";
}

function getBroadBMICategory(bmiCategory: string): "Underweight" | "Healthy" | "Overweight" | "Obesity" {
  if (bmiCategory.includes("Underweight")) return "Underweight";
  if (bmiCategory === "Healthy") return "Healthy";
  if (bmiCategory === "Overweight") return "Overweight";
  return "Obesity";
}

function getAgeAdjustedHealthyBMIRange(age: number): { min: number; max: number; target: number } {
  if (age < 20) return { min: 18.5, max: 24.8, target: 21.5 };
  if (age < 35) return { min: 19, max: 24.9, target: 22 };
  if (age < 50) return { min: 20, max: 26, target: 23 };
  if (age < 65) return { min: 21, max: 27, target: 24 };
  return { min: 22, max: 28, target: 25 };
}

function getBodyFatTargetRange(gender: Gender, age: number): { min: number; max: number; target: number } {
  if (gender === "male") {
    if (age < 40) return { min: 8, max: 20, target: 14 };
    if (age < 60) return { min: 11, max: 23, target: 17 };
    return { min: 13, max: 25, target: 19 };
  }
  if (gender === "female") {
    if (age < 40) return { min: 21, max: 32, target: 26.5 };
    if (age < 60) return { min: 23, max: 34, target: 28.5 };
    return { min: 24, max: 36, target: 30 };
  }
  if (age < 40) return { min: 14, max: 28, target: 21 };
  if (age < 60) return { min: 16, max: 30, target: 23 };
  return { min: 18, max: 32, target: 25 };
}

function getBodyFatCategory(gender: Gender, bodyFatPercent: number): string {
  if (gender === "male") {
    if (bodyFatPercent < 6) return "Essential";
    if (bodyFatPercent < 14) return "Athletic";
    if (bodyFatPercent < 18) return "Fit";
    if (bodyFatPercent < 25) return "Average";
    return "High";
  }

  if (gender === "female") {
    if (bodyFatPercent < 14) return "Essential";
    if (bodyFatPercent < 21) return "Athletic";
    if (bodyFatPercent < 25) return "Fit";
    if (bodyFatPercent < 32) return "Average";
    return "High";
  }

  if (bodyFatPercent < 10) return "Essential";
  if (bodyFatPercent < 18) return "Athletic";
  if (bodyFatPercent < 24) return "Fit";
  if (bodyFatPercent < 30) return "Average";
  return "High";
}

function estimateBodyFatPercent(input: { bmi: number; age: number; gender: Gender }): number {
  const genderScalar = input.gender === "male" ? 1 : input.gender === "female" ? 0 : 0.5;
  const estimate = 1.2 * input.bmi + 0.23 * input.age - 10.8 * genderScalar - 5.4;
  return clamp(estimate, 4, 55);
}

function getFFMICategory(gender: Gender, ffmi: number): string {
  if (gender === "female") {
    if (ffmi < 14.5) return "Low Lean Mass";
    if (ffmi < 17.5) return "Balanced";
    if (ffmi < 20) return "High Lean Mass";
    return "Very High Lean Mass";
  }

  if (gender === "male") {
    if (ffmi < 17) return "Low Lean Mass";
    if (ffmi < 20.5) return "Balanced";
    if (ffmi < 23) return "High Lean Mass";
    return "Very High Lean Mass";
  }

  if (ffmi < 16) return "Low Lean Mass";
  if (ffmi < 19) return "Balanced";
  if (ffmi < 22) return "High Lean Mass";
  return "Very High Lean Mass";
}

function getWaistRiskCategory(waistToHeightRatio: number): string {
  if (waistToHeightRatio < 0.4) return "Low";
  if (waistToHeightRatio < 0.5) return "Healthy";
  if (waistToHeightRatio < 0.6) return "Elevated";
  return "High";
}

function getRestingHeartRateCategory(restingHeartRate: number): string {
  if (restingHeartRate < 50) return "Athlete-grade";
  if (restingHeartRate < 60) return "Excellent";
  if (restingHeartRate < 70) return "Good";
  if (restingHeartRate < 80) return "Fair";
  if (restingHeartRate < 90) return "Elevated";
  return "High";
}

export function calculateBMR(input: AIHealthInput): number {
  const heightCm = getHeightCm(input.heightFt, input.heightIn);
  const sexConstant = GENDER_BMR_CONSTANT[input.gender];
  return 10 * input.weightKg + 6.25 * heightCm - 5 * input.age + sexConstant;
}

export function getActivityAdjustedCalories(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

function getSleepTarget(age: number): number {
  if (age < 18) return 8.5;
  if (age < 65) return 7.5;
  return 7.2;
}

function getSleepScore(age: number, sleepHours: number): number {
  const target = getSleepTarget(age);
  let score = rangeScore(sleepHours, target - 0.7, target + 1.2, 0.5);
  if (sleepHours < 5.5) score -= 15;
  if (sleepHours > 10.5) score -= 10;
  return clamp(score, 0, 100);
}

function getStressScore(stressLevel: number): number {
  const normalized = clamp((stressLevel - 1) / 9, 0, 1);
  const score = 100 - Math.pow(normalized, 1.35) * 92;
  return clamp(score, 4, 100);
}

function getStepsScore(dailySteps: number, activityLevel: ActivityLevel): number {
  const target = STEP_TARGETS[activityLevel];
  const minIdeal = target * 0.82;
  const maxIdeal = target * 1.22;
  let score = rangeScore(dailySteps, minIdeal, maxIdeal, target * 0.12);

  if (dailySteps < 3000) {
    score = Math.min(score, 42);
  }

  if (dailySteps > 19000) {
    score = Math.min(score + 5, 100);
  }

  return clamp(score, 0, 100);
}

function getRestingHeartRateScore(input: {
  restingHeartRate?: number;
  age: number;
  activityLevel: ActivityLevel;
  fallbackAgeResilience: number;
}): number {
  if (input.restingHeartRate === undefined) {
    return clamp(input.fallbackAgeResilience * 0.75 + ACTIVITY_SCORE[input.activityLevel] * 0.25, 0, 100);
  }

  const baselineByActivity: Record<ActivityLevel, number> = {
    sedentary: 72,
    light: 68,
    moderate: 64,
    active: 60,
    athlete: 55,
  };

  const target = baselineByActivity[input.activityLevel] + Math.max(0, input.age - 40) * 0.18;
  return rangeScore(input.restingHeartRate, target - 10, target + 8, 4);
}

function getAgeResilienceScore(input: {
  age: number;
  activityLevel: ActivityLevel;
  sleepScore: number;
  stressScore: number;
}): number {
  const ageBase = clamp(100 - Math.max(0, input.age - 28) * 1.1, 42, 100);
  const activityLift = ACTIVITY_SCORE[input.activityLevel] * 0.22;
  const recoveryLift = (input.sleepScore * 0.6 + input.stressScore * 0.4) * 0.18;
  return clamp(ageBase * 0.6 + activityLift + recoveryLift, 0, 100);
}

function getFFMIScore(ffmi: number, gender: Gender): number {
  const [minIdeal, maxIdeal, softness] =
    gender === "male" ? [18.5, 22.2, 1.5] : gender === "female" ? [15.8, 19, 1.2] : [17.2, 20.2, 1.35];
  return rangeScore(ffmi, minIdeal, maxIdeal, softness);
}

function getMetabolicEfficiencyScore(bmr: number, leanBodyMassKg: number): number {
  const expected = 370 + 21.6 * leanBodyMassKg;
  const ratio = expected <= 0 ? 1 : bmr / expected;
  const gaussian = gaussianScore(ratio, 1, 0.07);
  const bounded = rangeScore(ratio, 0.92, 1.08, 0.05);
  return weightedAverage([
    { score: gaussian, weight: 0.55 },
    { score: bounded, weight: 0.45 },
  ]);
}

function getGoalAwarePrimaryCalorieTarget(input: {
  goal: FitnessGoal;
  maintenanceCalories: number;
  bmi: number;
  experienceLevel: ExperienceLevel;
}): number {
  const offsets: Record<FitnessGoal, number> = {
    fat_loss: -0.18,
    recomposition: input.bmi >= 25 ? -0.09 : -0.03,
    maintenance: 0,
    muscle_gain: input.experienceLevel === "advanced" ? 0.08 : 0.11,
  };

  const raw = input.maintenanceCalories * (1 + offsets[input.goal]);
  const floor = input.goal === "fat_loss" ? 1200 : 1300;
  return Math.round(clamp(raw, floor, 5200));
}

function getMacroTargets(input: {
  goal: FitnessGoal;
  weightKg: number;
  bmi: number;
  leanBodyMassKg: number;
  calorieTarget: number;
}): MacroTargets {
  const proteinFactor = GOAL_PROTEIN_FACTORS[input.goal];
  const fatFactor = GOAL_FAT_FACTORS[input.goal];

  const proteinBasis = input.bmi >= 30 ? input.leanBodyMassKg + 12 : input.weightKg;
  let proteinG = Math.round(proteinBasis * proteinFactor);
  let fatsG = Math.round(input.weightKg * fatFactor);

  let carbsCalories = input.calorieTarget - proteinG * 4 - fatsG * 9;

  if (carbsCalories < 220) {
    const needed = 220 - carbsCalories;
    fatsG = Math.max(40, Math.round(fatsG - needed / 9));
    carbsCalories = input.calorieTarget - proteinG * 4 - fatsG * 9;
  }

  if (carbsCalories < 180) {
    const needed = 180 - carbsCalories;
    proteinG = Math.max(95, Math.round(proteinG - needed / 4));
    carbsCalories = input.calorieTarget - proteinG * 4 - fatsG * 9;
  }

  const carbsG = Math.round(Math.max(45, carbsCalories / 4));
  const fiberG = Math.round(clamp(input.calorieTarget / 40, 20, 45));

  return {
    calories: input.calorieTarget,
    proteinG,
    carbsG,
    fatsG,
    fiberG,
  };
}

function getHydrationLiters(input: {
  weightKg: number;
  activityLevel: ActivityLevel;
  dailySteps: number;
  sleepHours: number;
}): number {
  const baseline = input.weightKg * 0.033;
  const activityBoost = ACTIVITY_HYDRATION_BONUS[input.activityLevel];
  const stepsBoost = Math.max(0, input.dailySteps - 8000) / 4000 * 0.15;
  const recoveryBoost = input.sleepHours < 6 ? 0.18 : 0;
  return round(clamp(baseline + activityBoost + stepsBoost + recoveryBoost, 1.5, 6), 1);
}

function getConfidenceScore(input: AIHealthInput): number {
  let score = 62;
  score += 6;
  if (input.restingHeartRate !== undefined) score += 11;
  if (input.waistCm !== undefined) score += 10;
  if (input.bodyFatPercent !== undefined) score += 10;
  if (input.sleepHours !== DEFAULT_AI_HEALTH_INPUT.sleepHours) score += 4;
  if (input.dailySteps !== DEFAULT_AI_HEALTH_INPUT.dailySteps) score += 4;
  if (input.stressLevel !== DEFAULT_AI_HEALTH_INPUT.stressLevel) score += 3;
  return Math.round(clamp(score, 55, 98));
}

function getRiskCategory(input: {
  score: number;
  bmi: number;
  sleepHours: number;
  stressLevel: number;
  restingHeartRate?: number;
  waistToHeightRatio?: number;
  bodyFatPercent: number;
  bodyFatCategory: string;
}): string {
  let riskPoints = 0;

  if (input.score < 45) riskPoints += 4;
  else if (input.score < 60) riskPoints += 3;
  else if (input.score < 74) riskPoints += 2;
  else if (input.score < 85) riskPoints += 1;

  if (input.bmi >= 35 || input.bmi < 16) riskPoints += 3;
  else if (input.bmi >= 30 || input.bmi < 18.5) riskPoints += 2;

  if (input.sleepHours < 5.5) riskPoints += 2;
  if (input.stressLevel >= 9) riskPoints += 2;

  if (input.restingHeartRate !== undefined) {
    if (input.restingHeartRate >= 95) riskPoints += 2;
    else if (input.restingHeartRate >= 85) riskPoints += 1;
  }

  if (input.waistToHeightRatio !== undefined) {
    if (input.waistToHeightRatio >= 0.62) riskPoints += 2;
    else if (input.waistToHeightRatio >= 0.55) riskPoints += 1;
  }

  if (input.bodyFatCategory === "High" && input.bodyFatPercent >= 34) {
    riskPoints += 2;
  }

  if (riskPoints >= 8) return "High Risk";
  if (riskPoints >= 5) return "Elevated Risk";
  if (riskPoints >= 3) return "Moderate Risk";
  return "Low Risk";
}

function getBodyCompositionInsights(input: {
  bmi: number;
  bmiCategory: string;
  bodyFatPercent: number;
  bodyFatCategory: string;
  ffmi: number;
  ffmiCategory: string;
  healthyWeightMinKg: number;
  healthyWeightMaxKg: number;
}): string {
  const weightBand = `${input.healthyWeightMinKg.toFixed(1)}-${input.healthyWeightMaxKg.toFixed(1)} kg`;
  return `BMI ${input.bmi.toFixed(1)} (${input.bmiCategory}), estimated body fat ${input.bodyFatPercent.toFixed(1)}% (${input.bodyFatCategory}), and FFMI ${input.ffmi.toFixed(1)} (${input.ffmiCategory}). A practical healthy weight band for your height/age is ${weightBand}.`;
}

function getFitnessRecommendation(input: {
  goal: FitnessGoal;
  activityLevel: ActivityLevel;
  experienceLevel: ExperienceLevel;
  weakestAreas: Array<keyof ComponentScores>;
}): string {
  const weakness = new Set(input.weakestAreas);
  const strengthSessions =
    input.goal === "muscle_gain"
      ? input.experienceLevel === "advanced"
        ? 5
        : 4
      : input.goal === "recomposition"
        ? 4
        : 3;

  const cardioSessions =
    input.goal === "fat_loss"
      ? 3
      : input.goal === "maintenance"
        ? 2
        : input.goal === "muscle_gain"
          ? 1
          : 2;

  const details: string[] = [
    `Program ${strengthSessions} strength sessions/week and ${cardioSessions} cardio sessions/week for your ${GOAL_LABELS[input.goal]} target.`,
  ];

  if (weakness.has("recoveryReadiness")) {
    details.push("Recovery is currently limiting output, so prioritize sleep consistency and one low-intensity deload day each week.");
  }

  if (weakness.has("lifestyleConsistency")) {
    details.push("Lock in fixed activity anchors (same walk/training windows daily) before increasing training intensity.");
  }

  if (weakness.has("bodyComposition")) {
    details.push("Keep nutrition adherence high for 3 consecutive weeks before evaluating body-composition changes.");
  }

  if (input.activityLevel === "sedentary") {
    details.push("Start with low-impact movement blocks and ramp gradually to avoid injury spikes.");
  }

  return details.join(" ");
}

function getHealthPersona(input: { score: number; goal: FitnessGoal; recoveryScore: number; lifestyleScore: number }): string {
  if (input.score >= 86 && input.goal === "muscle_gain") return "Performance Builder";
  if (input.score >= 82 && input.goal === "fat_loss") return "High-Compliance Cutter";
  if (input.score >= 76 && input.recoveryScore >= 72) return "Consistent Optimizer";
  if (input.score >= 62 && input.lifestyleScore >= 58) return "Momentum Phase";
  return "Foundation Reset";
}

function getPersonalizedImprovementPlan(input: {
  goal: FitnessGoal;
  calorieTarget: number;
  macroTargets: MacroTargets;
  stepTarget: number;
  hydrationLiters: number;
  sleepTarget: number;
  stressLevel: number;
  weakestAreas: Array<keyof ComponentScores>;
  riskCategory: string;
}): string[] {
  const plan: string[] = [];
  plan.push(
    `Nutrition target: ${input.calorieTarget} kcal/day with ${input.macroTargets.proteinG}g protein, ${input.macroTargets.carbsG}g carbs, and ${input.macroTargets.fatsG}g fats.`
  );
  plan.push(`Movement target: average at least ${input.stepTarget.toLocaleString()} daily steps and keep two short movement breaks in sedentary hours.`);
  plan.push(`Recovery target: hold sleep near ${input.sleepTarget.toFixed(1)} hours/night and hydration near ${input.hydrationLiters.toFixed(1)} L/day.`);

  if (input.weakestAreas.includes("recoveryReadiness")) {
    plan.push("Add a fixed bedtime alarm and a 20-minute pre-sleep wind-down to stabilize recovery quality.");
  }

  if (input.weakestAreas.includes("cardioFitness")) {
    plan.push("Include one progressive cardio benchmark session weekly and increase workload by 5-8% every 2 weeks.");
  }

  if (input.weakestAreas.includes("bodyComposition")) {
    plan.push("Track morning bodyweight 4-5 days/week and adjust calories by +/-120 only after a full 14-day trend review.");
  }

  if (input.goal === "muscle_gain") {
    plan.push("Prioritize progressive overload with rep logging and keep weekly training volume per muscle in the 10-18 set range.");
  }

  if (input.goal === "fat_loss") {
    plan.push("Use high-volume meals (lean protein, fibrous vegetables) to maintain satiety while preserving your calorie deficit.");
  }

  if (input.stressLevel >= 8) {
    plan.push("Run a daily 10-minute downregulation routine (walking, breathwork, or mobility) to lower stress reactivity.");
  }

  if (input.riskCategory === "High Risk") {
    plan.push("Because multiple risk markers are elevated, pair this plan with clinician guidance before aggressive diet or training changes.");
  }

  return plan;
}

function buildPositiveSignals(input: {
  bmi: number;
  bodyFatPercent: number;
  bodyFatTarget: { min: number; max: number };
  stepsScore: number;
  sleepScore: number;
  stressScore: number;
  restingHeartRate?: number;
  restingHeartRateScore: number;
}): string[] {
  const signals: string[] = [];

  if (input.bmi >= 18.5 && input.bmi <= 26) signals.push("BMI is currently in or near a healthy operating zone.");
  if (input.bodyFatPercent >= input.bodyFatTarget.min && input.bodyFatPercent <= input.bodyFatTarget.max) {
    signals.push("Estimated body-fat level is inside your age-adjusted target range.");
  }
  if (input.stepsScore >= 78) signals.push("Daily movement volume supports long-term cardiometabolic health.");
  if (input.sleepScore >= 76) signals.push("Sleep profile is strong enough to support recovery and hormonal balance.");
  if (input.stressScore >= 70) signals.push("Stress load appears manageable, which improves adherence and recovery.");

  if (input.restingHeartRate !== undefined && input.restingHeartRateScore >= 75) {
    signals.push(`Resting heart rate is in a favorable zone (${input.restingHeartRate} bpm).`);
  }

  return signals;
}

function buildCautionSignals(input: {
  bmi: number;
  waistToHeightRatio?: number;
  bodyFatPercent: number;
  bodyFatCategory: string;
  sleepHours: number;
  stressLevel: number;
  dailySteps: number;
  restingHeartRate?: number;
}): string[] {
  const cautions: string[] = [];

  if (input.bmi >= 30) cautions.push("BMI is in an obesity range, increasing long-term cardiometabolic pressure.");
  if (input.bmi < 18.5) cautions.push("BMI is below the healthy range, suggesting low energy reserve and recovery risk.");

  if (input.waistToHeightRatio !== undefined) {
    if (input.waistToHeightRatio >= 0.6) cautions.push("Waist-to-height ratio is high, indicating elevated central adiposity risk.");
    else if (input.waistToHeightRatio >= 0.5) cautions.push("Waist-to-height ratio is above ideal and should be monitored.");
  }

  if (input.bodyFatCategory === "High") cautions.push("Estimated body-fat level is above the preferred range for your profile.");
  if (input.sleepHours < 6) cautions.push("Short sleep duration is likely suppressing recovery and performance.");
  if (input.stressLevel >= 8) cautions.push("Self-reported stress is high and can blunt progress if unmanaged.");
  if (input.dailySteps < 5000) cautions.push("Low daily movement volume is limiting cardiovascular and metabolic momentum.");

  if (input.restingHeartRate !== undefined && input.restingHeartRate >= 85) {
    cautions.push("Resting heart rate is elevated, suggesting cardiovascular conditioning can improve.");
  }

  return cautions;
}

function getCalorieRecommendation(input: {
  broadBmiCategory: "Underweight" | "Healthy" | "Overweight" | "Obesity";
  goal: FitnessGoal;
  primaryTarget: number;
  maintenanceCalories: number;
}): string {
  const maintenance = Math.round(input.maintenanceCalories);
  const target = Math.round(input.primaryTarget);

  if (input.goal === "fat_loss") {
    return `${target} kcal/day target for controlled fat-loss (maintenance ${maintenance} kcal).`;
  }
  if (input.goal === "muscle_gain") {
    return `${target} kcal/day target for lean gain with adequate recovery intake.`;
  }
  if (input.goal === "recomposition") {
    return `${target} kcal/day target for recomposition with high-protein intake.`;
  }

  if (input.broadBmiCategory === "Underweight") {
    return `${Math.max(target, maintenance + 250)} kcal/day target to restore energy reserves.`;
  }

  if (input.broadBmiCategory === "Obesity") {
    return `${Math.min(target, maintenance - 350)} kcal/day target with gradual sustainable deficit.`;
  }

  return `${target} kcal/day target to maintain and improve body composition quality.`;
}

interface ScoreBreakdownInput {
  bmi: number;
  age: number;
  activityLevel: ActivityLevel;
  sleepHours?: number;
  stressLevel?: number;
  dailySteps?: number;
  restingHeartRate?: number;
  bodyFatPercent?: number;
}

export function calculateAIHealthScore(input: ScoreBreakdownInput): number {
  const bmiTarget = getAgeAdjustedHealthyBMIRange(input.age);
  const bmiScore = rangeScore(input.bmi, bmiTarget.min, bmiTarget.max, 1.2);
  const sleepScore = getSleepScore(input.age, input.sleepHours ?? 7);
  const stressScore = getStressScore(input.stressLevel ?? 5);
  const stepScore = getStepsScore(input.dailySteps ?? 6500, input.activityLevel);

  const ageResilience = getAgeResilienceScore({
    age: input.age,
    activityLevel: input.activityLevel,
    sleepScore,
    stressScore,
  });

  const restingScore = getRestingHeartRateScore({
    restingHeartRate: input.restingHeartRate,
    age: input.age,
    activityLevel: input.activityLevel,
    fallbackAgeResilience: ageResilience,
  });

  const bodyFatEstimate = input.bodyFatPercent ?? estimateBodyFatPercent({
    bmi: input.bmi,
    age: input.age,
    gender: "non_binary",
  });

  const bodyFatRange = getBodyFatTargetRange("non_binary", input.age);
  const bodyFatScore = rangeScore(bodyFatEstimate, bodyFatRange.min, bodyFatRange.max, 3.3);

  const base = weightedAverage([
    { score: bmiScore, weight: 0.25 },
    { score: bodyFatScore, weight: 0.2 },
    { score: ACTIVITY_SCORE[input.activityLevel], weight: 0.15 },
    { score: stepScore, weight: 0.13 },
    { score: restingScore, weight: 0.12 },
    { score: sleepScore, weight: 0.08 },
    { score: stressScore, weight: 0.07 },
  ]);

  const penalties =
    (input.bmi >= 35 ? 10 : 0) +
    (input.bmi < 16 ? 10 : 0) +
    ((input.sleepHours ?? 7) < 5.5 ? 6 : 0) +
    ((input.stressLevel ?? 5) >= 9 ? 5 : 0);

  return Math.round(clamp(base - penalties, 0, 100));
}

export function validateAIHealthInput(input: AIHealthInput): AIHealthValidationIssue[] {
  const issues: AIHealthValidationIssue[] = [];

  const totalInches = input.heightFt * 12 + input.heightIn;
  if (totalInches < 48 || totalInches > 96) {
    issues.push({ field: "heightFt", message: "Height is outside realistic bounds." });
  }

  const bmi = calculateBMI(input.weightKg, input.heightFt, input.heightIn);
  if (!Number.isFinite(bmi) || bmi < 11 || bmi > 70) {
    issues.push({ field: "weightKg", message: "Weight and height combination is outside a realistic range." });
  }

  if (input.goal === "muscle_gain" && input.activityLevel === "sedentary") {
    issues.push({ field: "activityLevel", message: "Select at least light activity when choosing a muscle-gain goal." });
  }

  if (input.sleepHours < 4.5 && input.activityLevel === "athlete") {
    issues.push({ field: "sleepHours", message: "Athlete activity needs a more realistic sleep baseline." });
  }

  if (input.restingHeartRate !== undefined && input.restingHeartRate < 40 && input.activityLevel !== "athlete") {
    issues.push({ field: "restingHeartRate", message: "Resting heart rate seems unusually low for the selected activity level." });
  }

  if (input.bodyFatPercent !== undefined) {
    const minReasonable = input.gender === "female" ? 8 : 4;
    if (input.bodyFatPercent < minReasonable) {
      issues.push({ field: "bodyFatPercent", message: `Body fat appears too low for ${GENDER_OPTIONS_LABELS[input.gender].toLowerCase()} physiology.` });
    }
  }

  return issues;
}

export function parseAIHealthInput(
  rawInput: unknown
): { success: true; data: AIHealthInput } | { success: false; error: string; issues: string[] } {
  const parsed = aiHealthInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join(".") : "form";
      return `${field}: ${issue.message}`;
    });
    return {
      success: false,
      error: "Input validation failed",
      issues,
    };
  }

  const customIssues = validateAIHealthInput(parsed.data);
  if (customIssues.length > 0) {
    return {
      success: false,
      error: "Input validation failed",
      issues: customIssues.map((issue) => `${issue.field}: ${issue.message}`),
    };
  }

  return { success: true, data: parsed.data };
}

function getWeakestAreas(componentScores: ComponentScores): Array<keyof ComponentScores> {
  const ordered = (Object.entries(componentScores) as Array<[keyof ComponentScores, number]>).sort((a, b) => a[1] - b[1]);
  return ordered.slice(0, 2).map(([key]) => key);
}

function getMetabolicAge(input: {
  age: number;
  score: number;
  bodyFatPercent: number;
  bodyFatTarget: { min: number; max: number; target: number };
  restingHeartRate?: number;
  sleepHours: number;
}): number {
  let delta = 0;
  delta += (70 - input.score) * 0.07;
  delta += (input.bodyFatPercent - input.bodyFatTarget.target) * 0.22;

  if (input.restingHeartRate !== undefined) {
    delta += (input.restingHeartRate - 65) * 0.08;
  }

  if (input.sleepHours < 7) {
    delta += (7 - input.sleepHours) * 0.6;
  }

  return Math.round(clamp(input.age + delta, 12, 100));
}

export function runAIHealthScoreEngine(input: AIHealthInput): AIHealthOutput {
  const heightCm = getHeightCm(input.heightFt, input.heightIn);
  const heightM = heightCm / 100;

  const bmiRaw = calculateBMI(input.weightKg, input.heightFt, input.heightIn);
  const bmi = round(bmiRaw, 1);
  const bmiCategory = getBMICategory(bmi);
  const broadBmiCategory = getBroadBMICategory(bmiCategory);

  const bmiRange = getAgeAdjustedHealthyBMIRange(input.age);
  const healthyWeightMinKg = round(bmiRange.min * (heightM * heightM), 1);
  const healthyWeightMaxKg = round(bmiRange.max * (heightM * heightM), 1);

  const bodyFatEstimated = estimateBodyFatPercent({ bmi, age: input.age, gender: input.gender });
  const bodyFatPercent = round(input.bodyFatPercent ?? bodyFatEstimated, 1);
  const bodyFatTarget = getBodyFatTargetRange(input.gender, input.age);
  const bodyFatCategory = getBodyFatCategory(input.gender, bodyFatPercent);

  const leanBodyMassKg = round(input.weightKg * (1 - bodyFatPercent / 100), 1);
  const ffmi = round(leanBodyMassKg / (heightM * heightM), 1);
  const ffmiCategory = getFFMICategory(input.gender, ffmi);

  const waistToHeightRatio = input.waistCm !== undefined ? round(input.waistCm / heightCm, 3) : undefined;
  const waistRiskCategory = waistToHeightRatio !== undefined ? getWaistRiskCategory(waistToHeightRatio) : undefined;

  const bmr = Math.round(calculateBMR(input));
  const baseMaintenanceCalories = getActivityAdjustedCalories(bmr, input.activityLevel);
  const caloriePerStep = 0.04 * clamp(input.weightKg / 70, 0.75, 1.45);
  const stepAdjustment = (input.dailySteps - 6500) * caloriePerStep;
  const maintenanceCalories = Math.round(clamp(baseMaintenanceCalories + stepAdjustment, 1100, 5200));

  const sleepScore = getSleepScore(input.age, input.sleepHours);
  const stressScore = getStressScore(input.stressLevel);
  const stepsScore = getStepsScore(input.dailySteps, input.activityLevel);

  const ageResilienceScore = getAgeResilienceScore({
    age: input.age,
    activityLevel: input.activityLevel,
    sleepScore,
    stressScore,
  });

  const restingHeartRateScore = getRestingHeartRateScore({
    restingHeartRate: input.restingHeartRate,
    age: input.age,
    activityLevel: input.activityLevel,
    fallbackAgeResilience: ageResilienceScore,
  });
  const restingHeartRateCategory =
    input.restingHeartRate !== undefined ? getRestingHeartRateCategory(input.restingHeartRate) : undefined;

  const bmiScore = rangeScore(bmi, bmiRange.min, bmiRange.max, 1.3);
  const bodyFatScore = rangeScore(bodyFatPercent, bodyFatTarget.min, bodyFatTarget.max, 3.2);
  const ffmiScore = getFFMIScore(ffmi, input.gender);
  const waistScore =
    waistToHeightRatio !== undefined
      ? rangeScore(waistToHeightRatio, 0.4, 0.51, 0.03)
      : weightedAverage([
          { score: bmiScore, weight: 0.6 },
          { score: bodyFatScore, weight: 0.4 },
        ]);

  const bodyCompositionScore = weightedAverage([
    { score: bmiScore, weight: 0.32 },
    { score: bodyFatScore, weight: 0.33 },
    { score: waistScore, weight: 0.2 },
    { score: ffmiScore, weight: 0.15 },
  ]);

  const cardioFitnessScore = weightedAverage([
    { score: ACTIVITY_SCORE[input.activityLevel], weight: 0.34 },
    { score: stepsScore, weight: 0.32 },
    { score: restingHeartRateScore, weight: 0.34 },
  ]);

  const recoveryDemand = ACTIVITY_SCORE[input.activityLevel] * EXPERIENCE_RECOVERY_LOAD[input.experienceLevel];
  const recoveryBuffer = weightedAverage([
    { score: sleepScore, weight: 0.6 },
    { score: stressScore, weight: 0.4 },
  ]);
  const recoveryPenalty = Math.max(0, recoveryDemand - recoveryBuffer) * 0.17;
  const recoveryReadinessScore = clamp(recoveryBuffer - recoveryPenalty, 0, 100);

  const metabolicEfficiencyScore = getMetabolicEfficiencyScore(bmr, leanBodyMassKg);
  const metabolicHealthScore = weightedAverage([
    { score: bmiScore, weight: 0.2 },
    { score: bodyFatScore, weight: 0.26 },
    { score: waistScore, weight: 0.2 },
    { score: metabolicEfficiencyScore, weight: 0.22 },
    { score: restingHeartRateScore, weight: 0.12 },
  ]);

  const lifestyleConsistencyScore = weightedAverage([
    { score: stepsScore, weight: 0.35 },
    { score: sleepScore, weight: 0.3 },
    { score: stressScore, weight: 0.2 },
    { score: ACTIVITY_SCORE[input.activityLevel], weight: 0.15 },
  ]);

  const componentScores: ComponentScores = {
    bodyComposition: Math.round(bodyCompositionScore),
    cardioFitness: Math.round(cardioFitnessScore),
    recoveryReadiness: Math.round(recoveryReadinessScore),
    metabolicHealth: Math.round(metabolicHealthScore),
    lifestyleConsistency: Math.round(lifestyleConsistencyScore),
    ageResilience: Math.round(ageResilienceScore),
  };

  const weights = GOAL_BASE_WEIGHTS[input.goal];
  const baseScore = weightedAverage([
    { score: componentScores.bodyComposition, weight: weights.bodyComposition },
    { score: componentScores.cardioFitness, weight: weights.cardioFitness },
    { score: componentScores.recoveryReadiness, weight: weights.recoveryReadiness },
    { score: componentScores.metabolicHealth, weight: weights.metabolicHealth },
    { score: componentScores.lifestyleConsistency, weight: weights.lifestyleConsistency },
    { score: componentScores.ageResilience, weight: weights.ageResilience },
  ]);

  const penalties =
    (bmi >= 38 ? 14 : 0) +
    (bmi >= 34 && bmi < 38 ? 8 : 0) +
    (bmi < 16 ? 12 : 0) +
    (input.sleepHours < 5.5 ? 8 : 0) +
    (input.stressLevel >= 9 ? 6 : 0) +
    (input.dailySteps < 3500 ? 5 : 0) +
    (input.restingHeartRate !== undefined && input.restingHeartRate >= 95 ? 6 : 0);

  const bonuses =
    (input.sleepHours >= 7 && input.sleepHours <= 9 ? 2 : 0) +
    (input.dailySteps >= STEP_TARGETS[input.activityLevel] ? 2 : 0) +
    (input.restingHeartRate !== undefined && input.restingHeartRate < 60 ? 2 : 0) +
    (bmi >= bmiRange.min && bmi <= bmiRange.max ? 2 : 0);

  const aiHealthScore = Math.round(clamp(baseScore - penalties + bonuses, 0, 100));

  const primaryCalorieTarget = getGoalAwarePrimaryCalorieTarget({
    goal: input.goal,
    maintenanceCalories,
    bmi,
    experienceLevel: input.experienceLevel,
  });

  const calorieTargets: CalorieTargets = {
    fatLossAggressive: Math.round(clamp(maintenanceCalories * 0.76, 1200, 4800)),
    fatLossModerate: Math.round(clamp(maintenanceCalories * 0.86, 1200, 4900)),
    recomposition: Math.round(clamp(maintenanceCalories * (bmi >= 25 ? 0.91 : 0.97), 1250, 5000)),
    maintenance: maintenanceCalories,
    muscleGain: Math.round(clamp(maintenanceCalories * 1.1, 1350, 5200)),
    primaryTarget: primaryCalorieTarget,
    primaryLabel: GOAL_LABELS[input.goal],
  };

  const macroTargets = getMacroTargets({
    goal: input.goal,
    weightKg: input.weightKg,
    bmi,
    leanBodyMassKg,
    calorieTarget: primaryCalorieTarget,
  });

  const hydrationLiters = getHydrationLiters({
    weightKg: input.weightKg,
    activityLevel: input.activityLevel,
    dailySteps: input.dailySteps,
    sleepHours: input.sleepHours,
  });

  const riskCategory = getRiskCategory({
    score: aiHealthScore,
    bmi,
    sleepHours: input.sleepHours,
    stressLevel: input.stressLevel,
    restingHeartRate: input.restingHeartRate,
    waistToHeightRatio,
    bodyFatPercent,
    bodyFatCategory,
  });

  const weakestAreas = getWeakestAreas(componentScores);

  const fitnessRecommendation = getFitnessRecommendation({
    goal: input.goal,
    activityLevel: input.activityLevel,
    experienceLevel: input.experienceLevel,
    weakestAreas,
  });

  const calorieRecommendation = getCalorieRecommendation({
    broadBmiCategory,
    goal: input.goal,
    primaryTarget: primaryCalorieTarget,
    maintenanceCalories,
  });

  const confidenceScore = getConfidenceScore(input);

  const healthPersona = getHealthPersona({
    score: aiHealthScore,
    goal: input.goal,
    recoveryScore: componentScores.recoveryReadiness,
    lifestyleScore: componentScores.lifestyleConsistency,
  });

  const metabolicAge = getMetabolicAge({
    age: input.age,
    score: aiHealthScore,
    bodyFatPercent,
    bodyFatTarget,
    restingHeartRate: input.restingHeartRate,
    sleepHours: input.sleepHours,
  });

  const sleepTarget = getSleepTarget(input.age);
  const stepTarget = STEP_TARGETS[input.activityLevel];

  const personalizedImprovementPlan = getPersonalizedImprovementPlan({
    goal: input.goal,
    calorieTarget: primaryCalorieTarget,
    macroTargets,
    stepTarget,
    hydrationLiters,
    sleepTarget,
    stressLevel: input.stressLevel,
    weakestAreas,
    riskCategory,
  });

  const positiveSignals = buildPositiveSignals({
    bmi,
    bodyFatPercent,
    bodyFatTarget,
    stepsScore,
    sleepScore,
    stressScore,
    restingHeartRate: input.restingHeartRate,
    restingHeartRateScore,
  });

  const cautionSignals = buildCautionSignals({
    bmi,
    waistToHeightRatio,
    bodyFatPercent,
    bodyFatCategory,
    sleepHours: input.sleepHours,
    stressLevel: input.stressLevel,
    dailySteps: input.dailySteps,
    restingHeartRate: input.restingHeartRate,
  });

  const reasoningTrace = [
    `Body composition scored ${componentScores.bodyComposition}/100 using BMI ${bmi} and body-fat estimate ${bodyFatPercent.toFixed(1)}%.`,
    `Cardio fitness scored ${componentScores.cardioFitness}/100 from activity level ${input.activityLevel}, ${input.dailySteps.toLocaleString()} steps/day${
      input.restingHeartRate !== undefined
        ? `, and resting HR ${input.restingHeartRate} bpm (${restingHeartRateCategory ?? "calibrated"})`
        : ""
    }.`,
    `Recovery readiness scored ${componentScores.recoveryReadiness}/100 from sleep (${input.sleepHours.toFixed(1)} h) and stress (${input.stressLevel}/10).`,
    `Metabolic health scored ${componentScores.metabolicHealth}/100 with maintenance estimate ${maintenanceCalories} kcal/day and BMR ${bmr} kcal/day.`,
    `Lifestyle consistency scored ${componentScores.lifestyleConsistency}/100 with daily routine regularity and movement volume.`,
    `Goal weighting prioritized ${GOAL_LABELS[input.goal]}, yielding final score ${aiHealthScore}/100 (confidence ${confidenceScore}%).`,
  ];

  const bodyCompositionInsights = getBodyCompositionInsights({
    bmi,
    bmiCategory,
    bodyFatPercent,
    bodyFatCategory,
    ffmi,
    ffmiCategory,
    healthyWeightMinKg,
    healthyWeightMaxKg,
  });

  const weeklyFocus = [
    `Hit ${Math.round(macroTargets.proteinG / 4) * 4}g protein on at least 6 days this week to stabilize recovery signal.`,
    `Average ${stepTarget.toLocaleString()}+ steps/day and keep one longer activity session on the weekend.`,
    `Hold a consistent sleep window targeting ${sleepTarget.toFixed(1)} hours/night.`,
    `Re-check scale trend after 14 days and only adjust calories by 100-150 kcal if trend is off-target.`,
  ];

  const medicalDisclaimer =
    "This score is a training/nutrition guidance model and not a medical diagnosis. If you have symptoms, chronic conditions, or medication changes, consult a licensed clinician.";

  return {
    bmi,
    bmiCategory,
    bmr,
    maintenanceCalories,
    calorieRecommendation,
    aiHealthScore,
    riskCategory,
    bodyCompositionInsights,
    fitnessRecommendation,
    personalizedImprovementPlan,
    confidenceScore,
    healthPersona,
    metabolicAge,
    hydrationLiters,
    componentScores,
    biometrics: {
      heightCm: round(heightCm, 1),
      weightKg: round(input.weightKg, 1),
      bmi,
      bmiCategory,
      healthyWeightMinKg,
      healthyWeightMaxKg,
      bodyFatPercent,
      bodyFatCategory,
      leanBodyMassKg,
      ffmi,
      ffmiCategory,
      waistToHeightRatio,
      waistRiskCategory,
    },
    calorieTargets,
    macroTargets,
    weeklyFocus,
    positiveSignals,
    cautionSignals,
    reasoningTrace,
    medicalDisclaimer,
  };
}
