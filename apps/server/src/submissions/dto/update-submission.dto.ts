import { z } from "zod";

export const updateSubmissionSchema = z.object({
  status: z.enum([
    "IN_REVIEW",
    "CHANGES_REQUESTED",
    "APPROVED",
    "REJECTED",
  ]),
});

export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;
