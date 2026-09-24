#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";

const program = new Command().name("audit").description("Submit code changes for review").version("0.1.0");
const env = (key: string, fallback?: string) => process.env[key] || fallback;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const configPath = resolve(process.env.HOME || process.env.USERPROFILE || ".", ".auditrc.json");
  let config: { apiUrl?: string; token?: string } = {};
  try { config = JSON.parse(await readFile(configPath, "utf8")) as typeof config; } catch { /* Optional per-user CLI config. */ }
  const base = env("AUDIT_API_URL", config.apiUrl || "http://localhost:3001")!;
  const token = env("AUDIT_TOKEN", config.token);
  if (!token) throw new Error("Set AUDIT_TOKEN (a bearer token from an Audit account)");
  const response = await fetch(new URL(path, base), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${(body as { message?: string }).message || response.statusText}`);
  return body as T;
}

program.command("projects").description("List available projects").action(async () => {
  const rows = await api<Array<{ id: string; name: string }>>("/projects");
  for (const project of rows) console.log(`${project.id}\t${project.name}`);
});

program.command("project-create <name>").description("Create a project owned by the current account").action(async (name: string) => {
  const result = await api<{ id: string; name: string }>("/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  console.log(`${result.id}\t${result.name}`);
});

program.command("submit")
  .description("Submit current Git changes for review")
  .requiredOption("--project <id>", "Project UUID")
  .requiredOption("--title <title>", "Submission title")
  .option("--base <ref>", "Base ref for diff", "HEAD~1")
  .action(async (options: { project: string; title: string; base: string }) => {
    const cwd = process.cwd();
    const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
    let diffText: string;
    try {
      diffText = execFileSync("git", ["diff", "--no-ext-diff", "--no-color", `${options.base}...HEAD`], { cwd, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
      const workingTreeDiff = execFileSync("git", ["diff", "--no-ext-diff", "--no-color", "HEAD"], { cwd, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
      diffText += workingTreeDiff;
      const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd, encoding: "utf8" }).trim();
      for (const file of untracked ? untracked.split(/\r?\n/) : []) {
        try {
          const contents = await readFile(resolve(cwd, file), "utf8");
          diffText += `\n--- /dev/null\n+++ b/${file}\n${contents.split(/\r?\n/).map((line) => `+${line}`).join("\n")}\n`;
        } catch { /* Binary and unreadable files are listed through Git's normal diff only. */ }
      }
    } catch (error) { throw new Error(`Could not collect Git diff: ${(error as Error).message}`); }
    if (!diffText.trim()) throw new Error("No diff found. Make or commit changes before submitting.");
    const result = await api<{ id: string; status: string }>("/submissions", {
      method: "POST",
      body: JSON.stringify({ projectId: options.project, title: options.title, source: "CLI", commitSha, diffText }),
    });
    console.log(`Submitted ${result.id} (${result.status})`);
    console.log(`Review: ${env("AUDIT_WEB_URL", "http://localhost:3000")}`);
  });

program.command("status <id>").description("Get submission status").action(async (id: string) => {
  const item = await api<{ id: string; title: string; status: string }>(`/submissions/${id}`);
  console.log(`${item.id}\t${item.status}\t${item.title}`);
});

program.command("wait <id>").description("Wait until submission review completes").option("--interval <seconds>", "Polling interval", "5").action(async (id: string, options: { interval: string }) => {
  const interval = Math.max(1, Number(options.interval)) * 1000;
  for (;;) {
    const item = await api<{ id: string; title: string; status: string }>(`/submissions/${id}`);
    console.log(`${new Date().toLocaleTimeString()} ${item.status}`);
    if (["CHANGES_REQUESTED", "APPROVED", "REJECTED"].includes(item.status)) {
      console.log(`${item.title}: ${item.status}`);
      return;
    }
    await Bun.sleep(interval);
  }
});

program.command("config").description("Show local CLI configuration status").action(async () => {
  const configPath = resolve(process.env.HOME || process.env.USERPROFILE || ".", ".auditrc.json");
  try {
    const config = JSON.parse(await readFile(configPath, "utf8")) as { apiUrl?: string; token?: string };
    console.log(`Config: ${configPath}\nAPI: ${env("AUDIT_API_URL", config.apiUrl || "http://localhost:3001")}\nToken: ${env("AUDIT_TOKEN", config.token) ? "configured" : "missing"}`);
  } catch { console.log(`No config at ${configPath}; use AUDIT_API_URL and AUDIT_TOKEN.`); }
});

program.parseAsync().catch((error: Error) => { console.error(`audit: ${error.message}`); process.exitCode = 1; });
