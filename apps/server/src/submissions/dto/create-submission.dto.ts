import { z } from "zod";

export const createSubmissionSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  source: z.enum(["CLI", "MCP", "DESKTOP"]),
  commitSha: z.string().trim().min(1).max(64).optional(),
  diffText: z.string().max(2_000_000).optional(),
  archiveKey: z.string().trim().min(1).max(1024).optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
