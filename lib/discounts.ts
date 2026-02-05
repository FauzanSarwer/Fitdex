export type PlanType = "MONTHLY" | "YEARLY";

export interface DiscountBreakdown {
  basePrice: number;
  planType: PlanType;
  welcomeDiscountPercent: number;
  welcomeAmount: number;
  yearlyDiscountPercent: number;
  yearlyAmount: number;
  partnerDiscountPercent: number;
  partnerAmount: number;
  totalDiscountPercent: number;
  totalDiscountAmount: number;
  finalPrice: number;
  capped: boolean;
}

export interface GymDiscountConfig {
  monthlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
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
    gym: GymDiscountConfig;
  }
): { finalPrice: number; breakdown: DiscountBreakdown } {
  const { isFirstTimeUser, hasActiveDuo, gym } = options;
  let welcomePercent = 0;
  let yearlyPercent = 0;
  let partnerPercent = 0;

  if (isFirstTimeUser && gym.welcomeDiscountPercent > 0) {
    welcomePercent = gym.welcomeDiscountPercent;
  }
  if (planType === "YEARLY" && gym.yearlyDiscountPercent > 0) {
    yearlyPercent = gym.yearlyDiscountPercent;
  }
  if (hasActiveDuo && gym.partnerDiscountPercent > 0) {
    partnerPercent = gym.partnerDiscountPercent;
  }

  let totalPercent =
    welcomePercent + yearlyPercent + partnerPercent;
  const cap = gym.maxDiscountCapPercent ?? 40;
  const capped = totalPercent > cap;
  if (capped) totalPercent = cap;

  const totalDiscountAmount = Math.round((basePrice * totalPercent) / 100);
  const finalPrice = basePrice - totalDiscountAmount;

  const welcomeAmount = Math.round((basePrice * welcomePercent) / 100);
  const yearlyAmount = Math.round((basePrice * yearlyPercent) / 100);
  const partnerAmount = Math.round((basePrice * partnerPercent) / 100);

  const breakdown: DiscountBreakdown = {
    basePrice,
    planType,
    welcomeDiscountPercent: welcomePercent,
    welcomeAmount,
    yearlyDiscountPercent: yearlyPercent,
    yearlyAmount,
    partnerDiscountPercent: partnerPercent,
    partnerAmount,
    totalDiscountPercent: totalPercent,
    totalDiscountAmount,
    finalPrice,
    capped,
  };
  return { finalPrice, breakdown };
}
