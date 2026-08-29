"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Search,
} from "lucide-react";

interface ApprovalRequest {
  id: string;
  pallet_id: string;
  type: string;
  status: string;
  requested_by: string;
  timestamp: string;
  resolved_at?: string;
}

export default function PalletApprovalsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [backendUrl, setBackendUrl] = useState("http://77.42.39.77:8000");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("erp_token");
      let savedBackendUrl = localStorage.getItem("erp_backend_url");
      if (savedToken) {
        setIsAuthenticated(true);
      } else {
        router.push("/login");
        return;
      }

      if (savedBackendUrl) {
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

  const fetchRequests = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/wms/approval-requests`, { mode: "cors" });
      if (!res.ok) throw new Error("Failed to fetch approval requests");
      const data = await res.json();
      
      // Sort: Pending first, then by timestamp descending
      const sorted = (data.requests || []).sort((a: ApprovalRequest, b: ApprovalRequest) => {
        if (a.status === "Pending" && b.status !== "Pending") return -1;
        if (a.status !== "Pending" && b.status === "Pending") return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      setRequests(sorted);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && backendUrl) {
      fetchRequests();
    }
  }, [isAuthenticated, backendUrl]);

  const handleResolve = async (id: string, status: "Approved" | "Rejected") => {
    setActionLoading(id);
    try {
      const res = await fetch(`${backendUrl}/wms/approval-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        mode: "cors"
      });
      if (!res.ok) throw new Error("Failed to update status");
      
      // Update local state
      setRequests(prev => prev.map(req => {
        if (req.id === id) {
          return { ...req, status, resolved_at: new Date().toISOString() };
        }
        return req;
      }).sort((a, b) => {
        if (a.status === "Pending" && b.status !== "Pending") return -1;
        if (a.status !== "Pending" && b.status === "Pending") return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }));
      
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRequests = requests.filter(req => 
    req.pallet_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    req.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">Pallet Approvals</h1>
              <p className="text-[10px] text-slate-500 font-mono">Review & Authorize Status Changes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by RFID or Type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
            />
          </div>
          <button
            onClick={fetchRequests}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="font-medium text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium font-mono text-xs uppercase tracking-widest">Loading Requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200 border-dashed">
            <ShieldCheck className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">No Pending Approvals</h3>
            <p className="text-slate-500 text-sm max-w-sm">There are no pallet status change requests waiting for your authorization.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRequests.map((req) => (
              <div 
                key={req.id} 
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md ${
                  req.status === 'Pending' ? 'border-amber-200' : 
                  req.status === 'Approved' ? 'border-emerald-200 opacity-75' : 'border-rose-200 opacity-75'
                }`}
              >
                <div className={`p-4 border-b flex items-start justify-between ${
                  req.status === 'Pending' ? 'bg-amber-50/50 border-amber-100' : 
                  req.status === 'Approved' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
                }`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        req.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 
                        req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {req.status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.timestamp).toLocaleDateString()} {new Date(req.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 font-mono tracking-tight">{req.pallet_id}</h2>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Requested Flag</p>
                    <div className="flex items-center gap-2">
                      {req.type === 'Damaged' ? (
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-orange-500" />
                      )}
                      <span className="text-sm font-bold text-slate-700">{req.type}</span>
                    </div>
                  </div>
                  
                  <div className="mb-5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Requested By</p>
                    <span className="text-sm font-medium text-slate-700">{req.requested_by}</span>
                  </div>

                  {req.status === 'Pending' && (
                    <div className="mt-auto pt-4 border-t border-slate-100 flex gap-3">
                      <button
                        onClick={() => handleResolve(req.id, "Rejected")}
                        disabled={actionLoading === req.id}
                        className="flex-1 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Reject
                      </button>
                      <button
                        onClick={() => handleResolve(req.id, "Approved")}
                        disabled={actionLoading === req.id}
                        className="flex-1 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                    </div>
                  )}
                  
                  {req.status !== 'Pending' && req.resolved_at && (
                    <div className="mt-auto pt-4 border-t border-slate-100">
                       <p className="text-[10px] font-mono text-slate-400 text-center">
                         Resolved on {new Date(req.resolved_at).toLocaleString()}
                       </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
