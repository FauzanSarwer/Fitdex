
import { z } from "zod";

export const cancelMembershipSchema = z.object({
  membershipId: z.string().trim().min(1),
});
