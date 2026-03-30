import { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "blue" | "green" | "red" | "amber";
  sub?: string;
};

const cfg = {
  blue:  { bg: "rgba(37,99,235,0.12)",  border: "rgba(37,99,235,0.25)",  icon: "text-blue-400",  glow: "rgba(37,99,235,0.2)"  },
  green: { bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.25)",  icon: "text-green-400", glow: "rgba(34,197,94,0.15)" },
  red:   { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",  icon: "text-red-400",   glow: "rgba(239,68,68,0.15)" },
  amber: { bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)", icon: "text-amber-400", glow: "rgba(245,158,11,0.15)"},
};

export default function StatCard({ label, value, icon: Icon, accent = "blue", sub }: Props) {
  const c = cfg[accent];
  return (
    <div className="glass glass-hover rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: c.bg, border: `1px solid ${c.border}`, boxShadow: `0 0 12px ${c.glow}` }}>
        <Icon size={18} className={c.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="font-display font-bold text-2xl text-ink-1 leading-none tracking-tight">{value}</p>
        {sub && <p className="text-xs text-ink-3 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
