# Repository Guidelines

## Project Structure & Module Organization

This is a Bun workspace monorepo. `apps/server` is the NestJS API, `apps/cli` the Git submission CLI, and `apps/mcp-server` the MCP tools; the browser review desk is the React app in root `src/`. `apps/desktop` is reserved for future native packaging. Shared code belongs in `packages/`; Prisma schema/migrations are in `prisma/`, infrastructure in `infrastructure/`, and helper scripts in `scripts/`.

## Build, Test, and Development Commands

- `bun install` installs dependencies.
- `bun run dev:server` starts the API with watch mode.
- `bun run dev:web` starts the review desk.
- `bun run dev:mcp` starts the MCP stdio server (requires `AUDIT_API_URL` and `AUDIT_TOKEN`).
- `bun run dev:cli -- --help` shows CLI commands.
- `bun run build:server` compiles the API.
- `bun run --filter '@audit/server' build` compiles the API.
- `bun run --filter '@audit/server' test` runs API tests with `bun test`.
- `bunx prisma migrate dev --name <change>` creates and applies a development migration; `bunx prisma generate` refreshes the client.
- `bun run check:workspaces` lists detected workspace packages.

Run Prisma commands from the repository root. Configure local secrets in `.env`; use `.env.example` as the template.

## Coding Style & Naming Conventions

Use TypeScript, ES modules, and two-space indentation. Organize API code by feature under `apps/server/src/<feature>/`: controllers handle HTTP, services contain business logic, and `dto/` holds request schemas. Use kebab-case filenames, PascalCase classes, and camelCase functions/variables. Validate external input with Zod; put contracts used by multiple apps in `packages/`. Keep the existing `.js` suffix on relative server imports. No formatter or linter is configured; match nearby code.

## Testing Guidelines

Place tests beside code or in `__tests__/`, named `*.spec.ts` or `*.test.ts`. Use Bun’s test runner; cover validation, authorization, status transitions, and persistence. Run server tests before submitting. For database changes, apply migrations locally and verify the affected PostgreSQL flow.

## Commit & Pull Request Guidelines

No commit history exists yet. Use concise imperative subjects with `feat:`, `fix:`, `docs:`, or `chore:` (example: `feat: add submission review endpoint`). Pull requests should describe behavior/schema changes, list verification commands, link issues when available, and include UI screenshots when relevant.

## Security & Configuration

Never commit `.env` values, passwords, JWT secrets, tokens, or source archives. Keep `.env.example` to placeholders. Include a generated `prisma/migrations/` migration with each schema change.

## HTTP API Conventions

Model endpoints as nouns and collections: `GET /projects`, `POST /projects`, `GET /submissions/{id}`, and `POST /sessions`. Use `PATCH /submissions/{id}` to update fields such as `status`; validate workflow transitions in the service and require reviewer/admin authorization. Use standard HTTP codes (`201` create, `200` read/update, `400` invalid input, `401` unauthenticated, `403` forbidden, `404` missing resource, `409` conflicting transition). Filter and paginate collections with query parameters. Submission listing supports `projectId`, `status`, `limit`, `cursor`, and `sort`; responses use `{ data, nextCursor, hasMore }`.
