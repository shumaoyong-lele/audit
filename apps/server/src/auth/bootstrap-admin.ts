import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";

@Injectable()
export class BootstrapAdmin implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdmin.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const email = this.config.get<string>("BOOTSTRAP_ADMIN_EMAIL");
    const password = this.config.get<string>("BOOTSTRAP_ADMIN_PASSWORD");
    if (!email && !password) return;
    if (!email || !password || password.length < 12) {
      throw new Error(
        "Set both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters)",
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== UserRole.ADMIN || !existing.passwordHash) {
        throw new Error(
          "Bootstrap admin email already belongs to a user without admin credentials",
        );
      }
      return;
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id",
    });
    await this.prisma.user.create({
      data: { email, passwordHash, role: UserRole.ADMIN, name: "Administrator" },
    });
    this.logger.log(`Bootstrap administrator created for ${email}`);
  }
}
