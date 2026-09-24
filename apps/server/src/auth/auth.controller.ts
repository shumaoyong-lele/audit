import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ZodError } from "zod";
import { AuthService } from "./auth.service.js";
import { loginSchema } from "./dto/login.dto.js";

@Controller("sessions")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown) {
    try {
      return this.auth.login(loginSchema.parse(body));
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: "Invalid session input",
          issues: error.issues,
        });
      }
      throw error;
    }
  }

}
