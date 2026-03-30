const BASE = process.env.NEXT_PUBLIC_API_URL
  || (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:8000/api");

function token() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("eg_token");
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tk = token();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new Error(`Cannot reach API (${BASE}). Check NEXT_PUBLIC_API_URL or backend /api route.`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function reqForm<T>(path: string, body: FormData): Promise<T> {
  const tk = token();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: tk ? { Authorization: `Bearer ${tk}` } : {},
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  register: (body: { username: string; email: string; password: string }) =>
    req<{ token: string; user: any }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    req<{ token: string; user: any }>("/auth/login",    { method: "POST", body: JSON.stringify(body) }),

  // ── Turnstile ───────────────────────────────────────────────────────────────
  verifyTurnstile: (cfToken: string) =>
    req<{ success: boolean }>("/auth/turnstile-verify", { method: "POST", body: JSON.stringify({ token: cfToken }) }),

  // ── Projects ────────────────────────────────────────────────────────────────
  projects:      ()                 => req<any[]>("/projects"),
  project:       (id: string)       => req<any>(`/projects/${id}`),
  getProject:    (id: string)       => req<any>(`/projects/${id}`),
  createProject: (body: any)        => req<any>("/projects", { method: "POST", body: JSON.stringify(body) }),
  deleteProject: (id: string)       => req<any>(`/projects/${id}`, { method: "DELETE" }),

  // ── Scripts ─────────────────────────────────────────────────────────────────
  scripts: (projectId: string) => req<any[]>(`/scripts?project_id=${projectId}`),

  createScript: (projectId: string, body: {
    name: string; description?: string; source: string; obf_level?: number;
  }) => req<any>("/scripts", { method: "POST", body: JSON.stringify({ ...body, project_id: projectId }) }),

  uploadScript: (params: {
    project_id: string; name: string; description?: string;
    obf_level?: number; file: File;
  }) => {
    const fd = new FormData();
    fd.append("project_id",  params.project_id);
    fd.append("name",        params.name);
    fd.append("description", params.description || "");
    fd.append("obf_level",   String(params.obf_level ?? 1));
    fd.append("file",        params.file);
    return reqForm<any>("/scripts/upload", fd);
  },

  updateScript: (id: string, body: any)  => req<any>(`/scripts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteScript: (id: string)             => req<any>(`/scripts/${id}`, { method: "DELETE" }),
  getLoader:    (id: string)             => req<{ loader: string; script_id: string }>(`/scripts/${id}/loader`),
  getMetrics:   (id: string)             => req<any>(`/scripts/${id}/metrics`),

  // ── Management ──────────────────────────────────────────────────────────────
  getBanned:     (projectId: string)                            => req<any[]>(`/projects/${projectId}/banned`),
  banHwid:       (projectId: string, hwid: string, note = "")  => req<any>(`/projects/${projectId}/banned`,     { method: "POST",   body: JSON.stringify({ hwid, note }) }),
  unbanHwid:     (projectId: string, banId: string)            => req<any>(`/projects/${projectId}/banned/${banId}`, { method: "DELETE" }),

  getWhitelist:    (projectId: string)                          => req<any[]>(`/projects/${projectId}/whitelist`),
  addWhitelist:    (projectId: string, hwid: string, note = "") => req<any>(`/projects/${projectId}/whitelist`,     { method: "POST",   body: JSON.stringify({ hwid, note }) }),
  removeWhitelist: (projectId: string, wlId: string)           => req<any>(`/projects/${projectId}/whitelist/${wlId}`, { method: "DELETE" }),

  // ── Key System ───────────────────────────────────────────────────────────────
  getLoaderConfig:  (projectId: string)        => req<any>(`/projects/${projectId}/loader-config`),
  saveLoaderConfig: (projectId: string, body: any) => req<any>(`/projects/${projectId}/loader-config`, { method: "PUT", body: JSON.stringify(body) }),

  listKeys:    (projectId: string)                       => req<any[]>(`/projects/${projectId}/keys`),
  createKey:   (projectId: string, body: { tier: string; note?: string; expires_at?: number }) =>
                 req<any>(`/projects/${projectId}/keys`, { method: "POST", body: JSON.stringify(body) }),
  deleteKey:   (projectId: string, keyId: string)        => req<any>(`/projects/${projectId}/keys/${keyId}`, { method: "DELETE" }),
  resetKeyHwid:(projectId: string, keyId: string)        => req<any>(`/projects/${projectId}/keys/${keyId}/reset-hwid`, { method: "PATCH", body: JSON.stringify({}) }),

  // Public key verify (used by loader)
  verifyKey: (body: { key: string; hwid: string; project_id: string }) =>
    req<{ valid: boolean; tier: string; script_id: string }>("/keys/verify", { method: "POST", body: JSON.stringify(body) }),
};

export function saveAuth(token: string, user: any) {
  localStorage.setItem("eg_token", token);
  localStorage.setItem("eg_user", JSON.stringify(user));
}
export function clearAuth() {
  localStorage.removeItem("eg_token");
  localStorage.removeItem("eg_user");
}
export function getUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("eg_user") || "null"); } catch { return null; }
}
