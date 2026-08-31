from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import jwt
import datetime
import requests
import json

from fastapi.middleware.cors import CORSMiddleware


import fastapi
# ERP_URL = "https://erpnext-qvg-hla.m.frappe.cloud"
ERP_URL = "http://77.42.39.77:8080"

# API_KEY = "6d03b8008c856ee"
API_KEY = "fe91c1c285be2e8"
# API_SECRET = "2d81d8145f8d572"
API_SECRET = "5c74a42513ab096"

HEADERS = {
    "Authorization": f"token {API_KEY}:{API_SECRET}",
    "Content-Type": "application/json"
}

def get_company_abbr(company_name: str) -> str:
    if not company_name:
        return "CO"
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Company/{company_name}", headers=HEADERS)
        if r.status_code == 200:
            abbr = r.json().get("data", {}).get("abbr")
            if abbr:
                return abbr
    except Exception:
        pass
    parts = company_name.split()
    if len(parts) >= 2:
        return "".join([p[0].upper() for p in parts if p[0].isalnum()])
    return company_name[:3].upper()

def log_wms_activity(activity_type: str, operator: str, target_location: str, old_tag: str = None, new_tag: str = None, details: str = None):
    try:
        payload = {
            "doctype": "WMS Activity Log",
            "activity_type": activity_type,
            "operator": operator or "System",
            "target_location": target_location or "",
            "old_tag": old_tag or "",
            "new_tag": new_tag or "",
            "details": details or ""
        }
        erp_post("WMS Activity Log", payload)
    except Exception as e:
        print(f"Failed to log WMS activity: {e}")

def handle_erp_response(response: requests.Response, operation: str):
    if response.status_code >= 400:
        error_msg = response.text
        try:
            err_data = response.json()
            if "exception" in err_data:
                error_msg = err_data["exception"]
            elif "_server_messages" in err_data:
                messages = json.loads(err_data["_server_messages"])
                if isinstance(messages, list) and len(messages) > 0:
                    msg_item = messages[0]
                    if isinstance(msg_item, dict) and "message" in msg_item:
                        error_msg = msg_item["message"]
                    elif isinstance(msg_item, str):
                        error_msg = msg_item
        except Exception:
            pass

        print(f"Status Code for {operation}:", response.status_code)
        print(f"Error detail for {operation}:", error_msg)
        raise HTTPException(
            status_code=response.status_code if response.status_code in [400, 401, 403, 404, 409, 417, 422] else 400,
            detail=error_msg
        )

    try:
        return response.json()["data"]
    except (KeyError, ValueError) as e:
        err_msg = f"Invalid response format from ERPNext: {str(e)}"
        print(err_msg)
        raise HTTPException(status_code=502, detail=err_msg)

def erp_post(doctype: str, payload: dict):
    try:
        print(f"POSTing to DocType: {doctype}...")
        r = requests.post(
            f"{ERP_URL}/api/resource/{doctype}",
            headers=HEADERS,
            json=payload
        )
    except requests.exceptions.RequestException as e:
        err_msg = f"Connection error to ERPNext during POST: {str(e)}"
        print(err_msg)
        raise HTTPException(status_code=503, detail=err_msg)

    return handle_erp_response(r, "post")

def erp_get(doctype: str, name: str):
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/{doctype}/{name}",
            headers=HEADERS
        )
    except requests.exceptions.RequestException as e:
        err_msg = f"Connection error to ERPNext during GET: {str(e)}"
        print(err_msg)
        raise HTTPException(status_code=503, detail=err_msg)

    return r

def erp_put(doctype: str, name: str, payload: dict):
    try:
        r = requests.put(
            f"{ERP_URL}/api/resource/{doctype}/{name}",
            headers=HEADERS,
            json=payload
        )
    except requests.exceptions.RequestException as e:
        err_msg = f"Connection error to ERPNext during PUT: {str(e)}"
        print(err_msg)
        raise HTTPException(status_code=503, detail=err_msg)

    return handle_erp_response(r, "put")

def exists(doctype: str, name: str):
    r = erp_get(doctype, name)
    return r.status_code == 200

def ensure_warehouse(warehouse_name: str, company: str, company_abbr: str):
    full_name = f"{warehouse_name} - {company_abbr}"
    if not exists("Warehouse", full_name):
        payload = {
            "warehouse_name": warehouse_name,
            "parent_warehouse": f"All Warehouses - {company_abbr}",
            "company": company
        }
        erp_post("Warehouse", payload)

def ensure_warehouse_from_full(full_warehouse_name: str, company: str):
    if " - " in full_warehouse_name:
        prefix, _ = full_warehouse_name.rsplit(" - ", 1)
    else:
        prefix = full_warehouse_name
    
    company_abbr = get_company_abbr(company)
    ensure_warehouse(prefix, company, company_abbr)

def ensure_gst_hsn_code(hsn_code: Optional[str]):
    if not hsn_code or hsn_code == "string":
        return
    if not exists("GST HSN Code", hsn_code):
        payload = {
            "name": hsn_code,
            "hsn_code": hsn_code,
            "description": f"Auto-created HSN {hsn_code}"
        }
        erp_post("GST HSN Code", payload)

def submit_doc(doctype: str, name: str):
    r_get = erp_get(doctype, name)
    if r_get.status_code >= 400:
        raise HTTPException(
            status_code=r_get.status_code,
            detail=f"Failed to fetch {doctype} {name} for submission: {r_get.text}"
        )
    doc_dict = r_get.json()["data"]

    try:
        r = requests.post(
            f"{ERP_URL}/api/method/frappe.client.submit",
            headers=HEADERS,
            json={
                "doc": json.dumps(doc_dict)
            }
        )
    except requests.exceptions.RequestException as e:
        err_msg = f"Connection error to ERPNext during submit: {str(e)}"
        print(err_msg)
        raise HTTPException(status_code=503, detail=err_msg)

    if r.status_code >= 400:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Failed to submit {doctype} {name}: {r.text}"
        )

    return r.json()["data"] if "data" in r.json() else r.json()

def make_doc_from_source(method_path: str, source_name: str):
    try:
        r = requests.post(
            f"{ERP_URL}/api/method/{method_path}",
            headers=HEADERS,
            json={"source_name": source_name}
        )
    except requests.exceptions.RequestException as e:
        err_msg = f"Connection error to ERPNext during make_doc_from_source: {str(e)}"
        print(err_msg)
        raise HTTPException(status_code=503, detail=err_msg)

    if r.status_code >= 400:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Failed to generate document using {method_path} from {source_name}: {r.text}"
        )
    return r.json()["message"]

def resolve_latest_doc(doctype: str, filters: list = None) -> str:
    params = {
        "order_by": "creation desc",
        "limit_page_length": 1
    }
    if filters:
        params["filters"] = json.dumps(filters)
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/{doctype}",
            headers=HEADERS,
            params=params
        )
        if r.status_code == 200:
            data = r.json().get("data", [])
            if data:
                return data[0]["name"]
    except Exception:
        pass
    return None

class WarehouseSchema(BaseModel):
    warehouse_name: str
    parent_warehouse: Optional[str] = None
    company: str
    is_group: Optional[int] = 0

class RawMaterialSchema(BaseModel):
    item_code: str
    item_name: str
    item_group: str
    stock_uom: str
    gst_hsn_code: Optional[str] = None
    has_batch_no: Optional[int] = 0
    has_expiry_date: Optional[int] = 0
    create_new_batch: Optional[int] = 0
    batch_number_series: Optional[str] = None
    shelf_life_in_days: Optional[int] = None

class ProductSchema(BaseModel):
    item_code: str
    item_name: str
    item_group: str
    stock_uom: str
    gst_hsn_code: Optional[str] = None
    has_batch_no: Optional[int] = 0
    has_expiry_date: Optional[int] = 0
    create_new_batch: Optional[int] = 0
    batch_number_series: Optional[str] = None
    shelf_life_in_days: Optional[int] = None

class BOMSchema(BaseModel):
    item: str
    quantity: float
    uom: str
    raw_material: str
    raw_material_qty: float
    raw_material_rate: float
    company: str

class PutawayRuleSchema(BaseModel):
    company: str
    item_code: str
    warehouse: str
    capacity: Optional[float] = None
    priority: Optional[int] = 1
    uom: Optional[str] = "Kg"

class SalesOrderSchema(BaseModel):
    customer: str
    company: str
    transaction_date: str
    delivery_date: str
    selling_price_list: Optional[str] = None
    currency: Optional[str] = None
    company_address: Optional[str] = None
    customer_address: Optional[str] = None
    shipping_address_name: Optional[str] = None
    taxes_and_charges: Optional[str] = None
    taxes: Optional[List[Dict[str, Any]]] = None
    item_code: str
    qty: float
    rate: float
    uom: str
    warehouse: str

class PaymentEntrySchema(BaseModel):
    sales_order_name: str
    amount: float
    customer: str
    company: str
    paid_from: str
    paid_to: str
    reference_date: str

class SupplierPaymentSchema(BaseModel):
    purchase_order_name: str
    amount: float
    supplier: str
    company: str
    paid_from: str
    paid_to: str
    reference_date: str

class PurchaseOrderSchema(BaseModel):
    supplier: str
    company: str
    transaction_date: str
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    supplier_address: Optional[str] = None
    taxes_and_charges: Optional[str] = None
    taxes: Optional[List[Dict[str, Any]]] = None
    item_code: str
    rate: float
    uom: str
    warehouse: str
    batch_1_qty: float
    batch_1_date: str
    batch_2_qty: float
    batch_2_date: str
    batch_3_qty: float
    batch_3_date: str

class ApprovePOSchema(BaseModel):
    purchase_order_name: str

class PurchaseReceiptSchema(BaseModel):
    purchase_order_name: Optional[str] = None
    item_row_index: Optional[int] = -1
    item_code: Optional[str] = None
    qty: Optional[float] = None
    warehouse: Optional[str] = None
    company: Optional[str] = None
    supplier: Optional[str] = None
    apply_putaway_rule: Optional[int] = 0

class WorkOrderSchema(BaseModel):
    qty: float
    bom_no: str
    production_item: str
    source_warehouse: str
    wip_warehouse: str
    fg_warehouse: str
    company: str
    use_multi_level_bom: int

class StartWorkOrderSchema(BaseModel):
    work_order_name: str
    qty: float

class FinishWorkOrderSchema(BaseModel):
    work_order_name: str
    qty: float

class SalesInvoiceSchema(BaseModel):
    sales_order_name: str
    warehouse: str

class PurchaseInvoiceSchema(BaseModel):
    purchase_order_name: str
    bill_no: str
    bill_date: str

class LoginRequest(BaseModel):
    email: str
    password: str

JWT_SECRET = "super-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"

def create_secure_jwt_token(email: str, api_key: Optional[str], api_secret: Optional[str]) -> str:
    payload = {
        "email": email,
        "api_key": api_key,
        "api_secret": api_secret,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

class DocFieldSchema(BaseModel):
    fieldname: str
    label: str
    fieldtype: str
    options: Optional[str] = None
    reqd: int = 0
    in_list_view: int = 0

class DocTypeCreateSchema(BaseModel):
    doctype_name: str
    autoname: Optional[str] = "Prompt"
    fields: List[DocFieldSchema]

def correct_warehouse_format(wh_name: str) -> str:
    if not wh_name:
        return wh_name
    if exists("Warehouse", wh_name):
        return wh_name
    # Try replacing hyphens with spaces (e.g. Bin-02 -> Bin 02)
    alt = wh_name.replace("-", " ")
    if exists("Warehouse", alt):
        return alt
    # Try replacing spaces with hyphens in the first part
    parts = wh_name.split(" - ")
    if len(parts) == 2:
        alt2 = f"{parts[0].replace(' ', '-')} - {parts[1]}"
        if exists("Warehouse", alt2):
            return alt2
    return wh_name

def resolve_warehouse_from_rfid(rfid_tag: str) -> str:
    company = resolve_latest_doc("Company") or "Rearly Tech"
    company_abbr = get_company_abbr(company)
    if f" - {company_abbr}" in rfid_tag:
        return correct_warehouse_format(rfid_tag)
        
    fields_to_try = ["custom_bin_rfid", "bin_rfid", "custom_rfid", "custom_rfid_tag", "rfid"]
    for fld in fields_to_try:
        try:
            url = f"{ERP_URL}/api/resource/Warehouse"
            params = {
                "filters": json.dumps([[fld, "=", rfid_tag]]),
                "fields": '["name"]'
            }
            r = requests.get(url, headers=HEADERS, params=params)
            if r.status_code == 200:
                data = r.json().get("data", [])
                if data:
                    return correct_warehouse_format(data[0]["name"])
        except Exception:
            pass
            
    resolved = rfid_tag
    if f" - {company_abbr}" not in resolved:
        resolved = f"{resolved} - {company_abbr}"
    return correct_warehouse_format(resolved)

#mobile api call
# WMS schemas
class WmsReceiveSchema(BaseModel):
    item_rfid: str
    pallet_id: str

class WmsPutAwaySchema(BaseModel):
    pallet_rfid: str
    bin_id: str

class WmsRetrieveSchema(BaseModel):
    pallet_rfid: str

class WmsMoveSchema(BaseModel):
    source_rfid: str
    destination_type: str
    destination_id: str

class WmsRepackSchema(BaseModel):
    item_rfid: str
    amount_used: float
    remaining_weight: float
    new_rfid: Optional[str] = None

class WmsSplitSchema(BaseModel):
    source_bin: str
    item_code: str
    qty: float
    target_bin: str

class WmsMergeSchema(BaseModel):
    pallet_a: str
    pallet_b: str
    item_code: str
    qty: float

class WmsExceptionSchema(BaseModel):
    target_rfid: str
    exception_type: str
    notes: str

class WmsDispatchSchema(BaseModel):
    pallet_rfid: str
    item_rfid: str | None = None
    dock_id: str | None = None

class WmsStockCountSchema(BaseModel):
    scanned_tags: list[str]
    warehouse: str | None = None

def resolve_item_from_rfid(rfid_tag: str) -> str:
    if exists("Item", rfid_tag):
        return rfid_tag

    try:
        item_url = f"{ERP_URL}/api/resource/Item"
        for fld in ["custom_rfid", "custom_rfid_tag", "barcode", "name"]:
            r = requests.get(
                item_url,
                headers=HEADERS,
                params={
                    "filters": json.dumps([[fld, "=", rfid_tag]]),
                    "fields": '["name"]'
                }
            )
            if r.status_code == 200:
                data = r.json().get("data", [])
                if data:
                    return data[0]["name"]
    except Exception:
        pass

    try:
        sn_url = f"{ERP_URL}/api/resource/Serial No"
        for fld in ["custom_rfid", "custom_rfid_tag", "name"]:
            r = requests.get(
                sn_url,
                headers=HEADERS,
                params={
                    "filters": json.dumps([[fld, "=", rfid_tag]]),
                    "fields": '["item_code"]'
                }
            )
            if r.status_code == 200:
                data = r.json().get("data", [])
                if data:
                    return data[0]["item_code"]
    except Exception:
        pass

    fallback = resolve_latest_doc("Item", [["is_stock_item", "=", 1]])
    if fallback:
        return fallback
    return "Maida Flour"

def get_item_source_warehouse(item_code: str) -> str:
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/Bin",
            headers=HEADERS,
            params={
                "filters": json.dumps([["item_code", "=", item_code], ["actual_qty", ">", 0]]),
                "fields": '["warehouse"]'
            }
        )
        if r.status_code == 200:
            data = r.json().get("data", [])
            if data:
                return data[0]["warehouse"]
    except Exception:
        pass
    return "Stores - V"

def perform_stock_transfer(item_code: str, qty: float, source_warehouse: str, target_warehouse: str):
    company = resolve_latest_doc("Company") or "Rearly Tech"
    
    payload = {
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Transfer",
        "purpose": "Material Transfer",
        "company": company,
        "items": [
            {
                "item_code": item_code,
                "qty": qty,
                "s_warehouse": source_warehouse,
                "t_warehouse": target_warehouse,
                "uom": "Nos",
                "allow_zero_valuation_rate": 1
            }
        ]
    }
    
    try:
        r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
        if r_item.status_code == 200:
            payload["items"][0]["uom"] = r_item.json().get("data", {}).get("stock_uom") or "Nos"
    except Exception:
        pass
        
    se = erp_post("Stock Entry", payload)
    submit_doc("Stock Entry", se["name"])
    return se



from fastapi import APIRouter
shared_router = APIRouter(tags=["Shared"])

@shared_router.post("/warehouse")
def api_create_warehouse(data: WarehouseSchema):
    company_abbr = get_company_abbr(data.company)
    w_name = data.warehouse_name
    if f" - {company_abbr}" in w_name:
        w_name = w_name.replace(f" - {company_abbr}", "")
    elif " - " in w_name:
        w_name, _ = w_name.rsplit(" - ", 1)
        
    full_name = f"{w_name} - {company_abbr}"
    if exists("Warehouse", full_name):
        return {"name": full_name, "message": "Warehouse already exists"}
        
    parent = data.parent_warehouse or f"All Warehouses - {company_abbr}"
    payload = {
        "warehouse_name": w_name,
        "parent_warehouse": parent,
        "company": data.company,
        "is_group": data.is_group
    }
    return erp_post("Warehouse", payload)

@shared_router.get("/warehouses")
def api_get_warehouses(company: Optional[str] = None):
    filters = [["disabled", "=", 0], ["custom_is_reserved", "!=", 1]]
    if company:
        filters.append(["company", "=", company])
    params = {
        "fields": '["name"]',
        "filters": json.dumps(filters),
        "limit_page_length": 100
    }
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Warehouse", headers=HEADERS, params=params)
        if r.status_code == 200:
            return [w["name"] for w in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@shared_router.get("/empty-bins")
def api_empty_bins():
    try:
        # 1. Fetch all warehouses
        wh_url = f"{ERP_URL}/api/resource/Warehouse"
        wh_params = {
            "fields": '["name", "warehouse_name", "parent_warehouse", "is_group", "custom_is_reserved"]',
            "filters": '[["custom_is_reserved", "!=", 1]]',
            "limit_page_length": 250
        }
        r_wh = requests.get(wh_url, headers=HEADERS, params=wh_params)
        wh_data = r_wh.json().get("data", []) if r_wh.status_code == 200 else []
        wh_dict = {w["name"]: w for w in wh_data}
        
        # 2. Fetch all Putaway Rules to find configured capacities
        pr_url = f"{ERP_URL}/api/resource/Putaway Rule"
        pr_params = {
            "fields": '["warehouse", "capacity", "item_code", "uom"]',
            "limit_page_length": 500
        }
        r_pr = requests.get(pr_url, headers=HEADERS, params=pr_params)
        pr_rules = r_pr.json().get("data", []) if r_pr.status_code == 200 else []
        
        # Map warehouse -> list of rules
        wh_rules = {}
        for rule in pr_rules:
            wh = rule["warehouse"]
            if wh not in wh_rules:
                wh_rules[wh] = []
            wh_rules[wh].append(rule)
        
        # 3. Fetch all Bins
        bin_url = f"{ERP_URL}/api/resource/Bin"
        bin_params = {
            "fields": '["warehouse", "item_code", "actual_qty"]',
            "limit_page_length": 500
        }
        r_bin = requests.get(bin_url, headers=HEADERS, params=bin_params)
        bins = r_bin.json().get("data", []) if r_bin.status_code == 200 else []
        
        # Map warehouse -> list of stock items with qty > 0
        wh_stock = {}
        for b in bins:
            wh = b["warehouse"]
            item = b["item_code"]
            qty = float(b["actual_qty"] or 0.0)
            if qty > 0:
                if wh not in wh_stock:
                    wh_stock[wh] = {}
                wh_stock[wh][item] = wh_stock[wh].get(item, 0.0) + qty
        
        available_bins = []
        for wh_name, w_doc in wh_dict.items():
            if w_doc["is_group"] == 1:
                continue
                
            stock_dict = wh_stock.get(wh_name, {})
            rules_list = wh_rules.get(wh_name, [])
            
            # Helper to resolve hierarchy path
            def get_resolved_path():
                path = []
                curr = wh_name
                while curr in wh_dict:
                    path.append(wh_dict[curr]["warehouse_name"])
                    curr = wh_dict[curr]["parent_warehouse"]
                path.reverse()
                
                main_wh = "Unknown"
                rack = "None"
                shelf = "None"
                bin_name = w_doc["warehouse_name"]
                
                clean_path = [x for x in path if "all" not in x.lower()]
                if len(clean_path) > 0:
                    main_wh = clean_path[0]
                if len(clean_path) > 1:
                    rack = clean_path[1]
                if len(clean_path) > 2:
                    shelf = clean_path[2]
                if len(clean_path) > 3:
                    bin_name = clean_path[3]
                return main_wh, rack, shelf, bin_name
                
            # Case A: Warehouse has zero active stock
            if not stock_dict or all(qty <= 0 for qty in stock_dict.values()):
                main_wh, rack, shelf, bin_name = get_resolved_path()
                capacity = None
                remaining = None
                uom = None
                if rules_list:
                    capacity = float(rules_list[0].get("capacity") or 0.0)
                    remaining = capacity
                    uom = rules_list[0].get("uom") or "Kg"
                    
                available_bins.append({
                    "warehouse": wh_name,
                    "main_warehouse": main_wh,
                    "rack": rack,
                    "shelf": shelf,
                    "bin": bin_name,
                    "status": "Empty",
                    "item_code": None,
                    "actual_qty": 0.0,
                    "capacity": capacity,
                    "remaining_capacity": remaining,
                    "uom": uom
                })
            else:
                # Case B: Warehouse has stock. Check for space under Putaway Rules
                for item_code, qty in stock_dict.items():
                    matching_rules = [r for r in rules_list if r.get("item_code") == item_code]
                    if matching_rules:
                        rule = matching_rules[0]
                        capacity = float(rule.get("capacity") or 0.0)
                        uom = rule.get("uom") or "Kg"
                        if qty < capacity:
                            main_wh, rack, shelf, bin_name = get_resolved_path()
                            available_bins.append({
                                "warehouse": wh_name,
                                "main_warehouse": main_wh,
                                "rack": rack,
                                "shelf": shelf,
                                "bin": bin_name,
                                "status": "Partially Filled",
                                "item_code": item_code,
                                "actual_qty": qty,
                                "capacity": capacity,
                                "remaining_capacity": capacity - qty,
                                "uom": uom
                            })
                            
        return available_bins
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@shared_router.get("/wms/activity-log")
def api_wms_activity_log():
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/WMS Activity Log",
            headers=HEADERS,
            params={
                "fields": '["name", "creation", "activity_type", "operator", "target_location", "old_tag", "new_tag", "details"]',
                "order_by": "creation desc",
                "limit_page_length": 50
            }
        )
        if r.status_code == 200:
            return r.json().get("data", [])
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

