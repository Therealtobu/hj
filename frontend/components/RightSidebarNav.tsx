"use client";
import { useRef, useEffect, useCallback } from "react";

export interface NavTab {
  id: string;
  label: string;
  Icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
}

interface LiquidNavProps {
  tabs: NavTab[];
  active: string;
  onChange: (id: string) => void;
}

export function RightSidebarNav({ tabs, active, onChange }: LiquidNavProps) {
  const N = tabs.length;
  const PAD = 4, IH = 56;

  /* ── Spring v3 ── */
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
  const cl=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
  const lp=(a:number,b:number,t:number)=>a+(b-a)*t;

  const activeIdx = tabs.findIndex(t => t.id === active);

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
    const tabW = (barW-PAD*2)/N;
    st.current.barW=barW; st.current.tabW=tabW;
    if(accentRef.current){
      accentRef.current.style.width=(barW-PAD*2)+"px";
      accentRef.current.style.height=IH+"px";
    }
  },[N]);

  const renderFrame = useCallback(()=>{
    const ind=indRef.current, accent=accentRef.current;
    if(!ind||!accent||!st.current.tabW) return;
    const {tabW}=st.current;
    const pos=posSpring.current.value;
    const press=cl(pressSpring.current.value,0,1);
    const v=st.current.velPx/tabW/10;
    const vx=cl(v*0.70,-0.18,0.18);
    const vy=cl(v*0.20,-0.08,0.08);
    const pe=lp(0,0.18,press);
    const indW=tabW+tabW*(Math.abs(vx)+pe);
    const indH=Math.round(IH*cl(1-Math.abs(vy)+pe*0.5,0.88,1.0))+lp(0,10,press);
    const indL=PAD+pos*tabW+tabW/2-indW/2;
    const indTop=4+(IH-indH)/2;
    ind.style.width=indW.toFixed(2)+"px";
    ind.style.height=indH+"px";
    ind.style.top=indTop.toFixed(2)+"px";
    ind.style.left=indL.toFixed(2)+"px";
    const rimA=lp(0.22,0.48,press);
    ind.style.background=`rgba(255,255,255,${lp(0.09,0.16,press).toFixed(3)})`;
    ind.style.boxShadow=
      `0 0 0 1.5px rgba(255,255,255,${(rimA*0.55).toFixed(3)}),`+
      `inset 0 1.5px 0 rgba(255,255,255,${rimA.toFixed(3)}),`+
      `inset 0 -1px 0 rgba(0,0,0,0.12),`+
      `0 8px 32px rgba(0,145,255,${(press*0.25).toFixed(3)})`;
    if(indGlowRef.current) indGlowRef.current.style.opacity=(press*0.9).toFixed(3);
    accent.style.left=((indW-tabW)/2-pos*tabW).toFixed(2)+"px";
    const cv=cl(Math.abs(v),0,1), cd=v>0?1:-1;
    if(chromaLRef.current) chromaLRef.current.style.opacity=(cd>0?lp(0.3,1,cv):lp(0.1,0.8,cv)).toFixed(3);
    if(chromaRRef.current) chromaRRef.current.style.opacity=(cd>0?lp(0.1,0.8,cv):lp(0.3,1,cv)).toFixed(3);
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

  const rafRef=useRef<number>(0);
  const prevTs=useRef<number>(0);

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
    const x=getX(e), now=performance.now();
    const dt=(now-s.lastT)/1000, dx=x-s.lastX;
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
    posSpring.current.to(idx); pressSpring.current.to(0);
    onChange(tabs[idx].id);
  },[N,onChange,tabs]);

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
      {tabs.map(({id,label,Icon},i)=>(
        <div key={id}
          style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",gap:3,height:IH,cursor:"pointer",
            userSelect:"none",WebkitUserSelect:"none"} as React.CSSProperties}
          onClick={!isAccent?()=>{posSpring.current.to(i);onChange(id);}:undefined}
        >
          <Icon size={16} style={{
            stroke:isAccent?"#3b82f6":"rgba(255,255,255,0.30)",
            color:isAccent?"#3b82f6":"rgba(255,255,255,0.30)",
            fill:"none",strokeWidth:1.75,
          }}/>
          <span style={{
            fontSize:9,fontWeight:isAccent?600:500,
            color:isAccent?"#3b82f6":"rgba(255,255,255,0.30)",
            letterSpacing:"0.02em",lineHeight:1,fontFamily:"var(--font-sans)",
          }}>{label}</span>
        </div>
      ))}
    </>
  );

  return (
    <div ref={barRef} onMouseDown={onDown} onTouchStart={onDown} style={{
      position:"relative",width:"100%",height:64,borderRadius:999,
      background:"rgba(20,20,20,0.45)",
      backdropFilter:"blur(32px) saturate(200%) brightness(1.1)",
      WebkitBackdropFilter:"blur(32px) saturate(200%) brightness(1.1)",
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.22),"+
        "inset 0 -1px 0 rgba(0,0,0,0.15),"+
        "0 0 0 1px rgba(255,255,255,0.12),"+
        "0 8px 32px rgba(0,0,0,0.5),"+
        "0 2px 8px rgba(0,0,0,0.3)",
      cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",
    } as React.CSSProperties}>
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
        {/* pill bg mask */}
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
        {/* blue accent clipped */}
        <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:999,pointerEvents:"none",zIndex:10}}>
          <div ref={accentRef} style={{position:"absolute",top:0,height:"100%",display:"flex",alignItems:"center",pointerEvents:"none",willChange:"left"}}>
            <TabRow isAccent={true}/>
          </div>
        </div>
      </div>
    </div>
  );
}
