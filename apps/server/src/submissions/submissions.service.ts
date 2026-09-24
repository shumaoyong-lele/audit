import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import type { CreateSubmissionInput } from "./dto/create-submission.dto.js";
import type { UpdateSubmissionInput } from "./dto/update-submission.dto.js";
import type { ListSubmissionsQuery } from "./dto/list-submissions-query.dto.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

const allowedTransitions = {
  PENDING: ["IN_REVIEW"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  CHANGES_REQUESTED: ["IN_REVIEW"],
  APPROVED: [],
  REJECTED: [],
} as const;

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSubmissionInput, actor: AuthenticatedUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return this.prisma.submission.create({
      data: {
        projectId: project.id,
        submitterId: actor.sub,
        title: input.title,
        source: input.source,
        commitSha: input.commitSha,
        diffText: input.diffText,
        archiveKey: input.archiveKey,
      },
      include: {
        project: { select: { id: true, name: true } },
        submitter: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async findAll(query: ListSubmissionsQuery) {
    const where = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    if (query.cursor) {
      const cursorSubmission = await this.prisma.submission.findUnique({
        where: { id: query.cursor },
        select: { id: true, projectId: true, status: true },
      });
      if (
        !cursorSubmission ||
        (query.projectId && cursorSubmission.projectId !== query.projectId) ||
        (query.status && cursorSubmission.status !== query.status)
      ) {
        throw new NotFoundException("Pagination cursor not found in this result set");
      }
    }

    const rows = await this.prisma.submission.findMany({
      where,
      orderBy: [{ createdAt: query.sort }, { id: query.sort }],
      ...(query.cursor
        ? { cursor: { id: query.cursor }, skip: 1 }
        : {}),
      take: query.limit + 1,
      include: {
        project: { select: { id: true, name: true } },
        submitter: { select: { id: true, email: true, name: true } },
      },
    });

    const hasMore = rows.length > query.limit;
    const data = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async findOne(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        submitter: { select: { id: true, email: true, name: true } },
      },
    });
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }
    return submission;
  }

  async update(id: string, input: UpdateSubmissionInput) {
    const current = await this.prisma.submission.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) {
      throw new NotFoundException("Submission not found");
    }

    const allowed = allowedTransitions[current.status] as readonly string[];
    if (!allowed.includes(input.status)) {
      throw new ConflictException(
        `Cannot change submission status from ${current.status} to ${input.status}`,
      );
    }

    const updated = await this.prisma.submission.updateMany({
      where: { id, status: current.status },
      data: { status: input.status },
    });
    if (updated.count === 0) {
      throw new ConflictException("Submission status changed concurrently");
    }

    return this.findOne(id);
  }
}
