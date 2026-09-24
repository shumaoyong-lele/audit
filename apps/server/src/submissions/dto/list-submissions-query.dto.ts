import { z } from "zod";

export const listSubmissionsQuerySchema = z.object({
  projectId: z.uuid().optional(),
  status: z.enum([
    "PENDING",
    "IN_REVIEW",
    "CHANGES_REQUESTED",
    "APPROVED",
    "REJECTED",
  ]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.uuid().optional(),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
