"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  RotateCcw,
  Layers,
  ShoppingCart,
  Cpu,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Clock,
  ArrowRightLeft,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Cpu as ProcessIcon,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  Boxes,
  AlertTriangle,
  FilePenLine,
} from "lucide-react";

// Definitions of Steps
interface StepDefinition {
  id: number;
  phase: string;
  name: string;
  endpoint: string;
  method: "POST" | "GET";
  description: string;
  defaultInputs: Record<string, any>;
}

const PHASES = [
  { id: "setup", name: "1. Setup & Masters", color: "from-blue-600 to-cyan-500", icon: Layers },
  { id: "sales", name: "2. Sales Order & Customer Advance", color: "from-indigo-600 to-violet-500", icon: DollarSign },
  { id: "procurement", name: "3. Procurement & Stocking", color: "from-amber-600 to-orange-500", icon: ShoppingCart },
  { id: "manufacturing", name: "4. Unified Work Order Manager", color: "from-emerald-600 to-teal-500", icon: Cpu },
  { id: "closing", name: "5. Sales Invoicing & Closing", color: "from-rose-600 to-pink-500", icon: CheckCircle2 },
];

const STEPS: StepDefinition[] = [
  // Phase 1: Setup & Masters
  {
    id: 0,
    phase: "setup",
    name: "Create Warehouse",
    endpoint: "/warehouse",
    method: "POST",
    description: "Creates a new warehouse in ERPNext under your company's warehouse tree.",
    defaultInputs: {
      warehouse_name: "Maida5 warehouse",
      company: "Vishwha Murukku Foods",
      parent_warehouse: "",
      is_group: 0
    }
  },
  {
    id: 1,
    phase: "setup",
    name: "Create Raw Material Item",
    endpoint: "/rawmaterials",
    method: "POST",
    description: "Registers the raw material item (e.g. Maida flour) in ERPNext.",
    defaultInputs: {
      item_code: "Maida5",
      item_name: "Maida5",
      item_group: "Raw Material",
      stock_uom: "Kg",
      gst_hsn_code: "string",
      has_batch_no: 0,
      has_expiry_date: 0,
      create_new_batch: 0,
      batch_number_series: "MAIDA-BATCH-.#####",
      shelf_life_in_days: "string"
    }
  },
  {
    id: 2,
    phase: "setup",
    name: "Create Finished Product Item",
    endpoint: "/product",
    method: "POST",
    description: "Registers the manufactured product (e.g. Biscuit) in ERPNext.",
    defaultInputs: {
      item_code: "Biscuit5",
      item_name: "Biscuit5",
      item_group: "Products",
      stock_uom: "Kg",
      gst_hsn_code: "string",
      has_batch_no: 0,
      has_expiry_date: 0,
      create_new_batch: 0,
      batch_number_series: "BISCUIT-BATCH-.#####",
      shelf_life_in_days: "string"
    }
  },
  {
    id: 3,
    phase: "setup",
    name: "Create Bill of Materials (BOM)",
    endpoint: "/bom",
    method: "POST",
    description: "Establishes the ingredient ratio (BOM) linking the raw material to the product.",
    defaultInputs: {
      item: "Biscuit5",
      quantity: 100.0,
      uom: "Kg",
      raw_material: "Maida5",
      raw_material_qty: 900.0,
      raw_material_rate: 35.00,
      company: "Vishwha Murukku Foods"
    }
  },
  {
    id: 4,
    phase: "setup",
    name: "Create Putaway Rule",
    endpoint: "/putaway-rule",
    method: "POST",
    description: "Defines putaway capacity rules for stocking items in specific warehouses.",
    defaultInputs: {
      company: "",
      item_code: "",
      warehouse: "",
      capacity: "string",
      priority: 1
    }
  },
  // Phase 2: Sales
  {
    id: 5,
    phase: "sales",
    name: "Create & Submit Sales Order",
    endpoint: "/salesorder",
    method: "POST",
    description: "Records the customer request for biscuits, triggering the production demand.",
    defaultInputs: {
      customer: "Customer1",
      company: "Vishwha Murukku Foods",
      transaction_date: "2026-06-13",
      delivery_date: "2026-06-20",
      item_code: "Biscuit5",
      qty: 100.0,
      rate: 360.00,
      uom: "Kg",
      warehouse: "Biscuit5 finished warehouse - VMF"
    }
  },
  {
    id: 6,
    phase: "sales",
    name: "Customer Advance Payment",
    endpoint: "/payment-entry",
    method: "POST",
    description: "Records advance cash from the customer, allocating it to the Sales Order.",
    defaultInputs: {
      sales_order_name: "string", // will auto-populate with the sales order created in step 4
      amount: 18000.0,
      customer: "Customer1",
      company: "Vishwha Murukku Foods",
      paid_from: "Debtors - VMF",
      paid_to: "50200084736291 - HDFC Bank - Current A/C - VMF",
      reference_date: "2026-06-13"
    }
  },
  // Phase 3: Procurement
  {
    id: 7,
    phase: "procurement",
    name: "Create Purchase Order",
    endpoint: "/purchase-order",
    method: "POST",
    description: "Generates PO for raw materials based on BOM requirements (single batch).",
    defaultInputs: {
      supplier: "ABC Flour Mills",
      company: "Vishwha Murukku Foods",
      transaction_date: "2026-06-13",
      item_code: "Maida5",
      rate: 35.00,
      uom: "Kg",
      warehouse: "Maida5 warehouse - VMF",
      batch_1_qty: 900.0,
      batch_1_date: "2026-06-15",
      batch_2_qty: 0.0,
      batch_2_date: "",
      batch_3_qty: 0.0,
      batch_3_date: ""
    }
  },
  {
    id: 8,
    phase: "procurement",
    name: "Approve Purchase Order",
    endpoint: "/purchase-order/approve",
    method: "POST",
    description: "Programmatically approves the Purchase Order to change state to approved.",
    defaultInputs: {
      purchase_order_name: "string" // will auto-populate with PO created in step 6
    }
  },
  {
    id: 9,
    phase: "procurement",
    name: "Supplier Advance Payment",
    endpoint: "/supplier-payment",
    method: "POST",
    description: "Releases advance payment to the supplier before raw materials arrive.",
    defaultInputs: {
      purchase_order_name: "string", // will auto-populate
      amount: 9000.0,
      supplier: "ABC Flour Mills",
      company: "Vishwha Murukku Foods",
      paid_from: "50200084736291 - HDFC Bank - Current A/C - VMF",
      paid_to: "Creditors - VMF",
      reference_date: "2026-06-13"
    }
  },
  {
    id: 10,
    phase: "procurement",
    name: "Create Purchase Receipt",
    endpoint: "/purchase-receipt",
    method: "POST",
    description: "Confirms delivery of raw materials into the warehouse.",
    defaultInputs: {
      purchase_order_name: "string", // will auto-populate
      item_row_index: -1,
      item_code: "string",
      qty: "string",
      warehouse: "string",
      company: "string",
      supplier: "string",
      apply_putaway_rule: 0
    }
  },
  {
    id: 11,
    phase: "procurement",
    name: "Create Purchase Invoice",
    endpoint: "/purchase-invoice",
    method: "POST",
    description: "Finalizes the supplier invoice and links the paid advance.",
    defaultInputs: {
      purchase_order_name: "string", // will auto-populate
      bill_no: "BILL-12345",
      bill_date: "2026-06-13"
    }
  },
  // Phase 4: Unified Manufacturing
  {
    id: 12,
    phase: "procurement",
    name: "Supplier Final Payment",
    endpoint: "/supplier-payment",
    method: "POST",
    description: "Processes final payment entry to supplier for outstanding raw material invoices.",
    defaultInputs: {
      purchase_order_name: "string", // will auto-populate with Purchase Invoice name from Step 10
      amount: 1500.0,
      supplier: "ABC Flour Mills",
      company: "Vishwha Murukku Foods",
      paid_from: "50200084736291 - HDFC Bank - Current A/C - VMF",
      paid_to: "Creditors - VMF",
      reference_date: "2026-06-13"
    }
  },
  {
    id: 13,
    phase: "manufacturing",
    name: "Work Order Management Console",
    endpoint: "/work-order",
    method: "POST",
    description: "Unified Work Order lifecycle: Submit -> Start (Material Issue) -> Finish (Record Stock).",
    defaultInputs: {
      qty: 33.3333,
      bom_no: "string",
      production_item: "Biscuit5",
      source_warehouse: "Maida5 warehouse - VMF",
      wip_warehouse: "Work In Progress - VMF",
      fg_warehouse: "Biscuit5 finished warehouse - VMF",
      company: "Vishwha Murukku Foods",
      use_multi_level_bom: 0
    }
  },
  // Phase 5: Closing
  {
    id: 14,
    phase: "closing",
    name: "Create Sales Invoice",
    endpoint: "/sales-invoice",
    method: "POST",
    description: "Generates the Sales Invoice, handles negative stock auto-reconciliation, and applies advance.",
    defaultInputs: {
      sales_order_name: "string", // will auto-populate
      warehouse: "Biscuit5 finished warehouse - VMF"
    }
  },
  {
    id: 15,
    phase: "closing",
    name: "Customer Final Payment",
    endpoint: "/payment-entry",
    method: "POST",
    description: "Processes final payment entry for outstanding balance to complete order cycle.",
    defaultInputs: {
      sales_order_name: "string", // will auto-populate
      amount: 24479.64,
      customer: "Customer1",
      company: "Vishwha Murukku Foods",
      paid_from: "Debtors - VMF",
      paid_to: "50200084736291 - HDFC Bank - Current A/C - VMF",
      reference_date: "2026-06-13"
    }
  }
];

interface TextInputProps {
  label: string;
  value: any;
  onChange: (val: string) => void;
}

const TextInput: React.FC<TextInputProps> = ({ label, value, onChange }) => {
  const isPlaceholder = value === "string";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={isPlaceholder ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isPlaceholder ? "Will auto-populate or optional..." : ""}
        className={`w-full bg-slate-50 border rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-slate-400 font-mono ${isPlaceholder ? "border-amber-200 text-amber-700 bg-amber-50/20" : "border-slate-200 text-slate-800"
          }`}
      />
    </div>
  );
};

interface NumberInputProps {
  label: string;
  value: any;
  onChange: (val: number | string) => void;
}

const NumberInput: React.FC<NumberInputProps> = ({ label, value, onChange }) => {
  const isPlaceholder = value === "string" || value === undefined;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">{label}</label>
      <input
        type="number"
        step="any"
        value={isPlaceholder ? "" : value}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === "" ? "" : parseFloat(val));
        }}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono"
      />
    </div>
  );
};

interface SelectInputProps {
  label: string;
  value: any;
  options: string[];
  placeholder: string;
  onChange: (val: string) => void;
}

const SelectInput: React.FC<SelectInputProps> = ({ label, value, options, placeholder, onChange }) => {
  const cleanOptions = [...new Set([value, ...options])].filter((opt) => opt && opt !== "string");
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">{label}</label>
      <select
        value={value === "string" ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-sans"
      >
        <option value="">{placeholder}</option>
        {cleanOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
};

interface CheckboxInputProps {
  label: string;
  value: any;
  onChange: (val: number) => void;
}

const CheckboxInput: React.FC<CheckboxInputProps> = ({ label, value, onChange }) => {
  return (
    <div className="flex items-center gap-2 py-2">
      <input
        type="checkbox"
        checked={value === 1 || value === "1" || !!value}
        onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 transition cursor-pointer"
      />
      <label className="text-xs font-bold text-slate-700 select-none cursor-pointer">
        {label}
      </label>
    </div>
  );
};

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [expiringBatches, setExpiringBatches] = useState<{ batch_number: string; item: string; expiry_date: string; daysRemaining: number }[]>([]);

  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Auto-login persistence
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
        // Robust cleanup: if the URL contains duplicate protocol/domain definitions, extract the first valid one
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

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("erp_token");
    }
    setIsAuthenticated(false);
    router.push("/login");
  };

  const [activeStep, setActiveStep] = useState<number>(0);
  const [stepStatuses, setStepStatuses] = useState<("idle" | "loading" | "success" | "error")[]>(
    Array(STEPS.length).fill("idle")
  );
  const [stepOutputs, setStepOutputs] = useState<any[]>(Array(STEPS.length).fill(null));

  // Custom inputs state mapped by step index
  const [stepInputs, setStepInputs] = useState<Record<number, Record<string, any>>>(() => {
    const initial: Record<number, Record<string, any>> = {};
    STEPS.forEach((step) => {
      initial[step.id] = {};
      Object.keys(step.defaultInputs).forEach((key) => {
        const val = step.defaultInputs[key];
        initial[step.id][key] = val === "string" ? "string" : "";
      });
    });
    return initial;
  });

  // Dropdown lists
  const [companies, setCompanies] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);

  // Real-time ledger balance info
  const [docBalance, setDocBalance] = useState<{
    grand_total: number;
    advance_paid: number;
    outstanding_amount: number;
    doctype: string;
    loading: boolean;
    error?: string;
  } | null>(null);

  // Fetch invoice/sales order balance dynamically
  useEffect(() => {
    const docname = stepInputs[activeStep]?.sales_order_name || stepInputs[activeStep]?.purchase_order_name;
    if (!docname || docname === "string" || docname === "") {
      setDocBalance(null);
      return;
    }

    let isMounted = true;
    setDocBalance(prev => prev ? { ...prev, loading: true } : { grand_total: 0, advance_paid: 0, outstanding_amount: 0, doctype: "", loading: true });

    fetch(`${backendUrl}/invoice-balance?docname=${encodeURIComponent(docname)}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data.error) {
            setDocBalance({ grand_total: 0, advance_paid: 0, outstanding_amount: 0, doctype: "", loading: false, error: data.error });
          } else {
            setDocBalance({ ...data, loading: false });
          }
        }
      })
      .catch(err => {
        if (isMounted) {
          setDocBalance({ grand_total: 0, advance_paid: 0, outstanding_amount: 0, doctype: "", loading: false, error: err.message });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeStep, stepInputs[activeStep]?.sales_order_name, stepInputs[activeStep]?.purchase_order_name, backendUrl]);

  // Unique States for Unified Work Order screen
  const [woId, setWoId] = useState<string>("");
  const [woLifecycleStatus, setWoLifecycleStatus] = useState<"not_created" | "submitted" | "started" | "finished">("not_created");
  const [woLoadingState, setWoLoadingState] = useState<"none" | "submit" | "start" | "finish">("none");

  const [consoleLogs, setConsoleLogs] = useState<{ time: string; type: "info" | "success" | "error" | "api"; message: string }[]>([]);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  // ERPNext Histories State
  const [activeTab, setActiveTab] = useState<"payments" | "stock" | "purchase" | "logs">("payments");
  const [historyPayments, setHistoryPayments] = useState<any[]>([]);
  const [historyStock, setHistoryStock] = useState<any[]>([]);
  const [historyPurchase, setHistoryPurchase] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Fetch histories and dropdown options from backend
  const fetchAllHistory = async (silent = false) => {
    if (!silent) setIsHistoryLoading(true);
    try {
      const rPay = await fetch(`${backendUrl}/history/payments`, { mode: "cors" });
      if (rPay.ok) setHistoryPayments(await rPay.json());

      const rStock = await fetch(`${backendUrl}/history/stock-entries`, { mode: "cors" });
      if (rStock.ok) setHistoryStock(await rStock.json());

      const rPur = await fetch(`${backendUrl}/history/purchase-orders`, { mode: "cors" });
      if (rPur.ok) setHistoryPurchase(await rPur.json());
    } catch (err) {
      console.error("Failed to fetch ERPNext history lists:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchDropdownOptions = async () => {
    try {
      const resCo = await fetch(`${backendUrl}/companies`, { mode: "cors" });
      if (resCo.ok) {
        const data = await resCo.json();
        console.log("Companies:", data);
        setCompanies(data);
      }
      const resWh = await fetch(`${backendUrl}/warehouses`, { mode: "cors" });
      if (resWh.ok) {
        const data = await resWh.json()
        console.log("Warehouses:", data);
        setWarehouses(data);
      }
      const resCust = await fetch(`${backendUrl}/customers`, { mode: "cors" });
      if (resCust.ok) {
        setCustomers(await resCust.json());
      }
      const resSupp = await fetch(`${backendUrl}/suppliers`, { mode: "cors" });
      if (resSupp.ok) {
        setSuppliers(await resSupp.json());
      }
    } catch (err) {
      console.error("Failed to fetch dropdown list options:", err);
    }
  };

  // Check backend health and fetch history
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${backendUrl}/docs`, { mode: "cors" });
        if (response.status === 200 || response.ok) {
          setIsBackendOnline(true);
        } else {
          setIsBackendOnline(false);
        }
      } catch (err) {
        setIsBackendOnline(false);
      }
    };
    const checkExpiringBatches = async () => {
      try {
        const response = await fetch(`${backendUrl}/batches`, { mode: "cors" });
        if (response.ok) {
          const batches = await response.json();
          const expiring = batches
            .filter((b: any) => b.expiry_date)
            .map((b: any) => {
              const diffTime = new Date(b.expiry_date).getTime() - new Date().getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return { ...b, daysRemaining: diffDays };
            })
            .filter((b: any) => b.daysRemaining >= 0 && b.daysRemaining <= 7);
          setExpiringBatches(expiring);
        }
      } catch (err) {
        console.error("Failed to check expiring batches", err);
      }
    };
    checkHealth();
    fetchAllHistory(true);
    fetchDropdownOptions();
    checkExpiringBatches();

    const interval = setInterval(() => {
      checkHealth();
      fetchAllHistory(true);
      fetchDropdownOptions();
      checkExpiringBatches();
    }, 12000);

    return () => clearInterval(interval);
  }, [backendUrl]);

  // Log function
  const addLog = (type: "info" | "success" | "error" | "api", message: string) => {
    const time = new Date().toLocaleTimeString();
    setConsoleLogs((prev) => [...prev, { time, type, message }]);
  };

  // Scroll to bottom of terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  // Helper: auto-propagate variables to subsequent steps
  const propagateVariables = (stepId: number, data: any) => {
    if (!data) return;
    const docName = data.name || data.bom_no || (typeof data === "object" && Object.keys(data).length > 0 ? Object.values(data)[0] : null);
    if (!docName || typeof docName !== "string") return;

    addLog("info", `Propagating generated key/name: "${docName}" to relevant fields.`);

    setStepInputs((prev) => {
      const updated = { ...prev };

      // Sales Order created in Step 5 (was 4)
      if (stepId === 5) {
        updated[6] = { ...updated[6], sales_order_name: docName }; // Customer advance
        updated[14] = { ...updated[14], sales_order_name: docName }; // Sales Invoice
        updated[15] = { ...updated[15], sales_order_name: docName }; // Final payment
      }

      // Purchase Order created in Step 7 (was 6)
      if (stepId === 7) {
        updated[8] = { ...updated[8], purchase_order_name: docName }; // Approve PO
        updated[9] = { ...updated[9], purchase_order_name: docName }; // Supplier payment
        updated[10] = { ...updated[10], purchase_order_name: docName }; // Purchase receipt
        updated[11] = { ...updated[11], purchase_order_name: docName }; // Purchase invoice
        updated[12] = { ...updated[12], purchase_order_name: docName }; // Supplier final payment
      }

      // Purchase Invoice created in Step 11 (was 10)
      if (stepId === 11) {
        updated[12] = { ...updated[12], purchase_order_name: docName }; // Supplier final payment
      }

      // Sales Invoice created in Step 14 (previously 13)
      if (stepId === 14) {
        updated[15] = { ...updated[15], sales_order_name: docName }; // Final payment
      }

      return updated;
    });
  };

  // Execute a single step
  const executeStep = async (stepId: number): Promise<boolean> => {
    const step = STEPS[stepId];

    // Special handling for unified work order step
    if (stepId === 13) {
      return await handleUnifiedWorkOrderSubmit();
    }

    setStepStatuses((prev) => {
      const copy = [...prev];
      copy[stepId] = "loading";
      return copy;
    });

    const url = `${backendUrl}${step.endpoint}`;
    const payload = { ...stepInputs[stepId] };

    // Fall back to default inputs if left blank, and clean up "string" placeholders
    Object.keys(payload).forEach((key) => {
      if (payload[key] === "" || payload[key] === null || payload[key] === undefined) {
        payload[key] = step.defaultInputs[key];
      }
      if (payload[key] === "string") {
        payload[key] = "";
      }
      if (payload[key] === "") {
        delete payload[key];
      }
    });

    addLog("api", `Executing Step: ${step.name}\nPayload: ${JSON.stringify(payload, null, 2)}`);

    try {
      const response = await fetch(url, {
        method: step.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        mode: "cors"
      });

      const resText = await response.text();
      let resJson: any;
      try {
        resJson = JSON.parse(resText);
      } catch {
        resJson = resText;
      }

      if (response.status === 200 || response.status === 201) {
        addLog("success", `Step ${stepId + 1} Success! Status Code: ${response.status}\nResponse: ${JSON.stringify(resJson, null, 2)}`);
        showToast("success", `Step ${stepId + 1} Succeeded: ${step.name}`);

        setStepStatuses((prev) => {
          const copy = [...prev];
          copy[stepId] = "success";
          return copy;
        });
        setStepOutputs((prev) => {
          const copy = [...prev];
          copy[stepId] = resJson;
          return copy;
        });

        // Trigger cascade auto-populates
        propagateVariables(stepId, resJson);
        fetchAllHistory(true);
        return true;
      } else {
        let errorDetail = resJson.detail || resJson.message || resText;
        try {
          const parsed = typeof errorDetail === "string" ? JSON.parse(errorDetail) : errorDetail;
          if (parsed && (parsed.message || parsed.detail)) {
            errorDetail = parsed.message || parsed.detail;
          }
        } catch (e) {
          // Fallback if errorDetail is not JSON
        }
        addLog("error", `Step ${stepId + 1} Failed with status ${response.status}: ${errorDetail}`);
        showToast("error", `Failed: ${errorDetail}`);
        setStepStatuses((prev) => {
          const copy = [...prev];
          copy[stepId] = "error";
          return copy;
        });
        return false;
      }
    } catch (error: any) {
      addLog("error", `Network Error executing Step ${stepId + 1}: ${error.message}`);
      showToast("error", `Network Error: ${error.message}`);
      setStepStatuses((prev) => {
        const copy = [...prev];
        copy[stepId] = "error";
        return copy;
      });
      return false;
    }
  };

  // Unified Manufacturing Handlers
  const handleUnifiedWorkOrderSubmit = async () => {
    setWoLoadingState("submit");
    const payload = { ...stepInputs[13] };

    // Fall back to default inputs if left blank, and clean up "string" placeholders
    Object.keys(payload).forEach((key) => {
      if (payload[key] === "" || payload[key] === null || payload[key] === undefined) {
        payload[key] = STEPS[13].defaultInputs[key];
      }
      if (payload[key] === "string") {
        payload[key] = "";
      }
    });

    addLog("api", `Submitting Work Order\nPayload: ${JSON.stringify(payload, null, 2)}`);

    try {
      const r = await fetch(`${backendUrl}/work-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (r.ok) {
        const name = data.name;
        setWoId(name);
        setWoLifecycleStatus("submitted");
        addLog("success", `Work Order ${name} Submitted Successfully!`);

        setStepStatuses(prev => {
          const copy = [...prev];
          copy[13] = "success";
          return copy;
        });
        setStepOutputs(prev => {
          const copy = [...prev];
          copy[13] = data;
          return copy;
        });
        fetchAllHistory(true);
        return true;
      } else {
        addLog("error", `Failed to Submit Work Order: ${data.detail || JSON.stringify(data)}`);
        setStepStatuses(prev => {
          const copy = [...prev];
          copy[13] = "error";
          return copy;
        });
        return false;
      }
    } catch (err: any) {
      addLog("error", `Network Error Submitting Work Order: ${err.message}`);
      setStepStatuses(prev => {
        const copy = [...prev];
        copy[13] = "error";
        return copy;
      });
      return false;
    } finally {
      setWoLoadingState("none");
    }
  };

  const handleUnifiedWorkOrderStart = async () => {
    setWoLoadingState("start");
    const startQty = stepInputs[13].qty === "" || stepInputs[13].qty === null || stepInputs[13].qty === undefined
      ? STEPS[13].defaultInputs.qty
      : stepInputs[13].qty;
    const payload = {
      work_order_name: woId,
      qty: startQty
    };
    addLog("api", `Starting Work Order (Material Issue) for ${woId}\nPayload: ${JSON.stringify(payload, null, 2)}`);

    try {
      const r = await fetch(`${backendUrl}/work-order/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (r.ok) {
        setWoLifecycleStatus("started");
        addLog("success", `Work Order ${woId} started! Material Transfer Stock Entry created: ${data.name || JSON.stringify(data)}`);
        fetchAllHistory(true);
        return true;
      } else {
        addLog("error", `Failed to start Work Order: ${data.detail || JSON.stringify(data)}`);
        return false;
      }
    } catch (err: any) {
      addLog("error", `Network Error starting Work Order: ${err.message}`);
      return false;
    } finally {
      setWoLoadingState("none");
    }
  };

  const handleUnifiedWorkOrderFinish = async () => {
    setWoLoadingState("finish");
    const finishQty = stepInputs[13].qty === "" || stepInputs[13].qty === null || stepInputs[13].qty === undefined
      ? STEPS[13].defaultInputs.qty
      : stepInputs[13].qty;
    const payload = {
      work_order_name: woId,
      qty: finishQty
    };
    addLog("api", `Finishing Work Order (Record Manufacture) for ${woId}\nPayload: ${JSON.stringify(payload, null, 2)}`);

    try {
      const r = await fetch(`${backendUrl}/work-order/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (r.ok) {
        setWoLifecycleStatus("finished");
        addLog("success", `Work Order ${woId} finished! Manufacture Stock Entry created: ${data.name || JSON.stringify(data)}`);
        fetchAllHistory(true);
        return true;
      } else {
        addLog("error", `Failed to finish Work Order: ${data.detail || JSON.stringify(data)}`);
        return false;
      }
    } catch (err: any) {
      addLog("error", `Network Error finishing Work Order: ${err.message}`);
      return false;
    } finally {
      setWoLoadingState("none");
    }
  };

  // Handle manual input changes
  const handleInputChange = (stepId: number, field: string, value: any) => {
    setStepInputs((prev) => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        [field]: value
      }
    }));
  };

  // Reset steps state
  const resetPipeline = () => {
    setStepStatuses(Array(STEPS.length).fill("idle"));
    setStepOutputs(Array(STEPS.length).fill(null));
    setConsoleLogs([]);
    setActiveStep(0);
    setWoId("");
    setWoLifecycleStatus("not_created");
    // Reset to base inputs
    const initial: Record<number, Record<string, any>> = {};
    STEPS.forEach((step) => {
      initial[step.id] = {};
      Object.keys(step.defaultInputs).forEach((key) => {
        const val = step.defaultInputs[key];
        initial[step.id][key] = val === "string" ? "string" : "";
      });
    });
    setStepInputs(initial);
    addLog("info", "🔄 Pipeline states reset to defaults.");
    fetchAllHistory(true);
  };

  // Render Status Badge
  const renderStatusBadge = (docstatus: number, workflowState?: string) => {
    if (workflowState) {
      const isApproved = workflowState.toLowerCase().includes("approve");
      return (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${isApproved
          ? "bg-emerald-50 border-emerald-250 text-emerald-700"
          : "bg-amber-50 border-amber-250 text-amber-700"
          }`}>
          {workflowState}
        </span>
      );
    }
    switch (docstatus) {
      case 0:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">Draft</span>;
      case 1:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">Submitted</span>;
      case 2:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700">Cancelled</span>;
      default:
        return null;
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

  const renderStepForm = () => {
    switch (activeStep) {
      case 0: // Create Warehouse
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Warehouse Name" value={stepInputs[0].warehouse_name} onChange={(v) => handleInputChange(0, "warehouse_name", v)} />
            <SelectInput label="Company" value={stepInputs[0].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(0, "company", v)} />
            <SelectInput label="Parent Warehouse" value={stepInputs[0].parent_warehouse} options={warehouses} placeholder="Select Parent Warehouse..." onChange={(v) => handleInputChange(0, "parent_warehouse", v)} />
            <CheckboxInput label="Is Group Warehouse" value={stepInputs[0].is_group} onChange={(v) => handleInputChange(0, "is_group", v)} />
          </div>
        );
      case 1: // Create Raw Material Item
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Item Code" value={stepInputs[1].item_code} onChange={(v) => handleInputChange(1, "item_code", v)} />
            <TextInput label="Item Name" value={stepInputs[1].item_name} onChange={(v) => handleInputChange(1, "item_name", v)} />
            <TextInput label="Item Group" value={stepInputs[1].item_group} onChange={(v) => handleInputChange(1, "item_group", v)} />
            <TextInput label="Stock UOM" value={stepInputs[1].stock_uom} onChange={(v) => handleInputChange(1, "stock_uom", v)} />
            <TextInput label="GST HSN Code" value={stepInputs[1].gst_hsn_code} onChange={(v) => handleInputChange(1, "gst_hsn_code", v)} />
            <CheckboxInput label="Has Batch No" value={stepInputs[1].has_batch_no} onChange={(v) => handleInputChange(1, "has_batch_no", v)} />
            <CheckboxInput label="Has Expiry Date" value={stepInputs[1].has_expiry_date} onChange={(v) => handleInputChange(1, "has_expiry_date", v)} />
            <CheckboxInput label="Create New Batch" value={stepInputs[1].create_new_batch} onChange={(v) => handleInputChange(1, "create_new_batch", v)} />
            <TextInput label="Batch Number Series" value={stepInputs[1].batch_number_series} onChange={(v) => handleInputChange(1, "batch_number_series", v)} />
            <NumberInput label="Shelf Life in Days" value={stepInputs[1].shelf_life_in_days} onChange={(v) => handleInputChange(1, "shelf_life_in_days", v)} />
          </div>
        );
      case 2: // Create Finished Product Item
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Item Code" value={stepInputs[2].item_code} onChange={(v) => handleInputChange(2, "item_code", v)} />
            <TextInput label="Item Name" value={stepInputs[2].item_name} onChange={(v) => handleInputChange(2, "item_name", v)} />
            <TextInput label="Item Group" value={stepInputs[2].item_group} onChange={(v) => handleInputChange(2, "item_group", v)} />
            <TextInput label="Stock UOM" value={stepInputs[2].stock_uom} onChange={(v) => handleInputChange(2, "stock_uom", v)} />
            <TextInput label="GST HSN Code" value={stepInputs[2].gst_hsn_code} onChange={(v) => handleInputChange(2, "gst_hsn_code", v)} />
            <CheckboxInput label="Has Batch No" value={stepInputs[2].has_batch_no} onChange={(v) => handleInputChange(2, "has_batch_no", v)} />
            <CheckboxInput label="Has Expiry Date" value={stepInputs[2].has_expiry_date} onChange={(v) => handleInputChange(2, "has_expiry_date", v)} />
            <CheckboxInput label="Create New Batch" value={stepInputs[2].create_new_batch} onChange={(v) => handleInputChange(2, "create_new_batch", v)} />
            <TextInput label="Batch Number Series" value={stepInputs[2].batch_number_series} onChange={(v) => handleInputChange(2, "batch_number_series", v)} />
            <NumberInput label="Shelf Life in Days" value={stepInputs[2].shelf_life_in_days} onChange={(v) => handleInputChange(2, "shelf_life_in_days", v)} />
          </div>
        );
      case 3: // Create Bill of Materials (BOM)
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Item (Product)" value={stepInputs[3].item} onChange={(v) => handleInputChange(3, "item", v)} />
            <NumberInput label="Quantity" value={stepInputs[3].quantity} onChange={(v) => handleInputChange(3, "quantity", v)} />
            <TextInput label="UOM" value={stepInputs[3].uom} onChange={(v) => handleInputChange(3, "uom", v)} />
            <TextInput label="Raw Material" value={stepInputs[3].raw_material} onChange={(v) => handleInputChange(3, "raw_material", v)} />
            <NumberInput label="Raw Material Qty" value={stepInputs[3].raw_material_qty} onChange={(v) => handleInputChange(3, "raw_material_qty", v)} />
            <TextInput label="Raw Material UOM" value={stepInputs[3].raw_material_uom} onChange={(v) => handleInputChange(3, "raw_material_uom", v)} />
            <SelectInput label="Company" value={stepInputs[3].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(3, "company", v)} />
          </div>
        );
      case 4: // Create Putaway Rule
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <SelectInput label="Company" value={stepInputs[4].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(4, "company", v)} />
            <TextInput label="Item Code" value={stepInputs[4].item_code} onChange={(v) => handleInputChange(4, "item_code", v)} />
            <SelectInput label="Warehouse" value={stepInputs[4].warehouse} options={warehouses} placeholder="Select Warehouse..." onChange={(v) => handleInputChange(4, "warehouse", v)} />
            <NumberInput label="Capacity" value={stepInputs[4].capacity} onChange={(v) => handleInputChange(4, "capacity", v)} />
            <NumberInput label="Priority" value={stepInputs[4].priority} onChange={(v) => handleInputChange(4, "priority", v)} />
            <TextInput label="UOM" value={stepInputs[4].uom} onChange={(v) => handleInputChange(4, "uom", v)} />
          </div>
        );
      case 5: // Create & Submit Sales Order
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <SelectInput label="Customer" value={stepInputs[5].customer} options={customers} placeholder="Select Customer..." onChange={(v) => handleInputChange(5, "customer", v)} />
            <SelectInput label="Company" value={stepInputs[5].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(5, "company", v)} />
            <TextInput label="Item Code" value={stepInputs[5].item_code} onChange={(v) => handleInputChange(5, "item_code", v)} />
            <NumberInput label="Quantity" value={stepInputs[5].qty} onChange={(v) => handleInputChange(5, "qty", v)} />
            <TextInput label="Delivery Date" value={stepInputs[5].delivery_date} onChange={(v) => handleInputChange(5, "delivery_date", v)} />
            <SelectInput label="Warehouse" value={stepInputs[5].warehouse} options={warehouses} placeholder="Select Warehouse..." onChange={(v) => handleInputChange(5, "warehouse", v)} />
            <NumberInput label="Rate" value={stepInputs[5].rate} onChange={(v) => handleInputChange(5, "rate", v)} />
            <TextInput label="Company Address" value={stepInputs[5].company_address} onChange={(v) => handleInputChange(5, "company_address", v)} />
          </div>
        );
      case 6: // Customer Advance Payment
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Sales Order Name" value={stepInputs[6].sales_order_name} onChange={(v) => handleInputChange(6, "sales_order_name", v)} />
            <NumberInput label="Amount" value={stepInputs[6].amount} onChange={(v) => handleInputChange(6, "amount", v)} />
            <SelectInput label="Customer" value={stepInputs[6].customer} options={customers} placeholder="Select Customer..." onChange={(v) => handleInputChange(6, "customer", v)} />
            <SelectInput label="Company" value={stepInputs[6].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(6, "company", v)} />
            <TextInput label="Paid From" value={stepInputs[6].paid_from} onChange={(v) => handleInputChange(6, "paid_from", v)} />
            <TextInput label="Paid To" value={stepInputs[6].paid_to} onChange={(v) => handleInputChange(6, "paid_to", v)} />
            <TextInput label="Reference Date" value={stepInputs[6].reference_date} onChange={(v) => handleInputChange(6, "reference_date", v)} />
          </div>
        );
      case 7: // Create Purchase Order
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <SelectInput label="Supplier" value={stepInputs[7].supplier} options={suppliers} placeholder="Select Supplier..." onChange={(v) => handleInputChange(7, "supplier", v)} />
            <SelectInput label="Company" value={stepInputs[7].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(7, "company", v)} />
            <TextInput label="Schedule Date" value={stepInputs[7].schedule_date} onChange={(v) => handleInputChange(7, "schedule_date", v)} />
            <TextInput label="Item Code" value={stepInputs[7].item_code} onChange={(v) => handleInputChange(7, "item_code", v)} />
            <NumberInput label="Quantity" value={stepInputs[7].qty} onChange={(v) => handleInputChange(7, "qty", v)} />
            <SelectInput label="Warehouse" value={stepInputs[7].warehouse} options={warehouses} placeholder="Select Warehouse..." onChange={(v) => handleInputChange(7, "warehouse", v)} />
            <NumberInput label="Rate" value={stepInputs[7].rate} onChange={(v) => handleInputChange(7, "rate", v)} />
          </div>
        );
      case 8: // Approve Purchase Order
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Purchase Order Name" value={stepInputs[8].purchase_order_name} onChange={(v) => handleInputChange(8, "purchase_order_name", v)} />
          </div>
        );
      case 9: // Supplier Advance Payment
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Purchase Order Name" value={stepInputs[9].purchase_order_name} onChange={(v) => handleInputChange(9, "purchase_order_name", v)} />
            <NumberInput label="Amount" value={stepInputs[9].amount} onChange={(v) => handleInputChange(9, "amount", v)} />
            <SelectInput label="Supplier" value={stepInputs[9].supplier} options={suppliers} placeholder="Select Supplier..." onChange={(v) => handleInputChange(9, "supplier", v)} />
            <SelectInput label="Company" value={stepInputs[9].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(9, "company", v)} />
            <TextInput label="Paid From" value={stepInputs[9].paid_from} onChange={(v) => handleInputChange(9, "paid_from", v)} />
            <TextInput label="Paid To" value={stepInputs[9].paid_to} onChange={(v) => handleInputChange(9, "paid_to", v)} />
            <TextInput label="Reference Date" value={stepInputs[9].reference_date} onChange={(v) => handleInputChange(9, "reference_date", v)} />
          </div>
        );
      case 10: // Create Purchase Receipt
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Purchase Order Name" value={stepInputs[10].purchase_order_name} onChange={(v) => handleInputChange(10, "purchase_order_name", v)} />

            {/* Custom select layout for purchase receipt item row index */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">Select Purchase Receipt Batch</label>
              <select
                value={stepInputs[10].item_row_index}
                onChange={(e) => handleInputChange(10, "item_row_index", parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-sans"
              >
                <option value={-1}>Receive All / Single Batch</option>
                <option value={0}>Batch 1 (First 300kg)</option>
                <option value={1}>Batch 2 (Second 300kg)</option>
                <option value={2}>Batch 3 (Third 300kg)</option>
              </select>
            </div>

            <TextInput label="Item Code (Standalone)" value={stepInputs[10].item_code} onChange={(v) => handleInputChange(10, "item_code", v)} />
            <TextInput label="Quantity (Standalone)" value={stepInputs[10].qty} onChange={(v) => handleInputChange(10, "qty", v)} />
            <SelectInput label="Warehouse (Standalone)" value={stepInputs[10].warehouse} options={warehouses} placeholder="Select Warehouse..." onChange={(v) => handleInputChange(10, "warehouse", v)} />
            <SelectInput label="Company (Standalone)" value={stepInputs[10].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(10, "company", v)} />
            <SelectInput label="Supplier (Standalone)" value={stepInputs[10].supplier} options={suppliers} placeholder="Select Supplier..." onChange={(v) => handleInputChange(10, "supplier", v)} />
            <CheckboxInput label="Apply Putaway Rule" value={stepInputs[10].apply_putaway_rule} onChange={(v) => handleInputChange(10, "apply_putaway_rule", v)} />
          </div>
        );
      case 11: // Create Purchase Invoice
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Purchase Order Name" value={stepInputs[11].purchase_order_name} onChange={(v) => handleInputChange(11, "purchase_order_name", v)} />
            <TextInput label="Reference Date" value={stepInputs[11].reference_date} onChange={(v) => handleInputChange(11, "reference_date", v)} />
          </div>
        );
      case 12: // Supplier Final Payment
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Purchase Order Name" value={stepInputs[12].purchase_order_name} onChange={(v) => handleInputChange(12, "purchase_order_name", v)} />
            <NumberInput label="Amount" value={stepInputs[12].amount} onChange={(v) => handleInputChange(12, "amount", v)} />
            <SelectInput label="Supplier" value={stepInputs[12].supplier} options={suppliers} placeholder="Select Supplier..." onChange={(v) => handleInputChange(12, "supplier", v)} />
            <SelectInput label="Company" value={stepInputs[12].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(12, "company", v)} />
            <TextInput label="Paid From" value={stepInputs[12].paid_from} onChange={(v) => handleInputChange(12, "paid_from", v)} />
            <TextInput label="Paid To" value={stepInputs[12].paid_to} onChange={(v) => handleInputChange(12, "paid_to", v)} />
            <TextInput label="Reference Date" value={stepInputs[12].reference_date} onChange={(v) => handleInputChange(12, "reference_date", v)} />
          </div>
        );
      case 14: // Create Sales Invoice
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Sales Order Name" value={stepInputs[14].sales_order_name} onChange={(v) => handleInputChange(14, "sales_order_name", v)} />
            <TextInput label="Posting Date" value={stepInputs[14].posting_date} onChange={(v) => handleInputChange(14, "posting_date", v)} />
          </div>
        );
      case 15: // Customer Final Payment
        return (
          <div className="grid grid-cols-1 gap-3.5">
            <TextInput label="Sales Order Name" value={stepInputs[15].sales_order_name} onChange={(v) => handleInputChange(15, "sales_order_name", v)} />
            <NumberInput label="Amount" value={stepInputs[15].amount} onChange={(v) => handleInputChange(15, "amount", v)} />
            <SelectInput label="Customer" value={stepInputs[15].customer} options={customers} placeholder="Select Customer..." onChange={(v) => handleInputChange(15, "customer", v)} />
            <SelectInput label="Company" value={stepInputs[15].company} options={companies} placeholder="Select Company..." onChange={(v) => handleInputChange(15, "company", v)} />
            <TextInput label="Paid From" value={stepInputs[15].paid_from} onChange={(v) => handleInputChange(15, "paid_from", v)} />
            <TextInput label="Paid To" value={stepInputs[15].paid_to} onChange={(v) => handleInputChange(15, "paid_to", v)} />
            <TextInput label="Reference Date" value={stepInputs[15].reference_date} onChange={(v) => handleInputChange(15, "reference_date", v)} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased">
      {/* HEADER NAVBAR */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
              <ProcessIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Vishwha
              </h1>
              <p className="text-[11px] text-slate-500 font-semibold">Manufacturing Automation Control Panel</p>
            </div>
          </div>
        </div>

        {/* Backend Endpoint Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            {isBackendOnline === true ? (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              </span>
            ) : isBackendOnline === false ? (
              <span className="flex h-2 w-2 rounded-full bg-rose-500"></span>
            ) : (
              <span className="flex h-2 w-2 rounded-full bg-slate-400"></span>
            )}
            <span className="text-[10px] text-slate-650 font-bold font-mono">
              SYSTEM {isBackendOnline === true ? "ONLINE" : isBackendOnline === false ? "OFFLINE" : "CHECKING"}
            </span>
          </div>

          <button
            onClick={resetPipeline}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 shadow-sm transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </header>

      {/* DASHBOARD GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">

        {/* LEFT COLUMN: VISUAL ROADMAP (TIMELINE) - Col 3 */}
        <aside className="lg:col-span-3 border-r border-slate-200 bg-white p-5 overflow-y-auto max-h-[calc(100vh-73px)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Process Steps</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-250 text-slate-600 font-mono font-bold">
              {STEPS.length} Steps
            </span>
          </div>

          {/* Phases and Step List */}
          <div className="space-y-6">
            {PHASES.map((phase) => {
              const phaseSteps = STEPS.filter((s) => s.phase === phase.id);
              const PhaseIcon = phase.icon;
              return (
                <div key={phase.id} className="space-y-1.5">
                  <div className="flex items-center gap-2 py-1 border-b border-slate-100 mb-1">
                    <PhaseIcon className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">{phase.name}</span>
                  </div>

                  <div className="space-y-0.5">
                    {phaseSteps.map((step) => {
                      const status = stepStatuses[step.id];
                      const isActive = activeStep === step.id;
                      const output = stepOutputs[step.id];
                      const docId = output ? (output.name || output.bom_no || (typeof output === "object" ? Object.values(output)[0] : null)) : null;

                      return (
                        <div
                          key={step.id}
                          onClick={() => setActiveStep(step.id)}
                          className={`group relative flex items-start gap-3 p-2 rounded-lg text-left transition cursor-pointer ${isActive
                            ? "bg-slate-100 border border-slate-200 text-slate-900"
                            : "hover:bg-slate-50 border border-transparent text-slate-600"
                            }`}
                        >
                          {/* Left Accent indicator line */}
                          {isActive && (
                            <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded bg-slate-800" />
                          )}

                          {/* Status Icon */}
                          <div className="mt-0.5 flex-shrink-0">
                            {status === "loading" ? (
                              <Loader2 className="h-3.5 w-3.5 text-slate-700 animate-spin" />
                            ) : status === "success" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : status === "error" ? (
                              <XCircle className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                              <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center text-[9px] font-bold ${isActive
                                ? "border-slate-800 text-slate-800 bg-white"
                                : "border-slate-300 text-slate-400 bg-slate-50"
                                }`}>
                                {step.id + 1}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${isActive ? "text-slate-900 font-bold" : "text-slate-600 group-hover:text-slate-800"
                              }`}>
                              {step.name}
                            </p>
                            {docId && typeof docId === "string" && (
                              <span className="inline-block mt-0.5 text-[9px] font-mono font-semibold px-1 rounded bg-slate-100 border border-slate-200 text-slate-700">
                                {docId}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* MIDDLE COLUMN: DYNAMIC CONTROL CENTER (FORM) - Col 5 */}
        <section className="lg:col-span-5 border-r border-slate-200 bg-slate-50 p-6 flex flex-col overflow-y-auto max-h-[calc(100vh-73px)]">

          {/* Expiry Warning Notifications */}
          {expiringBatches.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-2 shadow-sm text-xs font-sans animate-bounce-in">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Upcoming Expiries (Disposal Warnings)</span>
              </div>
              <div className="space-y-1.5 text-slate-700 font-mono text-[10px]">
                {expiringBatches.map((batch, index) => (
                  <div key={index} className="flex items-center justify-between border-b border-slate-100/50 pb-1 last:border-b-0">
                    <span>{batch.item} going to expire {batch.expiry_date} use or dispose it</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold shrink-0 font-sans">
                      {batch.daysRemaining} days left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header area of focused step */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                Step {activeStep + 1} of {STEPS.length}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{STEPS[activeStep].name}</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {STEPS[activeStep].description}
            </p>
          </div>

          {/* Special UI Rendering for Unified Work Order (Step 13) */}
          {activeStep === 13 ? (
            <div className="flex-1 flex flex-col gap-6">

              {/* Parameter Settings */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm space-y-4">
                <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">
                  Work Order Parameters
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 font-mono">qty (production amount)</label>
                    <input
                      type="number"
                      value={stepInputs[13].qty === "" ? "" : stepInputs[13].qty}
                      placeholder="33.3333"
                      onChange={(e) => handleInputChange(13, "qty", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                      disabled={woLifecycleStatus !== "not_created"}
                      className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 font-mono">production_item</label>
                    <input
                      type="text"
                      value={stepInputs[13].production_item}
                      placeholder="Biscuit5"
                      onChange={(e) => handleInputChange(13, "production_item", e.target.value)}
                      disabled={woLifecycleStatus !== "not_created"}
                      className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 font-mono">company</label>
                    <input
                      type="text"
                      value={stepInputs[13].company}
                      placeholder="Vishwha Murukku Foods"
                      onChange={(e) => handleInputChange(13, "company", e.target.value)}
                      disabled={woLifecycleStatus !== "not_created"}
                      className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 font-mono focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 font-mono">source_warehouse</label>
                    <select
                      value={stepInputs[13].source_warehouse}
                      onChange={(e) => handleInputChange(13, "source_warehouse", e.target.value)}
                      disabled={woLifecycleStatus !== "not_created"}
                      className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 font-mono focus:outline-none"
                    >
                      <option value="">Select Source Warehouse (Default: Maida5 warehouse - VMF)...</option>
                      {[...new Set([stepInputs[13].source_warehouse, ...warehouses])].filter(Boolean).map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 font-mono">wip_warehouse</label>
                    <select
                      value={stepInputs[13].wip_warehouse}
                      onChange={(e) => handleInputChange(13, "wip_warehouse", e.target.value)}
                      disabled={woLifecycleStatus !== "not_created"}
                      className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 font-mono focus:outline-none"
                    >
                      <option value="">Select WIP Warehouse (Default: Work In Progress - VMF)...</option>
                      {[...new Set([stepInputs[13].wip_warehouse, ...warehouses])].filter(Boolean).map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 font-mono">fg_warehouse</label>
                    <select
                      value={stepInputs[13].fg_warehouse}
                      onChange={(e) => handleInputChange(13, "fg_warehouse", e.target.value)}
                      disabled={woLifecycleStatus !== "not_created"}
                      className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 font-mono focus:outline-none"
                    >
                      <option value="">Select FG Warehouse (Default: Biscuit5 finished warehouse - VMF)...</option>
                      {[...new Set([stepInputs[13].fg_warehouse, ...warehouses])].filter(Boolean).map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ERPNext Work Order Document State Flow */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm space-y-5">
                <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">
                  Work Order Lifecycle Flow (Just like ERPNext)
                </h3>

                {/* Progress Indicators */}
                <div className="space-y-4">

                  {/* Step 1: Submission */}
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${woLifecycleStatus !== "not_created"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-slate-100 border-slate-200 text-slate-500"
                      }`}>
                      1
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-800">Submit Work Order</div>
                      <div className="text-[10px] text-slate-450 font-mono">{woId || "No Document Submitting"}</div>
                    </div>
                    {woLifecycleStatus !== "not_created" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">SUBMITTED</span>
                    )}
                  </div>

                  <div className="h-4 border-l-2 border-dashed border-slate-200 ml-3" />

                  {/* Step 2: Start (Material Transfer) */}
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${woLifecycleStatus === "started" || woLifecycleStatus === "finished"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-slate-100 border-slate-200 text-slate-500"
                      }`}>
                      2
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-800">Start Work Order (Material Issue)</div>
                      <div className="text-[10px] text-slate-450">Creates stock entry from raw to WIP warehouse</div>
                    </div>
                    {(woLifecycleStatus === "started" || woLifecycleStatus === "finished") && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">MATERIAL ISSUED</span>
                    )}
                  </div>

                  <div className="h-4 border-l-2 border-dashed border-slate-200 ml-3" />

                  {/* Step 3: Finish (Record Manufacture) */}
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${woLifecycleStatus === "finished"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-slate-100 border-slate-200 text-slate-500"
                      }`}>
                      3
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-800">Finish Work Order (Manufacture)</div>
                      <div className="text-[10px] text-slate-440">Consumes materials and places final biscuits in finished warehouse</div>
                    </div>
                    {woLifecycleStatus === "finished" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">COMPLETED</span>
                    )}
                  </div>
                </div>

                {/* Unified Dynamic Button Action */}
                <div className="pt-3 border-t border-slate-100">
                  {woLifecycleStatus === "not_created" && (
                    <button
                      onClick={handleUnifiedWorkOrderSubmit}
                      disabled={woLoadingState !== "none" || isBackendOnline === false}
                      className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      {woLoadingState === "submit" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Submitting Work Order...
                        </>
                      ) : (
                        "Submit Work Order"
                      )}
                    </button>
                  )}

                  {woLifecycleStatus === "submitted" && (
                    <button
                      onClick={handleUnifiedWorkOrderStart}
                      disabled={woLoadingState !== "none" || isBackendOnline === false}
                      className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      {woLoadingState === "start" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Transferring Raw Materials...
                        </>
                      ) : (
                        "Start Work Order (Issue Material)"
                      )}
                    </button>
                  )}

                  {woLifecycleStatus === "started" && (
                    <button
                      onClick={handleUnifiedWorkOrderFinish}
                      disabled={woLoadingState !== "none" || isBackendOnline === false}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      {woLoadingState === "finish" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Finishing Production...
                        </>
                      ) : (
                        "Finish Work Order (Record Production)"
                      )}
                    </button>
                  )}

                  {woLifecycleStatus !== "not_created" && (
                    <button
                      onClick={() => {
                        setWoId("");
                        setWoLifecycleStatus("not_created");
                        setStepStatuses(prev => {
                          const copy = [...prev];
                          copy[13] = "idle";
                          return copy;
                        });
                        addLog("info", "⚠️ Work Order Console force reset by user.");
                      }}
                      className="w-full mt-3 py-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-650 border border-slate-200 border-dashed hover:border-red-200 rounded-lg text-[10px] font-bold transition"
                    >
                      Force Reset / Start New Work Order
                    </button>
                  )}

                  {woLifecycleStatus === "finished" && (
                    <div className="space-y-3">
                      <div className="w-full py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-center font-bold text-xs">
                        ✓ Work Order fully finished in ERPNext!
                      </div>
                      <button
                        onClick={() => {
                          setWoId("");
                          setWoLifecycleStatus("not_created");
                          setStepStatuses(prev => {
                            const copy = [...prev];
                            copy[13] = "idle";
                            return copy;
                          });
                          addLog("info", "🔄 Work Order Console reset to start a new production batch.");
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition"
                      >
                        Start Next Batch (New Work Order)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Advance to next */}
              {woLifecycleStatus === "finished" && (
                <button
                  onClick={() => setActiveStep(13)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  Go to Sales Invoicing
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            /* Standard Step Form Rendering */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 bg-white border border-slate-200 p-5 rounded-lg shadow-sm mb-6 space-y-4">
                <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">Step Configuration</h3>
                {renderStepForm()}
              </div>

              {/* Balance Summary Card */}
              {docBalance && (
                (stepInputs[activeStep]?.sales_order_name && stepInputs[activeStep]?.sales_order_name !== "string") ||
                (stepInputs[activeStep]?.purchase_order_name && stepInputs[activeStep]?.purchase_order_name !== "string")
              ) && (
                  <div className="bg-slate-900 text-white border border-slate-800 p-4 rounded-lg shadow-sm space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                        💰 ERPNext Ledger Info
                      </span>
                      <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                        {docBalance.doctype || "Searching..."}
                      </span>
                    </div>
                    {docBalance.loading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono py-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Fetching real-time ledger balance...
                      </div>
                    ) : docBalance.error ? (
                      <div className="text-xs text-rose-400 font-mono py-1">
                        ⚠️ {docBalance.error}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="bg-slate-800 p-2 rounded border border-slate-700">
                            <div className="text-[9px] text-slate-450 uppercase font-mono font-bold mb-0.5">Grand Total</div>
                            <div className="text-xs font-bold font-mono text-slate-200">
                              ₹ {docBalance.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="bg-slate-800 p-2 rounded border border-slate-700">
                            <div className="text-[9px] text-slate-450 uppercase font-mono font-bold mb-0.5">Paid / Advance</div>
                            <div className="text-xs font-bold font-mono text-emerald-400">
                              ₹ {docBalance.advance_paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="bg-slate-800 p-2 rounded border border-slate-700">
                            <div className="text-[9px] text-slate-450 uppercase font-mono font-bold mb-0.5">Outstanding</div>
                            <div className="text-xs font-bold font-mono text-amber-400 font-extrabold">
                              ₹ {docBalance.outstanding_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>

                        {/* Button to auto-fill amount */}
                        {docBalance.outstanding_amount > 0 && (activeStep === 11 || activeStep === 14) && (
                          <button
                            onClick={() => {
                              handleInputChange(activeStep, "amount", docBalance.outstanding_amount);
                              addLog("info", `Auto-filled payment amount: ₹${docBalance.outstanding_amount.toFixed(2)}`);
                            }}
                            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold transition flex items-center justify-center gap-1.5 font-mono"
                          >
                            Use Outstanding Amount (₹{docBalance.outstanding_amount.toFixed(2)})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

              {/* Action Row */}
              <div className="flex gap-4">
                <button
                  onClick={() => executeStep(activeStep)}
                  disabled={isBackendOnline === false}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white transition disabled:opacity-50"
                >
                  {stepStatuses[activeStep] === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current text-white" />
                      Execute Single Step
                    </>
                  )}
                </button>

                {activeStep < STEPS.length - 1 && (
                  <button
                    onClick={() => setActiveStep((prev) => prev + 1)}
                    className="px-3 py-2.5 rounded-lg font-bold text-sm bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition"
                  >
                    <ArrowRight className="h-4 w-4 text-slate-600" />
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: ERPNEXT HISTORIES - Col 4 */}
        <section className="lg:col-span-4 bg-slate-100/50 p-5 flex flex-col max-h-[calc(100vh-73px)] border-t lg:border-t-0 border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-600" />
              ERPNext Database History
            </h2>
            <button
              onClick={() => fetchAllHistory(false)}
              disabled={isHistoryLoading || isBackendOnline === false}
              className="text-[10px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-mono font-bold"
            >
              <RefreshCw className={`h-3 w-3 ${isHistoryLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Tabs header */}
          <div className="flex bg-slate-200/60 p-1 rounded-lg gap-1 mb-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex-1 py-1.5 rounded-md text-center transition ${activeTab === "payments" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Payments
            </button>
            <button
              onClick={() => setActiveTab("stock")}
              className={`flex-1 py-1.5 rounded-md text-center transition ${activeTab === "stock" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Stock Entries
            </button>
            <button
              onClick={() => setActiveTab("purchase")}
              className={`flex-1 py-1.5 rounded-md text-center transition ${activeTab === "purchase" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Purchase Orders
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex-1 py-1.5 rounded-md text-center transition ${activeTab === "logs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Logs
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4 overflow-y-auto shadow-inner">

            {isHistoryLoading && (
              <div className="h-full flex items-center justify-center text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}

            {!isHistoryLoading && activeTab === "payments" && (
              <div className="space-y-3">
                {historyPayments.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-8">No payments found in ERPNext.</p>
                ) : (
                  historyPayments.map((item) => (
                    <div key={item.name} className="border-b border-slate-100 pb-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-900">{item.name}</span>
                        {renderStatusBadge(item.docstatus)}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{item.party} ({item.party_type})</span>
                        <span className="font-bold text-slate-700">₹{parseFloat(item.paid_amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-slate-450 mt-0.5">{item.posting_date}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!isHistoryLoading && activeTab === "stock" && (
              <div className="space-y-3">
                {historyStock.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-8">No stock entries found in ERPNext.</p>
                ) : (
                  historyStock.map((item) => (
                    <div key={item.name} className="border-b border-slate-100 pb-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-900">{item.name}</span>
                        {renderStatusBadge(item.docstatus)}
                      </div>
                      <div className="text-[11px] text-slate-600 font-semibold">{item.purpose}</div>
                      <div className="text-[10px] text-slate-455 mt-0.5">{item.posting_date}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!isHistoryLoading && activeTab === "purchase" && (
              <div className="space-y-3">
                {historyPurchase.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-8">No purchase orders found in ERPNext.</p>
                ) : (
                  historyPurchase.map((item) => (
                    <div key={item.name} className="border-b border-slate-100 pb-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-900">{item.name}</span>
                        {renderStatusBadge(item.docstatus, item.workflow_state)}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate max-w-[150px]">{item.supplier}</span>
                        <span className="font-bold text-slate-700">₹{parseFloat(item.grand_total || 0).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-slate-450 mt-0.5">{item.transaction_date}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!isHistoryLoading && activeTab === "logs" && (
              <div className="font-mono text-xs space-y-3">
                {consoleLogs.length === 0 ? (
                  <div className="text-center text-slate-400 py-12">
                    <Terminal className="h-6 w-6 text-slate-350 mx-auto mb-2" />
                    <p className="text-[10px]">No operations logged yet.</p>
                  </div>
                ) : (
                  consoleLogs.map((log, index) => {
                    let colorClass = "text-slate-655";
                    if (log.type === "success") colorClass = "text-emerald-700 font-medium";
                    if (log.type === "error") colorClass = "text-rose-600 font-semibold";
                    if (log.type === "api") colorClass = "text-slate-800";
                    if (log.type === "info") colorClass = "text-blue-600 font-medium";

                    return (
                      <div key={index} className="border-b border-slate-50 pb-2 last:border-b-0">
                        <div className="flex items-center justify-between text-[9px] text-slate-450 mb-0.5">
                          <span>{log.time}</span>
                          <span className="font-bold px-1 rounded bg-slate-50 text-slate-500 text-[8px] uppercase border border-slate-100">
                            {log.type}
                          </span>
                        </div>
                        <pre className="whitespace-pre-wrap select-text font-mono text-[10px] leading-relaxed text-slate-700">
                          {log.message}
                        </pre>
                      </div>
                    );
                  })
                )}
                <div ref={terminalEndRef} />
              </div>
            )}

          </div>
        </section>

        {/* Toast Notification Banner */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border transition-all duration-300 font-sans text-xs animate-bounce-in max-w-sm ${toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : toast.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
            )}
            <div>
              <p className="font-bold uppercase tracking-wider text-[10px] opacity-75 mb-0.5 font-mono">
                {toast.type === "success" ? "Success" : "Error"}
              </p>
              <p className="font-medium text-slate-700 font-mono">{toast.message}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
