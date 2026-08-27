"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  PackageCheck,
  PackageSearch,
  PackageMinus,
  RefreshCw,
  Box
} from "lucide-react";

interface PalletItem {
  item_code: string;
  item_name: string;
  qty: number;
}

interface ReservedPallet {
  pallet_id: string;
  items: PalletItem[];
}

interface PalletOption {
  name: string;
  warehouse_name: string;
}

export default function PalletReservationPage() {
  const router = useRouter();
  
  const [allPallets, setAllPallets] = useState<PalletOption[]>([]);
  const [reservedPallets, setReservedPallets] = useState<ReservedPallet[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPallet, setSelectedPallet] = useState<string>("");
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  const fetchData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [allRes, reservedRes] = await Promise.all([
        fetch(`${backendUrl}/wms/pallets/all`, { mode: "cors" }),
        fetch(`${backendUrl}/wms/reserved-pallets`, { mode: "cors" })
      ]);
      
      if (!allRes.ok || !reservedRes.ok) throw new Error("Failed to fetch data from backend");
      
      const allData = await allRes.json();
      const reservedData = await reservedRes.json();
      
      setAllPallets(allData.pallets || []);
      setReservedPallets(reservedData.reserved_pallets || []);
      
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && backendUrl) {
      fetchData();
    }
  }, [isAuthenticated, backendUrl]);

  const handleReserve = async () => {
    if (!selectedPallet) return;
    
    setActionLoading("reserve_new");
    try {
      const res = await fetch(`${backendUrl}/wms/pallets/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pallet_id: selectedPallet, action: "reserve" }),
        mode: "cors"
      });
      if (!res.ok) throw new Error("Failed to reserve pallet");
      
      setSelectedPallet("");
      await fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnreserve = async (palletId: string) => {
    setActionLoading(palletId);
    try {
      const res = await fetch(`${backendUrl}/wms/pallets/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pallet_id: palletId, action: "unreserve" }),
        mode: "cors"
      });
      if (!res.ok) throw new Error("Failed to unreserve pallet");
      
      await fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const reservedIds = reservedPallets.map(rp => rp.pallet_id);
  const availablePallets = allPallets.filter(p => !reservedIds.includes(p.name));

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
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">Pallet Reservation</h1>
              <p className="text-[10px] text-slate-500 font-mono">Manage Reserved Stock & Locations</p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        
        {/* Top Section: Reserve Pallet */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <PackageSearch className="w-4 h-4 text-indigo-500" />
            Reserve a Pallet
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select Active Pallet
              </label>
              <select 
                value={selectedPallet}
                onChange={(e) => setSelectedPallet(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-2.5 transition-all outline-none"
              >
                <option value="">-- Choose a pallet to reserve --</option>
                {availablePallets.map(p => (
                  <option key={p.name} value={p.name}>{p.warehouse_name} ({p.name})</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleReserve}
              disabled={!selectedPallet || actionLoading === "reserve_new"}
              className="h-[42px] px-6 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === "reserve_new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              Reserve
            </button>
          </div>
        </section>

        {/* Bottom Section: Reserved Pallets List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-500" />
              Currently Reserved Pallets
              <span className="bg-slate-100 text-slate-600 text-[10px] py-0.5 px-2 rounded-full font-mono">{reservedPallets.length}</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-200 border-dashed">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-slate-500 font-medium font-mono text-xs uppercase tracking-widest">Loading Reserved Stock...</p>
            </div>
          ) : reservedPallets.length === 0 ? (
             <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200 border-dashed">
              <PackageMinus className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-lg font-bold text-slate-700 mb-1">No Reserved Pallets</h3>
              <p className="text-slate-500 text-sm max-w-sm">There are currently no pallets marked as reserved in the system.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {reservedPallets.map(pallet => (
                <div key={pallet.pallet_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  {/* Card Header */}
                  <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <PackageCheck className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 font-mono tracking-tight">{pallet.pallet_id}</h3>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Reserved</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnreserve(pallet.pallet_id)}
                      disabled={actionLoading === pallet.pallet_id}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {actionLoading === pallet.pallet_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageMinus className="w-3.5 h-3.5" />}
                      Unreserve
                    </button>
                  </div>
                  
                  {/* Card Body - Items List */}
                  <div className="p-4 flex-1">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5" />
                      Items Inside
                    </h4>
                    
                    {(!pallet.items || pallet.items.length === 0) ? (
                      <p className="text-sm text-slate-500 italic">No stock found in this pallet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {pallet.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg p-3">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-sm font-bold text-slate-800 truncate" title={item.item_name}>
                                {item.item_name}
                              </p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{item.item_code}</p>
                            </div>
                            <div className="text-right whitespace-nowrap bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-md">
                              <span className="text-base font-black text-indigo-700">{item.qty}</span>
                              <span className="text-[10px] font-bold text-indigo-500 ml-1">QTY</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
