"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Layers,
  Info,
  FilePenLine
} from "lucide-react";

interface FieldInput {
  label: string;
  fieldname: string;
  fieldtype: string;
  options: string;
  reqd: boolean;
  in_list_view: boolean;
}

const FIELD_TYPES = [
  "Data",
  "Int",
  "Float",
  "Select",
  "Date",
  "Link",
  "Check",
  "Text",
  "Long Text",
  "Code",
  "Currency",
  "Read Only"
];

export default function NewDocTypePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Form states
  const [doctypeName, setDoctypeName] = useState("");
  const [autoname, setAutoname] = useState("Prompt");
  const [fields, setFields] = useState<FieldInput[]>([
    { label: "Title", fieldname: "title", fieldtype: "Data", options: "", reqd: true, in_list_view: true }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Authenticate session check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("erp_token");
      let savedBackendUrl = localStorage.getItem("erp_backend_url");
      if (savedToken) {
        setIsAuthenticated(true);
      } else {
        router.push("/login");
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
      setIsLoading(false);
    }
  }, [router]);

  const handleAddField = () => {
    setFields([
      ...fields,
      { label: "", fieldname: "", fieldtype: "Data", options: "", reqd: false, in_list_view: false }
    ]);
  };

  const handleRemoveField = (index: number) => {
    if (fields.length <= 1) return;
    const updated = [...fields];
    updated.splice(index, 1);
    setFields(updated);
  };

  const handleFieldChange = (index: number, key: keyof FieldInput, value: any) => {
    const updated = [...fields];
    updated[index] = {
      ...updated[index],
      [key]: value
    };
    
    // Automatically slugify for fieldname if label changed
    if (key === "label") {
      updated[index].fieldname = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9_ ]/g, "")
        .replace(/\s+/g, "_");
    }
    
    setFields(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctypeName.trim()) {
      setSubmitError("DocType Name is required.");
      return;
    }
    
    // Simple validation on fields
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label.trim()) {
        setSubmitError(`Field #${i + 1} has an empty Label.`);
        return;
      }
      if (!fields[i].fieldname.trim()) {
        setSubmitError(`Field #${i + 1} has an empty Field Name.`);
        return;
      }
      if ((fields[i].fieldtype === "Link" || fields[i].fieldtype === "Select") && !fields[i].options.trim()) {
        setSubmitError(`Field #${i + 1} (${fields[i].label}) of type "${fields[i].fieldtype}" requires Options (e.g. DocType target or select options).`);
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const payload = {
        doctype_name: doctypeName.trim(),
        autoname: autoname,
        fields: fields.map(f => ({
          fieldname: f.fieldname.trim(),
          label: f.label.trim(),
          fieldtype: f.fieldtype,
          options: f.options.trim() || null,
          reqd: f.reqd ? 1 : 0,
          in_list_view: f.in_list_view ? 1 : 0
        }))
      };

      const res = await fetch(`${backendUrl}/doctype`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        setSubmitSuccess(true);
        // Reset form
        setDoctypeName("");
        setFields([{ label: "Title", fieldname: "title", fieldtype: "Data", options: "", reqd: true, in_list_view: true }]);
      } else {
        setSubmitError(data.detail || JSON.stringify(data) || "Failed to create DocType.");
      }
    } catch (err: any) {
      setSubmitError(`Cannot reach backend. Details: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans antialiased">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold font-mono">
          <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
          Verifying session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased">
      {/* HEADER NAVBAR */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 shadow-sm transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FilePenLine className="h-5 w-5 text-indigo-600" />
              ERPNext DocType Builder
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold">
              Create new custom data structures in ERPNext dynamically
            </p>
          </div>
        </div>
      </header>

      {/* BODY CONTENT */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        {submitSuccess && (
          <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-650 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Success!</h3>
              <p className="text-xs mt-0.5 leading-relaxed font-semibold">
                Custom DocType has been registered and initialized in ERPNext database successfully.
              </p>
              <button
                onClick={() => setSubmitSuccess(false)}
                className="mt-2 text-[10px] font-bold text-emerald-700 hover:underline"
              >
                Create Another DocType
              </button>
            </div>
          </div>
        )}

        {submitError && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Error Creating DocType</h3>
              <p className="text-xs mt-0.5 leading-relaxed font-semibold">{submitError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                DocType Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={doctypeName}
                onChange={(e) => setDoctypeName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-slate-400 font-sans"
                placeholder="e.g. Device Status or Murukku Batch"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                Auto Naming Rule
              </label>
              <select
                value={autoname}
                onChange={(e) => setAutoname(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-slate-400"
              >
                <option value="Prompt">Prompt (User specifies document ID)</option>
                <option value="hash">Hash (Unique 10-char string)</option>
                <option value="field:title">Field: title</option>
              </select>
            </div>
          </div>

          {/* Fields Setup */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Layers className="h-4 w-4" />
                DocFields Configuration
              </h3>
              <button
                type="button"
                onClick={handleAddField}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-250 border border-slate-350 text-slate-700 rounded transition"
              >
                <Plus className="h-3 w-3" />
                Add Row
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-mono text-[9px] border-b border-slate-200">
                    <th className="py-2.5 px-3 w-36">Label Name</th>
                    <th className="py-2.5 px-3 w-36">Field Name</th>
                    <th className="py-2.5 px-3 w-32">Type</th>
                    <th className="py-2.5 px-3">Options / Links</th>
                    <th className="py-2.5 px-3 w-16 text-center">Reqd</th>
                    <th className="py-2.5 px-3 w-16 text-center">List</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    const needsOptions = field.fieldtype === "Link" || field.fieldtype === "Select";
                    return (
                      <tr key={index} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition">
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            value={field.label}
                            onChange={(e) => handleFieldChange(index, "label", e.target.value)}
                            placeholder="e.g. Device ID"
                            className="w-full bg-white border border-slate-200 rounded py-1 px-2 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            value={field.fieldname}
                            onChange={(e) => handleFieldChange(index, "fieldname", e.target.value)}
                            placeholder="device_id"
                            className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-2 text-xs text-slate-600 font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={field.fieldtype}
                            onChange={(e) => handleFieldChange(index, "fieldtype", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded py-1 px-1.5 text-xs text-slate-800"
                          >
                            {FIELD_TYPES.map(ft => (
                              <option key={ft} value={ft}>{ft}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          {needsOptions ? (
                            <input
                              type="text"
                              required
                              value={field.options}
                              onChange={(e) => handleFieldChange(index, "options", e.target.value)}
                              placeholder={field.fieldtype === "Link" ? "Target DocType (e.g. User)" : "Option A\\nOption B"}
                              className="w-full bg-white border border-amber-250 rounded py-1 px-2 text-xs text-slate-800 font-mono placeholder:text-slate-350"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400 px-2 italic select-none">No options required</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={field.reqd}
                            onChange={(e) => handleFieldChange(index, "reqd", e.target.checked)}
                            className="h-3.5 w-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={field.in_list_view}
                            onChange={(e) => handleFieldChange(index, "in_list_view", e.target.checked)}
                            className="h-3.5 w-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            disabled={fields.length <= 1}
                            onClick={() => handleRemoveField(index)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 active:bg-rose-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Help Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-slate-600">
            <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-800">DocType Creation Quick Notes:</span>
              <p>
                By building a new DocType, ERPNext automatically creates the backend database tables, security rules, 
                and core controller modules. Custom DocTypes will belong to the <strong>Custom</strong> module with full 
                permissions granted to the <strong>System Manager</strong> role by default.
              </p>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-600 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating DocType...
                </>
              ) : (
                "Create DocType in ERPNext"
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
