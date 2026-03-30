"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Code2, ToggleLeft, ToggleRight, Trash2, Download,
  ChevronDown, ChevronUp, ShieldAlert, Activity, X, Pencil,
  RefreshCw, Upload, FileCode, Cpu, Layers, FolderOpen,
  Radio, Settings, Key, Ban, UserCheck, Plus, Copy, Eye, EyeOff,
  AlertTriangle, Check, Zap, Lock, RotateCcw
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Sidebar from "@/components/Sidebar";
import CodeBlock from "@/components/CodeBlock";
import { RightSidebarNav, NavTab } from "@/components/RightSidebarNav";
import { api } from "@/lib/api";

// ── Project Tab Nav ──────────────────────────────────────────────────────────
const PROJECT_TABS: NavTab[] = [
  { id: "files",      label: "Files",    Icon: FolderOpen as any },
  { id: "livefeed",   label: "Live Feed",Icon: Radio as any      },
  { id: "management", label: "Manage",   Icon: Settings as any   },
  { id: "keysystem",  label: "Keys",     Icon: Key as any        },
];
type ProjTab = "files" | "livefeed" | "management" | "keysystem";


// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`toggle-track ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <div className="toggle-thumb" />
    </div>
  );
}

// ── ObfBadge ─────────────────────────────────────────────────────────────────
function ObfBadge({ level }: { level: number }) {
  const cfg = level >= 2
    ? { label:"VM",  color:"text-purple-400", bg:"rgba(168,85,247,0.1)", border:"rgba(168,85,247,0.25)" }
    : { label:"CFF", color:"text-blue-400",   bg:"rgba(59,130,246,0.1)", border:"rgba(59,130,246,0.25)" };
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.color}`}
      style={{ background:cfg.bg, border:`1px solid ${cfg.border}` }}>
      <Layers size={9} /> {cfg.label}
    </span>
  );
}

// ── ScriptCard ───────────────────────────────────────────────────────────────
function ScriptCard({ script, onToggle, onDelete, onLoader, onMetrics }: any) {
  const [expanded, setExpanded] = useState(false);
  const [src, setSrc]           = useState("");
  const [saving, setSaving]     = useState(false);
  const [obfLevel, setObfLevel] = useState(script.obf_level || 1);

  const save = async () => {
    if (!src.trim()) return;
    setSaving(true);
    try { await api.updateScript(script.id, { source: src, obf_level: obfLevel }); toast.success("Updated"); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className={`glass rounded-2xl overflow-hidden transition-all ${!script.active ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${script.active ? "status-active" : "status-off"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{script.name}</p>
          {script.description && <p className="text-xs text-white/30 mt-0.5 truncate font-light">{script.description}</p>}
        </div>
        <div className="hidden sm:flex gap-2 flex-shrink-0 items-center">
          <ObfBadge level={script.obf_level || 1} />
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400 px-2 py-1 rounded-full"
            style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.2)" }}>
            <Activity size={9} /> {script.executions || 0}
          </span>
          {(script.hook_attempts || 0) > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 px-2 py-1 rounded-full"
              style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)" }}>
              <ShieldAlert size={9} /> {script.hook_attempts}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {[
            { icon: script.active ? ToggleRight : ToggleLeft, fn: () => onToggle(script),          cls: script.active ? "text-blue-400" : "text-white/30" },
            { icon: Download,                                  fn: () => onLoader(script.id),        cls: "text-white/30 hover:text-blue-400" },
            { icon: Activity,                                  fn: () => onMetrics(script.id),       cls: "text-white/30 hover:text-green-400" },
            { icon: expanded ? ChevronUp : ChevronDown,        fn: () => setExpanded(!expanded),     cls: "text-white/30 hover:text-white" },
            { icon: Trash2,                                    fn: () => onDelete(script),           cls: "text-white/30 hover:text-red-400" },
          ].map((btn, i) => (
            <button key={i} onClick={btn.fn} className={`p-2 rounded-lg transition-colors ${btn.cls}`}>
              <btn.icon size={14} />
            </button>
          ))}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Update Source</p>
          <div className="flex gap-2 mb-3">
            {[{v:1,label:"Level 1 — CFF",icon:FileCode},{v:2,label:"Level 2 — VM",icon:Cpu}].map(opt => (
              <button key={opt.v} type="button" onClick={() => setObfLevel(opt.v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${obfLevel===opt.v?"text-white":"text-white/30"}`}
                style={obfLevel===opt.v?{background:"rgba(37,99,235,0.25)",border:"1px solid rgba(37,99,235,0.5)"}:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                <opt.icon size={11} /> {opt.label}
              </button>
            ))}
          </div>
          <textarea value={src} onChange={e => setSrc(e.target.value)} rows={6}
            placeholder="# Paste source code mới…" className="input-glass w-full p-3 rounded-xl font-mono text-xs resize-y" />
          <button onClick={save} disabled={saving||!src.trim()}
            className="btn-primary mt-3 px-4 py-2 rounded-xl text-xs flex items-center gap-2 disabled:opacity-40">
            {saving ? <><RefreshCw size={12} className="animate-spin"/>Saving…</> : <><Pencil size={12}/>Update</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── MetricsDrawer ────────────────────────────────────────────────────────────
function MetricsDrawer({ scriptId, onClose }: { scriptId: string; onClose: () => void }) {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getMetrics(scriptId).then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [scriptId]);
  const TT = ({ active, payload, label }: any) => {
    if (!active||!payload?.length) return null;
    return <div className="glass rounded-xl px-3 py-2.5 text-xs"><p className="text-white/30 mb-1.5">{label}</p><p className="text-green-400 font-semibold">Runs: {payload[0]?.value}</p><p className="text-red-400 font-semibold">Hooks: {payload[1]?.value}</p></div>;
  };
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md h-full overflow-auto animate-slide-right"
        style={{ background:"rgba(10,10,18,0.96)", backdropFilter:"blur(40px)", borderLeft:"1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between px-6 py-5 sticky top-0 z-10"
          style={{ background:"rgba(10,10,18,0.9)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="font-display font-bold text-white tracking-tight">Script Metrics</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white p-1"><X size={16}/></button>
        </div>
        {loading ? <div className="p-6 space-y-3">{[1,2].map(i=><div key={i} className="skeleton h-20 rounded-2xl"/>)}</div>
        : data ? (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                {label:"Total Runs",   val:data.total_runs,    color:"text-blue-400"},
                {label:"Unique IPs",   val:data.unique_ips,    color:"text-green-400"},
                {label:"Devices",      val:data.unique_devices,color:"text-purple-400"},
                {label:"Hook Attempts",val:data.total_hooks,   color:"text-red-400"},
              ].map(s=>(
                <div key={s.label} className="glass rounded-2xl p-4 text-center">
                  <p className={`font-display font-bold text-3xl ${s.color} leading-none`}>{s.val}</p>
                  <p className="text-[10px] text-white/30 mt-2 font-semibold uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
            {data.daily?.length>0 && (
              <div className="glass rounded-2xl p-4">
                <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Last 7 days</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.daily} margin={{top:5,right:5,left:-25,bottom:0}}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="day" tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}}/>
                    <YAxis tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}}/>
                    <Tooltip content={<TT/>}/>
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="hooks" stroke="#ef4444" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : <p className="p-6 text-white/30 text-sm">Không có dữ liệu</p>}
      </div>
    </div>
  );
}

// ==================== TABS ====================

// ── FILES TAB ────────────────────────────────────────────────────────────────
function FilesTab({ project, scripts, onReload, onToggle, onDelete, onLoader, onMetrics, metricsId, onCloseMetrics }: any) {
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState({ name: "", description: "" });
  const [source,     setSource]     = useState("");
  const [obfLevel,   setObfLevel]   = useState(1);
  const [uploading,  setUploading]  = useState(false);
  const [uploadMode, setUploadMode] = useState<"paste"|"file">("paste");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 10*1024*1024) { toast.error("File quá lớn (max 10MB)"); return; }
    const r = new FileReader(); r.onload = ev => setSource((ev.target?.result as string)||""); r.readAsText(f);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !source.trim()) { toast.error("Cần tên và source code"); return; }
    setUploading(true);
    try {
      await api.createScript(project.id, { ...form, source, obf_level: obfLevel });
      toast.success("Đã thêm script"); setModal(false); setForm({ name:"", description:"" }); setSource(""); onReload();
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-bold text-white text-lg tracking-tight">Files</h2>
            <p className="text-white/30 text-xs mt-0.5">Upload & quản lý script — tối đa 10MB/file</p>
          </div>
          <button onClick={() => setModal(true)} className="btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
            <Plus size={13}/> Add Script
          </button>
        </div>

        {scripts.length === 0 ? (
          <div className="glass rounded-2xl py-16 text-center">
            <Code2 size={28} className="text-white/20 mx-auto mb-3"/>
            <p className="text-sm font-semibold text-white mb-1">No scripts yet</p>
            <p className="text-xs text-white/30 mb-5">Add your first script</p>
            <button onClick={() => setModal(true)} className="btn-primary px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 mx-auto">
              <Plus size={12}/> Add Script
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {scripts.map((s: any) => (
              <ScriptCard key={s.id} script={s} onToggle={onToggle} onDelete={onDelete} onLoader={onLoader} onMetrics={onMetrics}/>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setModal(false)}/>
          <div className="relative glass-strong rounded-3xl w-full max-w-lg animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <h2 className="font-display font-bold text-white tracking-tight">Add Script</h2>
              <button onClick={() => setModal(false)} className="text-white/30 hover:text-white p-1"><X size={16}/></button>
            </div>
            <form onSubmit={create} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Script Name *</label>
                  <input required value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="main.py" className="input-glass w-full px-3 py-2.5 rounded-xl text-sm"/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Description</label>
                  <input value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Optional" className="input-glass w-full px-3 py-2.5 rounded-xl text-sm"/>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-wider">Obfuscation</label>
                <div className="flex gap-2">
                  {[{v:1,label:"Level 1 — CFF",icon:FileCode},{v:2,label:"Level 2 — VM",icon:Cpu}].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setObfLevel(opt.v)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${obfLevel===opt.v?"text-white":"text-white/30"}`}
                      style={obfLevel===opt.v?{background:"rgba(37,99,235,0.25)",border:"1px solid rgba(37,99,235,0.5)"}:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                      <opt.icon size={11}/> {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Source Code *</label>
                  <div className="flex gap-1">
                    {(["paste","file"] as const).map(m => (
                      <button key={m} type="button" onClick={() => setUploadMode(m)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all ${uploadMode===m?"text-white":"text-white/30"}`}
                        style={uploadMode===m?{background:"rgba(37,99,235,0.2)",border:"1px solid rgba(37,99,235,0.4)"}:{background:"transparent"}}>
                        {m==="paste"?"Paste":"Upload File"}
                      </button>
                    ))}
                  </div>
                </div>
                {uploadMode==="paste" ? (
                  <textarea value={source} onChange={e => setSource(e.target.value)} rows={7}
                    placeholder="# Paste Python code…" className="input-glass w-full p-3 rounded-xl font-mono text-xs resize-y"/>
                ) : (
                  <div>
                    <input ref={fileRef} type="file" accept=".py,.txt,.lua" onChange={handleFile} className="hidden"/>
                    <div onClick={() => fileRef.current?.click()} className="glass rounded-xl p-6 text-center cursor-pointer hover:bg-white/5 transition-colors">
                      <Upload size={20} className="text-white/30 mx-auto mb-2"/>
                      <p className="text-xs text-white/50 font-medium">Click to select file</p>
                      <p className="text-[10px] text-white/20 mt-1">Max 10MB · .py .txt .lua</p>
                    </div>
                    {source && <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1"><Check size={10}/> Loaded ({Math.round(source.length/1024)}KB)</p>}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={uploading} className="btn-primary flex-1 py-2.5 rounded-xl text-sm disabled:opacity-50">
                  {uploading?"Creating…":"Create Script"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {metricsId && <MetricsDrawer scriptId={metricsId} onClose={onCloseMetrics}/>}
    </div>
  );
}

// ── LIVE FEED TAB ────────────────────────────────────────────────────────────
function LiveFeedTab({ project, scripts }: any) {
  const totalRuns  = scripts.reduce((s: number, sc: any) => s + (sc.executions||0), 0);
  const totalHooks = scripts.reduce((s: number, sc: any) => s + (sc.hook_attempts||0), 0);
  const active     = scripts.filter((s: any) => s.active).length;
  const mockChart  = Array.from({length:12},(_,i)=>({ time:`${i*2}h`, runs:Math.floor(Math.random()*80+10), hooks:Math.floor(Math.random()*8) }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 max-w-3xl mx-auto space-y-5">
        <div>
          <h2 className="font-display font-bold text-white text-lg tracking-tight mb-0.5">Live Feed</h2>
          <p className="text-white/30 text-xs">Real-time charts and activity log</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            {label:"Scripts Active",value:active,    color:"text-green-400"},
            {label:"Total Runs",    value:totalRuns,  color:"text-blue-400"},
            {label:"Hook Attempts", value:totalHooks, color:totalHooks>0?"text-red-400":"text-white/30"},
          ].map(s=>(
            <div key={s.label} className="glass rounded-2xl p-4 text-center">
              <p className={`font-display font-bold text-2xl ${s.color} leading-none`}>{s.value}</p>
              <p className="text-[10px] text-white/30 mt-2 font-semibold uppercase tracking-wider leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Activity (24h)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mockChart} margin={{top:5,right:5,left:-25,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="time" tick={{fill:"rgba(255,255,255,0.25)",fontSize:9}}/>
              <YAxis tick={{fill:"rgba(255,255,255,0.25)",fontSize:9}}/>
              <Tooltip contentStyle={{background:"rgba(10,10,18,0.95)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,fontSize:12}}/>
              <Line type="monotone" dataKey="runs"  stroke="#3b82f6" strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="hooks" stroke="#ef4444" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-blue-400"/><span className="text-[10px] text-white/30">Runs</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-red-400"/><span className="text-[10px] text-white/30">Hooks</span></div>
          </div>
        </div>
        {scripts.length>0 && (
          <div className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Per Script</p>
            <div className="space-y-2">
              {scripts.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 py-2" style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.active?"status-active":"status-off"}`}/>
                  <p className="text-sm text-white flex-1 truncate">{s.name}</p>
                  <span className="text-xs text-green-400 font-semibold">{s.executions||0} runs</span>
                  {(s.hook_attempts||0)>0 && <span className="text-xs text-red-400 font-semibold">{s.hook_attempts} hooks</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MANAGEMENT TAB ───────────────────────────────────────────────────────────
function ManagementTab({ project }: any) {
  const [banned,    setBanned]    = useState<any[]>([]);
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [newBan,    setNewBan]    = useState("");
  const [newWl,     setNewWl]     = useState("");
  const [loading,   setLoading]   = useState(true);

  const load = async () => {
    try {
      const [b, w] = await Promise.all([api.getBanned(project.id), api.getWhitelist(project.id)]);
      setBanned(b); setWhitelist(w);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [project.id]);

  const banHwid = async () => {
    const h = newBan.trim(); if (!h) return;
    try { await api.banHwid(project.id, h); setNewBan(""); load(); toast.success("HWID banned"); }
    catch (e: any) { toast.error(e.message); }
  };
  const unban = async (id: string) => {
    try { await api.unbanHwid(project.id, id); load(); toast.success("Unbanned"); }
    catch (e: any) { toast.error(e.message); }
  };
  const addWl = async () => {
    const h = newWl.trim(); if (!h) return;
    try { await api.addWhitelist(project.id, h); setNewWl(""); load(); toast.success("Added to whitelist"); }
    catch (e: any) { toast.error(e.message); }
  };
  const removeWl = async (id: string) => {
    try { await api.removeWhitelist(project.id, id); load(); toast.success("Deleted khỏi whitelist"); }
    catch (e: any) { toast.error(e.message); }
  };

  const HwidList = ({ items, color, onRemove }: { items: any[]; color: string; onRemove: (id:string) => void }) => (
    items.length === 0 ? (
      <p className="text-xs text-white/25 text-center py-4">Trống</p>
    ) : (
      <div className="space-y-1.5 max-h-44 overflow-y-auto">
        {items.map(it => (
          <div key={it.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{background:`rgba(${color},0.06)`,border:`1px solid rgba(${color},0.2)`}}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-white/70 truncate">{it.hwid}</p>
              {it.note && <p className="text-[10px] text-white/30 mt-0.5">{it.note}</p>}
            </div>
            <button onClick={() => onRemove(it.id)} className="text-white/20 hover:text-red-400 p-1 ml-2 flex-shrink-0">
              <X size={12}/>
            </button>
          </div>
        ))}
      </div>
    )
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 max-w-3xl mx-auto space-y-5">
        <div>
          <h2 className="font-display font-bold text-white text-lg tracking-tight mb-0.5">Management</h2>
          <p className="text-white/30 text-xs">Manage HWID blacklist and whitelist</p>
        </div>

        {/* Blacklist */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)"}}>
              <Ban size={13} className="text-red-400"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">HWID Blacklist</p>
              <p className="text-[10px] text-white/30">Banned devices cannot run scripts</p>
            </div>
            <span className="ml-auto text-xs font-bold text-red-400">{banned.length}</span>
          </div>
          <div className="flex gap-2 mb-3">
            <input value={newBan} onChange={e => setNewBan(e.target.value)}
              placeholder="Hardware ID…" className="input-glass flex-1 px-3 py-2.5 rounded-xl text-sm"
              onKeyDown={e => e.key==="Enter" && banHwid()}/>
            <button onClick={banHwid} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
              <Ban size={12}/> Ban
            </button>
          </div>
          {loading ? <div className="skeleton h-12 rounded-xl"/> : <HwidList items={banned} color="239,68,68" onRemove={unban}/>}
        </div>

        {/* Whitelist */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.25)"}}>
              <UserCheck size={13} className="text-green-400"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">HWID Whitelist</p>
              <p className="text-[10px] text-white/30">Bypass key restrictions for trusted devices</p>
            </div>
            <span className="ml-auto text-xs font-bold text-green-400">{whitelist.length}</span>
          </div>
          <div className="flex gap-2 mb-3">
            <input value={newWl} onChange={e => setNewWl(e.target.value)}
              placeholder="Hardware ID…" className="input-glass flex-1 px-3 py-2.5 rounded-xl text-sm"
              onKeyDown={e => e.key==="Enter" && addWl()}/>
            <button onClick={addWl} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
              <UserCheck size={12}/> Add
            </button>
          </div>
          {loading ? <div className="skeleton h-12 rounded-xl"/> : <HwidList items={whitelist} color="34,197,94" onRemove={removeWl}/>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-2xl p-4 text-center">
            <p className="font-display font-bold text-2xl text-red-400 leading-none">{banned.length}</p>
            <p className="text-[10px] text-white/30 mt-2 font-semibold uppercase tracking-wider">Banned HWIDs</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <p className="font-display font-bold text-2xl text-green-400 leading-none">{whitelist.length}</p>
            <p className="text-[10px] text-white/30 mt-2 font-semibold uppercase tracking-wider">Whitelisted</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KEY SYSTEM TAB ───────────────────────────────────────────────────────────
function KeySystemTab({ project, scripts }: any) {
  const [cfg, setCfg] = useState<any>({ role_management:false, free_script_id:null, paid_script_id:null, force_getkey:false });
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [genType, setGenType]   = useState<"free"|"paid">("free");
  const [generating, setGenerating] = useState(false);
  const [showKey, setShowKey]   = useState<Record<string,boolean>>({});

  const load = async () => {
    try {
      const [c, k] = await Promise.all([api.getLoaderConfig(project.id), api.listKeys(project.id)]);
      setCfg(c); setKeys(k);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [project.id]);

  const saveCfg = async () => {
    setSaving(true);
    try { await api.saveLoaderConfig(project.id, cfg); toast.success("Config saved"); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const genKey = async () => {
    setGenerating(true);
    try { const k = await api.createKey(project.id, { tier: genType }); setKeys(prev => [k, ...prev]); toast.success(`Key ${genType} đã tạo`); }
    catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const delKey = async (kid: string) => {
    try { await api.deleteKey(project.id, kid); setKeys(prev => prev.filter(k => k.id !== kid)); toast.success("Deleted key"); }
    catch (e: any) { toast.error(e.message); }
  };

  const resetHwid = async (kid: string) => {
    try { await api.resetKeyHwid(project.id, kid); load(); toast.success("HWID reset"); }
    catch (e: any) { toast.error(e.message); }
  };

  const copyKey = (k: string) => { navigator.clipboard.writeText(k); toast.success("Copied"); };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 max-w-3xl mx-auto space-y-5">
        <div>
          <h2 className="font-display font-bold text-white text-lg tracking-tight mb-0.5">Key System</h2>
          <p className="text-white/30 text-xs">Manage keys and configure loader access</p>
        </div>

        {/* Loader Config */}
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Loader Configuration</p>
          {loading ? <div className="skeleton h-24 rounded-xl"/> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2" style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <div>
                  <p className="text-sm font-semibold text-white">Role Management</p>
                  <p className="text-[11px] text-white/35 mt-0.5">Free/Paid script access control</p>
                </div>
                <Toggle on={cfg.role_management} onChange={v => setCfg({...cfg, role_management:v, ...(v?{}:{force_getkey:false})})}/>
              </div>

              {!cfg.role_management ? (
                <div className="glass rounded-xl p-4" style={{borderColor:"rgba(37,99,235,0.2)",background:"rgba(37,99,235,0.05)"}}>
                  <div className="flex items-center gap-2 mb-1"><Zap size={12} className="text-blue-400"/><p className="text-xs font-semibold text-white">Single Script Mode</p></div>
                  <p className="text-[11px] text-white/40">Loader auto-runs the only script in this project — no key required.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium text-white">Force GetKey</p><p className="text-[11px] text-white/35 mt-0.5">Free users must obtain a key before running</p></div>
                    <Toggle on={cfg.force_getkey} onChange={v => setCfg({...cfg, force_getkey:v})}/>
                  </div>
                  {scripts.length>0 && (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-wider">Free Key → Script</label>
                        <select value={cfg.free_script_id||""} onChange={e => setCfg({...cfg,free_script_id:e.target.value||null})} className="input-glass w-full px-3 py-2.5 rounded-xl text-sm">
                          <option value="">— Disabled (no access) —</option>
                          {scripts.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-wider">Paid Key → Script</label>
                        <select value={cfg.paid_script_id||""} onChange={e => setCfg({...cfg,paid_script_id:e.target.value||null})} className="input-glass w-full px-3 py-2.5 rounded-xl text-sm">
                          <option value="">— Disabled (no access) —</option>
                          {scripts.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}

              <button onClick={saveCfg} disabled={saving} className="btn-primary w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving?<><RefreshCw size={13} className="animate-spin"/>Saving…</>:<><Check size={13}/>Save Config</>}
              </button>
            </div>
          )}
        </div>

        {/* Generate Key */}
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Generate Key</p>
          <div className="flex items-center gap-2 mb-3">
            {(["free","paid"] as const).map(t=>(
              <button key={t} onClick={()=>setGenType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${genType===t?"text-white":"text-white/30"}`}
                style={genType===t?{background:"rgba(37,99,235,0.25)",border:"1px solid rgba(37,99,235,0.5)"}:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                {t==="free"?"🔑 Free":"⭐ Paid"}
              </button>
            ))}
          </div>
          <button onClick={genKey} disabled={generating}
            className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {generating?<><RefreshCw size={13} className="animate-spin"/>Creating…</>:<><Key size={13}/>Generate Key {genType}</>}
          </button>
        </div>

        {/* Key List */}
        {keys.length>0 && (
          <div className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Generated Keys ({keys.length})</p>
            <div className="space-y-2">
              {keys.map(k=>(
                <div key={k.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{background:k.tier==="paid"?"rgba(168,85,247,0.06)":"rgba(37,99,235,0.06)",border:`1px solid ${k.tier==="paid"?"rgba(168,85,247,0.2)":"rgba(37,99,235,0.2)"}`}}>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${k.tier==="paid"?"text-purple-300":"text-blue-300"}`}
                    style={{background:k.tier==="paid"?"rgba(168,85,247,0.15)":"rgba(37,99,235,0.15)"}}>
                    {k.tier.toUpperCase()}
                  </span>
                  <span className="flex-1 text-xs font-mono text-white/60 truncate">
                    {showKey[k.id]?k.key:k.key.replace(/./g,(_c,i)=>i<8?_c:"•")}
                  </span>
                  {k.hwid && <span title="HWID locked" className="text-[9px] text-yellow-400/70 px-1.5 py-0.5 rounded-full flex-shrink-0" style={{background:"rgba(234,179,8,0.08)",border:"1px solid rgba(234,179,8,0.2)"}}>LOCKED</span>}
                  <button onClick={()=>setShowKey(s=>({...s,[k.id]:!s[k.id]}))} className="text-white/30 hover:text-white p-1 flex-shrink-0">{showKey[k.id]?<EyeOff size={12}/>:<Eye size={12}/>}</button>
                  <button onClick={()=>copyKey(k.key)} className="text-white/30 hover:text-blue-400 p-1 flex-shrink-0"><Copy size={12}/></button>
                  {k.hwid && <button onClick={()=>resetHwid(k.id)} title="Reset HWID" className="text-white/30 hover:text-yellow-400 p-1 flex-shrink-0"><RotateCcw size={12}/></button>}
                  <button onClick={()=>delKey(k.id)} className="text-white/30 hover:text-red-400 p-1 flex-shrink-0"><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project,     setProject]     = useState<any>(null);
  const [scripts,     setScripts]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<ProjTab>("files");
  const [loaderModal, setLoaderModal] = useState<string|null>(null);
  const [loaderCode,  setLoaderCode]  = useState("");
  const [metricsId,   setMetricsId]   = useState<string|null>(null);

  const loadAll = async () => {
    try {
      const proj = await api.getProject(projectId);
      setProject(proj);
      // Try to get scripts; if they're embedded in project, use that
      const scr = proj.scripts ?? await api.scripts(projectId).catch(() => []);
      setScripts(scr);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); }, [projectId]);

  const handleToggle = async (s: any) => {
    try {
      await api.updateScript(s.id, { active: !s.active });
      setScripts(prev => prev.map(x => x.id===s.id ? {...x,active:!x.active} : x));
    } catch (e: any) { toast.error(e.message); }
  };
  const handleDelete = async (s: any) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try { await api.deleteScript(s.id); toast.success("Deleted"); setScripts(prev => prev.filter(x => x.id!==s.id)); }
    catch (e: any) { toast.error(e.message); }
  };
  const handleLoader = async (id: string) => {
    try { const r = await api.getLoader(id); setLoaderCode(r.loader); setLoaderModal(id); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return (
    <Sidebar>
      <div className="relative h-full overflow-hidden">
        <div className="p-6 space-y-4 max-w-3xl mx-auto" style={{ paddingBottom: 96 }}>
          {[1,2,3].map(i=><div key={i} className="skeleton h-20 rounded-2xl"/>)}
        </div>
        <div style={{
          position:"fixed",
          bottom:"max(env(safe-area-inset-bottom,0px),16px)",
          left:16, zIndex:50,
          width:"min(260px,calc(100vw - 32px))",
        }}>
          <RightSidebarNav tabs={PROJECT_TABS} active="files" onChange={()=>{}}/>
        </div>
      </div>
    </Sidebar>
  );

  return (
    <Sidebar>
      <div className="relative h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)"}}>
          <Link href="/dashboard" className="text-white/30 hover:text-white transition-colors p-1 -ml-1">
            <ArrowLeft size={16}/>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-white tracking-tight truncate">{project?.name||"Project"}</h1>
            {project?.description && <p className="text-xs text-white/30 truncate font-light">{project.description}</p>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full status-active"/>
            <span className="text-[10px] text-white/40">{scripts.filter(s=>s.active).length}/{scripts.length} active</span>
          </div>
        </div>

        {/* Tab content — fills remaining height, content scrolls under the floating bar */}
        <div className="h-full overflow-hidden" key={tab}>
          <div className="animate-tab-in h-full" style={{ paddingBottom: 88 }}>
            {tab==="files"      && <FilesTab      project={project} scripts={scripts} onReload={loadAll} onToggle={handleToggle} onDelete={handleDelete} onLoader={handleLoader} onMetrics={setMetricsId} metricsId={metricsId} onCloseMetrics={()=>setMetricsId(null)}/>}
            {tab==="livefeed"   && <LiveFeedTab   project={project} scripts={scripts}/>}
            {tab==="management" && <ManagementTab project={project}/>}
            {tab==="keysystem"  && <KeySystemTab  project={project} scripts={scripts}/>}
          </div>
        </div>

        {/* Liquid nav — centered at bottom */}
        <div style={{
          position:"fixed",
          bottom:"max(env(safe-area-inset-bottom,0px),16px)",
          left:"50%",
          transform:"translateX(-50%)",
          zIndex:50,
          width:"min(360px,calc(100vw - 32px))",
        }}>
          <RightSidebarNav tabs={PROJECT_TABS} active={tab} onChange={setTab as any}/>
        </div>
      </div>

      {/* Loader Modal */}
      {loaderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={()=>setLoaderModal(null)}/>
          <div className="relative glass-strong rounded-3xl w-full max-w-lg animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <h2 className="font-display font-bold text-white tracking-tight">Loader Code</h2>
              <button onClick={()=>setLoaderModal(null)} className="text-white/30 hover:text-white p-1"><X size={16}/></button>
            </div>
            <div className="p-5">
              <CodeBlock code={loaderCode} language="python"/>
              <button onClick={()=>{navigator.clipboard.writeText(loaderCode);toast.success("Copied");}}
                className="btn-primary mt-3 w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                <Copy size={13}/> Copy Loader
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
  }
