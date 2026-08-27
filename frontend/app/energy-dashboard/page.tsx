"use client";

import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Zap,
  Activity,
  Gauge,
  Power,
  TrendingUp,
  Factory,
  ArrowDownRight,
  ArrowUpRight,
  Plug,
  ArrowLeft,
  Settings
} from "lucide-react";

// Types
interface LiveData {
  time: string;
  voltage: string;
  frequency: string;
  activePower: string;
  powerFactor: string;
}

interface ChartData {
  time: string;
  power: number;
}

export default function EnergyDashboard() {
  const router = useRouter();
  const [liveData, setLiveData] = useState<LiveData>({
    time: "00:00:00",
    voltage: "230.20",
    frequency: "49.88",
    activePower: "9.30",
    powerFactor: "0.999",
  });

  const [chartData, setChartData] = useState<ChartData[]>([]);

  const [historicalData, setHistoricalData] = useState([
    { day: "Mon", energy: 120, target: 115 },
    { day: "Tue", energy: 135, target: 115 },
    { day: "Wed", energy: 125, target: 115 },
    { day: "Thu", energy: 140, target: 115 },
    { day: "Fri", energy: 115, target: 115 },
    { day: "Sat", energy: 90, target: 115 },
    { day: "Sun", energy: 85, target: 115 },
  ]);

  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");

  const [thresholds, setThresholds] = useState({ temperature: 30, humidity: 70, energy: 50 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempThreshold, setTempThreshold] = useState("30");
  const [humThreshold, setHumThreshold] = useState("70");
  const [energyThreshold, setEnergyThreshold] = useState("50");

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("erp_backend_url") || "http://localhost:8000";
      setBackendUrl(savedUrl);
    }
  }, []);

  useEffect(() => {
    if (!backendUrl) return;

    // Initialize chart with empty data
    setChartData(Array.from({ length: 20 }, () => ({ time: "", power: 0 })));

    const fetchLive = async () => {
      try {
        const res = await fetchWithAuth(`${backendUrl}/api/energy/live`);
        if (res.ok) {
          const data = await res.json();
          console.log("API Response Data:", data);
          if (data.success && data.values) {
            const v = data.values;
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const pwr = parseFloat(v.activePower) || 0;
            console.log("live values: ", v)
            setLiveData({
              time: timeStr,
              voltage: parseFloat(v.voltage || 0).toFixed(2),
              frequency: parseFloat(v.frequency || 0).toFixed(2),
              activePower: pwr.toFixed(2),
              powerFactor: parseFloat(v.powerFactor || 0).toFixed(3),
            });

            setChartData((prev) => {
              const newChart = [...prev, { time: timeStr, power: pwr }];
              if (newChart.length > 20) newChart.shift();
              return newChart;
            });
          }
        }
      } catch (err) {
        console.error("Error fetching live energy:", err);
      }
    };

    const fetchHistory = async () => {
      try {
        const [res, thRes] = await Promise.all([
          fetchWithAuth(`${backendUrl}/api/energy/history`),
          fetch(`${backendUrl}/wms/thresholds`)
        ]);

        let targetEnergy = 50;
        let currentThresholds = { temperature: 30, humidity: 70, energy: 50 };
        if (thRes.ok) {
          const thData = await thRes.json();
          targetEnergy = thData.energy || 50;
          currentThresholds = thData;
          setThresholds(currentThresholds);
        }

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.history) {
            
            // 1. Group by YYYY-MM-DD to find min/max activeEnergy per day
            const maxEnergyPerDay: Record<string, number> = {};
            const minEnergyPerDay: Record<string, number> = {};
            
            data.history.forEach((h: any) => {
              if (h.created_at && h.values && h.values.activeEnergy) {
                const dateObj = new Date(h.created_at);
                const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
                const energy = parseFloat(h.values.activeEnergy);
                
                if (maxEnergyPerDay[dateKey] === undefined || energy > maxEnergyPerDay[dateKey]) {
                  maxEnergyPerDay[dateKey] = energy;
                }
                if (minEnergyPerDay[dateKey] === undefined || energy < minEnergyPerDay[dateKey]) {
                  minEnergyPerDay[dateKey] = energy;
                }
              }
            });

            // 2. Generate the last 7 days dynamically
            const newHistory = [];
            const today = new Date();
            
            for (let i = 6; i >= 0; i--) {
              const d = new Date(today);
              d.setDate(today.getDate() - i);
              const dateKey = d.toISOString().split('T')[0];
              
              const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
              const dateStr = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
              
              // Calculate consumption: max today - max yesterday
              const prevDate = new Date(d);
              prevDate.setDate(d.getDate() - 1);
              const prevDateKey = prevDate.toISOString().split('T')[0];
              
              let dailyEnergy = 0;
              if (maxEnergyPerDay[dateKey] !== undefined) {
                 if (maxEnergyPerDay[prevDateKey] !== undefined) {
                    // Difference from end of yesterday
                    dailyEnergy = maxEnergyPerDay[dateKey] - maxEnergyPerDay[prevDateKey];
                 } else {
                    // Fallback to diff between first and last reading of today
                    dailyEnergy = maxEnergyPerDay[dateKey] - minEnergyPerDay[dateKey];
                 }
              }
              
              // Ensure we don't have negative numbers from weird anomalies
              dailyEnergy = Math.max(0, dailyEnergy);

              newHistory.push({
                day: `${dayStr} ${dateStr}`,
                energy: Number(dailyEnergy.toFixed(2)),
                target: targetEnergy
              });
            }
            
            console.log("Calculated Historical Data:", newHistory);
            setHistoricalData(newHistory);
          }
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };

    fetchLive();
    fetchHistory();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-sm"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Energy Monitoring
              </h1>
              <p className="text-slate-500 mt-1 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Live Telemetry Active • MQTT Broker Connected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setTempThreshold(thresholds.temperature.toString());
                setHumThreshold(thresholds.humidity.toString());
                setEnergyThreshold(thresholds.energy.toString());
                setIsSettingsOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              Targets
            </button>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">System Status</p>
                <p className="text-sm font-bold text-emerald-600">Optimal</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* KPI Card 1 */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-colors duration-500">
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
              <Zap size={100} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                <Zap size={22} />
              </div>
              <h3 className="text-slate-500 font-medium">Active Power</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800 tracking-tight">{liveData.activePower}</span>
              <span className="text-blue-400 font-medium">W</span>
            </div>
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
              <TrendingUp size={14} className="text-emerald-400" /> +0.2% from baseline
            </p>
          </div>

          {/* KPI Card 2 */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-colors duration-500">
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
              <Activity size={100} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
                <Activity size={22} />
              </div>
              <h3 className="text-slate-500 font-medium">Voltage (RMS)</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800 tracking-tight">{liveData.voltage}</span>
              <span className="text-purple-400 font-medium">V</span>
            </div>
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
              Phase 1 • Normal range
            </p>
          </div>

          {/* KPI Card 3 */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-colors duration-500">
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
              <Gauge size={100} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Gauge size={22} />
              </div>
              <h3 className="text-slate-500 font-medium">Frequency</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800 tracking-tight">{liveData.frequency}</span>
              <span className="text-emerald-400 font-medium">Hz</span>
            </div>
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
              Grid stability: 99.8%
            </p>
          </div>

          {/* KPI Card 4 */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-colors duration-500">
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
              <Power size={100} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <Power size={22} />
              </div>
              <h3 className="text-slate-500 font-medium">Power Factor</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800 tracking-tight">{liveData.powerFactor}</span>
              <span className="text-amber-400 font-medium">PF</span>
            </div>
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
              Highly efficient load
            </p>
          </div>
        </div>

        <div className="mb-8">
          {/* Streaming Chart */}
          <div className="w-full bg-white border border-slate-200 shadow-sm rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-800 tracking-wide">Live Power Streaming</h2>
                <p className="text-sm text-slate-500 mt-1">Real-time active power draw (W)</p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium border border-blue-500/30">
                  1m Window
                </span>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      backdropFilter: "blur(10px)",
                      color: "#1e293b",
                    }}
                    itemStyle={{ color: "#8b5cf6" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="power"
                    stroke="url(#colorPower)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: "#8b5cf6", stroke: "#0a0a0f", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Historical Bottom Row */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 tracking-wide">Historical Consumption</h2>
              <p className="text-sm text-slate-500 mt-1">Daily active energy trends over the last 7 days</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicalData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#94a3b8"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    backdropFilter: "blur(10px)",
                    color: "#1e293b",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <ReferenceLine y={115} label={{ position: 'top', value: 'Target', fill: '#fbbf24', fontSize: 12 }} stroke="#fbbf24" strokeDasharray="3 3" />
                <Bar dataKey="energy" name="Active Energy (kWh)" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

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
