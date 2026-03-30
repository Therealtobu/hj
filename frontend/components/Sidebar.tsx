"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/api";

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    if (!u) router.push("/login");
  }, [router]);

  return (
    <div className="flex flex-col h-screen bg-[#08080f] overflow-hidden">
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
