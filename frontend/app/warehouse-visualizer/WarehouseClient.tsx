"use client";

import { useState, useMemo } from "react";
import { WarehouseNode, Item } from "@/lib/warehouse-data";
import { ArrowLeft, Search, Loader2, MapPin, Package, AlertTriangle, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

const isItemExpiringSoon = (expiryDate?: string, filterValue?: string) => {
    if (!expiryDate || filterValue === "all" || !filterValue) return false;
    
    const exp = new Date(expiryDate);
    const now = new Date();
    
    if (filterValue === "0") {
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
    initialRacksMap: Record<string, WarehouseNode[]>;
    backendUrl: string;
}

export default function WarehouseClient({ initialWarehouses, initialRacksMap, backendUrl }: Props) {
    const router = useRouter();
    const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
    const [expiryFilter, setExpiryFilter] = useState<string>("0");
    const [markingBatch, setMarkingBatch] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Sliding Window State
    // viewContext stores the path of nodes we have drilled into.
    // If empty, the "current parent" is the selected warehouse (root).
    // The items inside `initialRacksMap[selectedWarehouse]` are the Level 1 nodes.
    const [viewContext, setViewContext] = useState<WarehouseNode[]>([]);
    const [currentL1Index, setCurrentL1Index] = useState(0);

    // Selected nodes for styling/highlighting (not for drilling down)
    const [selectedL1, setSelectedL1] = useState<WarehouseNode | null>(null);
    const [selectedL2, setSelectedL2] = useState<WarehouseNode | null>(null);
    const [selectedL3, setSelectedL3] = useState<WarehouseNode | null>(null);

    const rootNodes = useMemo(() => {
        return selectedWarehouse ? (initialRacksMap[selectedWarehouse] || []) : [];
    }, [selectedWarehouse, initialRacksMap]);

    // Recursive search for expiring items
    const expiringItems = useMemo(() => {
        if (expiryFilter === "all") return [];
        
        const items: { item: Item, path: string[], node: WarehouseNode }[] = [];
        
        const searchNode = (node: WarehouseNode, path: string[]) => {
            if (!node) return;
            const currentPath = [...path, node.name];
            (node.items || []).forEach(item => {
                if (isItemExpiringSoon(item.expiryDate, expiryFilter)) {
                    items.push({ item, path: currentPath, node });
                }
            });
            (node.children || []).forEach(child => searchNode(child, currentPath));
        };

        rootNodes.forEach(root => searchNode(root, []));
        
        return items;
    }, [rootNodes, expiryFilter]);

    const handleL1Click = (node: WarehouseNode) => {
        setSelectedL1(node);
        setSelectedL2(null);
        setSelectedL3(null);
    };

    const handleL2Click = (l1: WarehouseNode, l2: WarehouseNode) => {
        setSelectedL1(l1);
        setSelectedL2(l2);
        setSelectedL3(null);
    };

    const handleL3Click = (l1: WarehouseNode, l2: WarehouseNode, l3: WarehouseNode) => {
        setSelectedL1(l1);
        setSelectedL2(l2);
        setSelectedL3(l3);
    };

    const drillDown = (l1Node: WarehouseNode, l2Node: WarehouseNode, node: WarehouseNode) => {
        if (l1Node && l2Node) {
            setViewContext([...viewContext, l1Node, l2Node]);
            setCurrentL1Index(l2Node.children.findIndex(c => c.id === node.id) || 0);
        }
        clearSelection();
    };

    const navigateUp = (index: number) => {
        // index is the index in the viewContext array to navigate to
        // -1 means root (Facility level)
        if (index === -1) {
            setViewContext([]);
        } else {
            setViewContext(viewContext.slice(0, index + 1));
        }
        setCurrentL1Index(0);
        clearSelection();
    };

    const clearSelection = () => {
        setSelectedL1(null);
        setSelectedL2(null);
        setSelectedL3(null);
    };

    const currentParentNodes = viewContext.length === 0 ? rootNodes : viewContext[viewContext.length - 1].children;

    const handleNextL1 = () => {
        setCurrentL1Index((prev) => (prev + 1) % currentParentNodes.length);
        clearSelection();
    };

    const handlePrevL1 = () => {
        setCurrentL1Index((prev) => (prev - 1 + currentParentNodes.length) % currentParentNodes.length);
        clearSelection();
    };

    const clearAll = () => {
        setSelectedWarehouse(null);
        setViewContext([]);
        setCurrentL1Index(0);
        setSearchQuery("");
        clearSelection();
    }
    
    const markForDispatch = async (batchNo: string) => {
        setMarkingBatch(batchNo);
        try {
            await fetch(`${backendUrl}/wms/mark-dispatch/${batchNo}`, { method: "PUT", mode: "cors" });
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

    const currentL1Node = currentParentNodes[currentL1Index];

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
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <button 
                                onClick={() => navigateUp(-1)}
                                className="px-2 py-0.5 hover:bg-indigo-100 bg-indigo-50 text-indigo-700 rounded text-[11px] font-bold border border-indigo-200 transition-colors cursor-pointer"
                            >
                                {initialWarehouses.find(w => w.id === selectedWarehouse)?.name || selectedWarehouse}
                            </button>
                            
                            {viewContext.map((node, idx) => (
                                <div key={node.id} className="flex items-center gap-1.5">
                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                    <button 
                                        onClick={() => navigateUp(idx)}
                                        className="px-2 py-0.5 hover:bg-slate-200 bg-slate-100 text-slate-700 rounded text-[11px] font-bold border border-slate-200 transition-colors cursor-pointer"
                                    >
                                        {node.name}
                                    </button>
                                </div>
                            ))}
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
                    {selectedL1 && (
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
                
                {currentParentNodes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <MapPin className="w-12 h-12 text-slate-300 mb-4" />
                        <h2 className="text-xl font-bold text-slate-800 mb-2">No Layout Data</h2>
                        <p className="text-slate-500 max-w-sm text-sm">There are no locations configured at this level.</p>
                    </div>
                ) : (
                    <>
                    <div className="w-full max-w-4xl flex items-center justify-between mb-6">
                        <button 
                            onClick={handlePrevL1}
                            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm border border-slate-300 flex items-center gap-2 text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Prev
                        </button>
                        
                        <div className="text-slate-700 font-bold text-sm bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                            {currentL1Node?.name} ({currentL1Index + 1} of {currentParentNodes.length})
                        </div>
                        
                        <button 
                            onClick={handleNextL1}
                            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm border border-slate-300 flex items-center gap-2 text-sm"
                        >
                            Next
                            <ArrowLeft className="w-4 h-4 rotate-180" />
                        </button>
                    </div>

                    <div className="w-full max-w-4xl h-fit">
                        {(() => {
                            const l1Node = currentL1Node;
                            if (!l1Node) return null;
                            const isL1Selected = selectedL1?.id === l1Node.id;
                            
                            return (
                                <div 
                                    key={l1Node.id} 
                                    className={`border-[3px] rounded-2xl p-5 transition-all cursor-pointer relative ${isL1Selected ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-300 bg-white hover:border-slate-400'}`}
                                    onClick={() => handleL1Click(l1Node)}
                                >
                                    <div className="flex justify-between items-center mb-5">
                                        <h2 className="text-lg font-extrabold text-slate-800">{l1Node.name}</h2>
                                        {isL1Selected && <div className="px-2 py-1 bg-indigo-500 rounded text-white text-[10px] font-bold shadow-sm uppercase tracking-wider">Selected</div>}
                                    </div>
                                    
                                    <div className="flex flex-col gap-4">
                                        {(l1Node.children || []).map(l2Node => {
                                            const isL2Selected = selectedL2?.id === l2Node.id;
                                            
                                            return (
                                                <div 
                                                    key={l2Node.id}
                                                    className={`border-2 rounded-xl p-4 flex flex-col transition-all cursor-pointer relative ${isL2Selected ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                                                    onClick={(e) => { e.stopPropagation(); handleL2Click(l1Node, l2Node); }}
                                                >
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h3 className="text-sm font-bold text-slate-700">{l2Node.name}</h3>
                                                        {isL2Selected && <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold uppercase tracking-wider">Selected</div>}
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                                            {(l2Node.children || []).map(l3Node => {
                                                                const isL3Selected = selectedL3?.id === l3Node.id;
                                                                const l3Items = l3Node.items || [];
                                                                const l3Children = l3Node.children || [];
                                                                const isEmpty = l3Items.length === 0 && l3Children.length === 0;
                                                                
                                                                // Search recursively for expiring items in this L3 node
                                                                let hasExpiringItems = false;
                                                                const checkExpiring = (n: WarehouseNode) => {
                                                                    if (!n) return;
                                                                    (n.items || []).some(item => {
                                                                        if (isItemExpiringSoon(item.expiryDate, expiryFilter)) {
                                                                            hasExpiringItems = true;
                                                                            return true;
                                                                        }
                                                                        return false;
                                                                    });
                                                                    if (hasExpiringItems) return;
                                                                    (n.children || []).forEach(checkExpiring);
                                                                };
                                                                checkExpiring(l3Node);
                                                                
                                                                const hasChildren = l3Children.length > 0;
                                                                
                                                                return (
                                                                    <div 
                                                                        key={l3Node.id}
                                                                        className={`relative border-2 rounded-lg p-2 h-24 flex flex-col items-center justify-center transition-all cursor-pointer group ${
                                                                            isL3Selected 
                                                                            ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-500/20 ring-offset-1' 
                                                                            : hasExpiringItems
                                                                                ? 'border-rose-400 bg-rose-50 shadow-sm'
                                                                                : isEmpty 
                                                                                    ? 'border-slate-200 border-dashed bg-white hover:border-slate-300' 
                                                                                    : 'border-slate-300 bg-white hover:border-indigo-300 shadow-sm'
                                                                        }`}
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            if (hasChildren) {
                                                                                drillDown(l1Node, l2Node, l3Node);
                                                                            } else {
                                                                                handleL3Click(l1Node, l2Node, l3Node);
                                                                            }
                                                                        }}
                                                                    >
                                                                    {isL3Selected && !hasChildren && (
                                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-20 pointer-events-none">
                                                                            <div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap mb-0.5">
                                                                                {l3Node.name}
                                                                            </div>
                                                                            <div className="w-0.5 h-2 bg-indigo-600 shadow-sm"></div>
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-md border border-white"></div>
                                                                        </div>
                                                                    )}

                                                                    <h4 className={`text-xs font-black mb-1 ${isL3Selected ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                                        {l3Node.name}
                                                                    </h4>
                                                                    
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isEmpty ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600 border border-slate-200'} text-center leading-tight`}>
                                                                        {isEmpty ? "Empty" : hasChildren ? `${l3Children.length} Locations\n(Click to Drill)` : `${l3Items.length} Items`}
                                                                    </span>

                                                                    {isL3Selected && !isEmpty && !hasChildren && (
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-30 w-48 pointer-events-none ring-1 ring-black/5">
                                                                            <h5 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Contents</h5>
                                                                            <div className="flex flex-col gap-2">
                                                                                {l3Items.map(item => (
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

                                                    {/* Direct items in L2 (if any) */}
                                                    {(l2Node.items || []).length > 0 && (l2Node.children || []).length === 0 && (
                                                        <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Items</h4>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                {l2Node.items.map(item => (
                                                                    <div key={item.itemCode} className="bg-slate-50 border border-slate-200 rounded p-2 flex justify-between items-start gap-2">
                                                                        <span className="text-[11px] font-bold text-slate-800 leading-tight">{item.itemName}</span>
                                                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                                                                            {item.totalWeight}{item.uom}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        
                                        {/* Direct items in L1 (if any) */}
                                        {(l1Node.items || []).length > 0 && (l1Node.children || []).length === 0 && (
                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                                <h3 className="text-sm font-bold text-slate-700 mb-3">Direct Items</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                    {l1Node.items.map(item => (
                                                        <div key={item.itemCode} className="bg-white border border-slate-200 rounded-lg p-3">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="text-[11px] font-bold text-slate-800 leading-tight">{item.itemName}</span>
                                                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                                                                    {item.totalWeight}{item.uom}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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
                                    <div key={`${entry.item.itemCode}-${i}`} className="bg-white border border-slate-200 hover:border-rose-300 hover:shadow-md rounded-xl p-3 shadow-sm transition-all cursor-pointer" >
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
                                                <span className="truncate">{entry.path.join(" > ")}</span>
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
