"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  AlertTriangle,
  LogOut,
  MapPin,
  Package,
  TrendingUp,
  Box,
  Clock,
  CheckCircle2,
  XCircle,
  ServerCrash,
  Loader2,
  Factory,
  DoorOpen,
  DoorClosed
} from "lucide-react";

interface DashboardMetrics {
  totalItems: number;
  totalStock: number;
  occupiedBins: number;
  emptyBins: number;
  expiringSoon: number;
  expired: number;
}

export default function WarehouseDashboard() {
  const router = useRouter();
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("erp_backend_url") || "http://localhost:8000";
      setBackendUrl(savedUrl);
    }
  }, []);

  useEffect(() => {
    if (!backendUrl) return;

    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${backendUrl}/wms/dashboard-metrics`, { mode: "cors" });
        if (!res.ok) throw new Error("Failed to fetch dashboard metrics");
        const data = await res.json();
        setMetrics(data);
      } catch (err: any) {
        console.error("Metrics error:", err);
        setError(err.message || "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // Poll every 60 seconds
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  // Directus Door Status
  const [doorStatus, setDoorStatus] = useState<string>("Unknown");

  useEffect(() => {
    const fetchDoorStatus = async () => {
      try {
        const directusToken = localStorage.getItem("directus_access_token");
        const fetchHeaders: Record<string, string> = {};
        if (directusToken) {
          fetchHeaders["Authorization"] = `Bearer ${directusToken}`;
        }
        const res = await fetch(`${backendUrl}/wms/door-status`, { headers: fetchHeaders, mode: "cors" });
        if (res.ok) {
          const json = await res.json();
          if (json.door_status) {
            setDoorStatus(json.door_status);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch door status from Directus", err);
      }
    };

    fetchDoorStatus();
    const interval = setInterval(fetchDoorStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("erp_token");
    localStorage.removeItem("erp_jwt");
    localStorage.removeItem("erp_user");
    localStorage.removeItem("erp_first_name");
    localStorage.removeItem("erp_full_name");
    localStorage.removeItem("directus_access_token");
    localStorage.removeItem("directus_refresh_token");
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Warehouse Management
            </h1>
            <p className="text-[12px] text-slate-500 font-semibold">Vishwha Central Dashboard</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-rose-50 active:bg-rose-100 text-rose-600 border border-slate-200 hover:border-rose-200 shadow-sm transition cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">

        {/* Metrics Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              Live Overview
            </h2>
            {loading && !metrics && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>

          {error ? (
            <div className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <ServerCrash className="w-8 h-8 text-rose-400 mb-2" />
              <p className="text-slate-700 font-medium">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-xs font-bold text-rose-600 bg-white border border-rose-200 px-3 py-1.5 rounded hover:bg-rose-50"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {/* Metric 1 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Package className="w-16 h-16 text-indigo-600" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Items</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-900">{metrics?.totalItems.toLocaleString() ?? "-"}</h3>
                </div>
              </div>

              {/* Metric 2 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <TrendingUp className="w-16 h-16 text-emerald-600" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Stock</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-900">{metrics?.totalStock.toLocaleString() ?? "-"}</h3>
                  <span className="text-sm font-bold text-slate-400">KG</span>
                </div>
              </div>

              {/* Metric 3 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <CheckCircle2 className="w-16 h-16 text-indigo-600" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Occupied Bins</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-900">{metrics?.occupiedBins.toLocaleString() ?? "-"}</h3>
                </div>
              </div>

              {/* Metric 4 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Box className="w-16 h-16 text-amber-500" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Empty Bins</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-900">{metrics?.emptyBins.toLocaleString() ?? "-"}</h3>
                </div>
              </div>

              {/* Metric 5 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Clock className="w-16 h-16 text-orange-500" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Expiring Soon</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-orange-600">{metrics?.expiringSoon.toLocaleString() ?? "-"}</h3>
                </div>
              </div>

              {/* Metric 6 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <XCircle className="w-16 h-16 text-rose-500" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Expired</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-rose-600">{metrics?.expired.toLocaleString() ?? "-"}</h3>
                </div>
              </div>

              {/* Metric 7 - Door Status */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  {doorStatus?.toLowerCase() === 'open' ? (
                    <DoorOpen className="w-16 h-16 text-amber-500" />
                  ) : (
                    <DoorClosed className="w-16 h-16 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Main Door Status</p>
                <div className="flex items-baseline gap-2">
                  <h3 className={`text-3xl font-black ${doorStatus?.toLowerCase() === 'open' ? 'text-amber-500' :
                    doorStatus?.toLowerCase() === 'close' || doorStatus?.toLowerCase() === 'closed' ? 'text-emerald-600' : 'text-slate-900'
                    }`}>
                    {doorStatus ? (doorStatus.charAt(0).toUpperCase() + doorStatus.slice(1)) : "Unknown"}
                  </h3>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Action Hub */}
        <section>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Boxes className="w-5 h-5 text-indigo-500" />
            Quick Actions
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push("/warehouse-visualizer")}
              className="flex flex-col items-start p-6 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-2xl transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-indigo-900 mb-1">Warehouse Visualizer</h3>
              <p className="text-xs font-medium text-indigo-700">View 2D layouts and inspect bins.</p>
            </button>

            <button
              onClick={() => router.push("/exception-report")}
              className="flex flex-col items-start p-6 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-rose-900 mb-1">Exception Report</h3>
              <p className="text-xs font-medium text-rose-700">Review discrepancies and dispatch logs.</p>
            </button>

            <button
              onClick={() => router.push("/warehouse-check")}
              className="flex flex-col items-start p-6 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-emerald-900 mb-1">Warehouse Check</h3>
              <p className="text-xs font-medium text-emerald-700">Scan and verify physical stock.</p>
            </button>

            <button
              onClick={() => router.push("/manufacturing-console")}
              className="flex flex-col items-start p-6 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-2xl transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                <Factory className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Manufacturing Console</h3>
              <p className="text-xs font-medium text-slate-400">Manage jobs and production metrics.</p>
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
