"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Users, FileCode2, Activity, ShieldAlert, Cpu, HardDrive,
  MemoryStick, Trash2, Ban, CheckCircle2, RefreshCw, LogOut,
  Server, Zap, Clock, FolderOpen, ChevronDown, ChevronUp, Eye, EyeOff
} from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL
  || (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:8000/api");

async function adminReq<T>(path: string, secret: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": secret,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ── Helpers ── */
function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function fmtDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("vi-VN", { day:"2-digit", month:"2-digit", year:"numeric" });
}

/* ── Gauge ring ── */
function Gauge({ pct, color, size=64 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct, 100) / 100;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}/>
    </svg>
  );
}

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">{label}</p>
        <p className="text-xl font-bold text-white tracking-tight">{value}</p>
        {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── System gauge card ── */
function SysCard({ label, pct, detail, color }: { label:string; pct:number; detail:string; color:string }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <Gauge pct={pct} color={color} size={56}/>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
          style={{ color }}>{Math.round(pct)}%</span>
      </div>
      <div>
        <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">{label}</p>
        <p className="text-sm font-semibold text-white">{detail}</p>
      </div>
    </div>
  );
}

/* ── Login screen ── */
function LoginScreen({ onLogin }: { onLogin: (s: string) => void }) {
  const [val, setVal]   = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!val.trim()) return;
    setLoading(true); setErr("");
    try {
      await adminReq("/stats", val.trim());
      onLogin(val.trim());
    } catch {
      setErr("Invalid admin secret");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight:"100vh", background:"#08080f",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"var(--font-sans)",
    }}>
      {/* bg orbs */}
      <div className="orb" style={{ width:400,height:400,top:"-10%",left:"-10%",background:"rgba(37,99,235,0.12)" }}/>
      <div className="orb" style={{ width:300,height:300,bottom:"5%",right:"5%",background:"rgba(124,58,237,0.10)" }}/>

      <div className="glass-strong rounded-3xl p-8 w-full animate-scale-in" style={{ maxWidth:360, position:"relative", zIndex:1 }}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background:"linear-gradient(135deg,#2563eb,#7c3aed)" }}>
            <Server size={18} color="white"/>
          </div>
          <div>
            <p className="font-bold text-white text-sm tracking-tight">ExeGuard</p>
            <p className="text-[10px] text-white/40">Admin Panel</p>
          </div>
        </div>

        <p className="text-white/50 text-xs mb-5">Enter admin secret to continue</p>

        <div className="relative mb-3">
          <input
            className="input-glass w-full rounded-xl px-4 py-3 text-sm pr-10"
            type={show ? "text" : "password"}
            placeholder="Admin secret"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            onClick={() => setShow(!show)}>
            {show ? <EyeOff size={14}/> : <Eye size={14}/>}
          </button>
        </div>

        {err && <p className="text-red-400 text-xs mb-3">{err}</p>}

        <button
          onClick={submit} disabled={loading}
          className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          {loading ? <RefreshCw size={14} className="animate-spin"/> : <Server size={14}/>}
          {loading ? "Verifying…" : "Access Panel"}
        </button>
      </div>
    </div>
  );
}

/* ── User row ── */
function UserRow({ user, secret, onRefresh }: { user: any; secret: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState<"ban"|"del"|null>(null);
  const [confirm, setConfirm]   = useState(false);

  const toggleBan = async () => {
    setLoading("ban");
    try { await adminReq(`/users/${user.id}/ban`, secret, { method:"PATCH" }); onRefresh(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(null); }
  };

  const deleteUser = async () => {
    if (!confirm) { setConfirm(true); return; }
    setLoading("del");
    try { await adminReq(`/users/${user.id}`, secret, { method:"DELETE" }); onRefresh(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(null); setConfirm(false); }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden mb-2">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}>
        {/* Avatar */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
          style={{ background: user.banned ? "rgba(239,68,68,0.25)" : "linear-gradient(135deg,rgba(37,99,235,0.5),rgba(99,102,241,0.4))" }}>
          {(user.username || user.email || "?")[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{user.username}</span>
            {user.banned && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-red-400"
                style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)" }}>
                BANNED
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/40 truncate">{user.email}</p>
        </div>

        {/* Mini stats */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] text-white/40 flex-shrink-0">
          <span className="flex items-center gap-1"><FolderOpen size={10}/>{user.project_count}</span>
          <span className="flex items-center gap-1"><FileCode2 size={10}/>{user.script_count}</span>
          <span className="flex items-center gap-1"><Activity size={10}/>{user.exec_count}</span>
        </div>

        <span className="text-white/20 flex-shrink-0">
          {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)" }}
          className="px-4 py-3 flex flex-wrap gap-2 items-center">
          {/* Stats chips */}
          <div className="flex gap-2 flex-wrap flex-1">
            {[
              { l:"Projects",   v:user.project_count, c:"#3b82f6" },
              { l:"Scripts",    v:user.script_count,  c:"#8b5cf6" },
              { l:"Executions", v:user.exec_count,    c:"#22c55e" },
              { l:"Joined",     v:fmtDate(user.created_at), c:"#f59e0b" },
            ].map(x => (
              <div key={x.l} className="rounded-xl px-3 py-1.5"
                style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[9px] text-white/40 uppercase tracking-wider">{x.l}</p>
                <p className="text-xs font-bold" style={{ color:x.c }}>{x.v}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={toggleBan} disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: user.banned ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                border: user.banned ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                color: user.banned ? "#22c55e" : "#ef4444",
              }}>
              {loading === "ban"
                ? <RefreshCw size={11} className="animate-spin"/>
                : user.banned ? <CheckCircle2 size={11}/> : <Ban size={11}/>}
              {user.banned ? "Unban" : "Ban"}
            </button>

            <button onClick={deleteUser} disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: confirm ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444",
              }}>
              {loading === "del"
                ? <RefreshCw size={11} className="animate-spin"/>
                : <Trash2 size={11}/>}
              {confirm ? "Confirm?" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Panel ── */
export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [stats,  setStats]  = useState<any>(null);
  const [users,  setUsers]  = useState<any[]>([]);
  const [tab,    setTab]    = useState<"overview"|"users">("overview");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<any>(null);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const [st, us] = await Promise.all([
        adminReq<any>("/stats", s),
        adminReq<any[]>("/users", s),
      ]);
      setStats(st); setUsers(us);
      setLastRefresh(new Date());
    } catch (e: any) {
      if (e.message === "Forbidden") setSecret(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!secret) return;
    load(secret);
  }, [secret, load]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!secret || !autoRefresh) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => load(secret), 15000);
    return () => clearInterval(timerRef.current);
  }, [secret, autoRefresh, load]);

  if (!secret) return <LoginScreen onLogin={s => setSecret(s)} />;

  const sys = stats?.system;
  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const bannedCount = users.filter(u => u.banned).length;

  return (
    <div style={{ minHeight:"100vh", background:"#08080f", fontFamily:"var(--font-sans)", color:"#f5f5f7" }}>
      {/* bg orbs */}
      <div className="orb" style={{ width:500,height:500,top:"-15%",right:"-10%",background:"rgba(37,99,235,0.08)",pointerEvents:"none" }}/>
      <div className="orb" style={{ width:400,height:400,bottom:"-10%",left:"-5%",background:"rgba(124,58,237,0.07)",pointerEvents:"none" }}/>

      {/* Header */}
      <div style={{
        position:"sticky", top:0, zIndex:50,
        background:"rgba(8,8,15,0.85)",
        backdropFilter:"blur(24px)",
        borderBottom:"1px solid rgba(255,255,255,0.06)",
      }}>
        <div className="flex items-center gap-3 px-5 py-3 max-w-5xl mx-auto">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background:"linear-gradient(135deg,#2563eb,#7c3aed)" }}>
            <Server size={14} color="white"/>
          </div>
          <div className="flex-1">
            <span className="font-bold text-white text-sm tracking-tight">ExeGuard</span>
            <span className="text-white/30 text-xs ml-2">Admin Panel</span>
          </div>

          {/* Auto-refresh indicator */}
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
            style={{
              background: autoRefresh ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
              border: autoRefresh ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.08)",
              color: autoRefresh ? "#22c55e" : "rgba(255,255,255,0.3)",
            }}>
            <div style={{
              width:6, height:6, borderRadius:"50%",
              background: autoRefresh ? "#22c55e" : "rgba(255,255,255,0.2)",
              boxShadow: autoRefresh ? "0 0 6px #22c55e" : "none",
            }}/>
            Auto 15s
          </button>

          <button onClick={() => load(secret)} disabled={loading}
            className="text-white/30 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""}/>
          </button>

          <button onClick={() => setSecret(null)}
            className="text-white/30 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-white/5">
            <LogOut size={14}/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 max-w-5xl mx-auto gap-1 pb-1">
          {(["overview","users"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: tab === t ? "rgba(37,99,235,0.15)" : "transparent",
                color: tab === t ? "#93c5fd" : "rgba(255,255,255,0.35)",
                border: tab === t ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent",
              }}>
              {t}
            </button>
          ))}
          {lastRefresh && (
            <span className="ml-auto self-center text-[9px] text-white/20 flex items-center gap-1">
              <Clock size={9}/> {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-5 pb-10">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="animate-fade-up space-y-4">

            {/* Main stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={Users}      label="Total Users"    value={stats?.users ?? "—"}        sub={`${bannedCount} banned`} color="#3b82f6"/>
              <StatCard icon={FolderOpen} label="Projects"       value={stats?.projects ?? "—"}     sub="" color="#8b5cf6"/>
              <StatCard icon={FileCode2}  label="Scripts"        value={stats?.scripts ?? "—"}      sub="uploaded" color="#22c55e"/>
              <StatCard icon={Activity}   label="Executions"     value={stats?.executions ?? "—"}   sub={`${stats?.executions_24h ?? 0} today`} color="#f59e0b"/>
            </div>

            {/* Hook attempts full width */}
            <div className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.25)" }}>
                <ShieldAlert size={18} color="#ef4444"/>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Hook Attempts Blocked</p>
                <p className="text-2xl font-bold text-red-400">{stats?.hook_attempts ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/30">Total across all scripts</p>
                <p className="text-xs text-white/50 mt-0.5">Anti-hook protection active</p>
              </div>
            </div>

            {/* System metrics */}
            {sys && (
              <>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold pt-2">System Health</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SysCard label="CPU" pct={sys.cpu_pct}
                    detail={`${sys.cpu_pct.toFixed(1)}%`}
                    color={sys.cpu_pct > 80 ? "#ef4444" : sys.cpu_pct > 50 ? "#f59e0b" : "#22c55e"}/>
                  <SysCard label="Memory" pct={sys.mem_pct}
                    detail={`${sys.mem_used_mb}/${sys.mem_total_mb} MB`}
                    color={sys.mem_pct > 85 ? "#ef4444" : sys.mem_pct > 60 ? "#f59e0b" : "#3b82f6"}/>
                  <SysCard label="Disk" pct={sys.disk_pct}
                    detail={`${sys.disk_used_gb}/${sys.disk_total_gb} GB`}
                    color={sys.disk_pct > 90 ? "#ef4444" : sys.disk_pct > 70 ? "#f59e0b" : "#8b5cf6"}/>
                  <div className="glass rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.25)" }}>
                      <Clock size={18} color="#22c55e"/>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Uptime</p>
                      <p className="text-sm font-bold text-white">{fmtUptime(sys.uptime_s)}</p>
                    </div>
                  </div>
                </div>

                {/* Load bar chart */}
                <div className="glass rounded-2xl p-4">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">Resource Overview</p>
                  {[
                    { label:"CPU",    pct:sys.cpu_pct,  color:"#3b82f6" },
                    { label:"Memory", pct:sys.mem_pct,  color:"#8b5cf6" },
                    { label:"Disk",   pct:sys.disk_pct, color:"#22c55e" },
                  ].map(r => (
                    <div key={r.label} className="mb-3 last:mb-0">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/50 font-medium">{r.label}</span>
                        <span className="font-bold" style={{ color:r.color }}>{r.pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background:"rgba(255,255,255,0.06)" }}>
                        <div className="h-2 rounded-full transition-all duration-700"
                          style={{
                            width:`${Math.min(r.pct,100)}%`,
                            background:`linear-gradient(90deg,${r.color}aa,${r.color})`,
                            boxShadow:`0 0 8px ${r.color}66`,
                          }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!stats && (
              <div className="flex flex-col items-center py-16 gap-3 text-white/30">
                <RefreshCw size={24} className="animate-spin"/>
                <p className="text-sm">Loading stats…</p>
              </div>
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="animate-fade-up">
            {/* Search + count */}
            <div className="flex items-center gap-3 mb-4">
              <input
                className="input-glass flex-1 rounded-xl px-4 py-2.5 text-sm"
                placeholder="Search username or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <span className="text-xs text-white/30 flex-shrink-0">
                {filteredUsers.length} / {users.length}
              </span>
            </div>

            {/* Summary chips */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { l:"Total",   v:users.length,       c:"#3b82f6" },
                { l:"Active",  v:users.length-bannedCount, c:"#22c55e" },
                { l:"Banned",  v:bannedCount,         c:"#ef4444" },
              ].map(x => (
                <div key={x.l} className="rounded-xl px-3 py-1.5 flex items-center gap-2"
                  style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background:x.c, boxShadow:`0 0 4px ${x.c}` }}/>
                  <span className="text-[10px] text-white/40">{x.l}</span>
                  <span className="text-xs font-bold" style={{ color:x.c }}>{x.v}</span>
                </div>
              ))}
            </div>

            {filteredUsers.length === 0 && !loading ? (
              <div className="glass rounded-2xl py-12 flex flex-col items-center gap-2 text-white/30">
                <Users size={28}/>
                <p className="text-sm">{search ? "No users match" : "No users yet"}</p>
              </div>
            ) : (
              filteredUsers.map(u => (
                <UserRow key={u.id} user={u} secret={secret} onRefresh={() => load(secret)}/>
              ))
            )}

            {loading && users.length === 0 && (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-2xl"/>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
