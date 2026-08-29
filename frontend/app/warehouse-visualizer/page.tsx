"use client";

import React, { useState, useEffect } from "react";
import WarehouseClient from "./WarehouseClient";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WarehouseVisualizerPage() {
    const router = useRouter();
    const [backendUrl, setBackendUrl] = useState("http://77.42.39.77:8000");
    const [warehouses, setWarehouses] = useState<{id: string, name: string}[] | null>(null);
    const [racksMap, setRacksMap] = useState<Record<string, any> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedUrl = localStorage.getItem("erp_backend_url") || "http://77.42.39.77:8000";
            setBackendUrl(savedUrl);
        }
    }, []);

    useEffect(() => {
        if (!backendUrl) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [whRes, layoutRes] = await Promise.all([
                    fetch(`${backendUrl}/wms/root-warehouses`, { mode: "cors" }),
                    fetch(`${backendUrl}/wms/warehouse-layout`, { mode: "cors" })
                ]);
                
                if (!whRes.ok) throw new Error("Failed to fetch root warehouses");
                if (!layoutRes.ok) throw new Error("Failed to fetch warehouse layout data");
                
                const whData = await whRes.json();
                const layoutData = await layoutRes.json();
                
                setWarehouses(whData);
                setRacksMap(layoutData);
            } catch (err: any) {
                console.error("Error fetching warehouse data:", err);
                setError(err.message || "Failed to load warehouse data");
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [backendUrl]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-slate-800">Loading Warehouse Data</h2>
                <p className="text-slate-500 text-sm mt-2">Fetching structure from ERPNext...</p>
            </div>
        );
    }

    if (error || !warehouses || !racksMap) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center p-8 font-sans">
                <div className="w-full max-w-2xl bg-white border border-rose-200 rounded-2xl shadow-sm p-8 flex flex-col items-center text-center mt-20">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-rose-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Connection Error</h2>
                    <p className="text-slate-600 mb-8">{error || "Unknown error occurred"}</p>
                    
                    <button 
                        onClick={() => router.push("/dashboard")}
                        className="bg-slate-900 text-white hover:bg-slate-800 px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return <WarehouseClient initialWarehouses={warehouses} initialRacksMap={racksMap} backendUrl={backendUrl} />;
}
