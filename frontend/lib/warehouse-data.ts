export type Item = {
    itemCode: string;
    itemName: string;
    packSize: number;
    packCount: number;
    totalWeight: number;
    uom: string;
    expiryDate?: string;
    batchNo?: string;
    markedForDispatch?: boolean;
};

export type Bin = {
    id: string;
    name: string;
    items: Item[];
};

export type Row = {
    id: string;
    name: string;
    bins: Bin[];
};

export type Rack = {
    id: string;
    name: string;
    rows: Row[];
};
