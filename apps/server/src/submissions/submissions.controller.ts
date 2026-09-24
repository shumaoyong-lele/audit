import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ZodError, z } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { createSubmissionSchema } from "./dto/create-submission.dto.js";
import { listSubmissionsQuerySchema } from "./dto/list-submissions-query.dto.js";
import { updateSubmissionSchema } from "./dto/update-submission.dto.js";
import { SubmissionsService } from "./submissions.service.js";

const submissionIdSchema = z.uuid();

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Invalid request input",
        issues: error.issues,
      });
    }
    throw error;
  }
}

@Controller("submissions")
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DEVELOPER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    return this.submissions.create(
      parseInput(createSubmissionSchema, body),
      request.user,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: unknown) {
    return this.submissions.findAll(
      parseInput(listSubmissionsQuerySchema, query),
    );
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(@Param("id") id: string) {
    return this.submissions.findOne(parseInput(submissionIdSchema, id));
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REVIEWER)
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.submissions.update(
      parseInput(submissionIdSchema, id),
      parseInput(updateSubmissionSchema, body),
    );
  }
}
