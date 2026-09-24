import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ZodError } from "zod";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { Roles } from "./roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";
import { createUserSchema } from "./dto/create-user.dto.js";

@Controller("users")
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createUser(@Body() body: unknown) {
    try {
      return this.auth.createUser(createUserSchema.parse(body));
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: "Invalid user representation",
          issues: error.issues,
        });
      }
      throw error;
    }
  }
}
