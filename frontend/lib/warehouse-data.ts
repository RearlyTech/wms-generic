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

export type WarehouseNode = {
    id: string;
    name: string;
    items: Item[];
    children: WarehouseNode[];
};
