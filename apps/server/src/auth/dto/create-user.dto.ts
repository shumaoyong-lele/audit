import { z } from "zod";

export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(12).max(256),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["DEVELOPER", "REVIEWER", "ADMIN"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
