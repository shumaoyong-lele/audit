import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { SubmissionsModule } from "./submissions/submissions.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    ProjectsModule,
    SubmissionsModule,
  ],
})
export class AppModule {}
