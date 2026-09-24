import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import type { AuthenticatedUser } from "./auth.types.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException("Bearer token required");
    }

    try {
      request.user = await this.jwt.verifyAsync<AuthenticatedUser>(match[1]);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
