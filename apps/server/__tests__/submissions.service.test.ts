import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "bun:test";
import type { PrismaService } from "../src/prisma.service.js";
import { SubmissionsService } from "../src/submissions/submissions.service.js";

type SubmissionStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED";

function createServiceFixture(
  currentStatus: SubmissionStatus | null,
  updatedCount = 1,
) {
  let findUniqueCalls = 0;
  let updateManyArgs: unknown;

  const prisma = {
    submission: {
      findUnique: async () => {
        findUniqueCalls += 1;
        if (findUniqueCalls === 1) {
          return currentStatus === null ? null : { status: currentStatus };
        }
        return { id: "submission-1", status: "IN_REVIEW" };
      },
      updateMany: async (args: unknown) => {
        updateManyArgs = args;
        return { count: updatedCount };
      },
    },
  } as unknown as PrismaService;

  return {
    service: new SubmissionsService(prisma),
    get updateManyArgs() {
      return updateManyArgs;
    },
  };
}

describe("SubmissionsService.update status transitions", () => {
  it("moves a pending submission into review", async () => {
    const fixture = createServiceFixture("PENDING");

    const result = await fixture.service.update("submission-1", {
      status: "IN_REVIEW",
    });

    expect(result.status).toBe("IN_REVIEW");
    expect(fixture.updateManyArgs).toEqual({
      where: { id: "submission-1", status: "PENDING" },
      data: { status: "IN_REVIEW" },
    });
  });

  it("rejects a transition that skips the review step", async () => {
    const fixture = createServiceFixture("PENDING");

    const error = await fixture.service
      .update("submission-1", { status: "APPROVED" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ConflictException);
    expect(fixture.updateManyArgs).toBeUndefined();
  });

  it("keeps approved submissions terminal", async () => {
    const fixture = createServiceFixture("APPROVED");

    const error = await fixture.service
      .update("submission-1", { status: "IN_REVIEW" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ConflictException);
    expect(fixture.updateManyArgs).toBeUndefined();
  });

  it("reports a missing submission", async () => {
    const fixture = createServiceFixture(null);

    const error = await fixture.service
      .update("missing-submission", { status: "IN_REVIEW" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(fixture.updateManyArgs).toBeUndefined();
  });

  it("detects a concurrent status change instead of overwriting it", async () => {
    const fixture = createServiceFixture("PENDING", 0);

    const error = await fixture.service
      .update("submission-1", { status: "IN_REVIEW" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ConflictException);
  });
});
