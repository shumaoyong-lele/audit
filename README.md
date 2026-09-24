# Audit Review

Human review workflow for AI and developer code submissions. The MVP contains a NestJS API, a React review desk, a Git-aware CLI, and an MCP server. All clients share the same API and database.

## Requirements

- Bun 1.4+
- PostgreSQL 16+

## Configure and run

1. Create `.env` in the repository root based on `.env.example`. Set a unique `JWT_SECRET` (at least 32 characters) and a bootstrap admin email/password (password at least 12 characters).
2. Install dependencies and apply migrations:

   ```powershell
   bun install
   bunx prisma migrate dev
   ```

3. Start API and review desk in separate terminals:

   ```powershell
   bun run dev:server
   bun run dev:web
   ```

   API: <http://localhost:3001>; review desk: <http://localhost:3000>.
4. Sign in as the bootstrap admin. Create developer and reviewer accounts through `POST /users` with the admin Bearer token, then sign in with a reviewer account in the review desk.
5. Create a project in the review desk, or through CLI/MCP, then submit changes with a developer account.

### Local admin account

Use the bootstrap administrator email and password configured in `.env` to sign in. Keep these credentials local and never commit them. Create separate developer/reviewer accounts through the admin-only `POST /users` endpoint.

## CLI

Set `AUDIT_API_URL` and `AUDIT_TOKEN` in the terminal or create `%USERPROFILE%\.auditrc.json` with `{"apiUrl":"http://localhost:3001","token":"<bearer-token>"}`. Create a project with `bun run dev:cli project-create "Example"`; list projects with `bun run dev:cli projects`. From a Git repository, submit with `bun run dev:cli submit --project <UUID> --title "Review title"`. Use `bun run dev:cli status <UUID>` or `bun run dev:cli wait <UUID>` to retrieve the result. The CLI submits a unified diff and current commit SHA.

## MCP

Start with `AUDIT_API_URL` and `AUDIT_TOKEN` configured: `bun run dev:mcp`. Tools: `audit_list_projects`, `audit_create_project`, `audit_submit_changes`, `audit_get_submission`, and `audit_wait_for_review`.

## MVP scope

The browser review desk supports login, project/status filters, diff inspection, and start-review/approve/reject/request-changes actions. Text diffs are stored in PostgreSQL and limited to 2 MB. Binary/archive upload, comments, Git provider sync, and native Tauri packaging are not included in this first test build.
