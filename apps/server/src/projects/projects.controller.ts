import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ZodError } from "zod";
import { createProjectSchema } from "./dto/create-project.dto.js";
import { ProjectsService } from "./projects.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.projects.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    try {
      return this.projects.create(
        createProjectSchema.parse(body),
        request.user,
      );
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: "Invalid project input",
          issues: error.issues,
        });
      }
      throw error;
    }
  }
}
