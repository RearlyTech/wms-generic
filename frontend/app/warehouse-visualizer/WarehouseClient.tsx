"use client";

import { useState, useMemo } from "react";
import { Rack, Row, Bin, Item } from "@/lib/warehouse-data";
import { ArrowLeft, Search, LogOut, Loader2, MapPin, Package, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

const isItemExpiringSoon = (expiryDate?: string, filterValue?: string) => {
    if (!expiryDate || filterValue === "all" || !filterValue) return false;
    
    const exp = new Date(expiryDate);
    const now = new Date();
    
    if (filterValue === "0") {
        // "This month"
        return exp.getFullYear() === now.getFullYear() && exp.getMonth() === now.getMonth();
    } else {
        const monthsToAdd = parseInt(filterValue, 10);
        const futureDate = new Date(now);
        futureDate.setMonth(now.getMonth() + monthsToAdd);
        return exp <= futureDate;
    }
};

interface Props {
    initialWarehouses: {id: string, name: string}[];
    initialRacksMap: Record<string, Rack[]>;
    backendUrl: string;
}

export default function WarehouseClient({ initialWarehouses, initialRacksMap, backendUrl }: Props) {
    const router = useRouter();
    const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
    const [selectedRow, setSelectedRow] = useState<Row | null>(null);
    const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
    const [expiryFilter, setExpiryFilter] = useState<string>("0");
    const [markingBatch, setMarkingBatch] = useState<string | null>(null);

    const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
    const [currentRackIndex, setCurrentRackIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");

    const initialRacks = useMemo(() => {
        return selectedWarehouse ? (initialRacksMap[selectedWarehouse] || []) : [];
    }, [selectedWarehouse, initialRacksMap]);

    const expiringItems = useMemo(() => {
        if (expiryFilter === "all") return [];
        
        const items: { item: Item, rackName: string, rowName: string, binName: string }[] = [];
        
        initialRacks.forEach(rack => {
            rack.rows.forEach(row => {
                row.bins.forEach(bin => {
                    bin.items.forEach(item => {
                        if (isItemExpiringSoon(item.expiryDate, expiryFilter)) {
                            items.push({ item, rackName: rack.name, rowName: row.name, binName: bin.name });
                        }
                    });
                });
            });
        });
        
        return items;
    }, [initialRacks, expiryFilter]);

    const handleRackClick = (rack: Rack) => {
        setSelectedRack(rack);
        setSelectedRow(null);
        setSelectedBin(null);
    };

    const handleRowClick = (rack: Rack, row: Row) => {
        setSelectedRack(rack);
        setSelectedRow(row);
        setSelectedBin(null);
    };

    const handleBinClick = (rack: Rack, row: Row, bin: Bin) => {
        setSelectedRack(rack);
        setSelectedRow(row);
        setSelectedBin(bin);
    };

    const clearSelection = () => {
        setSelectedRack(null);
        setSelectedRow(null);
        setSelectedBin(null);
    };

    const handleNextRack = () => {
        setCurrentRackIndex((prev) => (prev + 1) % initialRacks.length);
        clearSelection();
    };

    const handlePrevRack = () => {
        setCurrentRackIndex((prev) => (prev - 1 + initialRacks.length) % initialRacks.length);
        clearSelection();
    };

    const clearAll = () => {
        setSelectedWarehouse(null);
        setCurrentRackIndex(0);
        setSearchQuery("");
        clearSelection();
    }
    
    const markForDispatch = async (batchNo: string) => {
        setMarkingBatch(batchNo);
        try {
            await fetch(`${backendUrl}/wms/mark-dispatch/${batchNo}`, { method: "PUT", mode: "cors" });
            // In a real app we'd mutate the state or refetch, for now just reset marking
        } catch (e) {
            console.error(e);
        } finally {
            setMarkingBatch(null);
        }
    }

    if (!selectedWarehouse) {
        const filteredWarehouses = initialWarehouses.filter(w => 
            w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            w.id.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center font-sans">
                <header className="w-full bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-indigo-600" />
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Warehouse Locations</h1>
                        </div>
                    </div>
                </header>

                <main className="w-full max-w-6xl mt-12 mb-12 flex flex-col items-center px-4">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl mb-6 flex items-center justify-center shadow-sm border border-indigo-200">
                        <MapPin className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3 text-center">Select Facility</h2>
                    <p className="text-slate-500 text-base mb-10 text-center max-w-lg">Choose a warehouse or bin location from your ERP system to visualize its physical layout.</p>
                    
                    <div className="w-full max-w-2xl relative mb-10">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search locations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-12 pr-4 py-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow shadow-sm text-base font-medium"
                        />
                    </div>

                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredWarehouses.map(w => (
                            <button 
                                key={w.id} 
                                onClick={() => setSelectedWarehouse(w.id)}
                                className="relative bg-white hover:bg-slate-50 text-left p-5 rounded-2xl transition-all shadow-sm border border-slate-200 hover:border-indigo-400 group overflow-hidden flex flex-col justify-between min-h-[130px]"
                            >
                                <div className="absolute top-0 right-0 p-5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                        <ArrowLeft className="w-4 h-4 text-indigo-600 rotate-180" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5 z-10">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{w.id}</span>
                                    <span className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 pr-8 leading-tight">{w.name}</span>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                            </button>
                        ))}
                        {filteredWarehouses.length === 0 && (
                            <div className="col-span-full py-12 text-center bg-white border border-slate-200 border-dashed rounded-2xl">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-3">
                                    <Search className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-slate-600 text-base font-medium">No locations found matching "{searchQuery}"</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    const currentRack = initialRacks[currentRackIndex];

    return (
        <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Package className="w-5 h-5 text-indigo-600" />
                            Warehouse Visualizer
                        </h1>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-bold border border-indigo-200">
                                {initialWarehouses.find(w => w.id === selectedWarehouse)?.name || selectedWarehouse}
                            </span>
                            <span className="text-slate-500 text-xs font-medium">
                                {initialRacks.length === 0 ? "No layout data" :
                                 !selectedRack ? `Viewing ${currentRack?.name}` : 
                                 !selectedRow ? `Selected ${selectedRack.name}` : 
                                 !selectedBin ? `Selected ${selectedRack.name} / ${selectedRow.name}` : 
                                 `Selected ${selectedRack.name} / ${selectedRow.name} / ${selectedBin.name}`}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <select 
                        value={expiryFilter}
                        onChange={(e) => setExpiryFilter(e.target.value)}
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block px-3 py-2 outline-none font-medium shadow-sm"
                    >
                        <option value="0">Expires This Month</option>
                        <option value="1">Expires in 1 Month</option>
                        <option value="2">Expires in 2 Months</option>
                        <option value="all">No Expiry Filter</option>
                    </select>
                    {selectedRack && (
                        <button 
                            onClick={clearSelection}
                            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-colors border border-slate-300 text-sm shadow-sm"
                        >
                            Clear Selection
                        </button>
                    )}
                    <button 
                        onClick={clearAll}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-semibold transition-colors border border-indigo-200 text-sm flex items-center gap-2 shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Change Facility
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden p-6 gap-6 w-full max-w-[1600px] mx-auto">
                <div className="flex-1 overflow-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center">
                
                {initialRacks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <MapPin className="w-12 h-12 text-slate-300 mb-4" />
                        <h2 className="text-xl font-bold text-slate-800 mb-2">No Layout Data</h2>
                        <p className="text-slate-500 max-w-sm text-sm">This warehouse does not have any racks, rows, or bins configured yet.</p>
                    </div>
                ) : (
                    <>
                    <div className="w-full max-w-4xl flex items-center justify-between mb-6">
                        <button 
                            onClick={handlePrevRack}
                            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm border border-slate-300 flex items-center gap-2 text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Prev Rack
                        </button>
                        
                        <div className="text-slate-700 font-bold text-sm bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                            Rack {currentRackIndex + 1} of {initialRacks.length}
                        </div>
                        
                        <button 
                            onClick={handleNextRack}
                            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm border border-slate-300 flex items-center gap-2 text-sm"
                        >
                            Next Rack
                            <ArrowLeft className="w-4 h-4 rotate-180" />
                        </button>
                    </div>

                    <div className="w-full max-w-4xl h-fit">
                        {(() => {
                            const rack = currentRack;
                            const isRackSelected = selectedRack?.id === rack.id;
                            
                            return (
                                <div 
                                    key={rack.id} 
                                    className={`border-[3px] rounded-2xl p-5 transition-all cursor-pointer relative ${isRackSelected ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-300 bg-white hover:border-slate-400'}`}
                                    onClick={() => handleRackClick(rack)}
                                >
                                    <div className="flex justify-between items-center mb-5">
                                        <h2 className="text-lg font-extrabold text-slate-800">{rack.name}</h2>
                                        {isRackSelected && <div className="px-2 py-1 bg-indigo-500 rounded text-white text-[10px] font-bold shadow-sm uppercase tracking-wider">Selected Rack</div>}
                                    </div>
                                    
                                    <div className="flex flex-col gap-4">
                                        {rack.rows.map(row => {
                                            const isRowSelected = selectedRow?.id === row.id;
                                            
                                            return (
                                                <div 
                                                    key={row.id}
                                                    className={`border-2 rounded-xl p-4 flex flex-col transition-all cursor-pointer relative ${isRowSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                                                    onClick={(e) => { e.stopPropagation(); handleRowClick(rack, row); }}
                                                >
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h3 className="text-sm font-bold text-slate-700">{row.name}</h3>
                                                        {isRowSelected && <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold uppercase tracking-wider">Selected Row</div>}
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                                            {row.bins.map(bin => {
                                                                const isBinSelected = selectedBin?.id === bin.id;
                                                                const isEmpty = bin.items.length === 0;
                                                                const hasExpiringItems = bin.items.some(item => isItemExpiringSoon(item.expiryDate, expiryFilter));
                                                                
                                                                return (
                                                                    <div 
                                                                        key={bin.id}
                                                                        className={`relative border-2 rounded-lg p-2 h-24 flex flex-col items-center justify-center transition-all cursor-pointer group ${
                                                                            isBinSelected 
                                                                            ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-500/20 ring-offset-1' 
                                                                            : hasExpiringItems
                                                                                ? 'border-rose-400 bg-rose-50 shadow-sm'
                                                                                : isEmpty 
                                                                                    ? 'border-slate-200 border-dashed bg-white hover:border-slate-300' 
                                                                                    : 'border-slate-300 bg-white hover:border-indigo-300 shadow-sm'
                                                                        }`}
                                                                        onClick={(e) => { e.stopPropagation(); handleBinClick(rack, row, bin); }}
                                                                    >
                                                                    {isBinSelected && (
                                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-20 pointer-events-none">
                                                                            <div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap mb-0.5">
                                                                                {bin.name}
                                                                            </div>
                                                                            <div className="w-0.5 h-2 bg-indigo-600 shadow-sm"></div>
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-md border border-white"></div>
                                                                        </div>
                                                                    )}

                                                                    <h4 className={`text-xs font-black mb-1 ${isBinSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                                        {bin.name}
                                                                    </h4>
                                                                    
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isEmpty ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                                        {isEmpty ? "Empty" : `${bin.items.length} Items`}
                                                                    </span>

                                                                    {isBinSelected && !isEmpty && (
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-30 w-48 pointer-events-none ring-1 ring-black/5">
                                                                            <h5 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Contents</h5>
                                                                            <div className="flex flex-col gap-2">
                                                                                {bin.items.map(item => (
                                                                                    <div key={item.itemCode} className="flex flex-col mb-1 last:mb-0">
                                                                                        <div className="flex justify-between items-start gap-2">
                                                                                            <span className="text-[11px] font-bold text-slate-800 leading-tight">{item.itemName}</span>
                                                                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                                                                                                {item.totalWeight}{item.uom}
                                                                                            </span>
                                                                                        </div>
                                                                                        {item.expiryDate && (
                                                                                            <span className={`text-[9px] font-medium mt-1 ${isItemExpiringSoon(item.expiryDate, expiryFilter) ? 'text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 inline-block self-start' : 'text-slate-500'}`}>
                                                                                                Exp: {item.expiryDate}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                    </>
                )}
                </div>
                
                {expiryFilter !== "all" && (
                    <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
                        <div className="p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="text-rose-600 font-bold flex items-center gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                Expiring Items
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                            {expiringItems.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center mt-6 font-medium">No items found matching this filter.</p>
                            ) : (
                                expiringItems.map((entry, i) => (
                                    <div key={`${entry.item.itemCode}-${i}`} className="bg-white border border-slate-200 hover:border-rose-300 hover:shadow-md rounded-xl p-3 shadow-sm transition-all cursor-pointer" onClick={() => {
                                        const rack = initialRacks.find(r => r.name === entry.rackName);
                                        const row = rack?.rows.find(r => r.name === entry.rowName);
                                        const bin = row?.bins.find(b => b.name === entry.binName);
                                        if (rack && row && bin) {
                                            handleBinClick(rack, row, bin);
                                        }
                                    }}>
                                        <div className="flex justify-between items-start mb-2 gap-2">
                                            <h4 className="text-xs font-bold text-slate-800 leading-tight">{entry.item.itemName}</h4>
                                            <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded whitespace-nowrap">Exp: {entry.item.expiryDate}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                {entry.item.itemCode}
                                            </span>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                {entry.item.totalWeight}{entry.item.uom}
                                            </span>
                                        </div>
                                        <div className="text-[10px] font-medium text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{entry.rackName} &gt; {entry.rowName} &gt; {entry.binName}</span>
                                            </div>
                                        </div>
                                        
                                        {entry.item.batchNo && (
                                            <div className="mt-2 pt-2 border-t border-slate-100">
                                                {entry.item.markedForDispatch ? (
                                                    <div className="w-full py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-center text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm">
                                                        Marked for Dispatch
                                                    </div>
                                                ) : (
                                                    <button 
                                                        disabled={markingBatch === entry.item.batchNo}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!entry.item.batchNo) return;
                                                            await markForDispatch(entry.item.batchNo);
                                                        }}
                                                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-center text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        {markingBatch === entry.item.batchNo ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : "Mark for Dispatch"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
