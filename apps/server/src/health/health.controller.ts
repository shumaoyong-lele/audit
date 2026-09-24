import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  async getHealth() {
    let database: "ok" | "error" = "ok";

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
    }

    return {
      status: database === "ok" ? "ok" : "error",
      database,
      service: "audit-server",
      timestamp: new Date().toISOString(),
    };
  }

}
