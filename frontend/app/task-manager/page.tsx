"use client";

import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, RefreshCw, LayoutList, CheckCircle2, Clock, MoveRight, Combine, ClipboardCheck, Truck, X } from "lucide-react";

export default function TaskManager() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [bins, setBins] = useState<string[]>([]);
  const [pallets, setPallets] = useState<string[]>([]);
  const [newTask, setNewTask] = useState({
    task_type: "Move Pallet",
    source_pallet: "",
    target_pallet: "",
    notes: ""
  });

  const [backendUrl, setBackendUrl] = useState<string>("http://77.42.39.77:8000");

  useEffect(() => {
    if (!backendUrl) return;
    const fetchLocations = async () => {
      try {
        setFetchError("");
        const binRes = await fetchWithAuth(`${backendUrl}/wms/bins/all`);
        if (binRes.ok) {
          const json = await binRes.json();
          setBins(json.bins.map((b: any) => b.name));
        } else {
          setFetchError(`Bin API Error: ${binRes.status} ${binRes.statusText}`);
        }

        const palRes = await fetchWithAuth(`${backendUrl}/wms/pallets/all`);
        if (palRes.ok) {
          const json = await palRes.json();
          setPallets(json.pallets.map((p: any) => p.name));
        } else {
          setFetchError((prev) => prev ? prev + ` | Pallet API Error: ${palRes.status} ${palRes.statusText}` : `Pallet API Error: ${palRes.status} ${palRes.statusText}`);
        }
      } catch (err: any) {
        setFetchError(`Network Error: ${err.message}`);
        console.error("Failed to fetch locations", err);
      }
    };
    fetchLocations();
  }, [backendUrl]);

  const fetchTasks = async () => {
    if (!backendUrl) return;
    setLoading(true);
    try {
      const resPending = await fetchWithAuth(`${backendUrl}/wms/tasks?status=Pending`);
      const resProgress = await fetchWithAuth(`${backendUrl}/wms/tasks?status=In Progress`);
      const resCompleted = await fetchWithAuth(`${backendUrl}/wms/tasks?status=Completed`);

      let allTasks: any[] = [];
      if (resPending.ok) allTasks = [...allTasks, ...(await resPending.json())];
      if (resProgress.ok) allTasks = [...allTasks, ...(await resProgress.json())];
      if (resCompleted.ok) allTasks = [...allTasks, ...(await resCompleted.json())];

      // Sort by creation desc
      allTasks.sort((a, b) => new Date(b.creation).getTime() - new Date(a.creation).getTime());
      setTasks(allTasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [backendUrl]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.source_pallet) {
      alert("Source Pallet is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`${backendUrl}/wms/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask)
      });
      if (res.ok) {
        setIsCreating(false);
        setNewTask({ task_type: "Move Pallet", source_pallet: "", target_pallet: "", notes: "" });
        fetchTasks();
      } else {
        alert("Failed to create task");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500/30">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <LayoutList className="w-6 h-6 text-indigo-600" />
              Task Manager
            </h1>
            {fetchError && (
              <p className="text-xs text-red-500 font-medium mt-1">{fetchError}</p>
            )}
            <p className="text-sm font-medium text-slate-500 mt-0.5">Assign and monitor warehouse tasks</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTasks}
            className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 bg-white shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all text-sm flex items-center gap-2 shadow-sm shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Assign New Task
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Task ID</th>
                  <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500 font-medium">
                      <div className="flex flex-col items-center gap-3">
                        <LayoutList className="w-8 h-8 text-slate-400" />
                        No tasks found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5 text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{task.name}</td>
                      <td className="px-6 py-5 text-sm font-medium text-slate-600">{task.task_type}</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${task.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          task.status === "In Progress" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                          {task.status === "Completed" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">{task.source_pallet || "-"}</td>
                      <td className="px-6 py-5 text-sm text-slate-600">{task.target_pallet || "-"}</td>
                      <td className="px-6 py-5 text-sm text-slate-500">
                        {new Date(task.creation).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Task Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCreating(false)} />
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl w-full max-w-xl max-h-[95vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 to-transparent opacity-50 pointer-events-none" />

            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center relative z-10 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Assign New Task</h2>
                <p className="text-sm text-slate-500 mt-1">Select a task type and configure details.</p>
              </div>
              <button type="button" onClick={() => setIsCreating(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-8 flex flex-col gap-6 relative z-10 overflow-y-auto">
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700">Task Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "Move Pallet", icon: MoveRight, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
                    { id: "Merge Pallets", icon: Combine, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
                    { id: "Stock Count", icon: ClipboardCheck, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
                    { id: "Dispatch", icon: Truck, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                  ].map((type) => {
                    const isSelected = newTask.task_type === type.id;
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewTask({ ...newTask, task_type: type.id })}
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${isSelected
                          ? `border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600`
                          : `border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300`
                          }`}
                      >
                        <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-indigo-100 text-indigo-700' : `${type.bg} ${type.color}`}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {type.id}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">
                  {newTask.task_type === "Move Pallet" ? "Source Bin" : newTask.task_type === "Merge Pallets" ? "Source Pallet" : "Source Location"}
                </label>
                <select
                  required
                  className="px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 transition-all shadow-sm"
                  value={newTask.source_pallet}
                  onChange={(e) => setNewTask({ ...newTask, source_pallet: e.target.value })}
                >
                  <option value="" disabled>Select Source</option>
                  {(newTask.task_type === "Move Pallet" || newTask.task_type === "Stock Count" ? bins : newTask.task_type === "Merge Pallets" ? pallets : [...bins, ...pallets]).map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {(newTask.task_type === "Move Pallet" || newTask.task_type === "Merge Pallets") && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200 fade-in">
                  <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    {newTask.task_type === "Move Pallet" ? "Target Bin" : "Target Pallet"}
                    <span className="text-xs font-medium text-slate-400">Optional</span>
                  </label>
                  <select
                    className="px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 transition-all shadow-sm"
                    value={newTask.target_pallet}
                    onChange={(e) => setNewTask({ ...newTask, target_pallet: e.target.value })}
                  >
                    <option value="">Select Target (Optional)</option>
                    {(newTask.task_type === "Move Pallet" ? bins : pallets).map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                  Notes
                  <span className="text-xs font-medium text-slate-400">Optional</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Add instructions..."
                  className="px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder-slate-400 transition-all resize-none shadow-sm"
                  value={newTask.notes}
                  onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-6 py-2.5 font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 text-sm flex items-center gap-2 shadow-sm"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
