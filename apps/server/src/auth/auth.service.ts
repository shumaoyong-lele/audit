import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service.js";
import type { CreateUserInput } from "./dto/create-user.dto.js";
import type { LoginInput } from "./dto/login.dto.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const validPassword = await Bun.password.verify(
      input.password,
      user.passwordHash,
    );
    if (!validPassword) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: "Bearer",
      expiresIn: "1h",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async createUser(input: CreateUserInput) {
    const passwordHash = await Bun.password.hash(input.password, {
      algorithm: "argon2id",
    });
    try {
      return await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name,
          role: input.role,
        },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A user with this email already exists");
      }
      throw error;
    }
  }
}
