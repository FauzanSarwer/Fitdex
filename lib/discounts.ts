export type PlanType = "DAY_PASS" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface DiscountBreakdown {
  basePrice: number;
  planType: PlanType;
  welcomeDiscountPercent: number;
  welcomeAmount: number;
  quarterlyDiscountPercent: number;
  quarterlyAmount: number;
  yearlyDiscountPercent: number;
  yearlyAmount: number;
  partnerDiscountPercent: number;
  partnerAmount: number;
  promoDiscountPercent: number;
  promoAmount: number;
  totalDiscountPercent: number;
  totalDiscountAmount: number;
  finalPrice: number;
  capped: boolean;
}

export interface GymDiscountConfig {
  monthlyPrice: number;
  quarterlyPrice?: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  quarterlyDiscountPercent?: number;
  yearlyDiscountPercent: number;
  welcomeDiscountPercent: number;
  maxDiscountCapPercent: number;
}

export function computeDiscount(
  basePrice: number,
  planType: PlanType,
  options: {
    isFirstTimeUser: boolean;
    hasActiveDuo: boolean;
    promoPercent?: number;
    gym: GymDiscountConfig;
  }
): { finalPrice: number; breakdown: DiscountBreakdown } {
  const { isFirstTimeUser, hasActiveDuo, promoPercent = 0, gym } = options;
  const normalizedBasePrice = Number.isFinite(basePrice)
    ? Math.max(0, Math.round(basePrice))
    : 0;
  const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
  let welcomePercent = 0;
  let quarterlyPercent = 0;
  let yearlyPercent = 0;
  let partnerPercent = 0;

  if (isFirstTimeUser && gym.welcomeDiscountPercent > 0) {
    welcomePercent = clampPercent(gym.welcomeDiscountPercent);
  }
  if (planType === "QUARTERLY" && (gym.quarterlyDiscountPercent ?? 0) > 0) {
    quarterlyPercent = clampPercent(gym.quarterlyDiscountPercent ?? 0);
  }
  if (planType === "YEARLY" && gym.yearlyDiscountPercent > 0) {
    yearlyPercent = clampPercent(gym.yearlyDiscountPercent);
  }
  if (hasActiveDuo && gym.partnerDiscountPercent > 0) {
    partnerPercent = clampPercent(gym.partnerDiscountPercent);
  }

  let totalPercent =
    welcomePercent + quarterlyPercent + yearlyPercent + partnerPercent + clampPercent(promoPercent);
  const cap = clampPercent(gym.maxDiscountCapPercent ?? 40);
  const capped = totalPercent > cap;
  if (capped) totalPercent = cap;

  const totalDiscountAmount = Math.round((normalizedBasePrice * totalPercent) / 100);
  const finalPrice = Math.max(0, normalizedBasePrice - totalDiscountAmount);

  const welcomeAmount = Math.round((normalizedBasePrice * welcomePercent) / 100);
  const quarterlyAmount = Math.round((normalizedBasePrice * quarterlyPercent) / 100);
  const yearlyAmount = Math.round((normalizedBasePrice * yearlyPercent) / 100);
  const partnerAmount = Math.round((normalizedBasePrice * partnerPercent) / 100);
  const promoAmount = Math.round((normalizedBasePrice * clampPercent(promoPercent)) / 100);

  const breakdown: DiscountBreakdown = {
    basePrice: normalizedBasePrice,
    planType,
    welcomeDiscountPercent: welcomePercent,
    welcomeAmount,
    quarterlyDiscountPercent: quarterlyPercent,
    quarterlyAmount,
    yearlyDiscountPercent: yearlyPercent,
    yearlyAmount,
    partnerDiscountPercent: partnerPercent,
    partnerAmount,
    promoDiscountPercent: promoPercent,
    promoAmount,
    totalDiscountPercent: totalPercent,
    totalDiscountAmount,
    finalPrice,
    capped,
  };
  return { finalPrice, breakdown };
}
