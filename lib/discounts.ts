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
  const normalizedBasePrice = Number.isFinite(basePrice)
    ? Math.max(0, Math.round(basePrice))
    : 0;
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

  const quarterlyType = quarterlyEligible ? (gym.quarterlyDiscountType ?? "PERCENT") : "NONE";
  const quarterlyValue = quarterlyEligible ? (gym.quarterlyDiscountValue ?? 0) : 0;
  const yearlyType = yearlyEligible ? gym.yearlyDiscountType : "NONE";
  const yearlyValue = yearlyEligible ? gym.yearlyDiscountValue : 0;
  const welcomeType = allowWelcome ? gym.welcomeDiscountType : "NONE";
  const welcomeValue = allowWelcome ? gym.welcomeDiscountValue : 0;

  const quarterlyAmount = quarterlyEligible
    ? applyDiscount(quarterlyType === "NONE" ? "PERCENT" : quarterlyType, quarterlyValue)
    : 0;
  const yearlyAmount = yearlyEligible
    ? applyDiscount(yearlyType === "NONE" ? "PERCENT" : yearlyType, yearlyValue)
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
  const welcomeAmount = allowWelcome
    ? applyDiscount(welcomeType === "NONE" ? "PERCENT" : welcomeType, welcomeValue)
    : 0;

  // Stacking rules:
  // - Welcome cannot stack with any other discount.
  // - Promo can stack with yearly/quarterly only.
  // - Duo can stack with yearly/quarterly only, and cannot stack with promo or welcome.
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

  if (totalDiscountAmount > normalizedBasePrice) totalDiscountAmount = normalizedBasePrice;
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
    promoDiscountType: hasPromo ? promo!.type : "NONE",
    promoDiscountValue: hasPromo ? promo!.value : 0,
    promoAmount,
    totalDiscountAmount,
    finalPrice,
  };
  return { finalPrice, breakdown };
}
