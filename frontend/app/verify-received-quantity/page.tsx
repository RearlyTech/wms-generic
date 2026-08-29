"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  RefreshCw
} from "lucide-react";

interface PalletItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  uom: string;
  totalWeight: number;
  weightUom: string;
}

interface PalletSummary {
  palletName: string;
  palletFullName: string;
  totalQuantity: number;
  totalWeight: number;
  items: PalletItem[];
}

export default function VerifyReceivedQuantityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [pallets, setPallets] = useState<PalletSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState("http://77.42.39.77:8000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("erp_token");
      let savedBackendUrl = localStorage.getItem("erp_backend_url");

      if (!savedToken) {
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

  const fetchPallets = async () => {
    if (!backendUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/wms/pallets-summary`, { mode: "cors" });
      if (!res.ok) throw new Error("Failed to fetch pallets summary");
      const data: PalletSummary[] = await res.json();
      setPallets(data);
      console.log("data fetched from pallet", data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while fetching pallet data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (backendUrl) {
      fetchPallets();
    }
  }, [backendUrl]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 border border-amber-100 text-amber-600 rounded-lg shadow-sm">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Verify Received Quantity</h1>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Pallet Stock Overview</p>
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={fetchPallets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-sm text-sm font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="font-medium text-sm">{error}</p>
          </div>
        )}

        {loading && pallets.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium">Loading pallet data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pallets.map((pallet, index) => (
              <div key={index} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="bg-slate-50 border-b border-slate-200 p-5 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm shrink-0">
                      <PackageCheck className="w-5 h-5 text-indigo-700" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 leading-tight">{pallet.palletName}</h2>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{pallet.palletFullName}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Quantity</p>
                      <div className="text-3xl font-black text-slate-800 tracking-tight">
                        {pallet.totalQuantity.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Weight</p>
                      <div className="text-3xl font-black text-indigo-700 tracking-tight">
                        {(pallet.totalWeight || 0).toLocaleString()} <span className="text-sm font-bold text-indigo-500 uppercase">{pallet.items[0]?.weightUom || 'KG'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Item Breakdown</h3>
                    <div className="flex flex-col gap-2.5">
                      {pallet.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800">{item.itemName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{item.itemCode}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right flex flex-col items-end">
                              <span className="text-sm font-black text-emerald-700">{item.quantity}</span>
                              <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-50 px-1 rounded">{item.uom}</span>
                            </div>
                            <div className="text-right flex flex-col items-end border-l border-slate-200 pl-4">
                              <span className="text-sm font-black text-indigo-700">{item.totalWeight}</span>
                              <span className="text-[10px] font-bold text-indigo-500 uppercase bg-indigo-50 px-1 rounded">{item.weightUom}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {pallets.length === 0 && !loading && !error && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200 border-dashed">
                <PackageCheck className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">No Active Pallets</h3>
                <p className="text-slate-500 text-sm max-w-sm">There are currently no pallets with stock allocated to them in the system.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
