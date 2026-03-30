"use client";
import { useEffect, useState } from "react";
import {
  Plus, FolderOpen, Trash2, ChevronRight, Code2, Activity, ShieldAlert, X,
  FolderKanban, User, LogOut, Crown, Sparkles
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import { RightSidebarNav, NavTab } from "@/components/RightSidebarNav";
import { api, getUser, clearAuth } from "@/lib/api";

// ── Account Panel ─────────────────────────────────────────────────────────────
function AccountPanel() {
  const router = useRouter();
  const user = getUser();
  const logout = () => { clearAuth(); router.push("/login"); };
  const initial = (user?.username || user?.email || "U")[0].toUpperCase();

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Avatar card */}
        <div className="glass rounded-3xl p-6 mb-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "linear-gradient(135deg,rgba(37,99,235,0.35) 0%,rgba(99,102,241,0.25) 100%)",
              border: "1px solid rgba(37,99,235,0.4)",
              boxShadow: "0 0 24px rgba(37,99,235,0.2)",
            }}>
            <span style={{ fontSize:28, fontWeight:700, color:"#fff", textShadow:"0 0 16px rgba(100,150,255,0.8)" }}>
              {initial}
            </span>
          </div>
          <h2 className="font-display font-bold text-xl text-ink-1 tracking-tight mb-1">
            {user?.username || user?.email || "User"}
          </h2>
          <p className="text-xs text-ink-3 font-light">{user?.email || ""}</p>
        </div>

        {/* Plan */}
        <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-3"
          style={{ border:"1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:"rgba(234,179,8,0.12)", border:"1px solid rgba(234,179,8,0.25)" }}>
            <Crown size={15} className="text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-ink-2">Current Plan</p>
            <p className="text-sm font-bold text-ink-1 mt-0.5">Free</p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background:"rgba(234,179,8,0.12)", border:"1px solid rgba(234,179,8,0.25)", color:"#facc15" }}>
            FREE
          </span>
        </div>

        {/* Upgrade hint */}
        <div className="glass rounded-2xl p-4 mb-4 flex items-start gap-3"
          style={{ background:"rgba(37,99,235,0.06)", border:"1px solid rgba(37,99,235,0.18)" }}>
          <Sparkles size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-400 mb-0.5">Upgrade to Pro</p>
            <p className="text-[11px] text-ink-3 font-light leading-relaxed">
              Unlock unlimited projects, advanced obfuscation, and priority support.
            </p>
          </div>
        </div>

        {/* Logout */}
        <button onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all"
          style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"rgba(239,68,68,0.9)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.15)"; (e.currentTarget as HTMLElement).style.borderColor="rgba(239,68,68,0.4)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.08)"; (e.currentTarget as HTMLElement).style.borderColor="rgba(239,68,68,0.2)"; }}>
          <LogOut size={14} /> Log Out
        </button>
      </div>
    </div>
  );
}

// ── Projects Panel ─────────────────────────────────────────────────────────────
function ProjectsPanel() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try { setProjects(await api.projects()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await api.createProject(form);
      toast.success("Project created");
      setModal(false); setForm({ name:"", description:"" }); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await api.deleteProject(id); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const totalScripts = projects.reduce((s, p) => s + (p.script_count || 0), 0);
  const totalRuns    = projects.reduce((s, p) => s + (p.total_executions || 0), 0);
  const totalHooks   = projects.reduce((s, p) => s + (p.hook_attempts || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-ink-1 tracking-tight">Projects</h1>
            <p className="text-ink-3 text-sm mt-1.5 font-light">Manage your script collections</p>
          </div>
          <button onClick={() => setModal(true)} className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
            <Plus size={15} /> New Project
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Scripts" value={totalScripts} icon={Code2}      accent="blue"  />
          <StatCard label="Total Runs"    value={totalRuns}    icon={Activity}    accent="green" />
          <StatCard label="Hook Attempts" value={totalHooks}   icon={ShieldAlert} accent="red"   />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="glass rounded-3xl flex flex-col items-center justify-center py-24 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.2)" }}>
              <FolderOpen size={28} className="text-blue-400" />
            </div>
            <p className="font-display font-bold text-xl text-ink-1 mb-2 tracking-tight">No projects yet</p>
            <p className="text-ink-3 text-sm mb-8 font-light">Create your first project to start managing scripts</p>
            <button onClick={() => setModal(true)} className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 text-sm">
              <Plus size={14} /> Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p, i) => (
              <div key={p.id} className="glass glass-hover rounded-2xl overflow-hidden animate-fade-up"
                style={{ animationDelay:`${i*0.05}s` }}>
                <Link href={`/dashboard/${p.id}`} className="block p-5">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background:"rgba(37,99,235,0.12)", border:"1px solid rgba(37,99,235,0.25)" }}>
                      <FolderOpen size={17} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-ink-1 tracking-tight truncate">{p.name}</h3>
                      {p.description && <p className="text-xs text-ink-3 mt-1 truncate font-light">{p.description}</p>}
                    </div>
                    <ChevronRight size={16} className="text-ink-3 mt-0.5 flex-shrink-0" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label:"Scripts", val:p.script_count||0,    color:"text-ink-1" },
                      { label:"Runs",    val:p.total_executions||0, color:"text-green-400" },
                      { label:"Hooks",   val:p.hook_attempts||0,    color:p.hook_attempts?"text-red-400":"text-ink-3" },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl py-2.5 text-center"
                        style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
                        <p className={`font-display font-bold text-xl ${s.color} leading-none`}>{s.val}</p>
                        <p className="text-[10px] text-ink-3 mt-1 font-medium tracking-wide uppercase">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </Link>
                <div className="px-5 pb-4">
                  <button onClick={() => del(p.id, p.name)}
                    className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-red-400 transition-colors font-medium">
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setModal(false)} />
          <div className="relative glass-strong rounded-3xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
              <h2 className="font-display font-bold text-ink-1 tracking-tight">New Project</h2>
              <button onClick={() => setModal(false)} className="text-ink-3 hover:text-ink-1 transition-colors p-1"><X size={16}/></button>
            </div>
            <form onSubmit={create} className="p-6 space-y-5">
              {[
                { key:"name",        label:"Project Name", placeholder:"My Script Collection",   required:true  },
                { key:"description", label:"Description",  placeholder:"What this project does…", required:false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-ink-2 mb-2 tracking-wide uppercase">{f.label}</label>
                  <input required={f.required} value={(form as any)[f.key]}
                    onChange={e => setForm({...form, [f.key]: e.target.value})}
                    placeholder={f.placeholder} className="input-glass w-full px-4 py-3 rounded-xl text-sm" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost flex-1 py-3 rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1 py-3 rounded-xl text-sm disabled:opacity-50">
                  {creating ? "Creating…" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nav tabs ──────────────────────────────────────────────────────────────────
const DASH_TABS: NavTab[] = [
  { id:"project", label:"Project", Icon: FolderKanban as any },
  { id:"account", label:"Account", Icon: User as any },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [tab, setTab] = useState<"project"|"account">("project");

  return (
    <Sidebar>
      {/* Full-screen — content fills everything, bar floats on top */}
      <div className="relative h-full overflow-hidden">

        {/* Content scrolls under the floating bar */}
        <div className="h-full overflow-hidden" key={tab}>
          <div className="animate-tab-in h-full flex flex-col" style={{ paddingBottom: 88 }}>
            {tab === "project" && <ProjectsPanel />}
            {tab === "account" && <AccountPanel />}
          </div>
        </div>

        {/* Floating liquid nav — compact, bottom-left */}
        <div style={{
          position: "fixed",
          bottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
          left: 16,
          width: "min(220px, calc(100vw - 32px))",
          zIndex: 50,
        }}>
          <RightSidebarNav tabs={DASH_TABS} active={tab} onChange={setTab as any} />
        </div>

      </div>
    </Sidebar>
  );
}
