"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Boxes,
  Info,
  Calendar,
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  MapPin,
  Inbox
} from "lucide-react";

interface ItemOption {
  name: string;
  item_name: string;
  item_group: string;
}

interface BatchOption {
  batch_number: string;
}

interface StockLocation {
  warehouse: string;
  qty: number;
  main_warehouse: string;
  rack: string;
  shelf: string;
  bin: string;
  expiry_date: string;
  is_reserved?: boolean;
}

interface WarehouseCheckItem {
  item_code: string;
  item_name: string;
  stock_locations: StockLocation[];
}

interface ItemCheckResponse {
  item_code: string;
  batch_no: string | null;
  expiry_date: string;
  items: WarehouseCheckItem[];
}

interface EmptyBin {
  warehouse: string;
  main_warehouse: string;
  rack: string;
  shelf: string;
  bin: string;
  status: string;
  item_code: string | null;
  actual_qty: number;
  capacity: number | null;
  remaining_capacity: number | null;
  uom: string | null;
}

interface SlowMovingItem {
  warehouse: string;
  itemCode: string;
  itemName: string;
  itemGroup: string;
  quantity: number;
  daysAgo: number;
  creationDate: string;
}

interface ExpiringItem {
  warehouse: string;
  itemCode: string;
  itemName: string;
  itemGroup: string;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
}

export default function WarehouseCheckPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendUrl, setBackendUrl] = useState("http://77.42.39.77:8000");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Data states
  const [items, setItems] = useState<ItemOption[]>([]);
  const [batchNumbers, setBatchNumbers] = useState<BatchOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [itemCheckData, setItemCheckData] = useState<ItemCheckResponse | null>(null);
  const [batchCheckData, setBatchCheckData] = useState<ItemCheckResponse | null>(null);
  const [emptyBins, setEmptyBins] = useState<EmptyBin[]>([]);
  const [slowMovingItems, setSlowMovingItems] = useState<SlowMovingItem[]>([]);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);

  // UI state
  const [isSearchingItem, setIsSearchingItem] = useState<boolean>(false);
  const [isSearchingBatch, setIsSearchingBatch] = useState<boolean>(false);
  const [isSearchingEmptyBins, setIsSearchingEmptyBins] = useState<boolean>(false);
  const [isSearchingSlowMoving, setIsSearchingSlowMoving] = useState<boolean>(false);
  const [isSearchingExpiringItems, setIsSearchingExpiringItems] = useState<boolean>(false);
  const [showEmptyBinsList, setShowEmptyBinsList] = useState<boolean>(false);
  const [showSlowMovingList, setShowSlowMovingList] = useState<boolean>(false);
  const [showExpiringItemsList, setShowExpiringItemsList] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authenticate session check and fetch items
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
        savedBackendUrl = dynamicUrl;
      }

      // Fetch items and batches list
      Promise.all([
        fetch(`${savedBackendUrl}/items`, { mode: "cors" }).then((res) => {
          if (!res.ok) throw new Error("Failed to load items");
          return res.json();
        }),
        fetch(`${savedBackendUrl}/batches`, { mode: "cors" }).then((res) => {
          if (!res.ok) throw new Error("Failed to load batches");
          return res.json();
        })
      ])
        .then(([itemsData, batchesData]) => {
          setItems(itemsData);
          setBatchNumbers(batchesData);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setErrorMessage("Failed to connect to ERPNext to retrieve items and batches.");
          setIsLoading(false);
        });
    }
  }, [router]);

  // Handle Item Check API request
  const handleItemSelect = async (itemCode: string) => {
    setSelectedItem(itemCode);
    if (!itemCode) {
      setItemCheckData(null);
      return;
    }

    setIsSearchingItem(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${backendUrl}/warehouse-item-check?item_code=${encodeURIComponent(itemCode)}`, {
        mode: "cors",
      });
      if (!res.ok) throw new Error("Error retrieving item warehouse inventory");
      const data = await res.json();
      setItemCheckData(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to retrieve item inventory.");
      setItemCheckData(null);
    } finally {
      setIsSearchingItem(false);
    }
  };

  const handleBatchSelect = async (batchNumber: string) => {
    setSelectedBatch(batchNumber);
    if (!batchNumber) {
      setBatchCheckData(null);
      return;
    }

    setIsSearchingBatch(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${backendUrl}/warehouse-item-check?item_code=${encodeURIComponent(batchNumber)}`, {
        mode: "cors",
      });
      if (!res.ok) throw new Error("Error retrieving item warehouse inventory");
      const data = await res.json();
      setBatchCheckData(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to retrieve item inventory.");
      setBatchCheckData(null);
    } finally {
      setIsSearchingBatch(false);
    }
  };

  // Handle Fetch Empty Bins API request
  const handleShowEmptyBins = async () => {
    setIsSearchingEmptyBins(true);
    setErrorMessage(null);
    setShowSlowMovingList(false);
    setShowExpiringItemsList(false);
    try {
      const res = await fetch(`${backendUrl}/empty-bins`, { mode: "cors" });
      if (!res.ok) throw new Error("Error retrieving empty warehouses");
      const data = await res.json();
      setEmptyBins(data);
      setShowEmptyBinsList(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to retrieve empty warehouses.");
    } finally {
      setIsSearchingEmptyBins(false);
    }
  };

  // Handle Fetch Slow Moving FG API request
  const handleShowSlowMoving = async () => {
    setIsSearchingSlowMoving(true);
    setErrorMessage(null);
    setShowEmptyBinsList(false);
    setShowExpiringItemsList(false);
    try {
      const res = await fetch(`${backendUrl}/wms/slow-moving-items`, { mode: "cors" });
      if (!res.ok) throw new Error("Error retrieving slow moving items");
      const data = await res.json();
      setSlowMovingItems(data);
      setShowSlowMovingList(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to retrieve slow moving items.");
    } finally {
      setIsSearchingSlowMoving(false);
    }
  };

  // Handle Fetch Expiring Items API request
  const handleShowExpiringItems = async () => {
    setIsSearchingExpiringItems(true);
    setErrorMessage(null);
    setShowEmptyBinsList(false);
    setShowSlowMovingList(false);
    try {
      const res = await fetch(`${backendUrl}/wms/expiring-items`, { mode: "cors" });
      if (!res.ok) throw new Error("Error retrieving expiring items");
      const data = await res.json();
      setExpiringItems(data);
      setShowExpiringItemsList(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to retrieve expiring items.");
    } finally {
      setIsSearchingExpiringItems(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
          <span className="text-xs font-bold text-slate-500 font-mono tracking-widest uppercase">
            Loading Warehouse Tracker...
          </span>
        </div>
      </div>
    );
  }

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
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">Warehouse Tracker</h1>
              <p className="text-[10px] text-slate-500 font-mono">Location & Expiry Date Controller</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex gap-3 text-xs leading-relaxed">
            <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="font-mono">{errorMessage}</p>
          </div>
        )}

        {/* Action Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Card: Item Stock Lookup */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Search className="h-4.5 w-4.5 text-slate-500" />
                <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  Item Expiry & Storage Search
                </h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Select a batched or stock item to query its active warehouse layout, quantity, and batch expiry details.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                  Select Batch Number
                </label>
                <select
                  value={selectedBatch}
                  onChange={(e) => handleBatchSelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-slate-400 font-mono"
                >
                  <option value="">Choose an Batch...</option>
                  {batchNumbers.map((batchNumber) => (
                    <option key={batchNumber.batch_number} value={batchNumber.batch_number}>
                      {batchNumber.batch_number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                  Select Item Code
                </label>
                <select
                  value={selectedItem}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-slate-400 font-mono"
                >
                  <option value="">Choose an Item...</option>
                  {items.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.item_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Dynamic querying enabled</span>
              {isSearchingItem && <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />}
            </div>
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Dynamic querying enabled</span>
              {isSearchingBatch && <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />}
            </div>
          </div>

          {/* Form Card: Empty Bins */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Inbox className="h-4.5 w-4.5 text-slate-500" />
                <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  Empty Storage Locator
                </h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Retrieve a live listing of all unallocated leaf-level warehouses (bins) with zero stock quantity.
              </p>

              <button
                type="button"
                onClick={handleShowEmptyBins}
                disabled={isSearchingEmptyBins}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-600 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow"
              >
                {isSearchingEmptyBins ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Finding Empty Bins...
                  </>
                ) : (
                  "Show Empty Bins"
                )}
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Bins with actual qty = 0</span>
              {emptyBins.length > 0 && (
                <span className="text-slate-500 font-bold">{emptyBins.length} empty bins found</span>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={handleShowSlowMoving}
                disabled={isSearchingSlowMoving}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow"
              >
                {isSearchingSlowMoving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Finding Slow Moving Items...
                  </>
                ) : (
                  "Show Slow Moving FG"
                )}
              </button>

              <button
                type="button"
                onClick={handleShowExpiringItems}
                disabled={isSearchingExpiringItems}
                className="w-full mt-3 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow"
              >
                {isSearchingExpiringItems ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Finding Expiring Items...
                  </>
                ) : (
                  "Show Expiring Items"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Panels */}
        <div className="space-y-6">
          {/* Item Search Results */}
          {selectedItem && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4.5 w-4.5 text-indigo-500" />
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    Stock Locations for: {selectedItem}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold font-mono">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                  Expiry Date: {itemCheckData?.expiry_date || "No Expiry Date"}
                </div>
              </div>

              {isSearchingItem ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-350" />
                  <span className="text-[11px] font-mono">Searching locations...</span>
                </div>
              ) : itemCheckData && itemCheckData.items && itemCheckData.items.length > 0 ? (
                <div className="space-y-6">
                  {itemCheckData.items.map((item) => (
                    <div key={item.item_code} className="space-y-3">
                      <div className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-150">
                        <Boxes className="h-3.5 w-3.5 text-slate-500" />
                        Item: {item.item_code} ({item.item_name})
                      </div>
                      
                      {item.stock_locations.length > 0 ? (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-mono text-[9px] border-b border-slate-200">
                                <th className="py-2.5 px-3">Main Warehouse</th>
                                <th className="py-2.5 px-3">Rack</th>
                                <th className="py-2.5 px-3">Shelf</th>
                                <th className="py-2.5 px-3">Bin</th>
                                <th className="py-2.5 px-3 text-right">Quantity (Kg/Pcs)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.stock_locations.map((loc, lIdx) => (
                                <tr key={lIdx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition font-mono">
                                  <td className="py-2.5 px-3 font-semibold text-slate-700">
                                    {loc.main_warehouse}
                                    {loc.is_reserved && (
                                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                                        Reserved
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">{loc.rack}</td>
                                  <td className="py-2.5 px-3 text-slate-600">{loc.shelf}</td>
                                  <td className="py-2.5 px-3 text-slate-600">
                                    {loc.bin}
                                    {loc.is_reserved && loc.bin !== "None" && (
                                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                                        Reserved
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-800">{loc.qty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-400 font-mono border border-dashed border-slate-200 rounded-xl">
                          No stock allocated in any warehouse.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-mono border-2 border-dashed border-slate-200 rounded-xl">
                  No stock found for {selectedItem} in any warehouse.
                </div>
              )}
            </div>
          )}

          {/* Batch Search Results */}
          {selectedBatch && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4.5 w-4.5 text-indigo-500" />
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    Stock Locations for Batch: {selectedBatch}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold font-mono">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                  Expiry Date: {batchCheckData?.expiry_date || "No Expiry Date"}
                </div>
              </div>

              {isSearchingBatch ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-350" />
                  <span className="text-[11px] font-mono">Searching locations...</span>
                </div>
              ) : batchCheckData && batchCheckData.items && batchCheckData.items.length > 0 ? (
                <div className="space-y-6">
                  {batchCheckData.items.map((item) => (
                    <div key={item.item_code} className="space-y-3">
                      <div className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-150">
                        <Boxes className="h-3.5 w-3.5 text-slate-500" />
                        Item: {item.item_code} ({item.item_name})
                      </div>
                      
                      {item.stock_locations.length > 0 ? (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-mono text-[9px] border-b border-slate-200">
                                <th className="py-2.5 px-3">Main Warehouse</th>
                                <th className="py-2.5 px-3">Rack</th>
                                <th className="py-2.5 px-3">Shelf</th>
                                <th className="py-2.5 px-3">Bin</th>
                                <th className="py-2.5 px-3 text-right">Quantity (Kg/Pcs)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.stock_locations.map((loc, lIdx) => (
                                <tr key={lIdx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition font-mono">
                                  <td className="py-2.5 px-3 font-semibold text-slate-700">
                                    {loc.main_warehouse}
                                    {loc.is_reserved && (
                                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                                        Reserved
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">{loc.rack}</td>
                                  <td className="py-2.5 px-3 text-slate-600">{loc.shelf}</td>
                                  <td className="py-2.5 px-3 text-slate-600">
                                    {loc.bin}
                                    {loc.is_reserved && loc.bin !== "None" && (
                                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                                        Reserved
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-800">{loc.qty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-400 font-mono border border-dashed border-slate-200 rounded-xl">
                          No stock allocated in any warehouse.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-mono border-2 border-dashed border-slate-200 rounded-xl">
                  No stock found for Batch {selectedBatch} in any warehouse.
                </div>
              )}
            </div>
          )}

          {/* Empty Bins Results */}
          {showEmptyBinsList && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4.5 w-4.5 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    Available & Empty Bins
                  </span>
                </div>
                <button
                  onClick={() => setShowEmptyBinsList(false)}
                  className="text-xs text-slate-400 hover:text-slate-605 font-mono"
                >
                  Hide List
                </button>
              </div>

              {emptyBins.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-mono text-[9px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Main Warehouse</th>
                        <th className="py-2.5 px-3">Rack</th>
                        <th className="py-2.5 px-3">Shelf</th>
                        <th className="py-2.5 px-3">Bin Name</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-right">Stock / Capacity</th>
                        <th className="py-2.5 px-3 text-right">Remaining Capacity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emptyBins.map((bin, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition font-mono">
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{bin.main_warehouse}</td>
                          <td className="py-2.5 px-3 text-slate-600">{bin.rack}</td>
                          <td className="py-2.5 px-3 text-slate-600">{bin.shelf}</td>
                          <td className={`py-2.5 px-3 font-semibold ${bin.status === "Empty" ? "text-emerald-600" : "text-amber-605"}`}>{bin.bin}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              bin.status === "Empty" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-705 border border-amber-200"
                            }`}>
                              {bin.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{bin.item_code || "-"}</td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            {bin.status === "Empty" ? (
                              bin.capacity ? `0 / ${bin.capacity} ${bin.uom}` : "0 (No Limit)"
                            ) : (
                              `${bin.actual_qty} / ${bin.capacity} ${bin.uom}`
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800 font-mono">
                            {bin.remaining_capacity !== null ? `${bin.remaining_capacity} ${bin.uom}` : "Unlimited"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-mono border-2 border-dashed border-slate-200 rounded-xl">
                  No empty bins found. All warehouses contain active stock allocations.
                </div>
              )}
            </div>
          )}

          {/* Slow Moving FG Results */}
          {showSlowMovingList && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-amber-500" />
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    Slow Moving Finished Goods
                  </span>
                </div>
                <button
                  onClick={() => setShowSlowMovingList(false)}
                  className="text-xs text-slate-400 hover:text-slate-605 font-mono"
                >
                  Hide List
                </button>
              </div>

              {slowMovingItems.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-mono text-[9px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Warehouse</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Item Group</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3">Creation Date</th>
                        <th className="py-2.5 px-3 text-right">Days in Warehouse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slowMovingItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition font-mono">
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{item.warehouse}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="font-bold">{item.itemName}</span><br />
                            <span className="text-[9px] text-slate-400">{item.itemCode}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{item.itemGroup}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-slate-600">{item.creationDate}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                              item.daysAgo > 30 ? "bg-rose-50 text-rose-700 border border-rose-200" : 
                              item.daysAgo > 14 ? "bg-amber-50 text-amber-700 border border-amber-200" : 
                              "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {item.daysAgo} Days
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-mono border-2 border-dashed border-slate-200 rounded-xl">
                  No stock items found in the warehouse.
                </div>
              )}
            </div>
          )}

          {/* Expiring Items Results */}
          {showExpiringItemsList && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-rose-500" />
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    Expiring Items
                  </span>
                </div>
                <button
                  onClick={() => setShowExpiringItemsList(false)}
                  className="text-xs text-slate-400 hover:text-slate-605 font-mono"
                >
                  Hide List
                </button>
              </div>

              {expiringItems.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-mono text-[9px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Warehouse</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Item Group</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3">Expiry Date</th>
                        <th className="py-2.5 px-3 text-right">Days Until Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiringItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition font-mono">
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{item.warehouse}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="font-bold">{item.itemName}</span><br />
                            <span className="text-[9px] text-slate-400">{item.itemCode}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{item.itemGroup}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-slate-600">{item.expiryDate}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                              item.daysUntilExpiry < 30 ? "bg-rose-50 text-rose-700 border border-rose-200" : 
                              item.daysUntilExpiry < 90 ? "bg-amber-50 text-amber-700 border border-amber-200" : 
                              "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {item.daysUntilExpiry} Days
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-mono border-2 border-dashed border-slate-200 rounded-xl">
                  No expiring items found in the warehouse.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Documentation Helper Info Panel */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-slate-600">
          <Info className="h-4.5 w-4.5 text-indigo-650 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-slate-800">Warehouse Location Tracking Note:</span>
            <p>
              Warehouse trees must represent a standard hierarchy level setup (e.g. <code>Main Warehouse {"->"} Rack {"->"} Shelf {"->"} Bin</code>).
              If leaf-level warehouses (bins) have no stock ledger allocations (or actual quantity balance is zero), they will automatically appear
              in the Empty Bin listing.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
