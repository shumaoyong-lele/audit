import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
