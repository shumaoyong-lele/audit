import type { UserRole } from "@prisma/client";

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}
