export type PlanType = "DAY_PASS" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface DiscountBreakdown {
  basePrice: number;
  planType: PlanType;
  welcomeDiscountType: "PERCENT" | "FLAT" | "NONE";
  welcomeDiscountValue: number;
  welcomeAmount: number;
  quarterlyDiscountType: "PERCENT" | "FLAT" | "NONE";
  quarterlyDiscountValue: number;
  quarterlyAmount: number;
  yearlyDiscountType: "PERCENT" | "FLAT" | "NONE";
  yearlyDiscountValue: number;
  yearlyAmount: number;
  partnerDiscountPercent: number;
  partnerAmount: number;
  promoDiscountType: "PERCENT" | "FLAT" | "NONE";
  promoDiscountValue: number;
  promoAmount: number;
  totalDiscountAmount: number;
  finalPrice: number;
}

export interface GymDiscountConfig {
  monthlyPrice: number;
  quarterlyPrice?: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  quarterlyDiscountType?: "PERCENT" | "FLAT";
  quarterlyDiscountValue?: number;
  yearlyDiscountType: "PERCENT" | "FLAT";
  yearlyDiscountValue: number;
  welcomeDiscountType: "PERCENT" | "FLAT";
  welcomeDiscountValue: number;
}

const DEFAULT_DISCOUNT_TYPE = "NONE";
const DEFAULT_DISCOUNT_VALUE = 0;

function validateDiscountInputs(basePrice: number, planType: PlanType, gym: GymDiscountConfig): boolean {
  return (
    Number.isFinite(basePrice) &&
    basePrice > 0 &&
    ["DAY_PASS", "MONTHLY", "QUARTERLY", "YEARLY"].includes(planType) &&
    gym != null &&
    Number.isFinite(gym.monthlyPrice) &&
    Number.isFinite(gym.yearlyPrice)
  );
}

export function computeDiscount(
  basePrice: number,
  planType: PlanType,
  options: {
    isFirstTimeUser: boolean;
    hasActiveDuo: boolean;
    promo?: { type: "PERCENT" | "FLAT"; value: number } | null;
    gym: GymDiscountConfig;
  }
): { finalPrice: number; breakdown: DiscountBreakdown } {
  const { isFirstTimeUser, hasActiveDuo, promo, gym } = options;

  if (!validateDiscountInputs(basePrice, planType, gym)) {
    throw new Error("Invalid discount computation inputs.");
  }

  const normalizedBasePrice = Math.max(0, Math.round(basePrice));
  const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
  const applyDiscount = (type: "PERCENT" | "FLAT", value: number) => {
    if (type === "PERCENT") {
      return Math.round((normalizedBasePrice * clampPercent(value)) / 100);
    }
    return Math.max(0, Math.round(value));
  };

  const hasPromo = !!promo && promo.value > 0;
  const allowPlanDiscount = planType === "QUARTERLY" || planType === "YEARLY";
  const allowPartnerDiscount = hasActiveDuo && allowPlanDiscount && !hasPromo;
  const allowWelcome = isFirstTimeUser && !hasPromo && !hasActiveDuo;

  const quarterlyEligible = planType === "QUARTERLY" && (gym.quarterlyDiscountValue ?? 0) > 0;
  const yearlyEligible = planType === "YEARLY" && (gym.yearlyDiscountValue ?? 0) > 0;

  const quarterlyType = quarterlyEligible ? gym.quarterlyDiscountType ?? DEFAULT_DISCOUNT_TYPE : DEFAULT_DISCOUNT_TYPE;
  const quarterlyValue = quarterlyEligible ? gym.quarterlyDiscountValue ?? DEFAULT_DISCOUNT_VALUE : DEFAULT_DISCOUNT_VALUE;
  const yearlyType = yearlyEligible ? gym.yearlyDiscountType : DEFAULT_DISCOUNT_TYPE;
  const yearlyValue = yearlyEligible ? gym.yearlyDiscountValue : DEFAULT_DISCOUNT_VALUE;
  const welcomeType = allowWelcome ? gym.welcomeDiscountType : DEFAULT_DISCOUNT_TYPE;
  const welcomeValue = allowWelcome ? gym.welcomeDiscountValue : DEFAULT_DISCOUNT_VALUE;

  const quarterlyAmount = quarterlyEligible
      ? (quarterlyType !== "NONE" ? applyDiscount(quarterlyType as "FLAT" | "PERCENT", quarterlyValue) : 0)
      : 0;
  const yearlyAmount = yearlyEligible
      ? (yearlyType !== "NONE" ? applyDiscount(yearlyType as "FLAT" | "PERCENT", yearlyValue) : 0)
      : 0;
  const planDiscountAmount = allowPlanDiscount
    ? quarterlyEligible
      ? quarterlyAmount
      : yearlyEligible
      ? yearlyAmount
      : 0
    : 0;

  const partnerAmount = allowPartnerDiscount
    ? Math.round((normalizedBasePrice * clampPercent(gym.partnerDiscountPercent)) / 100)
    : 0;
  const promoAmount = hasPromo ? applyDiscount(promo!.type, promo!.value) : 0;
    const welcomeAmount = allowWelcome ? (welcomeType !== "NONE" ? applyDiscount(welcomeType as "FLAT" | "PERCENT", welcomeValue) : 0) : 0;

  let totalDiscountAmount = 0;
  if (welcomeAmount > 0) {
    totalDiscountAmount = welcomeAmount;
  } else if (hasPromo && allowPlanDiscount) {
    totalDiscountAmount = planDiscountAmount + promoAmount;
  } else if (hasPromo) {
    totalDiscountAmount = promoAmount;
  } else if (allowPartnerDiscount && allowPlanDiscount) {
    totalDiscountAmount = planDiscountAmount + partnerAmount;
  } else if (allowPlanDiscount) {
    totalDiscountAmount = planDiscountAmount;
  } else if (allowPartnerDiscount) {
    totalDiscountAmount = partnerAmount;
  }

  totalDiscountAmount = Math.min(totalDiscountAmount, normalizedBasePrice);
  const finalPrice = Math.max(0, normalizedBasePrice - totalDiscountAmount);

  const breakdown: DiscountBreakdown = {
    basePrice: normalizedBasePrice,
    planType,
    welcomeDiscountType: welcomeType,
    welcomeDiscountValue: welcomeValue,
    welcomeAmount,
    quarterlyDiscountType: quarterlyType,
    quarterlyDiscountValue: quarterlyValue,
    quarterlyAmount,
    yearlyDiscountType: yearlyType,
    yearlyDiscountValue: yearlyValue,
    yearlyAmount,
    partnerDiscountPercent: partnerAmount > 0 ? gym.partnerDiscountPercent : 0,
    partnerAmount,
    promoDiscountType: hasPromo ? promo!.type : DEFAULT_DISCOUNT_TYPE,
    promoDiscountValue: hasPromo ? promo!.value : DEFAULT_DISCOUNT_VALUE,
    promoAmount,
    totalDiscountAmount,
    finalPrice,
  };
  return { finalPrice, breakdown };
}
