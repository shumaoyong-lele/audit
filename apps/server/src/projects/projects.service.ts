import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import type { CreateProjectInput } from "./dto/create-project.dto.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateProjectInput, actor: AuthenticatedUser) {
    return this.prisma.project.create({
      data: {
        name: input.name,
        ownerId: actor.sub,
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }

  findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }
}
