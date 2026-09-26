import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { afterAll, expect, it } from "bun:test";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma.service.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = testDatabaseUrl ? it : it.skip;

integrationTest("authenticates users and enforces the submission review flow over HTTP", async () => {
  if (!testDatabaseUrl) return;

  const databaseUrl = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !/(?:^|_)test$/i.test(databaseName)
  ) {
    throw new Error(
      "TEST_DATABASE_URL must point to a local PostgreSQL database ending in _test",
    );
  }

  const runId = randomUUID();
  const adminEmail = `admin-${runId}@audit.test`;
  const developerEmail = `developer-${runId}@audit.test`;
  const reviewerEmail = `reviewer-${runId}@audit.test`;
  const projectName = `HTTP integration ${runId}`;

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = randomUUID().replaceAll("-", "") + randomUUID();
  process.env.BOOTSTRAP_ADMIN_EMAIL = adminEmail;
  process.env.BOOTSTRAP_ADMIN_PASSWORD = `test-${randomUUID()}-Password!`;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 3 * 1024 * 1024 }),
    { logger: false },
  );

  try {
    await app.listen(0, "127.0.0.1");
    const baseUrl = await app.getUrl();

    const request = (
      path: string,
      options: { method?: string; token?: string; body?: unknown } = {},
    ) => {
      const headers = new Headers();
      if (options.body !== undefined) headers.set("content-type", "application/json");
      if (options.token) headers.set("authorization", `Bearer ${options.token}`);
      return fetch(`${baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
    };

    expect((await request("/submissions")).status).toBe(401);

    const adminLogin = await request("/sessions", {
      method: "POST",
      body: { email: adminEmail, password: process.env.BOOTSTRAP_ADMIN_PASSWORD },
    });
    expect(adminLogin.status).toBe(200);
    const admin = (await adminLogin.json()) as { accessToken: string };

    const developerResponse = await request("/users", {
      method: "POST",
      token: admin.accessToken,
      body: {
        email: developerEmail,
        password: "developer-test-password",
        name: "Integration Developer",
        role: "DEVELOPER",
      },
    });
    expect(developerResponse.status).toBe(201);

    const reviewerResponse = await request("/users", {
      method: "POST",
      token: admin.accessToken,
      body: {
        email: reviewerEmail,
        password: "reviewer-test-password",
        name: "Integration Reviewer",
        role: "REVIEWER",
      },
    });
    expect(reviewerResponse.status).toBe(201);

    const developerLogin = await request("/sessions", {
      method: "POST",
      body: { email: developerEmail, password: "developer-test-password" },
    });
    expect(developerLogin.status).toBe(200);
    const developer = (await developerLogin.json()) as { accessToken: string };

    const reviewerLogin = await request("/sessions", {
      method: "POST",
      body: { email: reviewerEmail, password: "reviewer-test-password" },
    });
    expect(reviewerLogin.status).toBe(200);
    const reviewer = (await reviewerLogin.json()) as { accessToken: string };

    const projectResponse = await request("/projects", {
      method: "POST",
      token: developer.accessToken,
      body: { name: projectName },
    });
    expect(projectResponse.status).toBe(201);
    const project = (await projectResponse.json()) as { id: string };

    const submissionResponse = await request("/submissions", {
      method: "POST",
      token: developer.accessToken,
      body: {
        projectId: project.id,
        title: "Integration submission",
        source: "CLI",
        commitSha: "0123456789abcdef",
        diffText: "diff --git a/example.ts b/example.ts",
      },
    });
    expect(submissionResponse.status).toBe(201);
    const submission = (await submissionResponse.json()) as { id: string; status: string };
    expect(submission.status).toBe("PENDING");

    expect(
      (
        await request(`/submissions/${submission.id}`, {
          method: "PATCH",
          token: developer.accessToken,
          body: { status: "IN_REVIEW" },
        })
      ).status,
    ).toBe(403);

    const reviewResponse = await request(`/submissions/${submission.id}`, {
      method: "PATCH",
      token: reviewer.accessToken,
      body: { status: "IN_REVIEW" },
    });
    expect(reviewResponse.status).toBe(200);

    const approvalResponse = await request(`/submissions/${submission.id}`, {
      method: "PATCH",
      token: reviewer.accessToken,
      body: { status: "APPROVED" },
    });
    expect(approvalResponse.status).toBe(200);
    expect(
      ((await approvalResponse.json()) as { status: string }).status,
    ).toBe("APPROVED");

    const listResponse = await request(`/submissions?projectId=${project.id}`, {
      token: reviewer.accessToken,
    });
    expect(listResponse.status).toBe(200);
    const list = (await listResponse.json()) as {
      data: Array<{ id: string }>;
      hasMore: boolean;
    };
    expect(list.data.map(({ id }) => id)).toContain(submission.id);
    expect(list.hasMore).toBe(false);
  } finally {
    try {
      const prisma = app.get(PrismaService);
      const project = await prisma.project.findFirst({
        where: { name: projectName },
        select: { id: true },
      });
      if (project) {
        await prisma.submission.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } });
      }
      await prisma.user.deleteMany({
        where: { email: { in: [adminEmail, developerEmail, reviewerEmail] } },
      });
    } finally {
      await app.close();
    }
  }
});

afterAll(() => {
  if (!testDatabaseUrl) {
    console.info(
      "HTTP/PostgreSQL integration test skipped; set TEST_DATABASE_URL to a local *_test database to run it.",
    );
  }
});
