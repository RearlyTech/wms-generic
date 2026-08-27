"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem("directus_access_token");
      const refreshToken = localStorage.getItem("directus_refresh_token");

      if (savedToken) {
        try {
          const payload = JSON.parse(atob(savedToken.split('.')[1]));
          const isExpired = payload.exp * 1000 < Date.now();
          
          if (isExpired && refreshToken) {
            // Attempt to refresh
            const refreshRes = await fetch("https://dev-directus.rearlytech.com/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData.data?.access_token) {
                localStorage.setItem("directus_access_token", refreshData.data.access_token);
                if (refreshData.data.refresh_token) {
                  localStorage.setItem("directus_refresh_token", refreshData.data.refresh_token);
                }
                router.push("/dashboard");
                return;
              }
            }
            // Refresh failed
            localStorage.removeItem("directus_access_token");
            localStorage.removeItem("directus_refresh_token");
            router.push("/login");
          } else if (isExpired) {
            localStorage.removeItem("directus_access_token");
            router.push("/login");
          } else {
            router.push("/dashboard");
          }
        } catch (e) {
          localStorage.removeItem("directus_access_token");
          router.push("/login");
        }
      } else {
        router.push("/login");
      }
    };
    
    if (typeof window !== "undefined") {
      checkAuth();
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
