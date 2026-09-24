import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./index.css";
import "./review.css";

type Role = "ADMIN" | "DEVELOPER" | "REVIEWER";
type Status = "PENDING" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";
type Project = { id: string; name: string };
type Submission = {
  id: string;
  title: string;
  status: Status;
  source: string;
  commitSha: string | null;
  diffText: string | null;
  createdAt: string;
  project: Project;
  submitter: { name: string | null; email: string };
};

const API = import.meta.env?.BUN_PUBLIC_API_URL || "http://localhost:3001";
const statuses: Status[] = ["PENDING", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"];
const statusName: Record<Status, string> = {
  PENDING: "待审核",
  IN_REVIEW: "审核中",
  CHANGES_REQUESTED: "需修改",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${body.message || response.statusText}`);
  return body as T;
}

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem("audit-token") || "");
  const [role, setRole] = useState<Role | "">(() => localStorage.getItem("audit-role") as Role | "" || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const load = useCallback(async (currentToken: string) => {
    const [projectRows, page] = await Promise.all([
      request<Project[]>("/projects", currentToken),
      request<{ data: Submission[] }>("/submissions?limit=100&sort=desc", currentToken),
    ]);
    setProjects(projectRows);
    setSubmissions(page.data);
    setSelected((old) => old ? page.data.find((row) => row.id === old.id) || old : page.data[0] || null);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((reason: Error) => {
      setError(reason.message);
      if (reason.message.includes("401")) logout();
    });
  }, [token, load]);

  function logout() {
    localStorage.removeItem("audit-token");
    localStorage.removeItem("audit-role");
    setToken(""); setRole(""); setSubmissions([]); setProjects([]); setSelected(null);
  }

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await request<{ accessToken: string; user: { role: Role } }>("/sessions", "", {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("audit-token", result.accessToken);
      localStorage.setItem("audit-role", result.user.role);
      setRole(result.user.role); setToken(result.accessToken); setPassword("");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function createProject(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const project = await request<Project>("/projects", token, {
        method: "POST", body: JSON.stringify({ name: newProjectName }),
      });
      setProjects((rows) => [project, ...rows]); setProjectFilter(project.id);
      setNewProjectName(""); setShowProjectForm(false); setNotice(`项目「${project.name}」已创建`);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function review(status: Status) {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await request<Submission>(`/submissions/${selected.id}`, token, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      setSubmissions((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      setSelected(updated); setNotice(`已更新为「${statusName[status]}」`);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  const visible = useMemo(() => submissions.filter((item) =>
    (!projectFilter || item.project.id === projectFilter) &&
    (statusFilter === "ALL" || item.status === statusFilter),
  ), [submissions, projectFilter, statusFilter]);

  if (!token) return (
    <main className="login-shell">
      <form className="login-card" onSubmit={login}>
        <div className="brand-mark">AR</div><p className="eyebrow">AUDIT REVIEW</p>
        <h1>项目审核台</h1><p className="muted">登录后查看 AI 与开发者提交的变更</p>
        <label>邮箱<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
        <label>密码<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入账号密码" /></label>
        {error && <div className="alert">{error}</div>}
        <button className="primary full" disabled={busy}>{busy ? "登录中…" : "登录工作台"}</button>
        <span className="login-foot">内部代码审核 · 安全连接</span>
      </form>
    </main>
  );

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand-mark small">AR</div><div className="rail-spacer" />
        <button className="rail-icon active" title="审核收件箱">▤</button>
        <button className="rail-icon" title="项目" onClick={() => setShowProjectForm(true)}>◇</button>
        <div className="rail-spacer" /><div className="avatar">{email.slice(0, 1).toUpperCase()}</div>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <div><div className="crumb">工作区 <span>/</span> 代码审核</div><h1>审核收件箱</h1></div>
          <div className="top-actions"><span className="connection"><i /> 服务已连接</span>
            <span className="role-pill">{role === "ADMIN" ? "管理员" : role === "REVIEWER" ? "审核者" : "开发者"}</span>
            <button className="text-button" onClick={logout}>退出</button>
          </div>
        </header>
        <div className="toolbar">
          <div className="filters">
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">所有项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "ALL")}>
              <option value="ALL">所有状态</option>{statuses.map((status) => <option key={status} value={status}>{statusName[status]}</option>)}
            </select>
            <button className="subtle" onClick={() => setShowProjectForm(true)}>＋ 新建项目</button>
          </div>
          <button className="subtle" onClick={() => load(token).catch((reason: Error) => setError(reason.message))}>↻ 刷新</button>
        </div>
        {showProjectForm && <form className="project-create" onSubmit={createProject}>
          <strong>新建项目</strong>
          <input autoFocus required maxLength={120} value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="项目名称" />
          <button className="primary" disabled={busy}>创建</button>
          <button type="button" className="text-button" onClick={() => setShowProjectForm(false)}>取消</button>
        </form>}
        <div className="workspace">
          <div className="inbox">
            <div className="inbox-head"><span>提交 <b>{visible.length}</b></span><span className="sort-label">最近提交 ↓</span></div>
            {visible.length === 0 ? <div className="empty"><div>▤</div><strong>暂时没有提交</strong><span>CLI 或 MCP 提交后会出现在这里</span></div> : visible.map((item) => (
              <button key={item.id} className={`submission-row ${selected?.id === item.id ? "selected" : ""}`} onClick={() => setSelected(item)}>
                <div className="row-top"><span className={`status-dot ${item.status.toLowerCase()}`} /><span className="row-project">{item.project.name}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time></div>
                <strong>{item.title}</strong>
                <div className="row-bottom"><span>{item.submitter.name || item.submitter.email}</span><span className={`status-chip ${item.status.toLowerCase()}`}>{statusName[item.status]}</span></div>
              </button>
            ))}
          </div>
          <article className="detail">
            {selected ? <>
              <div className="detail-head"><div><div className="detail-kicker">{selected.project.name} <span>·</span> {selected.source}</div>
                <h2>{selected.title}</h2><div className="meta">提交者 {selected.submitter.name || selected.submitter.email} <span>·</span> {new Date(selected.createdAt).toLocaleString()}</div></div>
                <span className={`status-chip large ${selected.status.toLowerCase()}`}>{statusName[selected.status]}</span>
              </div>
              <div className="commit-bar"><span>COMMIT</span><code>{selected.commitSha || "未关联 Git commit"}</code><button onClick={() => navigator.clipboard.writeText(selected.id)}>复制 ID</button></div>
              <div className="diff-head"><span>变更内容</span><span>{selected.diffText ? `${selected.diffText.split("\n").length} 行` : "无 diff"}</span></div>
              <pre className="diff-view">{selected.diffText ? selected.diffText.split("\n").map((line, index) => (
                <div key={index} className={line.startsWith("+") ? "add" : line.startsWith("-") ? "remove" : ""}><span className="line-no">{String(index + 1).padStart(3, "0")}</span>{line || " "}</div>
              )) : <div className="diff-empty">此提交没有附带文本 diff。使用 CLI 或 MCP 提交变更时请附带 diff。</div>}</pre>
              <div className="review-footer"><div>{error && <span className="alert inline">{error}</span>}{notice && <span className="success">✓ {notice}</span>}</div>
                {(role === "ADMIN" || role === "REVIEWER") && <div className="review-actions">
                  {(selected.status === "PENDING" || selected.status === "CHANGES_REQUESTED") && <button className="subtle" disabled={busy} onClick={() => review("IN_REVIEW")}>开始审核</button>}
                  {selected.status === "IN_REVIEW" && <><button className="subtle" disabled={busy} onClick={() => review("CHANGES_REQUESTED")}>要求修改</button><button className="danger" disabled={busy} onClick={() => review("REJECTED")}>驳回</button><button className="primary" disabled={busy} onClick={() => review("APPROVED")}>✓ 通过审核</button></>}
                </div>}
              </div>
            </> : <div className="empty detail-empty"><div>←</div><strong>选择一个提交开始审核</strong></div>}
          </article>
        </div>
      </section>
    </div>
  );
}

export default App;
