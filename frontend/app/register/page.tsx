"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import toast from "react-hot-toast";
import { api, saveAuth } from "@/lib/api";
import { ensureTurnstileLoaded } from "@/lib/turnstile";

export default function RegisterPage() {
  const router = useRouter();
  const [form,    setForm]    = useState({ username: "", email: "", password: "" });
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [cfToken, setCfToken] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId  = useRef<string>("");

  useEffect(() => {
    const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
    let disposed = false;
    ensureTurnstileLoaded()
      .then(() => {
        if (disposed || widgetId.current || !widgetRef.current || !(window as any).turnstile) return;
        widgetId.current = (window as any).turnstile.render(widgetRef.current, {
          sitekey: SITE_KEY, theme: "dark", size: "normal",
          callback: (t: string) => setCfToken(t),
          "expired-callback": () => setCfToken(""),
        });
      })
      .catch((err: Error) => {
        toast.error(`Turnstile unavailable: ${err.message}`);
      });
    return () => {
      disposed = true;
      try { if ((window as any).turnstile && widgetId.current) { (window as any).turnstile.remove(widgetId.current); widgetId.current = ""; } } catch (_) {}
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!cfToken) { toast.error("Please complete Cloudflare Turnstile first"); return; }
    setLoading(true);
    try {
      try { await api.verifyTurnstile(cfToken); } catch (_) {}
      const res = await api.register(form);
      saveAuth(res.token, res.user);
      toast.success(`Welcome, ${res.user.username}!`);
      router.push("/dashboard");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const pwStrength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : 3;
  const strengthColor = ["","bg-red-500","bg-yellow-500","bg-green-500"][pwStrength];
  const strengthLabel = ["","Weak","Medium","Strong"][pwStrength];

  return (
    <main className="min-h-screen bg-[#08080f] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="orb w-[500px] h-[500px] -top-40 -left-40 opacity-20"
        style={{ background: "radial-gradient(circle,#2563eb,transparent 70%)" }} />
      <div className="orb w-[400px] h-[400px] -bottom-40 -right-40 opacity-15"
        style={{ background: "radial-gradient(circle,#7c3aed,transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        <div className="text-center mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/exe-logo.png" alt="ExeGuard" width={52} height={52} className="mx-auto mb-4" style={{ objectFit:"contain" }} />
          <h1 className="font-display font-bold text-2xl text-white tracking-tight">Create account</h1>
          <p className="text-white/40 text-sm mt-1 font-light">Free forever, no credit card required</p>
        </div>

        <div className="glass-strong rounded-3xl p-7">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Username</label>
              <input type="text" required minLength={3} value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="yourname" className="input-glass w-full px-4 py-3 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" required value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com" className="input-glass w-full px-4 py-3 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input type={show ? "text" : "password"} required value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••" className="input-glass w-full px-4 py-3 pr-11 rounded-xl text-sm" />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1,2,3].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= pwStrength ? strengthColor : "bg-white/10"}`} />)}
                  </div>
                  <span className="text-[10px] text-white/30">{strengthLabel}</span>
                </div>
              )}
            </div>

            {/* Cloudflare Turnstile */}
            <div style={{ display:"flex", justifyContent:"center", minHeight: 65 }}>
              <div ref={widgetRef} />
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
              {loading ? "Creating…" : <><span>Create Account</span><ArrowRight size={14} /></>}
            </button>
          </form>

          <div className="mt-4 space-y-1.5">
            {["Free forever","No credit card","AES-256 encryption"].map(t => (
              <div key={t} className="flex items-center gap-2">
                <Check size={11} className="text-green-400" />
                <span className="text-[11px] text-white/35">{t}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-center text-sm text-white/30">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Sign in →</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
