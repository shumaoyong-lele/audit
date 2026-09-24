import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import { BootstrapAdmin } from "./bootstrap-admin.js";
import { AuthController } from "./auth.controller.js";
import { UsersController } from "./users.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { RolesGuard } from "./roles.guard.js";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let secret = config.get<string>("JWT_SECRET");
        if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
          throw new Error("JWT_SECRET must be configured with at least 32 characters");
        }
        if (!secret || secret.length < 32) {
          secret = randomBytes(32).toString("hex");
          console.warn("JWT_SECRET is unset; using a temporary development-only key");
        }
        return { secret, signOptions: { expiresIn: "1h" } };
      },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, BootstrapAdmin],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
