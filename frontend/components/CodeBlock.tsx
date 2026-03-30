"use client";
import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import toast from "react-hot-toast";

export default function CodeBlock({ code, filename = "loader.py", language: _language }: { code: string; filename?: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = filename;
    a.click();
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="font-mono text-xs text-ink-3">{filename}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-3 hover:text-ink-1 hover:bg-white/8 transition-all">
            {copied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
          <button onClick={download}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-3 hover:text-ink-1 hover:bg-white/8 transition-all">
            <Download size={12} /> Download
          </button>
        </div>
      </div>
      {/* Code */}
      <pre className="overflow-auto max-h-72 p-5 font-mono text-xs text-ink-2 leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
