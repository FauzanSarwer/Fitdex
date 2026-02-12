export type Gender = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "athlete";

export interface AIHealthInput {
  gender: Gender;
  age: number;
  heightFt: number;
  heightIn: number;
  weightKg: number;
  activityLevel: ActivityLevel;
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
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

const ACTIVITY_SCORE: Record<ActivityLevel, number> = {
  sedentary: 45,
  light: 65,
  moderate: 78,
  active: 88,
  athlete: 96,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const round = (value: number, precision = 1): number => {
  const base = 10 ** precision;
  return Math.round(value * base) / base;
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
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obesity";
}

export function calculateBMR(input: AIHealthInput): number {
  const heightCm = getHeightCm(input.heightFt, input.heightIn);
  const sexConstant = input.gender === "male" ? 5 : -161;
  return 10 * input.weightKg + 6.25 * heightCm - 5 * input.age + sexConstant;
}

export function getActivityAdjustedCalories(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

function getAgeScore(age: number): number {
  if (age <= 25) return 92;
  if (age <= 35) return 88;
  if (age <= 45) return 82;
  if (age <= 55) return 75;
  if (age <= 65) return 68;
  return 60;
}

function getBMIScore(bmi: number): number {
  const distanceFromTarget = Math.abs(bmi - 22);
  return clamp(100 - distanceFromTarget * 8, 30, 100);
}

interface ScoreBreakdownInput {
  bmi: number;
  age: number;
  activityLevel: ActivityLevel;
}

export function calculateAIHealthScore(input: ScoreBreakdownInput): number {
  const bmiComponent = getBMIScore(input.bmi) * 0.4;
  const ageComponent = getAgeScore(input.age) * 0.15;
  const activityComponent = ACTIVITY_SCORE[input.activityLevel] * 0.2;

  let score = 25 + bmiComponent + ageComponent + activityComponent;

  if (input.bmi >= 35) {
    score -= 20;
  } else if (input.bmi >= 30) {
    score -= 12;
  }

  if (input.bmi < 17) {
    score -= 16;
  } else if (input.bmi < 18.5) {
    score -= 10;
  }

  if (input.activityLevel === "sedentary") {
    score -= 8;
  }

  if (input.activityLevel === "athlete") {
    score += 6;
  }

  return Math.round(clamp(score, 0, 100));
}

function getRiskCategory(score: number): string {
  if (score >= 85) return "Low Risk";
  if (score >= 70) return "Moderate Risk";
  if (score >= 50) return "Elevated Risk";
  return "High Risk";
}

function getBodyCompositionInsights(bmiCategory: string): string {
  if (bmiCategory === "Healthy") {
    return "Your body composition is in a balanced range. Focus on consistency and recovery quality.";
  }
  if (bmiCategory === "Underweight") {
    return "Your body composition suggests low energy reserves. A structured nutrition surplus can improve resilience.";
  }
  if (bmiCategory === "Overweight") {
    return "Your body composition shows elevated mass relative to height. Targeted fat-loss progression is recommended.";
  }
  return "Your body composition indicates high metabolic and cardiovascular risk pressure. Prioritize sustainable reduction strategies.";
}

function getFitnessRecommendation(activityLevel: ActivityLevel): string {
  if (activityLevel === "sedentary") {
    return "Start with low-impact movement 5 days/week and build to 7,000 to 9,000 daily steps.";
  }
  if (activityLevel === "light") {
    return "Progress to 3 focused strength sessions per week with 2 cardio sessions for better conditioning.";
  }
  if (activityLevel === "moderate") {
    return "Maintain your baseline and add periodized strength overload to improve performance outcomes.";
  }
  if (activityLevel === "active") {
    return "Prioritize structured recovery and protein timing to support training quality and prevent fatigue.";
  }
  return "Use deload cycles and mobility work to sustain performance while minimizing overuse risk.";
}

function getCalorieRecommendation(maintenanceCalories: number, bmiCategory: string): string {
  const maintenance = Math.round(maintenanceCalories);
  if (bmiCategory === "Underweight") {
    return `${maintenance + 300} kcal/day target (lean gain phase)`;
  }
  if (bmiCategory === "Overweight" || bmiCategory === "Obesity") {
    return `${Math.max(1200, maintenance - 450)} kcal/day target (fat-loss phase)`;
  }
  return `${maintenance} kcal/day target (maintenance phase)`;
}

function getPersonalizedImprovementPlan(input: {
  bmiCategory: string;
  activityLevel: ActivityLevel;
  age: number;
}): string[] {
  const plan: string[] = [];

  if (input.bmiCategory === "Underweight") {
    plan.push("Increase daily intake by 250-350 kcal with protein-rich meals.");
  } else if (input.bmiCategory === "Healthy") {
    plan.push("Hold current intake and prioritize progressive strength training.");
  } else {
    plan.push("Apply a controlled calorie deficit and track weekly body-weight trend.");
  }

  if (input.activityLevel === "sedentary") {
    plan.push("Schedule a 30-minute walk daily and two beginner resistance sessions weekly.");
  } else if (input.activityLevel === "light") {
    plan.push("Add one extra full-body training day and increase step count by 15%.");
  } else if (input.activityLevel === "athlete") {
    plan.push("Introduce a weekly recovery block with mobility and sleep optimization.");
  } else {
    plan.push("Keep training frequency stable and improve exercise intensity progression.");
  }

  if (input.age >= 45) {
    plan.push("Prioritize joint-friendly exercise selection and protein distribution across meals.");
  } else if (input.age <= 30) {
    plan.push("Leverage higher recovery capacity with progressive overload and routine consistency.");
  } else {
    plan.push("Use performance checkpoints every 4 weeks to keep progression objective.");
  }

  return plan;
}

export function runAIHealthScoreEngine(input: AIHealthInput): AIHealthOutput {
  const bmiRaw = calculateBMI(input.weightKg, input.heightFt, input.heightIn);
  const bmi = round(bmiRaw, 1);
  const bmiCategory = getBMICategory(bmi);
  const bmr = Math.round(calculateBMR(input));
  const maintenanceCalories = Math.round(getActivityAdjustedCalories(bmr, input.activityLevel));
  const aiHealthScore = calculateAIHealthScore({
    bmi,
    age: input.age,
    activityLevel: input.activityLevel,
  });

  return {
    bmi,
    bmiCategory,
    bmr,
    maintenanceCalories,
    calorieRecommendation: getCalorieRecommendation(maintenanceCalories, bmiCategory),
    aiHealthScore,
    riskCategory: getRiskCategory(aiHealthScore),
    bodyCompositionInsights: getBodyCompositionInsights(bmiCategory),
    fitnessRecommendation: getFitnessRecommendation(input.activityLevel),
    personalizedImprovementPlan: getPersonalizedImprovementPlan({
      bmiCategory,
      activityLevel: input.activityLevel,
      age: input.age,
    }),
  };
}
