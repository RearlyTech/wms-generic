"use client";

import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, RefreshCw, LayoutList, CheckCircle2, Clock } from "lucide-react";

export default function TaskManager() {
  const router = useRouter();
  const [backendUrl, setBackendUrl] = useState<string>("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({
    task_type: "Move Pallet",
    source_pallet: "",
    target_pallet: "",
    notes: ""
  });

  useEffect(() => {
    setBackendUrl(localStorage.getItem("backendUrl") || "http://127.0.0.1:8000");
  }, []);

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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <LayoutList className="w-5 h-5 text-indigo-600" />
              WMS Task Manager
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">Assign tasks to mobile workers</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchTasks}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Assign New Task
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Task ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No tasks found.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-800">{task.name}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{task.task_type}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          task.status === "Completed" ? "bg-emerald-100 text-emerald-700" :
                          task.status === "In Progress" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {task.status === "Completed" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{task.source_pallet || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{task.target_pallet || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(task.creation).toLocaleString()}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Assign New Task</h2>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Task Type</label>
                <select 
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newTask.task_type}
                  onChange={(e) => setNewTask({...newTask, task_type: e.target.value})}
                >
                  <option value="Move Pallet">Move Pallet</option>
                  <option value="Merge Pallets">Merge Pallets</option>
                  <option value="Stock Count">Stock Count</option>
                  <option value="Dispatch">Dispatch</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Source Pallet</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Pallet-001"
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newTask.source_pallet}
                  onChange={(e) => setNewTask({...newTask, source_pallet: e.target.value})}
                />
              </div>

              {(newTask.task_type === "Move Pallet" || newTask.task_type === "Merge Pallets") && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Target Pallet / Location (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. Pallet-002 or Bin-A"
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newTask.target_pallet}
                    onChange={(e) => setNewTask({...newTask, target_pallet: e.target.value})}
                  />
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Notes (Optional)</label>
                <textarea 
                  rows={2}
                  placeholder="Add instructions..."
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={newTask.notes}
                  onChange={(e) => setNewTask({...newTask, notes: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
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
