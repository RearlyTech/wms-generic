"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("erp_token");
      if (savedToken) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans antialiased">
      <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold font-mono">
        <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
        Redirecting...
      </div>
    </div>
  );
}
