"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Cpu as ProcessIcon,
  Eye,
  EyeOff,
  Lock,
  Loader2
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Auto-login persistence / backend URL load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("erp_token");
      let savedBackendUrl = localStorage.getItem("erp_backend_url");
      if (savedToken) {
        router.push("/dashboard");
      }
      if (savedBackendUrl) {
        // Robust cleanup: if the URL contains duplicate protocol/domain definitions, extract the first valid one
        const urlMatches = savedBackendUrl.match(/https?:\/\/[^\/]+/g);
        if (urlMatches && urlMatches.length > 1) {
          savedBackendUrl = urlMatches[0];
          localStorage.setItem("erp_backend_url", savedBackendUrl);
        }
        setBackendUrl(savedBackendUrl);
      } else {
        const dynamicUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
        setBackendUrl(dynamicUrl);
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleLogin: Form submitted", { email, backendUrl });
    setLoginLoading(true);
    setLoginError(null);
    try {
      const targetUrl = `${backendUrl}/api/auth/login`;
      console.log("handleLogin: Fetching target URL", targetUrl);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      console.log("handleLogin: Response status", res.status);
      const data = await res.json();
      console.log("handleLogin: Response data", data);
      if (res.ok) {
        if (typeof window !== "undefined") {
          localStorage.setItem("erp_token", data.access_token);
          if (data.directus_access_token) {
            localStorage.setItem("directus_access_token", data.directus_access_token);
          }
          if (data.directus_refresh_token) {
            localStorage.setItem("directus_refresh_token", data.directus_refresh_token);
          }
          localStorage.setItem("erp_backend_url", backendUrl);
        }
        console.log("handleLogin: Authentication successful, redirecting to Dashboard");
        router.push("/dashboard");
      } else {
        console.warn("handleLogin: Authentication failed with details", data);
        setLoginError(data.detail || "Invalid email or password");
      }
    } catch (err: any) {
      console.error("handleLogin: Catch block error", err);
      setLoginError(`Cannot reach backend server. Check backend URL (${err.message})`);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans antialiased px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-sm">
            <ProcessIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            Vishwha Murukku Foods
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            Manufacturing Automation Control Panel
          </p>
        </div>

        {loginError && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-lg text-xs font-semibold flex items-start gap-2">
            <span className="text-sm">⚠️</span>
            <div>{loginError}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">
              Email / Username
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-slate-400 transition font-sans"
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg py-2 pl-3 pr-10 text-xs focus:outline-none focus:border-slate-400 transition font-sans"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-655 transition focus:outline-none cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 disabled:bg-slate-600 text-white font-bold text-xs rounded-lg transition shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            {loginLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                Login to Console
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
