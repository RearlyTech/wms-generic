"use client";

import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
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
  DoorClosed,
  Thermometer,
  Bell,
  Wind,
  Settings,
  BellRing,
  ShieldCheck,
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
  const [backendUrl, setBackendUrl] = useState("http://77.42.39.77:8000");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
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
  const [alarmStatus, setAlarmStatus] = useState<string>("Unknown");
  const [amoniaStatus, setAmoniaStatus] = useState<string>("Unknown");

  useEffect(() => {
    const fetchDoorStatus = async () => {
      try {
        let res = await fetchWithAuth(`${backendUrl}/wms/door-status`);

        if (res.ok) {
          const json = await res.json();
          if (json.door_status) {
            setDoorStatus(json.door_status);
          }
          if (json.alarm_status) {
            setAlarmStatus(json.alarm_status);
          }
          if (json.amonia_status) {
            setAmoniaStatus(json.amonia_status);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch door status from Directus", err);
      }
    };

    fetchDoorStatus();
    const interval = setInterval(fetchDoorStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [backendUrl]);

  const [gatewayStatus, setGatewayStatus] = useState<any>(null);

  useEffect(() => {
    if (!backendUrl) return;
    const fetchGatewayStatus = async () => {
      try {
        let res = await fetchWithAuth(`${backendUrl}/wms/gateway-status`);
        if (res.ok) {
          const json = await res.json();
          setGatewayStatus(json);
        }
      } catch (err) {
        console.warn("Failed to fetch gateway status", err);
      }
    };
    
    fetchGatewayStatus();
    const interval = setInterval(fetchGatewayStatus, 10000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const [thresholds, setThresholds] = useState({ temperature: 30, humidity: 70, energy: 50 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [tempThreshold, setTempThreshold] = useState("30");
  const [humThreshold, setHumThreshold] = useState("70");
  const [energyThreshold, setEnergyThreshold] = useState("50");

  useEffect(() => {
    if (!backendUrl) return;

    const fetchThresholdsAndLive = async () => {
      try {
        let thRes = await fetch(`${backendUrl}/wms/thresholds`);
        let currentThresholds = { temperature: 30, humidity: 70, energy: 50 };
        if (thRes.ok) {
          currentThresholds = await thRes.json();
          setThresholds(currentThresholds);
        }

        let newAlerts: string[] = [];

        let tempRes = await fetchWithAuth(`${backendUrl}/api/temperature/live`);
        if (tempRes.ok) {
           let tempData = await tempRes.json();
           if (tempData.success && tempData.values) {
              if (tempData.values.temperature > currentThresholds.temperature) {
                 newAlerts.push(`High Temperature: ${tempData.values.temperature}°C (Limit: ${currentThresholds.temperature}°C)`);
              }
              if (tempData.values.humidity > currentThresholds.humidity) {
                 newAlerts.push(`High Humidity: ${tempData.values.humidity}% (Limit: ${currentThresholds.humidity}%)`);
              }
           }
        }

        let energyRes = await fetchWithAuth(`${backendUrl}/api/energy/live`);
        if (energyRes.ok) {
           let energyData = await energyRes.json();
           if (energyData.success && energyData.values) {
              if (energyData.values.activeEnergy > currentThresholds.energy) {
                 newAlerts.push(`High Energy: ${energyData.values.activeEnergy}kWh (Limit: ${currentThresholds.energy}kWh)`);
              }
           }
        }
        setAlerts(newAlerts);
      } catch (err) {
        console.warn("Failed to fetch thresholds/live metrics", err);
      }
    };

    fetchThresholdsAndLive();
    const interval = setInterval(fetchThresholdsAndLive, 10000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const handleSaveThresholds = async () => {
    try {
      const payload = {
        temperature: parseFloat(tempThreshold),
        humidity: parseFloat(humThreshold),
        energy: parseFloat(energyThreshold)
      };
      await fetch(`${backendUrl}/wms/thresholds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setThresholds(payload as any);
      setIsSettingsOpen(false);
    } catch (e) {
      console.error("Failed to save thresholds", e);
    }
  };

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

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/energy-dashboard")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm transition cursor-pointer"
          >
            <Factory className="h-4 w-4" />
            Energy Analytics
          </button>
          <button
            onClick={() => router.push("/temperature-dashboard")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-sm transition cursor-pointer"
          >
            <Thermometer className="h-4 w-4" />
            Temperature
          </button>
          <button
            onClick={() => {
              setTempThreshold(thresholds.temperature.toString());
              setHumThreshold(thresholds.humidity.toString());
              setEnergyThreshold(thresholds.energy.toString());
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            Targets
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-rose-50 active:bg-rose-100 text-rose-600 border border-slate-200 hover:border-rose-200 shadow-sm transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
        
        {/* Alerts Banner */}
        {alerts.length > 0 && (
          <section>
             <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
               <div className="flex items-center gap-2 text-rose-700 font-bold">
                 <BellRing className="w-5 h-5 animate-bounce" />
                 Threshold Warnings
               </div>
               <div className="flex flex-col gap-1 ml-7 text-sm font-medium text-rose-600">
                 {alerts.map((a, i) => <div key={i}>• {a}</div>)}
               </div>
             </div>
          </section>
        )}

        {/* Gateway Status Banner */}
        {gatewayStatus && (
          <section>
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm transition-colors ${gatewayStatus.gateway_online ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div className="flex items-center gap-3">
                 <div className="relative flex h-4 w-4">
                   <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${gatewayStatus.gateway_online ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                   <span className={`relative inline-flex rounded-full h-4 w-4 ${gatewayStatus.gateway_online ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                 </div>
                 <h3 className={`font-bold tracking-tight text-sm ${gatewayStatus.gateway_online ? 'text-emerald-800' : 'text-rose-800'}`}>
                   MQTT Gateway: {gatewayStatus.gateway_online ? 'ONLINE' : 'OFFLINE'}
                 </h3>
              </div>
              <div className="flex flex-wrap gap-4 bg-white/50 px-3 py-2 rounded-lg border border-white/20">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <div className={`h-2.5 w-2.5 rounded-full shadow-inner ${gatewayStatus.sensors?.ambient_xyth_1?.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  Temperature Sensor
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <div className={`h-2.5 w-2.5 rounded-full shadow-inner ${gatewayStatus.sensors?.energy_meter_1?.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  Energy Meter
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <div className={`h-2.5 w-2.5 rounded-full shadow-inner ${gatewayStatus.sensors?.door_sensor_1?.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  Door Sensor
                </div>
              </div>
            </div>
          </section>
        )}

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

              {/* Metric 8 - Alarm Status */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Bell className={`w-16 h-16 ${alarmStatus === 'ACTIVE' ? 'text-rose-500' : 'text-slate-400'}`} />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Alarm Status</p>
                <div className="flex items-baseline gap-2">
                  <h3 className={`text-3xl font-black ${alarmStatus === 'ACTIVE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {alarmStatus || "Unknown"}
                  </h3>
                </div>
              </div>

              {/* Metric 9 - Ammonia Status */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Wind className={`w-16 h-16 ${amoniaStatus === 'HIGH' ? 'text-rose-500' : 'text-slate-400'}`} />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ammonia Status</p>
                <div className="flex items-baseline gap-2">
                  <h3 className={`text-3xl font-black ${amoniaStatus === 'HIGH' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {amoniaStatus || "Unknown"}
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
              onClick={() => router.push("/verify-received-quantity")}
              className="flex flex-col items-start p-6 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-2xl transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-amber-900 mb-1">Verify Received Quantity</h3>
              <p className="text-xs font-medium text-amber-700">Check pallet stock and weights.</p>
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

            <button
              onClick={() => router.push("/pallet-approvals")}
              className="flex flex-col items-start p-6 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-2xl transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-sky-900 mb-1">Pallet Approvals</h3>
              <p className="text-xs font-medium text-sky-700">Review status change requests.</p>
            </button>
            
            <button
              onClick={() => router.push("/pallet-reservation")}
              className="flex flex-col items-start p-6 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-2xl transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                <Boxes className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-teal-900 mb-1">Pallet Reservation</h3>
              <p className="text-xs font-medium text-teal-700">Manage reserved stock & locations.</p>
            </button>
          </div>
        </section>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-slate-800">Target Thresholds</h2>
            <p className="text-sm text-slate-500 mb-2">Set the limits. Warnings will trigger if live data exceeds these targets.</p>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Max Temperature (°C)</label>
              <input type="number" value={tempThreshold} onChange={(e) => setTempThreshold(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Max Humidity (%)</label>
              <input type="number" value={humThreshold} onChange={(e) => setHumThreshold(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Max Energy (kWh)</label>
              <input type="number" value={energyThreshold} onChange={(e) => setEnergyThreshold(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
              <button onClick={handleSaveThresholds} className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition">Save Targets</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
