import { z } from "zod";

export const createMembershipSchema = z.object({
  gymId: z.string().trim().min(1),
  planType: z.enum(["DAY_PASS", "MONTHLY", "QUARTERLY", "YEARLY"]),
  discountCode: z.string().trim().optional(),
  inviteCode: z.string().trim().optional(),
});
