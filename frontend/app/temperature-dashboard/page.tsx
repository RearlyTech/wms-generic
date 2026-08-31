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
  Thermometer,
  Wind,
  Droplets,
  ArrowLeft,
  Settings
} from "lucide-react";

// Types
interface LiveData {
  time: string;
  temperature: string;
  humidity: string;
}

interface ChartData {
  time: string;
  temperature: number;
  humidity: number;
}

export default function TemperatureDashboard() {
  const router = useRouter();
  const [liveData, setLiveData] = useState<LiveData>({
    time: "--:--:--",
    temperature: "--",
    humidity: "--",
  });

  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  // Assuming backend runs on 8000 in dev
  const [backendUrl, setBackendUrl] = useState("http://77.42.39.77:8000");

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
    const fetchLive = async () => {
      try {
        const res = await fetchWithAuth(`${backendUrl}/api/temperature/live`);
        if (res.ok) {
          const data = await res.json();
          console.log("temperature dashboard", data)
          if (data.success && data.values) {
            const v = data.values;
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const temp = parseFloat(v.temperature) || 0;
            const hum = parseFloat(v.humidity) || 0;

            setLiveData({
              time: timeStr,
              temperature: temp.toFixed(1),
              humidity: hum.toFixed(1),
            });

            setChartData((prev) => {
              const newData = [...prev, { time: timeStr, temperature: temp, humidity: hum }];
              return newData.slice(-60); // Keep last 60 points
            });
          }
        }
      } catch (err) {
        console.error("Error fetching live data:", err);
      }
    };

    const fetchHistory = async () => {
      try {
        const [res, thRes] = await Promise.all([
          fetchWithAuth(`${backendUrl}/api/temperature/history`),
          fetch(`${backendUrl}/wms/thresholds`)
        ]);

        let targetTemp = 30;
        let targetHum = 70;
        let currentThresholds = { temperature: 30, humidity: 70, energy: 50 };
        if (thRes.ok) {
          const thData = await thRes.json();
          targetTemp = thData.temperature || 30;
          targetHum = thData.humidity || 70;
          currentThresholds = thData;
          setThresholds(currentThresholds);
        }

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.history) {

            // 1. Group by YYYY-MM-DD to find average temp/humidity per day
            const tempSums: Record<string, number> = {};
            const humSums: Record<string, number> = {};
            const counts: Record<string, number> = {};

            data.history.forEach((h: any) => {
              if (h.created_at && h.values) {
                const temp = parseFloat(h.values.temperature);
                const hum = parseFloat(h.values.humidity);

                // Only include valid numerical readings to prevent NaN from breaking the averages
                if (!isNaN(temp) && !isNaN(hum)) {
                  const dateObj = new Date(h.created_at);
                  const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

                  if (!counts[dateKey]) {
                    tempSums[dateKey] = 0;
                    humSums[dateKey] = 0;
                    counts[dateKey] = 0;
                  }

                  tempSums[dateKey] += temp;
                  humSums[dateKey] += hum;
                  counts[dateKey] += 1;
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

              let avgTemp = 0;
              let avgHum = 0;

              if (counts[dateKey]) {
                avgTemp = tempSums[dateKey] / counts[dateKey];
                avgHum = humSums[dateKey] / counts[dateKey];
              }

              newHistory.push({
                day: `${dayStr} ${dateStr}`,
                temperature: Number(avgTemp.toFixed(1)),
                humidity: Number(avgHum.toFixed(1)),
                targetTemp,
                targetHum
              });
            }

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
                Ambient Monitoring
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

        {/* Top KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* KPI Card 1 - Temperature */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-rose-500/30 transition-colors duration-500">
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
              <Thermometer size={100} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-500">
                <Thermometer size={22} />
              </div>
              <h3 className="text-slate-500 font-medium">Ambient Temperature</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800 tracking-tight">{liveData.temperature}</span>
              <span className="text-rose-500 font-medium">°C</span>
            </div>
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
              Main Facility
            </p>
          </div>

          {/* KPI Card 2 - Humidity */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-colors duration-500">
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
              <Droplets size={100} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-500">
                <Droplets size={22} />
              </div>
              <h3 className="text-slate-500 font-medium">Relative Humidity</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800 tracking-tight">{liveData.humidity}</span>
              <span className="text-blue-500 font-medium">% RH</span>
            </div>
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
              Main Facility
            </p>
          </div>
        </div>

        <div className="mb-8">
          {/* Streaming Chart */}
          <div className="w-full bg-white border border-slate-200 shadow-sm rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-800 tracking-wide">Live Ambient Streaming</h2>
                <p className="text-sm text-slate-500 mt-1">Real-time temperature and humidity tracking</p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-500/10 text-slate-500 text-xs font-medium border border-slate-500/20">
                  1m Window
                </span>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                    yAxisId="left"
                    stroke="#f43f5e"
                    tick={{ fill: "#f43f5e", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#3b82f6"
                    tick={{ fill: "#3b82f6", fontSize: 12 }}
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
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    name="Temperature (°C)"
                    type="monotone"
                    dataKey="temperature"
                    stroke="url(#colorTemp)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    name="Humidity (%)"
                    type="monotone"
                    dataKey="humidity"
                    stroke="url(#colorHum)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
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
              <h2 className="text-xl font-semibold text-slate-800 tracking-wide">Historical Ambient Conditions</h2>
              <p className="text-sm text-slate-500 mt-1">Average daily temperature & humidity over the last 7 days</p>
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
                  yAxisId="left"
                  stroke="#f43f5e"
                  tick={{ fill: "#f43f5e", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#3b82f6"
                  tick={{ fill: "#3b82f6", fontSize: 12 }}
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
                <Bar yAxisId="left" name="Avg Temperature (°C)" dataKey="temperature" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar yAxisId="right" name="Avg Humidity (%)" dataKey="humidity" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                <ReferenceLine yAxisId="left" y={22} label={{ position: 'top', value: 'Target Temp', fill: '#f43f5e', fontSize: 12 }} stroke="#f43f5e" strokeDasharray="3 3" />
                <ReferenceLine yAxisId="right" y={45} label={{ position: 'top', value: 'Target Hum', fill: '#3b82f6', fontSize: 12 }} stroke="#3b82f6" strokeDasharray="3 3" />
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
