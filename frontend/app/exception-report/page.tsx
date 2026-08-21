"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  PackageCheck,
  PackageMinus,
  Tag,
  MapPin,
  Clock,
  Loader2
} from "lucide-react";

export default function ExceptionReportPage() {
  const router = useRouter();
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedBackendUrl = localStorage.getItem("erp_backend_url") || "http://localhost:8000";
      setBackendUrl(savedBackendUrl);
    }
  }, []);

  const fetchActivityLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/wms/activity-log`, { mode: "cors" });
      if (response.ok) {
        const json = await response.json();
        setActivityLogs(json);
      } else {
        throw new Error("Failed to fetch logs");
      }
    } catch (err: any) {
      console.error("Error fetching activity logs:", err);
      setError(err.message || "Network Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (backendUrl) {
      fetchActivityLogs();
      const interval = setInterval(fetchActivityLogs, 15000); // Auto-refresh every 15s
      return () => clearInterval(interval);
    }
  }, [backendUrl]);

  const getLogStyle = (type: string) => {
    switch (type) {
      case "Dispatch":
        return { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: <PackageMinus className="w-5 h-5 text-emerald-600" /> };
      case "Stock Discrepancy":
        return { color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", icon: <AlertTriangle className="w-5 h-5 text-rose-600" /> };
      case "Manual Exception":
        return { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: <AlertTriangle className="w-5 h-5 text-amber-600" /> };
      case "RFID Change":
        return { color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", icon: <Tag className="w-5 h-5 text-purple-600" /> };
      case "Location Move":
        return { color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-300", icon: <MapPin className="w-5 h-5 text-slate-600" /> };
      default:
        return { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: <Activity className="w-5 h-5 text-blue-600" /> };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">WMS Activity Log</h1>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Exception Report</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={fetchActivityLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-slate-600 text-sm">
            This is a real-time feed of all physical dispatches, tag re-mappings, stock count discrepancies, and manual exceptions recorded by operators across the warehouse.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-rose-800 text-sm">Connection Error</h3>
              <p className="text-rose-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Feed List */}
        <div className="space-y-4">
          {loading && activityLogs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-sm font-medium">Loading activity logs...</p>
            </div>
          ) : activityLogs.length > 0 ? (
            activityLogs.map((log) => {
              const style = getLogStyle(log.activity_type);
              const date = new Date(log.creation);
              const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={log.name} className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${style.border}`}>
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Icon & Timestamp */}
                    <div className="flex items-start md:flex-col md:items-center gap-4 md:gap-2 md:w-32 shrink-0">
                      <div className={`p-3 rounded-xl ${style.bg}`}>
                        {style.icon}
                      </div>
                      <div className="flex flex-col md:items-center mt-1 md:mt-0">
                        <span className="text-[13px] font-bold text-slate-700">{formattedDate}</span>
                        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formattedTime}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${style.bg} ${style.color}`}>
                          {log.activity_type}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {log.operator || "System"}
                        </span>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-slate-700 text-sm leading-relaxed">
                          {log.details}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        {log.target_location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Location:</span>
                            <span className="text-sm font-semibold text-slate-700">{log.target_location}</span>
                          </div>
                        )}
                        
                        {log.old_tag && log.new_tag && (
                          <div className="flex items-center gap-2 w-full md:w-auto">
                            <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex items-center gap-2 text-sm font-mono flex-wrap">
                              <span className="text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded truncate max-w-[150px]" title={log.old_tag}>
                                {log.old_tag.substring(0, 10)}...
                              </span>
                              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-slate-800 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded truncate max-w-[150px]" title={log.new_tag}>
                                {log.new_tag.substring(0, 10)}...
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-white border border-slate-200 rounded-2xl border-dashed">
              <Activity className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-base font-medium text-slate-700">No recent activities</p>
              <p className="text-sm">Activity logs will appear here once recorded.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
