import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 3 * 1024 * 1024 }),
  );
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(",") ?? true });

  await app.listen({
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 3001),
  });
}

bootstrap();
