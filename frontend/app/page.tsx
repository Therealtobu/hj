"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home as HomeIcon, BookOpen, Tag, LogIn as LoginIcon, ArrowRight,
  Shield, Lock, BarChart2, Key, Users, Check,
  Zap, ChevronDown, ChevronUp, Terminal, UserPlus, Star, AlertTriangle
} from "lucide-react";
import { api } from "@/lib/api";
import { ensureTurnstileLoaded } from "@/lib/turnstile";

// ── Liquid Glass Bottom Nav ──────────────────────────────────────────────────
const LANDING_TABS = [
  { id: "home",     label: "Home",     Icon: HomeIcon  },
  { id: "tutorial", label: "Tutorial", Icon: BookOpen  },
  { id: "price",    label: "Pricing",  Icon: Tag       },
  { id: "login",    label: "Account",  Icon: LoginIcon },
] as const;
type TabId = typeof LANDING_TABS[number]["id"];

function LiquidNav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const N = LANDING_TABS.length;
  const PAD = 4, IH = 56;

  /* ── Spring ── */
  class Spring {
    k:number; c:number; value:number; vel:number; target:number;
    constructor(k=300,c=30){this.k=k;this.c=c;this.value=0;this.vel=0;this.target=0;}
    to(t:number){this.target=t;}
    snap(v:number){this.value=v;this.target=v;this.vel=0;}
    tick(dt:number){
      const s=Math.min(dt,0.05);
      const f=-this.k*(this.value-this.target)-this.c*this.vel;
      this.vel+=f*s; this.value+=this.vel*s;
    }
  }
  const cl = (v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
  const lp = (a:number,b:number,t:number)=>a+(b-a)*t;

  const activeIdx = LANDING_TABS.findIndex(t => t.id === active);

  const barRef     = useRef<HTMLDivElement>(null);
  const indRef     = useRef<HTMLDivElement>(null);
  const accentRef  = useRef<HTMLDivElement>(null);
  const indGlowRef = useRef<HTMLDivElement>(null);
  const indShimRef = useRef<HTMLDivElement>(null);
  const chromaLRef = useRef<HTMLDivElement>(null);
  const chromaRRef = useRef<HTMLDivElement>(null);

  const posSpring   = useRef(new Spring(280,26));
  const pressSpring = useRef(new Spring(380,34));
  const st = useRef({barW:0,tabW:0,velPx:0,dragging:false,startX:0,lastX:0,lastT:0});

  const measure = useCallback(()=>{
    if(!barRef.current) return;
    const barW = barRef.current.offsetWidth;
    const tabW = (barW - PAD*2) / N;
    st.current.barW = barW; st.current.tabW = tabW;
    if(accentRef.current){
      accentRef.current.style.width  = (barW-PAD*2)+"px";
      accentRef.current.style.height = IH+"px";
    }
  },[N]);

  const renderFrame = useCallback(()=>{
    const ind = indRef.current, accent = accentRef.current;
    if(!ind||!accent||!st.current.tabW) return;
    const {tabW} = st.current;
    const pos   = posSpring.current.value;
    const press = cl(pressSpring.current.value,0,1);
    const v     = st.current.velPx/tabW/10;
    const vx    = cl(v*0.70,-0.18,0.18);
    const vy    = cl(v*0.20,-0.08,0.08);
    const pe    = lp(0,0.18,press);
    const indW  = tabW + tabW*(Math.abs(vx)+pe);
    const indH  = Math.round(IH*cl(1-Math.abs(vy)+pe*0.5,0.88,1.0))+lp(0,10,press);
    const indL  = PAD + pos*tabW + tabW/2 - indW/2;
    const indTop = 4 + (IH-indH)/2;

    ind.style.width  = indW.toFixed(2)+"px";
    ind.style.height = indH+"px";
    ind.style.top    = indTop.toFixed(2)+"px";
    ind.style.left   = indL.toFixed(2)+"px";

    const rimA = lp(0.22,0.48,press);
    ind.style.background = `rgba(255,255,255,${lp(0.09,0.16,press).toFixed(3)})`;
    ind.style.boxShadow  =
      `0 0 0 1.5px rgba(255,255,255,${(rimA*0.55).toFixed(3)}),`+
      `inset 0 1.5px 0 rgba(255,255,255,${rimA.toFixed(3)}),`+
      `inset 0 -1px 0 rgba(0,0,0,0.12),`+
      `0 8px 32px rgba(0,145,255,${(press*0.25).toFixed(3)})`;

    if(indGlowRef.current) indGlowRef.current.style.opacity=(press*0.9).toFixed(3);
    accent.style.left = ((indW-tabW)/2 - pos*tabW).toFixed(2)+"px";

    const cv=cl(Math.abs(v),0,1), cd=v>0?1:-1;
    const lead=lp(0.1,0.8,cv), trail=lp(0.3,1.0,cv);
    if(chromaLRef.current) chromaLRef.current.style.opacity=(cd>0?trail:lead).toFixed(3);
    if(chromaRRef.current) chromaRRef.current.style.opacity=(cd>0?lead:trail).toFixed(3);

    const sv=cl(Math.abs(v)*1.5,0,1);
    if(indShimRef.current){
      if(sv>0.05){
        indShimRef.current.style.background=v>0
          ?"linear-gradient(105deg,rgba(255,180,60,0.18) 0%,rgba(60,220,255,0.12) 100%)"
          :"linear-gradient(75deg,rgba(60,220,255,0.18) 0%,rgba(255,80,180,0.12) 100%)";
        indShimRef.current.style.opacity=sv.toFixed(3);
      } else indShimRef.current.style.opacity="0";
    }
  },[]);

  const rafRef = useRef<number>(0);
  const prevTs = useRef<number>(0);

  useEffect(()=>{
    measure(); posSpring.current.snap(activeIdx);
    const loop=(ts:number)=>{
      const dt=Math.min((ts-(prevTs.current||ts))/1000,0.05);
      prevTs.current=ts;
      posSpring.current.tick(dt); pressSpring.current.tick(dt);
      if(!st.current.dragging) st.current.velPx*=Math.pow(0.65,dt*60);
      renderFrame();
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    window.addEventListener("resize",measure);
    return()=>{cancelAnimationFrame(rafRef.current);window.removeEventListener("resize",measure);};
  },[measure,renderFrame,activeIdx]);

  const getX=(e:any)=>e.changedTouches?.length?e.changedTouches[0].clientX:e.touches?.length?e.touches[0].clientX:e.clientX;

  const onDown=useCallback((e:any)=>{
    const s=st.current;
    s.dragging=true; s.startX=s.lastX=getX(e);
    s.lastT=performance.now(); s.velPx=0;
    pressSpring.current.to(1);
  },[]);

  const onMove=useCallback((e:any)=>{
    const s=st.current; if(!s.dragging) return;
    e.preventDefault?.();
    const x=getX(e),now=performance.now();
    const dt=(now-s.lastT)/1000,dx=x-s.lastX;
    if(dt>0) s.velPx=dx/dt;
    const newPos=cl(posSpring.current.target+dx/s.tabW,0,N-1);
    posSpring.current.to(newPos);
    posSpring.current.value=lp(posSpring.current.value,newPos,0.22);
    s.lastX=x; s.lastT=now;
  },[N]);

  const onUp=useCallback((e:any)=>{
    const s=st.current; if(!s.dragging) return;
    s.dragging=false;
    const drag=Math.abs(getX(e)-s.startX);
    let idx:number;
    if(drag<10){
      const rect=barRef.current!.getBoundingClientRect();
      idx=cl(Math.floor((getX(e)-rect.left-PAD)/s.tabW),0,N-1);
    } else {
      idx=cl(Math.round(posSpring.current.value),0,N-1);
    }
    posSpring.current.to(idx);
    pressSpring.current.to(0);
    onChange(LANDING_TABS[idx].id);
  },[N,onChange]);

  useEffect(()=>{
    window.addEventListener("mousemove",onMove);
    window.addEventListener("touchmove",onMove,{passive:false});
    window.addEventListener("mouseup",onUp);
    window.addEventListener("touchend",onUp);
    return()=>{
      window.removeEventListener("mousemove",onMove);
      (window as any).removeEventListener("touchmove",onMove);
      window.removeEventListener("mouseup",onUp);
      window.removeEventListener("touchend",onUp);
    };
  },[onMove,onUp]);

  const TabRow=({isAccent}:{isAccent:boolean})=>(
    <>
      {LANDING_TABS.map(({id,label,Icon},i)=>(
        <div key={id}
          style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",gap:3,height:IH,cursor:"pointer",userSelect:"none",
            WebkitUserSelect:"none"}}
          onClick={!isAccent?()=>{posSpring.current.to(i);onChange(id);}:undefined}
        >
          <Icon size={18} style={{
            stroke: isAccent?"#3b82f6":"rgba(255,255,255,0.30)",
            fill:"none",strokeWidth:1.75,strokeLinecap:"round",strokeLinejoin:"round",
          }}/>
          <span style={{
            fontSize:10,fontWeight:isAccent?600:500,
            color:isAccent?"#3b82f6":"rgba(255,255,255,0.30)",
            letterSpacing:"0.02em",lineHeight:1,fontFamily:"var(--font-sans)",
          }}>{label}</span>
        </div>
      ))}
    </>
  );

  return (
    <div ref={barRef} onMouseDown={onDown} onTouchStart={onDown} style={{
      position:"relative",
      width:"100%",
      height:64,borderRadius:999,
      background:"rgba(20,20,20,0.5)",
      backdropFilter:"blur(28px) saturate(180%) brightness(1.1)",
      WebkitBackdropFilter:"blur(28px) saturate(180%) brightness(1.1)",
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.22),"+
        "inset 0 -1px 0 rgba(0,0,0,0.15),"+
        "0 0 0 1px rgba(255,255,255,0.13),"+
        "0 8px 32px rgba(0,0,0,0.5),"+
        "0 2px 8px rgba(0,0,0,0.3)",
      cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",
    }}>
      {/* gray base tabs */}
      <div style={{position:"absolute",left:PAD,right:PAD,top:PAD,height:IH,display:"flex",alignItems:"center",zIndex:1}}>
        <TabRow isAccent={false}/>
      </div>

      {/* indicator */}
      <div ref={indRef} style={{
        position:"absolute",top:4,borderRadius:999,
        willChange:"left,width,height,top",
        zIndex:5,pointerEvents:"none",overflow:"hidden",
        background:"rgba(255,255,255,0.09)",
      }}>
        {/* pill bg mask — che icon xám, đúng hình pill */}
        <div style={{position:"absolute",inset:0,borderRadius:999,background:"rgba(14,14,22,0.28)",zIndex:1,pointerEvents:"none"}}/>
        <div ref={indShimRef} style={{position:"absolute",inset:0,borderRadius:999,pointerEvents:"none",zIndex:6,opacity:0}}/>
        {/* chroma top */}
        <div style={{position:"absolute",top:-1,left:0,right:0,height:2,borderRadius:"999px 999px 0 0",background:"linear-gradient(90deg,rgba(255,80,80,0) 0%,rgba(255,80,80,.5) 25%,rgba(255,80,80,.5) 75%,rgba(255,80,80,0) 100%)",mixBlendMode:"screen",pointerEvents:"none",zIndex:22}}/>
        {/* chroma bottom */}
        <div style={{position:"absolute",bottom:-1,left:0,right:0,height:2,borderRadius:"0 0 999px 999px",background:"linear-gradient(90deg,rgba(80,80,255,0) 0%,rgba(80,80,255,.5) 25%,rgba(80,80,255,.5) 75%,rgba(80,80,255,0) 100%)",mixBlendMode:"screen",pointerEvents:"none",zIndex:22}}/>
        {/* chroma left */}
        <div ref={chromaLRef} style={{position:"absolute",top:-1,bottom:-1,left:-1,width:3,borderRadius:"999px 0 0 999px",background:"linear-gradient(180deg,rgba(255,60,120,0) 0%,rgba(255,60,120,.6) 35%,rgba(255,100,60,.6) 65%,rgba(255,60,120,0) 100%)",mixBlendMode:"screen",pointerEvents:"none",zIndex:22}}/>
        {/* chroma right */}
        <div ref={chromaRRef} style={{position:"absolute",top:-1,bottom:-1,right:-1,width:3,borderRadius:"0 999px 999px 0",background:"linear-gradient(180deg,rgba(60,200,255,0) 0%,rgba(60,200,255,.6) 35%,rgba(100,60,255,.6) 65%,rgba(60,200,255,0) 100%)",mixBlendMode:"screen",pointerEvents:"none",zIndex:22}}/>
        {/* specular */}
        <div style={{position:"absolute",top:0,left:"12%",right:"12%",height:1,background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,.75) 40%,rgba(255,255,255,.75) 60%,transparent 100%)",pointerEvents:"none",zIndex:21}}/>
        {/* glow */}
        <div ref={indGlowRef} style={{position:"absolute",inset:0,borderRadius:999,pointerEvents:"none",zIndex:2,opacity:0,background:"radial-gradient(ellipse 60% 70% at 50% 110%,rgba(0,145,255,0.22),transparent 70%)"}}/>
        {/* blue accent clipped inside pill */}
        <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:999,pointerEvents:"none",zIndex:10}}>
          <div ref={accentRef} style={{position:"absolute",top:0,height:"100%",display:"flex",alignItems:"center",pointerEvents:"none",willChange:"left"}}>
            <TabRow isAccent={true}/>
          </div>
        </div>
      </div>
    </div>
  );
}



// ── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: "How does ExeGuard protect my scripts?",        a: "ExeGuard encrypts your scripts using AES-256-GCM and delivers them through a secure API. Each request receives a unique key with a 10-second TTL, preventing replay attacks and unauthorized access." },
  { q: "How does the Key System work?",                a: "Create Free and Paid keys in the Key System tab. Each key is locked to the user's HWID on first use. You can assign which script runs for each key tier." },
  { q: "What is a HWID ban?",                          a: "Hardware ID (HWID) is a unique device identifier. Banning a HWID prevents that device from running your scripts even if they have a valid key." },
  { q: "What is the whitelist for?",                   a: "Whitelisted HWIDs bypass key restrictions. Use it to grant special access to testers or trusted partners without requiring a key." },
  { q: "What is the maximum file size I can upload?",  a: "ExeGuard supports script uploads up to 10MB per file. All files are encrypted and stored securely on the server." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass glass-hover rounded-2xl overflow-hidden cursor-pointer" onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-sm font-semibold text-white pr-4">{q}</p>
        {open ? <ChevronUp size={14} className="text-blue-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-white/30 flex-shrink-0" />}
      </div>
      {open && <div className="px-5 pb-4"><p className="text-sm text-white/50 leading-relaxed">{a}</p></div>}
    </div>
  );
}

// ── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab() {
  return (
    <div>
      <div className="max-w-lg mx-auto px-5 pt-8 pb-8">
        {/* Hero */}
        <div className="text-center mb-10 animate-fade-up">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/exe-logo.png" alt="ExeGuard" style={{ width: 72, height: 72, objectFit: "contain", display: "block" }} />
          </div>

          <div className="inline-flex items-center gap-2 glass px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full status-active" />
            <span className="text-xs text-white/50 font-medium">Script delivery platform · v5</span>
          </div>

          <h1 className="font-display font-bold mb-5"
            style={{ fontSize: "clamp(2.4rem,5vw,4rem)", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            <span className="text-white">Protect. Deploy.</span>
            <br />
            <span style={{ background: "linear-gradient(135deg,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Control.
            </span>
          </h1>
          <p className="text-white/40 text-base leading-relaxed max-w-lg mx-auto mb-8 font-light">
            Manage, protect and deliver scripts with AES-256 encryption, key system, HWID bans and real-time analytics.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/register" className="btn-primary px-7 py-3 rounded-2xl text-sm flex items-center gap-2">
              Get started free <ArrowRight size={14} />
            </Link>
            <Link href="/login" className="btn-ghost px-7 py-3 rounded-2xl text-sm">Sign in</Link>
          </div>
        </div>

        {/* Hero image */}
        <div className="relative mb-10 animate-fade-up" style={{ animationDelay: "0.15s", borderRadius: 20, overflow: "hidden", minHeight: 180, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/exe-hero.png"
            alt="ExeGuard Platform"
            style={{ width: "100%", height: "auto", minHeight: 180, maxHeight: 300, objectFit: "cover", display: "block" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(8,8,15,0.7) 0%,transparent 60%)", pointerEvents:"none" }} />
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4 mb-10">
          {[
            { Icon: Lock,     title: "AES-256 Encryption",  desc: "Per-request keys with 10-second TTL. Sessions expire instantly.",    delay: "0.2s" },
            { Icon: Shield,   title: "Anti-Hook Engine",    desc: "Detects replay, rate abuse, UA tampering and debug injection.",       delay: "0.3s" },
            { Icon: Key,      title: "Key System",          desc: "Create Free/Paid keys, HWID-locked, with full access control.",      delay: "0.35s" },
            { Icon: Users,    title: "HWID Management",     desc: "Ban or whitelist devices by Hardware ID in real time.",               delay: "0.4s" },
            { Icon: BarChart2, title: "Live Analytics",      desc: "Real-time charts tracking runs, unique devices, and hook attempts.", delay: "0.45s" },
            { Icon: Zap,      title: "Smart Loader",        desc: "Auto-delivers the right script based on key tier.",                  delay: "0.5s" },
          ].map(f => (
            <div key={f.title} className="glass glass-hover rounded-2xl p-5 animate-fade-up" style={{ animationDelay: f.delay }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)" }}>
                <f.Icon size={16} className="text-blue-400" />
              </div>
              <h3 className="font-display font-bold text-white text-sm mb-1.5 tracking-tight">{f.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed font-light">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mb-6">
          <h2 className="font-display font-bold text-xl text-white mb-5 tracking-tight">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQS.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TUTORIAL TAB ─────────────────────────────────────────────────────────────
const STEPS = [
  { step: "01", title: "Create an account",      Icon: UserPlus,  desc: "Sign up for a free ExeGuard account. Complete the Cloudflare Turnstile verification to protect the system." },
  { step: "02", title: "Create a Project",        Icon: Terminal,  desc: "Go to Dashboard and click 'New Project'. Give it a name and description to organize your scripts." },
  { step: "03", title: "Upload a Script",         Icon: Zap,       desc: "In the Files tab, upload your script file (up to 10MB). The system automatically encrypts and stores it securely." },
  { step: "04", title: "Configure the Key System",Icon: Key,       desc: "Go to the Keys tab, create Free and Paid keys. Assign which script runs for each tier. Enable Role Management to enforce access." },
  { step: "05", title: "Manage HWIDs",            Icon: Shield,    desc: "The Management tab lets you ban abusive HWIDs or whitelist trusted devices. Lists update in real time." },
  { step: "06", title: "Get the Loader",          Icon: ArrowRight,desc: "Click the Download icon on any script to get the loader code. The loader checks the key, HWID, and runs the correct script." },
];

function TutorialTab() {
  return (
    <div>
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-8">
        <div className="mb-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 glass px-3 py-1 rounded-full mb-4">
            <BookOpen size={11} className="text-blue-400" />
            <span className="text-xs text-white/50 font-medium">Getting Started</span>
          </div>
          <h2 className="font-display font-bold text-3xl text-white tracking-tight mb-2">Up and running in 6 steps</h2>
          <p className="text-white/40 text-sm font-light">Set up ExeGuard and protect your scripts in minutes.</p>
        </div>
        <div className="space-y-4">
          {STEPS.map((s, i) => (
            <div key={s.step} className="glass glass-hover rounded-2xl p-5 animate-fade-up flex gap-4" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)" }}>
                  <s.Icon size={16} className="text-blue-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-blue-400/70 font-mono tracking-widest">{s.step}</span>
                  <h3 className="font-display font-bold text-white text-sm tracking-tight">{s.title}</h3>
                </div>
                <p className="text-white/40 text-sm leading-relaxed font-light">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 glass rounded-2xl p-5 animate-fade-up" style={{ animationDelay: "0.5s", borderColor: "rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.07)" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white mb-1">Important notice</p>
              <p className="text-xs text-white/40 leading-relaxed">
                Never share your API token or project ID publicly. Loader code contains sensitive information — only distribute it to trusted users. The system automatically detects and logs all hook attempts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PRICING TAB ───────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    desc: "For individuals getting started",
    features: ["1 Project", "Up to 3 Scripts", "Basic analytics", "Key System (limited)", "Community support"],
    cta: "Get started free",
    href: "/register",
    featured: false,
  },
  {
    name: "Go",
    price: "$0",
    period: "/month",
    badge: "Coming soon",
    desc: "For developers and small teams",
    features: ["5 Projects", "Up to 20 Scripts", "Advanced analytics", "HWID Management", "Full Key System", "Priority support"],
    cta: "Choose Go",
    href: "/register",
    featured: true,
  },
  {
    name: "Expert",
    price: "$0",
    period: "/month",
    badge: "Coming soon",
    desc: "Full-featured solution for power users",
    features: ["Unlimited Projects", "Unlimited Scripts", "Live Feed & Alerts", "Custom Loader", "API Access", "24/7 SLA Support"],
    cta: "Choose Expert",
    href: "/register",
    featured: false,
  },
] as const;

function PriceTab() {
  return (
    <div>
      <div className="max-w-lg mx-auto px-5 pt-8 pb-8">
        <div className="text-center mb-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 glass px-3 py-1 rounded-full mb-4">
            <Tag size={11} className="text-blue-400" />
            <span className="text-xs text-white/50 font-medium">Pricing</span>
          </div>
          <h2 className="font-display font-bold text-3xl text-white tracking-tight mb-2">Simple, transparent pricing</h2>
          <p className="text-white/40 text-sm font-light">All plans are free during the beta period.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((p, i) => (
            <div key={p.name} className={`price-card p-6 flex flex-col animate-fade-up ${p.featured ? "featured" : ""}`}
              style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-bold text-white text-lg tracking-tight">{p.name}</h3>
                    {(p as any).badge && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-blue-300"
                        style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)" }}>
                        {(p as any).badge}
                      </span>
                    )}
                  </div>
                  <p className="text-white/35 text-xs">{p.desc}</p>
                </div>
                {p.featured && <Star size={14} className="text-blue-400 mt-1" />}
              </div>
              <div className="mb-5">
                <span className="font-display font-bold text-4xl text-white">{p.price}</span>
                <span className="text-white/30 text-sm ml-1">{p.period}</span>
              </div>
              <div className="space-y-2 flex-1 mb-6">
                {p.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={12} className="text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-white/60">{f}</span>
                  </div>
                ))}
              </div>
              <Link href={p.href}
                className={`text-center py-3 rounded-xl text-sm font-semibold transition-all ${p.featured ? "btn-primary" : "btn-ghost"}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ACCOUNT TAB ───────────────────────────────────────────────────────────────
function AccountTab() {
  return (
    <div>
      <div className="max-w-sm mx-auto px-6 pt-16 pb-8">
        <div className="text-center mb-10 animate-fade-up">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/exe-logo.png" alt="ExeGuard" style={{ width: 44, height: 44, objectFit: "contain" }} />
            </div>
          </div>
          <h2 className="font-display font-bold text-2xl text-white tracking-tight mb-2">Your account</h2>
          <p className="text-white/40 text-sm font-light">Sign in or create a new account</p>
        </div>
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <Link href="/login"
            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm">
            <LoginIcon size={15} /> Sign in
          </Link>
          <Link href="/register"
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm">
            <UserPlus size={15} /> Create an account
          </Link>
        </div>
        <div className="mt-10 glass rounded-2xl p-5 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={13} className="text-blue-400" />
            <p className="text-xs font-semibold text-white">Security</p>
          </div>
          <div className="space-y-1.5">
            {["Cloudflare Turnstile verification", "10-second session token TTL", "AES-256-GCM encryption"].map(t => (
              <div key={t} className="flex items-center gap-2">
                <Check size={10} className="text-green-400" />
                <span className="text-[11px] text-white/40">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-[11px] text-white/20 mt-6 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          © 2025 ExeGuard · Powered by Exe Security API
        </p>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [tab,           setTab]           = useState<TabId>("home");
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [cfToken,       setCfToken]       = useState("");
  const [tsError,       setTsError]       = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId  = useRef<string>("");

  // Redirect if already logged in
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("eg_token"))
      router.push("/dashboard");
  }, [router]);

  // Load Turnstile widget with retry
  useEffect(() => {
    if (captchaPassed) return;
    const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
    let disposed = false;
    ensureTurnstileLoaded()
      .then(() => {
        if (disposed || widgetId.current || !widgetRef.current || !(window as any).turnstile) return;
        widgetId.current = (window as any).turnstile.render(widgetRef.current, {
          sitekey: SITE_KEY,
          theme: "dark",
          size: "normal",
          callback: (token: string) => setCfToken(token),
          "expired-callback": () => setCfToken(""),
        });
      })
      .catch((err: Error) => {
        console.error("Turnstile load failed", err);
      });
    return () => {
      disposed = true;
      try { if ((window as any).turnstile && widgetId.current) { (window as any).turnstile.remove(widgetId.current); widgetId.current = ""; } } catch (_) {}
    };
  }, [captchaPassed]);

  const handleContinue = async () => {
    if (cfToken) {
      try { await api.verifyTurnstile(cfToken); } catch (_) {}
    }
    setCaptchaPassed(true);
  };

  const TabContent = { home: HomeTab, tutorial: TutorialTab, price: PriceTab, login: AccountTab }[tab];

  return (
    <main style={{
      position: "relative",
      minHeight: "100dvh",
      width: "100%",
      maxWidth: "100vw",
      overflowX: "hidden",
      background: "#08080f",
    }}>
      {/* Orbs */}
      <div className="orb" style={{ width:500,height:500,top:-160,left:-160,opacity:0.2,background:"radial-gradient(circle,#2563eb,transparent 70%)" }} />
      <div className="orb" style={{ width:400,height:400,top:"50%",right:-160,opacity:0.12,background:"radial-gradient(circle,#7c3aed,transparent 70%)" }} />

      {/* ── CAPTCHA GATE ── z-index 100 so it covers the nav too */}
      {!captchaPassed && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
          background: "rgba(8,8,15,0.96)",
          backdropFilter: "blur(24px)",
        }}>
          <div className="glass-strong animate-scale-in" style={{
            borderRadius: 28, padding: 32, width: "100%", maxWidth: 320, textAlign: "center",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/exe-logo.png" alt="ExeGuard" width={52} height={52}
              style={{ objectFit:"contain", margin:"0 auto 20px" }} />
            <h2 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:20, color:"#fff", marginBottom:6, letterSpacing:"-0.03em" }}>
              Security Check
            </h2>
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:24, fontFamily:"var(--font-sans)" }}>
              Complete the Cloudflare verification to continue
            </p>

            {/* Turnstile widget container */}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
              <div ref={widgetRef} />
            </div>
            {tsError && (
              <p style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>
                Turnstile error: {tsError}
              </p>
            )}

            <button
              onClick={handleContinue}
              disabled={!cfToken}
              className="btn-primary"
              style={{
                width:"100%", padding:"12px 0", borderRadius:14,
                fontSize:14, opacity: cfToken ? 1 : 0.4,
                cursor: cfToken ? "pointer" : "not-allowed",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT ── */}
      <div key={tab} style={{ paddingBottom: 96 }}>
        <div className="animate-tab-in">
          <TabContent />
        </div>
      </div>

      {/* ── FIXED BOTTOM NAV ── z-index 50 (below gate) */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", justifyContent: "center",
        padding: "0 16px 18px",
        background: "linear-gradient(to top, rgba(8,8,15,0.9) 0%, rgba(8,8,15,0.5) 55%, transparent 100%)",
        pointerEvents: "none",
      }}>
        <div style={{ width:"100%", maxWidth:360, pointerEvents:"all" }}>
          <LiquidNav active={tab} onChange={setTab} />
        </div>
      </div>
    </main>
  );
}
