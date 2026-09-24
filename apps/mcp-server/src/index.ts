#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const apiUrl = process.env.AUDIT_API_URL || "http://localhost:3001";
const token = process.env.AUDIT_TOKEN;
const server = new McpServer({ name: "audit-review", version: "0.1.0" });

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!token) throw new Error("Set AUDIT_TOKEN to a bearer token before starting the MCP server");
  const response = await fetch(new URL(path, apiUrl), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${(body as { message?: string }).message || response.statusText}`);
  return body as T;
}

server.registerTool("audit_list_projects", {
  description: "List projects available for code review submissions",
  inputSchema: {},
}, async () => {
  const projects = await api<Array<{ id: string; name: string }>>("/projects");
  return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
});

server.registerTool("audit_create_project", {
  description: "Create a review project owned by the connected account",
  inputSchema: { name: z.string().min(1).max(120) },
}, async ({ name }) => {
  const project = await api<{ id: string; name: string }>("/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return { content: [{ type: "text", text: JSON.stringify(project) }] };
});

server.registerTool("audit_submit_changes", {
  description: "Submit a title, project, commit SHA, and unified diff for human review",
  inputSchema: {
    projectId: z.string().uuid(),
    title: z.string().min(1).max(200),
    commitSha: z.string().max(64).optional(),
    diffText: z.string().max(2_000_000),
  },
}, async ({ projectId, title, commitSha, diffText }) => {
  const result = await api<{ id: string; status: string }>("/submissions", {
    method: "POST",
    body: JSON.stringify({ projectId, title, source: "MCP", commitSha, diffText }),
  });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.registerTool("audit_get_submission", {
  description: "Get the current state and review result of a submission",
  inputSchema: { submissionId: z.string().uuid() },
}, async ({ submissionId }) => {
  const result = await api(`/submissions/${submissionId}`);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("audit_wait_for_review", {
  description: "Wait by polling until the submission is approved, rejected, or returned for changes",
  inputSchema: {
    submissionId: z.string().uuid(),
    intervalSeconds: z.number().int().min(2).max(60).default(5),
    timeoutSeconds: z.number().int().min(5).max(3600).default(600),
  },
}, async ({ submissionId, intervalSeconds, timeoutSeconds }) => {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let result: { id: string; title: string; status: string };
  do {
    result = await api(`/submissions/${submissionId}`);
    if (["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(result.status)) {
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    await Bun.sleep(intervalSeconds * 1000);
  } while (Date.now() < deadline);
  return { content: [{ type: "text", text: `Timed out while waiting. Latest state: ${JSON.stringify(result)}` }] };
});

await server.connect(new StdioServerTransport());
