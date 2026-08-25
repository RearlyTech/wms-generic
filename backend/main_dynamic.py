from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import jwt
import datetime
import requests
import json

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ERP System (Dynamic Backend)", description="ERP System API with strictly dynamic inputs", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import fastapi
@app.get("/wms/door-status")
def get_door_status(authorization: str = fastapi.Header(default=None)):
    try:
        url = "https://dev-directus.rearlytech.com/items/gateway_sensor_readings?filter[sensor_type][_eq]=door_uart&limit=1&sort=-created_at"
        headers = {}
        if authorization:
            headers["Authorization"] = authorization
            
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("data") and len(data["data"]) > 0:
                return {"door_status": data["data"][0].get("door_status", "Unknown")}
        return {"door_status": "Unknown"}
    except Exception as e:
        print(f"Error fetching door status: {e}")
        return {"door_status": "Unknown"}

# ERP_URL = "https://erpnext-qvg-hla.m.frappe.cloud"
ERP_URL = "http://192.168.29.59:8000"

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

@app.post("/api/auth/login")
def login_user(data: LoginRequest):
    payload = {
        "email": data.email,
        "password": data.password
    }
    
    session = requests.Session()
    login_response = session.post("https://dev-directus.rearlytech.com/auth/login", json=payload)
    
    if login_response.status_code != 200:
        print(f"Directus Login failed. Status: {login_response.status_code}, Response: {login_response.text}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid email or password. Directus returned {login_response.status_code}: {login_response.text}"
        )
    
    directus_data = login_response.json().get("data", {})
    directus_access_token = directus_data.get("access_token")
    directus_refresh_token = directus_data.get("refresh_token")
        
    # Use the existing active key & secret defined in the backend config
    api_key = API_KEY
    api_secret = API_SECRET

    token = create_secure_jwt_token(email=data.email, api_key=api_key, api_secret=api_secret)

    return {
        "message": "Login successful", 
        "access_token": token, 
        "token_type": "bearer",
        "directus_access_token": directus_access_token,
        "directus_refresh_token": directus_refresh_token
    }

@app.post("/warehouse")
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

@app.post("/putaway-rule")
def api_create_putaway_rule(data: PutawayRuleSchema):
    # warehouse = data.warehouse
    # if not warehouse or warehouse == "":
    #     bin_url = f"{ERP_URL}/api/resource/Bin"
    #     bin_params = {
    #         "fields": '["warehouse","actual_qty"]',
    #         "filters": json.dumps([
    #             ["Item", "item_code", "=", data.item_code],
    #             ["actual_qty", ">", 0]
    #         ])
    #     }
    #     response = requests.get(bin_url, params=bin_params, headers=HEADERS)
    #     bin_data = response.json().get("data", [])
    #     putaway_url = f"{ERP_URL}/api/resource/Putaway Rule"
    #     putaway_params = {
    #         "fields": '["capacity"]',
    #         "filters": json.dumps([
    #             ["item_code", "=", data.item_code],
    #             ["warehouse", "=", warehouse]
    #         ])
    #     }
    #     response2 = requests.get(putaway_url, params=putaway_params, headers=HEADERS)
    #     putaway_data = response2.json().get("data",[])
    #     remaining = putaway_data[0].get("capacity") - bin_data[0].get("actual_qty",0)      
    payload = {
        "company": data.company,
        "item_code": data.item_code,
        "warehouse": data.warehouse,
        "capacity": data.capacity,
        "priority": data.priority,
        "uom": data.uom
    }
    return erp_post("Putaway Rule", payload)

@app.post("/rawmaterials")
def api_create_raw_material(data: RawMaterialSchema):
    hsn = data.gst_hsn_code
    if hsn == "string" or not hsn:
        hsn = None
    else:
        ensure_gst_hsn_code(hsn)
        
    payload = {
        "item_code": data.item_code,
        "item_name": data.item_name,
        "item_group": data.item_group,
        "stock_uom": data.stock_uom,
        "is_stock_item": 1,
        "has_batch_no": data.has_batch_no,
        "has_expiry_date": data.has_expiry_date,
        "create_new_batch": data.create_new_batch,
        "batch_number_series": data.batch_number_series,
        "shelf_life_in_days": data.shelf_life_in_days
    }
    if hsn:
        payload["gst_hsn_code"] = hsn
        
    return erp_post("Item", payload)

@app.post("/product")
def api_create_product(data: ProductSchema):
    hsn = data.gst_hsn_code
    if hsn == "string" or not hsn:
        hsn = None
    else:
        ensure_gst_hsn_code(hsn)
        
    payload = {
        "item_code": data.item_code,
        "item_name": data.item_name,
        "item_group": data.item_group,
        "stock_uom": data.stock_uom,
        "is_stock_item": 1,
        "has_batch_no": data.has_batch_no,
        "has_expiry_date": data.has_expiry_date,
        "create_new_batch": data.create_new_batch,
        "batch_number_series": data.batch_number_series,
        "shelf_life_in_days": data.shelf_life_in_days
    }
    if hsn:
        payload["gst_hsn_code"] = hsn
        
    return erp_post("Item", payload)

@app.post("/bom")
def api_create_bom(data: BOMSchema):
    payload = {
        "item": data.item,
        "company": data.company,
        "is_active": 1,
        "quantity": data.quantity,
        "uom": data.uom,
        "items": [
            {
                "item_code": data.raw_material,
                "rate": data.raw_material_rate,
                "uom": data.uom,
                "qty": data.raw_material_qty,
                "stock_qty": data.raw_material_qty,
                "stock_uom": data.uom
            }
        ]
    }
    bom = erp_post("BOM", payload)
    submit_doc("BOM", bom["name"])
    return bom

@app.get("/bom/active")
def api_get_active_bom(item: str):
    r_bom = requests.get(
        f"{ERP_URL}/api/resource/BOM",
        headers=HEADERS,
        params={"filters": f'[["item", "=", "{item}"], ["is_active", "=", 1]]'}
    )
    if r_bom.status_code == 200:
        bom_list = r_bom.json().get("data", [])
        if bom_list:
            bom_name = bom_list[0]["name"]
            r_get = erp_get("BOM", bom_name)
            if r_get.status_code == 200:
                bom_data = r_get.json()["data"]
                if bom_data.get("docstatus") == 0:
                    submit_doc("BOM", bom_name)
            return {"bom_no": bom_name}
    raise HTTPException(status_code=404, detail=f"No active BOM found for {item}")

@app.post("/salesorder")
def api_create_salesorder(data: SalesOrderSchema):
    ensure_warehouse_from_full(data.warehouse, data.company)
    
    so_payload = {
        "customer": data.customer,
        "company": data.company,
        "transaction_date": data.transaction_date,
        "delivery_date": data.delivery_date,
        "items": [
            {
                "item_code": data.item_code,
                "qty": data.qty,
                "rate": data.rate,
                "uom": data.uom,
                "conversion_factor": 1.0,
                "delivery_date": data.delivery_date,
                "warehouse": data.warehouse
            }
        ]
    }
    if data.selling_price_list:
        so_payload["selling_price_list"] = data.selling_price_list
    if data.currency:
        so_payload["currency"] = data.currency
    if data.company_address:
        so_payload["company_address"] = data.company_address
    if data.customer_address:
        so_payload["customer_address"] = data.customer_address
    if data.shipping_address_name:
        so_payload["shipping_address_name"] = data.shipping_address_name
    if data.taxes_and_charges:
        so_payload["taxes_and_charges"] = data.taxes_and_charges
    if data.taxes:
        so_payload["taxes"] = data.taxes
        
    so = erp_post("Sales Order", so_payload)
    submit_doc("Sales Order", so["name"])
    return so

@app.post("/payment-entry")
def api_create_payment_entry(data: PaymentEntrySchema):
    so_name = data.sales_order_name
    ref_doctype = "Sales Order"
    if so_name == "string" or not so_name:
        resolved_si = resolve_latest_doc("Sales Invoice", [["customer", "=", data.customer], ["docstatus", "<", 2]])
        if resolved_si:
            so_name = resolved_si
            ref_doctype = "Sales Invoice"
            print(f"Resolved 'string' to latest Sales Invoice: {so_name}")
        else:
            resolved_so = resolve_latest_doc("Sales Order", [["customer", "=", data.customer], ["docstatus", "<", 2]])
            if resolved_so:
                so_name = resolved_so
                ref_doctype = "Sales Order"
                print(f"Resolved 'string' to latest Sales Order: {so_name}")
            else:
                raise HTTPException(status_code=400, detail="Could not find any Sales Order or Sales Invoice to resolve 'string' placeholder.")
    else:
        if exists("Sales Invoice", so_name):
            ref_doctype = "Sales Invoice"
        elif exists("Sales Order", so_name):
            ref_doctype = "Sales Order"

    allocated = data.amount
    try:
        r_doc = erp_get(ref_doctype, so_name)
        if r_doc.status_code == 200:
            doc_data = r_doc.json().get("data", {})
            if ref_doctype == "Sales Invoice":
                outstanding = float(doc_data.get("outstanding_amount", 0.0))
            else:
                grand_total = float(doc_data.get("grand_total", 0.0))
                advance_paid = float(doc_data.get("advance_paid", 0.0))
                outstanding = grand_total - advance_paid
                
            if outstanding <= 0:
                raise HTTPException(status_code=400, detail=f"{ref_doctype} {so_name} is already fully paid (outstanding amount is 0).")
            allocated = min(data.amount, outstanding)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching outstanding amount: {e}")
        
    pe_payload = {
        "payment_type": "Receive",
        "party_type": "Customer",
        "party": data.customer,
        "company": data.company,
        "paid_from": data.paid_from,
        "paid_to": data.paid_to,
        "received_amount": allocated,
        "paid_amount": allocated,
        "reference_no": f"ADV-{so_name}",
        "reference_date": data.reference_date,
        "references": [
            {
                "reference_doctype": ref_doctype,
                "reference_name": so_name,
                "allocated_amount": allocated
            }
        ]
    }
    pe = erp_post("Payment Entry", pe_payload)
    submit_doc("Payment Entry", pe["name"])
    return pe

@app.post("/supplier-payment")
def api_create_supplier_payment(data: SupplierPaymentSchema):
    po_name = data.purchase_order_name
    ref_doctype = "Purchase Order"
    
    if po_name == "string" or not po_name:
        resolved_pi = resolve_latest_doc("Purchase Invoice", [["supplier", "=", data.supplier], ["docstatus", "<", 2]])
        if resolved_pi:
            po_name = resolved_pi
            ref_doctype = "Purchase Invoice"
            print(f"Resolved 'string' to latest Purchase Invoice: {po_name}")
        else:
            resolved_po = resolve_latest_doc("Purchase Order", [["supplier", "=", data.supplier], ["docstatus", "<", 2]])
            if resolved_po:
                po_name = resolved_po
                ref_doctype = "Purchase Order"
                print(f"Resolved 'string' to latest Purchase Order: {po_name}")
            else:
                raise HTTPException(status_code=400, detail="Could not find any Purchase Order or Purchase Invoice to resolve 'string' placeholder.")
    else:
        if exists("Purchase Invoice", po_name):
            ref_doctype = "Purchase Invoice"
        elif exists("Purchase Order", po_name):
            ref_doctype = "Purchase Order"

    allocated = data.amount
    try:
        r_doc = erp_get(ref_doctype, po_name)
        if r_doc.status_code == 200:
            doc_data = r_doc.json().get("data", {})
            if ref_doctype == "Purchase Invoice":
                outstanding = float(doc_data.get("outstanding_amount", 0.0))
            else:
                grand_total = float(doc_data.get("grand_total", 0.0))
                advance_paid = float(doc_data.get("advance_paid", 0.0))
                outstanding = grand_total - advance_paid
                
            if outstanding <= 0:
                raise HTTPException(status_code=400, detail=f"{ref_doctype} {po_name} is already fully paid (outstanding amount is 0).")
            allocated = min(data.amount, outstanding)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching outstanding amount: {e}")

    pe_payload = {
        "payment_type": "Pay",
        "party_type": "Supplier",
        "party": data.supplier,
        "company": data.company,
        "paid_from": data.paid_from,
        "paid_to": data.paid_to,
        "received_amount": allocated,
        "paid_amount": allocated,
        "reference_no": f"SUP-PAY-{po_name}",
        "reference_date": data.reference_date,
        "references": [
            {
                "reference_doctype": ref_doctype,
                "reference_name": po_name,
                "allocated_amount": allocated
            }
        ]
    }
    pe = erp_post("Payment Entry", pe_payload)
    submit_doc("Payment Entry", pe["name"])
    return pe

@app.post("/purchase-order")
def api_create_purchase_order(data: PurchaseOrderSchema):
    ensure_warehouse_from_full(data.warehouse, data.company)
    
    items = []
    if data.batch_1_qty > 0:
        items.append({
            "item_code": data.item_code,
            "qty": data.batch_1_qty,
            "rate": data.rate,
            "uom": data.uom,
            "warehouse": data.warehouse,
            "schedule_date": data.batch_1_date
        })
    if data.batch_2_qty > 0:
        items.append({
            "item_code": data.item_code,
            "qty": data.batch_2_qty,
            "rate": data.rate,
            "uom": data.uom,
            "warehouse": data.warehouse,
            "schedule_date": data.batch_2_date
        })
    if data.batch_3_qty > 0:
        items.append({
            "item_code": data.item_code,
            "qty": data.batch_3_qty,
            "rate": data.rate,
            "uom": data.uom,
            "warehouse": data.warehouse,
            "schedule_date": data.batch_3_date
        })
        
    if not items:
        raise HTTPException(status_code=400, detail="At least one batch must have a quantity greater than 0.")

    po_payload = {
        "company": data.company,
        "supplier": data.supplier,
        "transaction_date": data.transaction_date,
        "items": items
    }
    if data.billing_address:
        po_payload["billing_address"] = data.billing_address
    if data.shipping_address:
        po_payload["shipping_address"] = data.shipping_address
    if data.supplier_address:
        po_payload["supplier_address"] = data.supplier_address
    if data.taxes_and_charges:
        po_payload["taxes_and_charges"] = data.taxes_and_charges
    if data.taxes:
        po_payload["taxes"] = data.taxes
        
    po = erp_post("Purchase Order", po_payload)
    return po

@app.post("/purchase-order/approve")
def api_approve_purchase_order(data: ApprovePOSchema):
    po_name = data.purchase_order_name
    if po_name == "string" or not po_name:
        resolved = resolve_latest_doc("Purchase Order", [["docstatus", "<", 2]])
        if resolved:
            po_name = resolved
            print(f"Resolved 'string' to latest Purchase Order: {po_name}")
        else:
            raise HTTPException(status_code=400, detail="Could not find any Purchase Order to resolve 'string' placeholder.")

    erp_put("Purchase Order", po_name, {"workflow_state": "Pending Manager Approval"})
    erp_put("Purchase Order", po_name, {"workflow_state": "Pending Senior Manager Approval"})
    erp_put("Purchase Order", po_name, {"workflow_state": "Approved"})
    doc = submit_doc("Purchase Order", po_name)
    return doc

@app.post("/purchase-receipt")
def api_create_purchase_receipt(data: PurchaseReceiptSchema):
    po_name = data.purchase_order_name
    
    # If no PO is specified AND we have standalone inputs, do standalone receipt
    if (po_name == "string" or not po_name) and data.item_code:
        warehouse = data.warehouse
        apply_putaway_rule = data.apply_putaway_rule
        is_auto_resolve = (not warehouse or warehouse == "" or warehouse == "string") and (apply_putaway_rule == 1 or apply_putaway_rule == '1' or apply_putaway_rule == True)
        
        if not data.qty or ((not warehouse or warehouse == "string") and not is_auto_resolve):
            raise HTTPException(status_code=400, detail="Standalone Purchase Receipt requires: item_code, qty, and warehouse (or Apply Putaway Rule checked).")
            
        company_name = data.company
        if not company_name or company_name == "string":
            company_name = "vishwha"

        supplier_name = data.supplier
        if not supplier_name or supplier_name == "string":
            supplier_name = "vishwha test supplier"
        if (not warehouse or warehouse == "") and (apply_putaway_rule == 1 or apply_putaway_rule == '1' or apply_putaway_rule == True):
            bin_url = f"{ERP_URL}/api/resource/Bin"
            bin_params = {
                "fields": '["warehouse","actual_qty"]',
                "filters": json.dumps([
                    ["item_code", "=", data.item_code],
                    ["actual_qty", ">", 0]
                ])
            }
            response = requests.get(bin_url, params=bin_params, headers=HEADERS)
            bin_data = response.json().get("data", [])
            
            if bin_data:
                matched_warehouse = bin_data[0].get("warehouse")
                putaway_url = f"{ERP_URL}/api/resource/Putaway Rule"
                putaway_params = {
                    "fields": '["capacity"]',
                    "filters": json.dumps([
                        ["item_code", "=", data.item_code],
                        ["warehouse", "=", matched_warehouse]
                    ])
                }
                response2 = requests.get(putaway_url, params=putaway_params, headers=HEADERS)
                putaway_data = response2.json().get("data", [])
                
                if putaway_data:
                    capacity = putaway_data[0].get("capacity") or 0.0
                    actual_qty = bin_data[0].get("actual_qty") or 0.0
                    remaining = capacity - actual_qty
                    
                    if remaining >= data.qty:
                        warehouse = matched_warehouse
                    else:
                        raise HTTPException(status_code=400,detail=f"Not enough space available in {matched_warehouse} for {data.item_code}."
                        f"Incoming quantity is {data.qty} Kg, but remaining space is only {remaining} Kg.")


        pr_payload = {
            "doctype": "Purchase Receipt",
            "supplier": supplier_name,
            "company": company_name,
            "items": [
                {
                    "item_code": data.item_code,
                    "qty": data.qty,
                    "warehouse": warehouse,
                    "uom": "Kg"
                }
            ]
        }
    else:
        # Standard PO-based receipt (with auto-resolution fallback)
        if po_name == "string" or not po_name:
            resolved = resolve_latest_doc("Purchase Order", [["docstatus", "<", 2]])
            if resolved:
                po_name = resolved
                print(f"Resolved 'string' to latest Purchase Order: {po_name}")
            else:
                raise HTTPException(status_code=400, detail="Could not find any Purchase Order to resolve 'string' placeholder.")

        pr_payload = make_doc_from_source(
            "erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_receipt",
            po_name
        )
        if not pr_payload.get("items"):
            raise HTTPException(status_code=400, detail="No pending items found in Purchase Order for receipt.")
        
        if data.item_row_index is not None and data.item_row_index >= 0:
            if len(pr_payload["items"]) > data.item_row_index:
                pr_payload["items"] = [pr_payload["items"][data.item_row_index]]
            else:
                pr_payload["items"] = [pr_payload["items"][0]]
        
    if data.apply_putaway_rule is not None:
        pr_payload["apply_putaway_rule"] = data.apply_putaway_rule
        for item in pr_payload.get("items", []):
            item["apply_putaway_rule"] = data.apply_putaway_rule

    pr = erp_post("Purchase Receipt", pr_payload)
    submit_doc("Purchase Receipt", pr["name"])
    return pr

@app.post("/work-order")
def api_create_work_order(data: WorkOrderSchema):
    try:
        requests.put(
            f"{ERP_URL}/api/resource/UOM/Nos",
            headers=HEADERS,
            json={'must_be_whole_number': 0}
        )
    except Exception:
        pass

    ensure_warehouse_from_full(data.source_warehouse, data.company)
    ensure_warehouse_from_full(data.wip_warehouse, data.company)
    ensure_warehouse_from_full(data.fg_warehouse, data.company)

    bom_no = data.bom_no
    if bom_no == "string" or not bom_no:
        resolved = resolve_latest_doc("BOM", [["item", "=", data.production_item], ["is_active", "=", 1], ["docstatus", "=", 1]])
        if resolved:
            bom_no = resolved
            print(f"Resolved 'string' to active BOM: {bom_no}")
        else:
            raise HTTPException(status_code=400, detail=f"Could not find any active, submitted BOM for item {data.production_item} to resolve 'string' placeholder.")

    wo_payload = {
        "company": data.company,
        "production_item": data.production_item,
        "bom_no": bom_no,
        "qty": data.qty,
        "wip_warehouse": data.wip_warehouse,
        "fg_warehouse": data.fg_warehouse,
        "source_warehouse": data.source_warehouse,
        "use_multi_level_bom": data.use_multi_level_bom
    }
    wo = erp_post("Work Order", wo_payload)
    submit_doc("Work Order", wo["name"])
    return wo

@app.post("/work-order/start")
def api_start_work_order(data: StartWorkOrderSchema):
    wo_name = data.work_order_name
    if wo_name == "string" or not wo_name:
        resolved = resolve_latest_doc("Work Order", [["docstatus", "<", 2]])
        if resolved:
            wo_name = resolved
            print(f"Resolved 'string' to latest Work Order: {wo_name}")
        else:
            raise HTTPException(status_code=400, detail="Could not find any Work Order to resolve 'string' placeholder.")

    r_se = requests.post(
        f"{ERP_URL}/api/method/erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry",
        headers=HEADERS,
        json={
            "work_order_id": wo_name,
            "purpose": "Material Transfer for Manufacture",
            "qty": data.qty
        }
    )
    if r_se.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to generate Transfer Stock Entry: {r_se.text}"
        )
    se_payload = r_se.json()["message"]
    se = erp_post("Stock Entry", se_payload)
    submit_doc("Stock Entry", se["name"])
    return se

@app.post("/work-order/finish")
def api_finish_work_order(data: FinishWorkOrderSchema):
    wo_name = data.work_order_name
    if wo_name == "string" or not wo_name:
        resolved = resolve_latest_doc("Work Order", [["docstatus", "<", 2]])
        if resolved:
            wo_name = resolved
            print(f"Resolved 'string' to latest Work Order: {wo_name}")
        else:
            raise HTTPException(status_code=400, detail="Could not find any Work Order to resolve 'string' placeholder.")

    r_se = requests.post(
        f"{ERP_URL}/api/method/erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry",
        headers=HEADERS,
        json={
            "work_order_id": wo_name,
            "purpose": "Manufacture",
            "qty": data.qty
        }
    )
    if r_se.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to generate Manufacture Stock Entry: {r_se.text}"
        )
    se_payload = r_se.json()["message"]
    se = erp_post("Stock Entry", se_payload)
    submit_doc("Stock Entry", se["name"])
    return se

@app.post("/purchase-invoice")
def api_create_purchase_invoice(data: PurchaseInvoiceSchema):
    po_name = data.purchase_order_name
    if po_name == "string" or not po_name:
        resolved = resolve_latest_doc("Purchase Order", [["docstatus", "<", 2]])
        if resolved:
            po_name = resolved
            print(f"Resolved 'string' to latest Purchase Order: {po_name}")
        else:
            raise HTTPException(status_code=400, detail="Could not find any Purchase Order to resolve 'string' placeholder.")

    pi_payload = make_doc_from_source(
        "erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice",
        po_name
    )
    pi_payload["bill_no"] = data.bill_no
    pi_payload["bill_date"] = data.bill_date
    pi_payload["allocate_advances_automatically"] = 1
    pi = erp_post("Purchase Invoice", pi_payload)
    submit_doc("Purchase Invoice", pi["name"])
    return pi

@app.post("/sales-invoice")
def api_create_sales_invoice(data: SalesInvoiceSchema):
    so_name = data.sales_order_name
    if so_name == "string" or not so_name:
        resolved = resolve_latest_doc("Sales Order", [["docstatus", "<", 2]])
        if resolved:
            so_name = resolved
            print(f"Resolved 'string' to latest Sales Order: {so_name}")
        else:
            raise HTTPException(status_code=400, detail="Could not find any Sales Order to resolve 'string' placeholder.")

    si_payload = make_doc_from_source(
        "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
        so_name
    )
    si_payload["update_stock"] = 1
    si_payload["allocate_advances_automatically"] = 1

    for item in si_payload.get("items", []):
        item_code = item["item_code"]
        warehouse = data.warehouse or item.get("warehouse")
        item["warehouse"] = warehouse
        
        # Query current available stock for this item in this warehouse to handle precision limits
        available_qty = None
        try:
            r_bin = requests.get(
                f"{ERP_URL}/api/resource/Bin",
                headers=HEADERS,
                params={
                    "filters": f'[["item_code", "=", "{item_code}"], ["warehouse", "=", "{warehouse}"]]',
                    "fields": '["actual_qty"]'
                }
            )
            if r_bin.status_code == 200:
                bin_data = r_bin.json().get("data", [])
                if bin_data:
                    available_qty = float(bin_data[0].get("actual_qty", 0.0))
                    print(f"Available stock of {item_code} found in warehouse: {available_qty}")
        except Exception as e:
            print(f"Failed to query stock bin level for {item_code}: {e}")

        if available_qty is not None:
            # If stock is slightly below requested amount due to division (e.g. 99.999 instead of 100)
            if available_qty < item["qty"] and (item["qty"] - available_qty) < 0.05:
                print(f"Adjusting invoice item qty from {item['qty']} to match actual stock: {available_qty}")
                item["qty"] = available_qty

    si = erp_post("Sales Invoice", si_payload)
    submit_doc("Sales Invoice", si["name"])
    return si

@app.get("/history/payments")
def api_get_payments_history(company: Optional[str] = None):
    params = {
        "fields": '["name", "posting_date", "party_type", "party", "paid_amount", "docstatus"]',
        "order_by": "creation desc",
        "limit_page_length": 15
    }
    if company:
        params["filters"] = json.dumps([["company", "=", company]])
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Payment Entry", headers=HEADERS, params=params)
        if r.status_code == 200:
            return r.json().get("data", [])
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/stock-entries")
def api_get_stock_entries_history(company: Optional[str] = None):
    params = {
        "fields": '["name", "posting_date", "purpose", "docstatus"]',
        "order_by": "creation desc",
        "limit_page_length": 15
    }
    if company:
        params["filters"] = json.dumps([["company", "=", company]])
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Stock Entry", headers=HEADERS, params=params)
        if r.status_code == 200:
            return r.json().get("data", [])
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/purchase-orders")
def api_get_purchase_orders_history(company: Optional[str] = None):
    params = {
        "fields": '["name", "transaction_date", "supplier", "grand_total", "docstatus", "workflow_state"]',
        "order_by": "creation desc",
        "limit_page_length": 15
    }
    if company:
        params["filters"] = json.dumps([["company", "=", company]])
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Purchase Order", headers=HEADERS, params=params)
        if r.status_code == 200:
            return r.json().get("data", [])
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/companies")
def api_get_companies():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Company", headers=HEADERS, params={"fields": '["name"]', "limit_page_length": 50})
        if r.status_code == 200:
            return [c["name"] for c in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/warehouses")
def api_get_warehouses(company: Optional[str] = None):
    filters = [["disabled", "=", 0]]
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

@app.get("/customers")
def api_get_customers():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Customer", headers=HEADERS, params={"fields": '["name"]', "limit_page_length": 100})
        if r.status_code == 200:
            return [c["name"] for c in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/suppliers")
def api_get_suppliers():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Supplier", headers=HEADERS, params={"fields": '["name"]', "limit_page_length": 100})
        if r.status_code == 200:
            return [s["name"] for s in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/invoice-balance")
def api_get_invoice_balance(docname: str):
    if not docname or docname == "string":
        return {"grand_total": 0.0, "advance_paid": 0.0, "outstanding_amount": 0.0, "doctype": "Unknown"}
        
    doctype = "Sales Order"
    if docname.startswith("SINV"):
        doctype = "Sales Invoice"
    elif docname.startswith("SAL-ORD"):
        doctype = "Sales Order"
    else:
        if exists("Sales Invoice", docname):
            doctype = "Sales Invoice"
        elif exists("Sales Order", docname):
            doctype = "Sales Order"
            
    try:
        r = erp_get(doctype, docname)
        if r.status_code == 200:
            doc = r.json().get("data", {})
            grand_total = float(doc.get("grand_total", 0.0))
            if doctype == "Sales Invoice":
                outstanding = float(doc.get("outstanding_amount", 0.0))
                advance_paid = grand_total - outstanding
            else:
                advance_paid = float(doc.get("advance_paid", 0.0))
                outstanding = grand_total - advance_paid
            return {
                "grand_total": grand_total,
                "advance_paid": advance_paid,
                "outstanding_amount": outstanding,
                "doctype": doctype
            }
        else:
            return {"grand_total": 0.0, "advance_paid": 0.0, "outstanding_amount": 0.0, "doctype": doctype, "error": f"Failed to fetch {docname}: {r.text}"}
    except Exception as e:
        return {"grand_total": 0.0, "advance_paid": 0.0, "outstanding_amount": 0.0, "doctype": doctype, "error": str(e)}

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

@app.post("/doctype")
def api_create_doctype(data: DocTypeCreateSchema):
    fields_payload = []
    for f in data.fields:
        fields_payload.append({
            "fieldname": f.fieldname,
            "label": f.label,
            "fieldtype": f.fieldtype,
            "options": f.options,
            "reqd": f.reqd,
            "in_list_view": f.in_list_view
        })
        
    permissions_payload = [
        {
            "role": "System Manager",
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "select": 1,
            "share": 1,
            "export": 1,
            "import": 0,
            "print": 1,
            "email": 1,
            "report": 1
        }
    ]
    
    payload = {
        "name": data.doctype_name,
        "custom": 1,
        "module": "Custom",
        "autoname": data.autoname,
        "fields": fields_payload,
        "permissions": permissions_payload
    }
    
    try:
        return erp_post("DocType", payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/items")
def api_get_items():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Item", headers=HEADERS, params={"fields": '["name", "item_name", "item_group"]', "limit_page_length": 150})
        if r.status_code == 200:
            return r.json().get("data", [])
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/batches")
def api_get_batches():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Batch", headers=HEADERS, params={"fields": '["name", "item", "expiry_date"]', "limit_page_length": 150})
        if r.status_code == 200:
            return [{"batch_number": b["name"], "item": b["item"], "expiry_date": b.get("expiry_date")} for b in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/warehouse-item-check")
def api_warehouse_item_check(item_code: str):
    try:
        # Check if item_code is actually a Batch number by querying Batch doctype
        batch_url = f"{ERP_URL}/api/resource/Batch"
        r_batch_check = requests.get(f"{batch_url}/{item_code}", headers=HEADERS)
        
        is_batch = r_batch_check.status_code == 200
        batch_doc = r_batch_check.json().get("data", {}) if is_batch else {}
        
        resolved_item_code = item_code
        selected_batch_no = None
        expiry_str = "No Expiry Date"
        
        if is_batch:
            selected_batch_no = item_code
            resolved_item_code = batch_doc.get("item")
            expiry_str = batch_doc.get("expiry_date") or "No Expiry Date"
            
            # Query parent Serial and Batch Bundles containing this batch number
            bundle_url = f"{ERP_URL}/api/resource/Serial and Batch Bundle"
            bundle_params = {
                "fields": '["name", "item_code", "item_name"]',
                "filters": json.dumps([
                    ["Serial and Batch Entry", "batch_no", "=", selected_batch_no],
                    ["docstatus", "=", 1]
                ]),
                "limit_page_length": 150
            }
            r_bundles = requests.get(bundle_url, headers=HEADERS, params=bundle_params)
            bundles = r_bundles.json().get("data", []) if r_bundles.status_code == 200 else []
            
            # Aggregate quantities by (item_code, item_name, warehouse)
            item_wh_qty = {}
            for bundle in bundles:
                bundle_name = bundle["name"]
                r_detail = requests.get(f"{bundle_url}/{bundle_name}", headers=HEADERS)
                if r_detail.status_code == 200:
                    detail = r_detail.json().get("data", {})
                    for entry in detail.get("entries", []):
                        if entry.get("batch_no") == selected_batch_no:
                            i_code = detail.get("item_code")
                            i_name = detail.get("item_name")
                            wh = entry.get("warehouse")
                            qty = float(entry.get("qty") or 0.0)
                            
                            is_outward = entry.get("is_outward") or detail.get("type_of_transaction") == "Outward"
                            change = -qty if is_outward else qty
                            
                            key = (i_code, i_name, wh)
                            item_wh_qty[key] = item_wh_qty.get(key, 0.0) + change
        else:
            # Standard item stock check
            bin_url = f"{ERP_URL}/api/resource/Bin"
            params = {
                "fields": '["warehouse", "actual_qty"]',
                "filters": json.dumps([["item_code", "=", resolved_item_code], ["actual_qty", ">", 0]]),
                "limit_page_length": 100
            }
            r_bin = requests.get(bin_url, headers=HEADERS, params=params)
            bins = r_bin.json().get("data", []) if r_bin.status_code == 200 else []
            
            # Fetch batches for this item to resolve expiry dates
            batch_params = {
                "fields": '["name", "expiry_date"]',
                "filters": json.dumps([["item", "=", resolved_item_code]]),
                "limit_page_length": 100
            }
            r_batch = requests.get(batch_url, headers=HEADERS, params=batch_params)
            batches = r_batch.json().get("data", []) if r_batch.status_code == 200 else []
            expiry_dates = [b.get("expiry_date") for b in batches if b.get("expiry_date")]
            expiry_str = ", ".join(set(expiry_dates)) if expiry_dates else "No Expiry Date"

        # Resolve warehouse hierarchy paths
        wh_url = f"{ERP_URL}/api/resource/Warehouse"
        wh_params = {
            "fields": '["name", "warehouse_name", "parent_warehouse", "is_group"]',
            "limit_page_length": 250
        }
        r_wh = requests.get(wh_url, headers=HEADERS, params=wh_params)
        wh_data = r_wh.json().get("data", []) if r_wh.status_code == 200 else []
        wh_dict = {w["name"]: w for w in wh_data}
        
        items_result = []
        
        if is_batch:
            # Group by item_code
            grouped_by_item = {}
            for (i_code, i_name, wh_name), qty in item_wh_qty.items():
                if qty <= 0:
                    continue
                # Resolve path
                path = []
                curr = wh_name
                while curr in wh_dict:
                    w_doc = wh_dict[curr]
                    path.append(w_doc["warehouse_name"])
                    curr = w_doc["parent_warehouse"]
                path.reverse()
                
                main_wh = "Unknown"
                rack = "None"
                shelf = "None"
                bin_name = "None"
                
                clean_path = [x for x in path if "all" not in x.lower()]
                if len(clean_path) > 0:
                    main_wh = clean_path[0]
                if len(clean_path) > 1:
                    rack = clean_path[1]
                if len(clean_path) > 2:
                    shelf = clean_path[2]
                if len(clean_path) > 3:
                    bin_name = clean_path[3]
                
                loc = {
                    "warehouse": wh_name,
                    "qty": qty,
                    "main_warehouse": main_wh,
                    "rack": rack,
                    "shelf": shelf,
                    "bin": bin_name,
                    "expiry_date": expiry_str
                }
                
                if i_code not in grouped_by_item:
                    grouped_by_item[i_code] = {
                        "item_code": i_code,
                        "item_name": i_name,
                        "stock_locations": []
                    }
                grouped_by_item[i_code]["stock_locations"].append(loc)
            
            items_result = list(grouped_by_item.values())
        else:
            # Standard single item
            r_item = requests.get(f"{ERP_URL}/api/resource/Item/{resolved_item_code}", headers=HEADERS)
            i_name = r_item.json().get("data", {}).get("item_name") if r_item.status_code == 200 else resolved_item_code
            
            locs = []
            for b in bins:
                wh_name = b["warehouse"]
                qty = b["actual_qty"]
                
                path = []
                curr = wh_name
                while curr in wh_dict:
                    w_doc = wh_dict[curr]
                    path.append(w_doc["warehouse_name"])
                    curr = w_doc["parent_warehouse"]
                path.reverse()
                
                main_wh = "Unknown"
                rack = "None"
                shelf = "None"
                bin_name = "None"
                
                clean_path = [x for x in path if "all" not in x.lower()]
                if len(clean_path) > 0:
                    main_wh = clean_path[0]
                if len(clean_path) > 1:
                    rack = clean_path[1]
                if len(clean_path) > 2:
                    shelf = clean_path[2]
                if len(clean_path) > 3:
                    bin_name = clean_path[3]
                    
                locs.append({
                    "warehouse": wh_name,
                    "qty": qty,
                    "main_warehouse": main_wh,
                    "rack": rack,
                    "shelf": shelf,
                    "bin": bin_name,
                    "expiry_date": expiry_str
                })
            
            if len(locs) > 0 or resolved_item_code:
                items_result.append({
                    "item_code": resolved_item_code,
                    "item_name": i_name,
                    "stock_locations": locs
                })
                
        return {
            "item_code": resolved_item_code,
            "batch_no": selected_batch_no,
            "expiry_date": expiry_str,
            "items": items_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/empty-bins")
def api_empty_bins():
    try:
        # 1. Fetch all warehouses
        wh_url = f"{ERP_URL}/api/resource/Warehouse"
        wh_params = {
            "fields": '["name", "warehouse_name", "parent_warehouse", "is_group"]',
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
@app.get("/warehouse-items")
def api_get_warehouse_items(warehouse: str):
    try:
        warehouse = resolve_warehouse_from_rfid(warehouse)
        items_list = []
        
        # 1. OPTION A: If your RFIDs are tracked individually via Serial Numbers
        sn_url = f"{ERP_URL}/api/resource/Serial No"
        sn_params = {
            # Note: "custom_rfid_tag" should be changed to whatever your actual field name is in ERPNext
            "fields": '["name", "item_code", "item_name", "custom_rfid_tag"]',
            "filters": json.dumps([["warehouse", "=", warehouse], ["status", "=", "Active"]]),
            "limit_page_length": 500
        }
        r_sn = requests.get(sn_url, headers=HEADERS, params=sn_params)
        
        if r_sn.status_code == 200:
            serial_nos = r_sn.json().get("data", [])
            for sn in serial_nos:
                rfid_val = sn.get("custom_rfid_tag") 
                # Fallback to the Serial No name if no RFID is set (for testing purposes)
                if not rfid_val:
                    rfid_val = sn.get("name")
                    
                items_list.append({
                    "item_code": sn.get("item_code"),
                    "item_name": sn.get("item_name") or sn.get("item_code"),
                    "rfid_tag": rfid_val,
                    "qty": 1,
                    "rate": "N/A"
                })
                
        # 2. OPTION B: If you are NOT using Serial Numbers and RFID is just a field on the Item Master
        if not items_list:
            bin_url = f"{ERP_URL}/api/resource/Bin"
            bin_params = {
                "fields": '["item_code", "actual_qty"]',
                "filters": json.dumps([["warehouse", "=", warehouse], ["actual_qty", ">", 0]]),
                "limit_page_length": 500
            }
            r_bin = requests.get(bin_url, headers=HEADERS, params=bin_params)
            bins = r_bin.json().get("data", []) if r_bin.status_code == 200 else []
            
            for b in bins:
                item_code = b.get("item_code")
                r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
                if r_item.status_code == 200:
                    item_data = r_item.json().get("data", {})
                    # Check common field names for RFID
                    rfid_val = item_data.get("rfid") or item_data.get("custom_rfid") or item_data.get("custom_rfid_tag") or "NO_TAG"
                    items_list.append({
                        "item_code": item_code,
                        "item_group": item_data.get("item_group", ""),
                        "item_name": item_data.get("item_name", item_code),
                        "rfid_tag": rfid_val,
                        "qty": b.get("actual_qty", 0),
                        "rate": item_data.get("valuation_rate", 0)
                    })
        
        return items_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
                "uom": "Nos"
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

@app.post("/wms/receive")
def api_wms_receive(data: WmsReceiveSchema):
    try:
        item_code = resolve_item_from_rfid(data.item_rfid)
        source_wh = get_item_source_warehouse(item_code)
        se = perform_stock_transfer(item_code, 1.0, source_wh, data.pallet_id)
        
        # Log activity in ERPNext
        try:
            log_wms_activity(
                activity_type="Location Move",
                operator="System",
                target_location=data.pallet_id,
                old_tag=data.item_rfid,
                details=f"Received item {item_code} and assigned to Pallet {data.pallet_id}"
            )
        except Exception:
            pass
            
        return {"message": "Success", "stock_entry": se["name"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/empty-bins")
def api_get_empty_bins():
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        # 1. Fetch all active warehouses (disabled = 0)
        r = requests.get(
            f"{ERP_URL}/api/resource/Warehouse",
            headers=HEADERS,
            params={
                "fields": '["name", "parent_warehouse"]',
                "filters": json.dumps([["disabled", "=", 0]]),
                "limit_page_length": 500
            }
        )
        if r.status_code != 200:
            return []
            
        data = r.json().get("data", [])
        
        # 2. Extract all Bins (case insensitive check)
        bins = [w["name"] for w in data if "bin" in w["name"].lower()]
        bins.sort()
        
        # 3. Extract occupied parent warehouses (Bins that have child Pallets/Warehouses mapped)
        occupied_bins = set()
        for w in data:
            parent = w.get("parent_warehouse")
            if parent:
                occupied_bins.add(parent)
                
        # 4. Filter to get only empty Bins
        empty_bins = [b for b in bins if b not in occupied_bins]
        return empty_bins
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/resolve-warehouse")
def api_resolve_warehouse(rfid: str):
    try:
        resolved = resolve_warehouse_from_rfid(rfid)
        return {"warehouse": resolved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/first-empty-bin")
def api_get_first_empty_bin():
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        empty_bins = api_get_empty_bins()
        if empty_bins:
            return {"empty_bin": empty_bins[0]}
        return {"empty_bin": f"BIN 001 - {company_abbr}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/put-away")
def api_wms_put_away(data: WmsPutAwaySchema):
    try:
        source_wh = resolve_warehouse_from_rfid(data.pallet_rfid)
        target_wh = resolve_warehouse_from_rfid(data.bin_id)
        
        # Update the parent warehouse of the Bin in ERPNext
        payload = {
            "parent_warehouse": target_wh
        }
        erp_put("Warehouse", source_wh, payload)
        
        # Log activity in ERPNext
        try:
            log_wms_activity(
                activity_type="Location Move",
                operator="System",
                target_location=target_wh,
                old_tag=data.pallet_rfid,
                details=f"Put Away: Placed Pallet {source_wh} inside Bin {target_wh}"
            )
        except Exception:
            pass
            
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/retrieve")
def api_wms_retrieve(data: WmsRetrieveSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        source_wh = resolve_warehouse_from_rfid(data.pallet_rfid)
            
        items_in_bin = []
        try:
            r = requests.get(
                f"{ERP_URL}/api/resource/Bin",
                headers=HEADERS,
                params={"filters": json.dumps([["warehouse", "=", source_wh], ["actual_qty", ">", 0]]), "fields": '["item_code", "actual_qty"]'}
            )
            if r.status_code == 200:
                items_in_bin = r.json().get("data", [])
        except Exception:
            pass

        dest_wh = f"Stores - {company_abbr}"
        if not items_in_bin:
            item_code = resolve_latest_doc("Item", [["is_stock_item", "=", 1]]) or "Maida Flour"
            perform_stock_transfer(item_code, 1.0, source_wh, dest_wh)
            return {"message": "Success (Mocked Fallback)"}

        for item in items_in_bin:
            perform_stock_transfer(item["item_code"], float(item["actual_qty"]), source_wh, dest_wh)
            
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/bin-pallet-lookup")
def api_wms_bin_pallet_lookup(bin_id: str):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        bin_wh = resolve_warehouse_from_rfid(bin_id)
        
        # 1. Query warehouses with only permitted fields: name, parent_warehouse
        r = requests.get(
            f"{ERP_URL}/api/resource/Warehouse",
            headers=HEADERS,
            params={
                "filters": json.dumps([["parent_warehouse", "=", bin_wh], ["disabled", "=", 0]]),
                "fields": '["name", "parent_warehouse"]',
                "limit_page_length": 5
            }
        )
        if r.status_code == 200:
            data = r.json().get("data", [])
            if data:
                pallet_name = data[0]["name"]
                
                # 2. Fetch the detailed document of the pallet to get custom RFID fields safely
                r_wh = requests.get(f"{ERP_URL}/api/resource/Warehouse/{pallet_name}", headers=HEADERS)
                pallet_rfid = "N/A"
                if r_wh.status_code == 200:
                    wh_doc = r_wh.json().get("data", {})
                    for field in ["custom_bin_rfid", "bin_rfid", "custom_rfid", "custom_rfid_tag", "rfid"]:
                        if wh_doc.get(field):
                            pallet_rfid = wh_doc[field]
                            break
                        
                return {
                    "pallet_name": pallet_name.replace(f" - {company_abbr}", ""),
                    "pallet_full_name": pallet_name,
                    "pallet_rfid": pallet_rfid,
                    "bin_name": bin_wh.replace(f" - {company_abbr}", ""),
                    "bin_full_name": bin_wh
                }
                
        return {"error": "No pallet currently assigned to this bin location."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/move")
def api_wms_move(data: WmsMoveSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        pallet_name = resolve_warehouse_from_rfid(data.source_rfid)
        target_bin = resolve_warehouse_from_rfid(data.destination_id)
        
        old_parent = "None"
        try:
            r_wh = requests.get(f"{ERP_URL}/api/resource/Warehouse/{pallet_name}", headers=HEADERS)
            if r_wh.status_code == 200:
                old_parent = r_wh.json().get("data", {}).get("parent_warehouse") or "None"
                old_parent = old_parent.replace(f" - {company_abbr}", "")
        except Exception:
            pass
            
        erp_put("Warehouse", pallet_name, {"parent_warehouse": target_bin})
        
        try:
            log_wms_activity(
                activity_type="Location Move",
                operator="System",
                target_location=target_bin,
                old_tag=data.source_rfid,
                details=f"Moved Pallet {pallet_name.replace(f' - {company_abbr}', '')} from Bin {old_parent} to Bin {target_bin.replace(f' - {company_abbr}', '')}"
            )
        except Exception:
            pass
            
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/repack")
def api_wms_repack(data: WmsRepackSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        src_wh = data.item_rfid
        is_wh = False
        
        # Check if src_wh exists as a Warehouse
        if " - " not in src_wh:
            src_wh_full = f"{src_wh} - {company_abbr}"
        else:
            src_wh_full = src_wh
            
        resolved_wh = resolve_warehouse_from_rfid(src_wh)
        if resolved_wh and exists("Warehouse", resolved_wh):
            src_wh_full = resolved_wh
            is_wh = True
            
        if is_wh or exists("Warehouse", src_wh_full):
            # It's a warehouse. Look up the item stored in it
            src_wh = src_wh_full
            items_in_wh = []
            try:
                r = requests.get(
                    f"{ERP_URL}/api/resource/Bin",
                    headers=HEADERS,
                    params={"filters": json.dumps([["warehouse", "=", src_wh], ["actual_qty", ">", 0]]), "fields": '["item_code"]'}
                )
                if r.status_code == 200:
                    items_in_wh = r.json().get("data", [])
            except Exception:
                pass
            if items_in_wh:
                item_code = items_in_wh[0]["item_code"]
            else:
                item_code = resolve_latest_doc("Item", [["is_stock_item", "=", 1]]) or "Maida Flour"
        else:
            # It's an RFID tag. Resolve the item and find where it has stock
            item_code = resolve_item_from_rfid(data.item_rfid)
            src_wh = get_item_source_warehouse(item_code)
        
        # 1. Perform Material Issue of amount_used
        payload = {
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Issue",
            "purpose": "Material Issue",
            "company": company,
            "items": [
                {
                    "item_code": item_code,
                    "qty": data.amount_used,
                    "s_warehouse": src_wh,
                    "uom": "Nos"
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
        
        # 2. Update RFID tag mapping if new_rfid is provided
        if data.new_rfid and data.new_rfid.strip():
            new_tag = data.new_rfid.strip()
            if is_wh:
                # Update warehouse custom RFID fields
                payload_wh = {
                    "custom_bin_rfid": new_tag,
                    "bin_rfid": new_tag,
                    "custom_rfid": new_tag
                }
                erp_put("Warehouse", src_wh, payload_wh)
            else:
                # Check for Serial No matching old tag and update it
                try:
                    r_sn = requests.get(
                        f"{ERP_URL}/api/resource/Serial No",
                        headers=HEADERS,
                        params={"filters": json.dumps([["custom_rfid_tag", "=", data.item_rfid]]), "fields": '["name"]'}
                    )
                    if r_sn.status_code == 200 and r_sn.json().get("data"):
                        sn_name = r_sn.json()["data"][0]["name"]
                        erp_put("Serial No", sn_name, {"custom_rfid_tag": new_tag})
                except Exception:
                    pass
                    
        # Log activity in ERPNext
        try:
            log_wms_activity(
                activity_type="RFID Change" if data.new_rfid else "Location Move",
                operator="System",
                target_location=src_wh,
                old_tag=data.item_rfid,
                new_tag=data.new_rfid or data.item_rfid,
                details=f"Repacked {item_code}. Consumed {data.amount_used} Nos. Remaining {data.remaining_weight} Nos."
            )
        except Exception:
            pass
                    
        return {"message": "Success", "stock_entry": se["name"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/merge")
def api_wms_merge(data: WmsMergeSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        src_wh = resolve_warehouse_from_rfid(data.pallet_a)
        dest_wh = resolve_warehouse_from_rfid(data.pallet_b)
        
        se = perform_stock_transfer(data.item_code, data.qty, src_wh, dest_wh)
        
        # Log activity in ERPNext
        try:
            log_wms_activity(
                activity_type="Location Move",
                operator="System",
                target_location=dest_wh,
                old_tag=data.pallet_a,
                new_tag=data.pallet_b,
                details=f"Merged: Transferred {data.qty} of {data.item_code} from Pallet {src_wh} to Pallet {dest_wh}"
            )
        except Exception:
            pass
            
        return {"message": "Success", "stock_entry": se["name"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/find")
def api_wms_find(pallet_id: str):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        wh = pallet_id
        if " - " not in wh:
            wh = f"{wh} - {company_abbr}"
            
        row = "N/A"
        rack = "N/A"
        bin_val = "N/A"
        
        # 1. Resolve Location hierarchy details
        try:
            r = requests.get(f"{ERP_URL}/api/resource/Warehouse/{wh}", headers=HEADERS)
            if r.status_code == 200:
                w_data = r.json().get("data", {})
                parent_1 = w_data.get("parent_warehouse")
                if parent_1:
                    bin_val = parent_1.replace(f" - {company_abbr}", "")
                    r2 = requests.get(f"{ERP_URL}/api/resource/Warehouse/{parent_1}", headers=HEADERS)
                    if r2.status_code == 200:
                        parent_2 = r2.json().get("data", {}).get("parent_warehouse")
                        if parent_2:
                            rack = parent_2.replace(f" - {company_abbr}", "")
                            r3 = requests.get(f"{ERP_URL}/api/resource/Warehouse/{parent_2}", headers=HEADERS)
                            if r3.status_code == 200:
                                parent_3 = r3.json().get("data", {}).get("parent_warehouse")
                                if parent_3:
                                    row = parent_3.replace(f" - {company_abbr}", "")
        except Exception:
            pass

        # 2. Resolve Item details stored in this warehouse bin
        item_name = "Empty Location"
        weight_str = "0"
        status = "Empty"
        
        try:
            r_bin = requests.get(
                f"{ERP_URL}/api/resource/Bin",
                headers=HEADERS,
                params={"filters": json.dumps([["warehouse", "=", wh], ["actual_qty", ">", 0]]), "fields": '["item_code", "actual_qty"]'}
            )
            if r_bin.status_code == 200:
                bins = r_bin.json().get("data", [])
                if bins:
                    item_code = bins[0]["item_code"]
                    qty = float(bins[0]["actual_qty"])
                    
                    r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
                    uom = "Nos"
                    name_val = item_code
                    if r_item.status_code == 200:
                        item_data = r_item.json().get("data", {})
                        name_val = item_data.get("item_name") or item_code
                        uom = item_data.get("stock_uom") or "Nos"
                        
                    item_name = name_val
                    weight_str = f"{qty} {uom}"
                    status = "Stored"
        except Exception:
            pass

        return {
            "pallet_id": pallet_id,
            "row": row,
            "rack": rack,
            "bin": bin_val,
            "item_name": item_name,
            "weight": weight_str,
            "status": status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/exception")
def api_wms_exception(data: WmsExceptionSchema):
    resolved_target = resolve_warehouse_from_rfid(data.target_rfid)
    print(f"EXCEPTION LOGGED: {data.exception_type} on {resolved_target}. Notes: {data.notes}")
    
    # Log activity in ERPNext
    log_wms_activity(
        activity_type="Manual Exception",
        operator="System",
        target_location=resolved_target,
        details=f"Type: {data.exception_type}. Notes: {data.notes}"
    )
    return {"message": "Success"}

@app.get("/wms/validate-dispatch")
def api_wms_validate_dispatch(pallet_rfid: str, item_rfid: str):
    try:
        warehouse_tag = resolve_warehouse_from_rfid(pallet_rfid)
        if not exists("Warehouse", warehouse_tag):
            return {"valid": False}
            
        item_code = resolve_item_from_rfid(item_rfid)
        if not item_code:
            return {"valid": False}
            
        # Verify stock exists in warehouse
        r_bin = requests.get(
            f"{ERP_URL}/api/resource/Bin",
            headers=HEADERS,
            params={"filters": json.dumps([["warehouse", "=", warehouse_tag], ["item_code", "=", item_code], ["actual_qty", ">", 0]]), "fields": '["actual_qty"]'}
        )
        if r_bin.status_code != 200 or not r_bin.json().get("data"):
            return {"valid": False}
            
        # Verify item is marked for dispatch
        dispatch_marked = requests.get(
            f"{ERP_URL}/api/resource/Batch", 
            headers=HEADERS, 
            params={"filters": json.dumps([["item", "=", item_code], ["custom_marked_for_dispatch", "=", 1]]), "fields": '["name"]'}
        )
        if dispatch_marked.status_code != 200 or not dispatch_marked.json().get("data"):
             return {"valid": False}
             
        return {"valid": True}
    except Exception:
        return {"valid": False}


@app.get("/wms/marked-for-dispatch")
def api_wms_marked_for_dispatch():
    try:
        # Fetch batches marked for dispatch
        r = requests.get(
            f"{ERP_URL}/api/resource/Batch",
            headers=HEADERS,
            params={
                "filters": json.dumps([["custom_marked_for_dispatch", "=", 1], ["disabled", "=", 0]]),
                "fields": '["name", "item", "item_name", "batch_qty", "expiry_date"]',
                "limit_page_length": 500
            }
        )
        if r.status_code != 200:
            return []
        
        batches = r.json().get("data", [])
        
        # For each batch, find its locations
        result = []
        for b in batches:
            r_bin = requests.get(
                f"{ERP_URL}/api/resource/Bin",
                headers=HEADERS,
                params={
                    "filters": json.dumps([["item_code", "=", b["item"]], ["actual_qty", ">", 0]]),
                    "fields": '["warehouse", "actual_qty"]'
                }
            )
            locations = []
            if r_bin.status_code == 200:
                locations = r_bin.json().get("data", [])
            
            result.append({
                "batch_number": b["name"],
                "item_code": b["item"],
                "item_name": b.get("item_name", ""),
                "batch_qty": b.get("batch_qty", 0),
                "expiry_date": b.get("expiry_date", ""),
                "locations": locations
            })
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/dispatch")
def api_wms_dispatch(data: WmsDispatchSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        warehouse_tag = resolve_warehouse_from_rfid(data.pallet_rfid)
        if not exists("Warehouse", warehouse_tag):
            raise Exception("Invalid Location/Bin RFID. Please scan a valid bin/pallet tag first.")
            
        if not data.item_rfid:
            raise Exception("Item RFID is required for 2-step verification. Please scan the item.")
            
        item_code = resolve_item_from_rfid(data.item_rfid)
        if not item_code:
            raise Exception("Invalid Item RFID. Could not resolve item code.")
            
        # Verify that the item has stock in the specified warehouse
        r_bin = requests.get(
            f"{ERP_URL}/api/resource/Bin",
            headers=HEADERS,
            params={"filters": json.dumps([["warehouse", "=", warehouse_tag], ["item_code", "=", item_code], ["actual_qty", ">", 0]]), "fields": '["actual_qty"]'}
        )
        
        if r_bin.status_code != 200 or not r_bin.json().get("data"):
            raise Exception(f"Item {item_code} not found in location {warehouse_tag} with quantity > 0.")
            
        bins = r_bin.json().get("data")
        qty = float(bins[0].get("actual_qty", 1.0))
        
        # Check if the item's batch is marked for dispatch
        dispatch_marked = requests.get(
            f"{ERP_URL}/api/resource/Batch", 
            headers=HEADERS, 
            params={"filters": json.dumps([["item", "=", item_code], ["custom_marked_for_dispatch", "=", 1]]), "fields": '["name"]'}
        )
        
        if dispatch_marked.status_code != 200 or not dispatch_marked.json().get("data"):
             raise Exception(f"Item {item_code} is not marked for dispatch.")
             
        dispatch_marked_bins = dispatch_marked.json().get("data", [])
        
        items_to_issue = [{
            "item_code": item_code,
            "qty": qty,
            "s_warehouse": warehouse_tag
        }]
        
        # Unmark the batch
        for d_batch in dispatch_marked_bins:
            try:
                erp_put("Batch", d_batch["name"], {"custom_marked_for_dispatch": 0})
            except Exception:
                pass
            
        # Build Stock Entry (Material Issue) payload
        items_payload = []
        for it in items_to_issue:
            uom = "Nos"
            try:
                r_item = requests.get(f"{ERP_URL}/api/resource/Item/{it['item_code']}", headers=HEADERS)
                if r_item.status_code == 200:
                    uom = r_item.json().get("data", {}).get("stock_uom") or "Nos"
            except Exception:
                pass
                
            items_payload.append({
                "item_code": it["item_code"],
                "qty": it["qty"],
                "s_warehouse": it["s_warehouse"],
                "uom": uom
            })
            
        payload = {
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Issue",
            "purpose": "Material Issue",
            "company": company,
            "items": items_payload
        }
        
        se = erp_post("Stock Entry", payload)
        submit_doc("Stock Entry", se["name"])
        
        # Not needed since we enforce location scanning
        # if is_warehouse:
        #    try:
        #        erp_put("Warehouse", tag, {"custom_dispatch_success": 1, "disabled": 1})
        #    except Exception:
        #        pass
                
        # Log activity in ERPNext
        try:
            item_details = ", ".join([f"{it['item_code']} ({it['qty']})" for it in items_to_issue])
            log_wms_activity(
                activity_type="Dispatch",
                operator="System",
                target_location=warehouse_tag,
                details=f"Dispatched items: {item_details}"
            )
        except Exception:
            pass
                
        return {"message": "Success", "stock_entry": se["name"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/repack-lookup")
def api_wms_repack_lookup(id: str):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        # Resolve the warehouse name from RFID tag first
        source_wh_full = resolve_warehouse_from_rfid(id)
        
        if exists("Warehouse", source_wh_full):
            r = requests.get(
                f"{ERP_URL}/api/resource/Bin",
                headers=HEADERS,
                params={"filters": json.dumps([["warehouse", "=", source_wh_full], ["actual_qty", ">", 0]]), "fields": '["item_code", "actual_qty"]'}
            )
            if r.status_code == 200:
                data = r.json().get("data", [])
                if data:
                    item_code = data[0]["item_code"]
                    qty = float(data[0]["actual_qty"])
                    r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
                    item_name = item_code
                    uom = "Nos"
                    if r_item.status_code == 200:
                        item_data = r_item.json().get("data", {})
                        item_name = item_data.get("item_name") or item_code
                        uom = item_data.get("stock_uom") or "Nos"
                    return {
                        "item_code": item_code,
                        "item_name": item_name,
                        "qty": qty,
                        "uom": uom
                    }
        
        # If it's not a warehouse, try resolving it as an item RFID
        item_code = resolve_item_from_rfid(id)
        r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
        item_name = item_code
        uom = "Nos"
        if r_item.status_code == 200:
            item_data = r_item.json().get("data", {})
            item_name = item_data.get("item_name") or item_code
            uom = item_data.get("stock_uom") or "Nos"
        
        src_wh_full = get_item_source_warehouse(item_code)
        r = requests.get(
            f"{ERP_URL}/api/resource/Bin",
            headers=HEADERS,
            params={"filters": json.dumps([["warehouse", "=", src_wh_full], ["item_code", "=", item_code]]), "fields": '["actual_qty"]'}
        )
        qty = 0.0
        if r.status_code == 200:
            data = r.json().get("data", [])
            if data:
                qty = float(data[0]["actual_qty"])
        return {
            "item_code": item_code,
            "item_name": item_name,
            "qty": qty,
            "uom": uom
        }
            
        return {
            "item_code": "Unknown",
            "item_name": "No Item in Location",
            "qty": 0.0,
            "uom": "Nos"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/split")
def api_wms_split(data: WmsSplitSchema):
    try:
        source_bin = resolve_warehouse_from_rfid(data.source_bin)
        target_bin = resolve_warehouse_from_rfid(data.target_bin)
        
        perform_stock_transfer(data.item_code, data.qty, source_bin, target_bin)
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wms/stock-count")
def api_wms_stock_count(data: WmsStockCountSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        target_warehouse = data.warehouse
        if target_warehouse and " - " not in target_warehouse:
            target_warehouse = f"{target_warehouse} - {company_abbr}"
            
        items_payload = []
        
        if target_warehouse:
            # 1. Fetch expected items in this warehouse (supporting Serial Number and Bin structures)
            expected_items = []
            
            # Serial No lookup
            try:
                sn_url = f"{ERP_URL}/api/resource/Serial No"
                sn_params = {
                    "fields": '["name", "item_code", "item_name", "custom_rfid_tag"]',
                    "filters": json.dumps([["warehouse", "=", target_warehouse], ["status", "=", "Active"]]),
                    "limit_page_length": 500
                }
                r_sn = requests.get(sn_url, headers=HEADERS, params=sn_params)
                if r_sn.status_code == 200:
                    for sn in r_sn.json().get("data", []):
                        rfid_val = sn.get("custom_rfid_tag") or sn.get("name")
                        expected_items.append({
                            "item_code": sn.get("item_code"),
                            "rfid_tag": rfid_val,
                            "val_rate": 1.0,
                            "uom": "Nos"
                        })
            except Exception:
                pass
                
            # Bin lookup fallback
            if not expected_items:
                try:
                    bin_url = f"{ERP_URL}/api/resource/Bin"
                    bin_params = {
                        "fields": '["item_code", "actual_qty"]',
                        "filters": json.dumps([["warehouse", "=", target_warehouse], ["actual_qty", ">", 0]]),
                        "limit_page_length": 500
                    }
                    r_bin = requests.get(bin_url, headers=HEADERS, params=bin_params)
                    if r_bin.status_code == 200:
                        for b in r_bin.json().get("data", []):
                            item_code = b.get("item_code")
                            r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
                            rfid_val = "NO_TAG"
                            val_rate = 1.0
                            uom = "Nos"
                            if r_item.status_code == 200:
                                item_data = r_item.json().get("data", {})
                                rfid_val = item_data.get("rfid") or item_data.get("custom_rfid") or item_data.get("custom_rfid_tag") or "NO_TAG"
                                val_rate = item_data.get("valuation_rate") or item_data.get("standard_rate") or 1.0
                                uom = item_data.get("stock_uom") or "Nos"
                            expected_items.append({
                                "item_code": item_code,
                                "rfid_tag": rfid_val,
                                "val_rate": val_rate,
                                "uom": uom
                            })
                except Exception:
                    pass
            
            # Map scanned tags to item/qty
            scanned_tags_set = set(data.scanned_tags)
            
            # Reconcile expected items: scanned items get their count (or 1.0), missing ones get 0.0
            reconciled_counts = {} # item_code -> total_qty
            item_uom_map = {}
            item_rate_map = {}
            
            for item in expected_items:
                code = item["item_code"]
                item_uom_map[code] = item["uom"]
                item_rate_map[code] = item["val_rate"]
                
                is_scanned = item["rfid_tag"] in scanned_tags_set
                # Accumulate quantity
                if is_scanned:
                    reconciled_counts[code] = reconciled_counts.get(code, 0.0) + 1.0
                else:
                    reconciled_counts[code] = reconciled_counts.get(code, 0.0)
                    
            for item_code, qty in reconciled_counts.items():
                items_payload.append({
                    "item_code": item_code,
                    "warehouse": target_warehouse,
                    "qty": qty,
                    "uom": item_uom_map.get(item_code, "Nos"),
                    "valuation_rate": float(item_rate_map.get(item_code, 1.0))
                })
        else:
            # Reconcile scanned tags generically (old logic)
            counts = {}
            for tag in data.scanned_tags:
                item_code = resolve_item_from_rfid(tag)
                warehouse = get_item_source_warehouse(item_code)
                key = (item_code, warehouse)
                counts[key] = counts.get(key, 0.0) + 1.0
                
            for (item_code, warehouse), qty in counts.items():
                uom = "Nos"
                val_rate = 1.0
                try:
                    r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
                    if r_item.status_code == 200:
                        item_data = r_item.json().get("data", {})
                        uom = item_data.get("stock_uom") or "Nos"
                        val_rate = item_data.get("valuation_rate") or item_data.get("standard_rate") or 1.0
                except Exception:
                    pass
                items_payload.append({
                    "item_code": item_code,
                    "warehouse": warehouse,
                    "qty": qty,
                    "uom": uom,
                    "valuation_rate": float(val_rate)
                })
                
        if not items_payload:
            return {"message": "No items to reconcile"}
            
        payload = {
            "doctype": "Stock Reconciliation",
            "company": company,
            "purpose": "Stock Reconciliation",
            "items": items_payload
        }
        
        sr = erp_post("Stock Reconciliation", payload)
        submit_doc("Stock Reconciliation", sr["name"])
        
        # Log activity in ERPNext
        try:
            if target_warehouse:
                discrepancies = []
                for item_code, scanned_qty in reconciled_counts.items():
                    expected_qty = sum(1.0 for x in expected_items if x["item_code"] == item_code)
                    if scanned_qty != expected_qty:
                        discrepancies.append(f"{item_code} (Expected: {expected_qty}, Scanned: {scanned_qty})")
                
                if discrepancies:
                    log_wms_activity(
                        activity_type="Stock Discrepancy",
                        operator="System",
                        target_location=target_warehouse,
                        details=f"Discrepancies found: {', '.join(discrepancies)}"
                    )
                else:
                    log_wms_activity(
                        activity_type="Stock Discrepancy",
                        operator="System",
                        target_location=target_warehouse,
                        details="Stock Count completed. All items matched successfully."
                    )
        except Exception:
            pass
            
        return {"message": "Success", "stock_reconciliation": sr["name"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/activity-log")
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

@app.get("/wms/resolve-tag-info")
def api_wms_resolve_tag_info(rfid: str):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        # 1. Try to resolve as a warehouse
        wh_name = resolve_warehouse_from_rfid(rfid)
        if exists("Warehouse", wh_name):
            r_wh = requests.get(f"{ERP_URL}/api/resource/Warehouse/{wh_name}", headers=HEADERS)
            parent = "None"
            if r_wh.status_code == 200:
                parent = r_wh.json().get("data", {}).get("parent_warehouse") or "None"
            return {
                "rfid": rfid,
                "type": "Warehouse",
                "name": wh_name.replace(f" - {company_abbr}", ""),
                "location": parent
            }
            
        # 2. Try to resolve as an item
        item_code = "Unknown"
        try:
            item_code = resolve_item_from_rfid(rfid)
        except Exception:
            pass
            
        if item_code != "Unknown" and exists("Item", item_code):
            src_wh = get_item_source_warehouse(item_code)
            item_name = item_code
            r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
            if r_item.status_code == 200:
                item_name = r_item.json().get("data", {}).get("item_name") or item_code
            return {
                "rfid": rfid,
                "type": "Item",
                "name": item_name,
                "location": src_wh
            }
            
        return {
            "rfid": rfid,
            "type": "Unknown",
            "name": "Unregistered Tag",
            "location": "N/A"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/warehouse-layout")
def get_warehouse_layout():
    try:
        r_wh = requests.get(f'{ERP_URL}/api/resource/Warehouse?fields=["name","parent_warehouse","is_group"]&limit_page_length=1000', headers=HEADERS)
        r_bin = requests.get(f'{ERP_URL}/api/resource/Bin?fields=["item_code","warehouse","actual_qty"]&limit_page_length=1000', headers=HEADERS)
        r_batch = requests.get(f'{ERP_URL}/api/resource/Batch?fields=["name","item","expiry_date","custom_marked_for_dispatch"]&limit_page_length=1000', headers=HEADERS)
        
        warehouses = r_wh.json().get("data", []) if r_wh.status_code == 200 else []
        bins = r_bin.json().get("data", []) if r_bin.status_code == 200 else []
        batches = r_batch.json().get("data", []) if r_batch.status_code == 200 else []
        
        batch_map = {}
        for b in batches:
            if b.get("expiry_date"):
                if b["item"] not in batch_map or b["expiry_date"] < batch_map[b["item"]]["expiry_date"]:
                    batch_map[b["item"]] = b
                    
        stock_map = {}
        for b in bins:
            if b.get("actual_qty", 0) > 0:
                wh = b.get("warehouse")
                if wh not in stock_map:
                    stock_map[wh] = []
                
                item_code = b.get("item_code")
                batch_info = batch_map.get(item_code, {})
                
                stock_map[wh].append({
                    "itemCode": item_code,
                    "itemName": item_code,
                    "packSize": 1,
                    "packCount": b["actual_qty"],
                    "totalWeight": b["actual_qty"],
                    "uom": "Units",
                    "expiryDate": batch_info.get("expiry_date"),
                    "batchNo": batch_info.get("name"),
                    "markedForDispatch": batch_info.get("custom_marked_for_dispatch") == 1
                })
                
        children_map = {}
        for w in warehouses:
            pw = w.get("parent_warehouse")
            if pw:
                if pw not in children_map:
                    children_map[pw] = []
                children_map[pw].append(w)
                
        top_warehouses = [w for w in warehouses if w.get("parent_warehouse") == "All Warehouses - V"]
        
        result = {}
        for root in top_warehouses:
            root_racks = []
            racks = children_map.get(root["name"], [])
            
            for rack in racks:
                rack_rows = []
                rows = children_map.get(rack["name"], [])
                
                for row in rows:
                    row_bins = []
                    bins_nodes = children_map.get(row["name"], [])
                    
                    for bn in bins_nodes:
                        row_bins.append({
                            "id": bn["name"],
                            "name": bn["name"].split(" - ")[0],
                            "items": stock_map.get(bn["name"], [])
                        })
                        
                    if len(row_bins) == 0 and len(stock_map.get(row["name"], [])) > 0:
                        row_bins.append({
                            "id": row["name"] + "_bin",
                            "name": row["name"].split(" - ")[0],
                            "items": stock_map.get(row["name"])
                        })
                        
                    rack_rows.append({
                        "id": row["name"],
                        "name": row["name"].split(" - ")[0],
                        "bins": row_bins
                    })
                    
                root_racks.append({
                    "id": rack["name"],
                    "name": rack["name"].split(" - ")[0],
                    "rows": rack_rows
                })
                
            result[root["name"]] = root_racks
            
        return result
    except Exception as e:
        print("Error fetching warehouse layout:", e)
        return {}

@app.put("/wms/mark-dispatch/{batch_no}")
def api_wms_mark_dispatch(batch_no: str):
    try:
        r = requests.put(
            f"{ERP_URL}/api/resource/Batch/{batch_no}",
            headers=HEADERS,
            json={"custom_marked_for_dispatch": 1}
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wms/root-warehouses")
def get_root_warehouses():
    try:
        url = f'{ERP_URL}/api/resource/Warehouse?fields=["name","warehouse_name"]&filters=[["parent_warehouse","=","All Warehouses - V"]]&limit_page_length=100'
        r = requests.get(url, headers=HEADERS)
        if r.status_code == 200:
            data = r.json().get("data", [])
            return [{"id": w["name"], "name": w.get("warehouse_name", w["name"])} for w in data]
        return []
    except Exception as e:
        print("Error fetching root warehouses:", e)
        return []

@app.get("/wms/dashboard-metrics")
def get_dashboard_metrics():
    from datetime import datetime, timedelta
    try:
        r_bin = requests.get(f'{ERP_URL}/api/resource/Bin?fields=["item_code","warehouse","actual_qty"]&limit_page_length=5000', headers=HEADERS)
        r_batch = requests.get(f'{ERP_URL}/api/resource/Batch?fields=["name","item","expiry_date"]&limit_page_length=5000', headers=HEADERS)
        
        bins = r_bin.json().get("data", []) if r_bin.status_code == 200 else []
        batches = r_batch.json().get("data", []) if r_batch.status_code == 200 else []
        
        unique_items = set()
        total_stock = 0
        occupied_bins = set()
        empty_bins = set()
        
        for b in bins:
            qty = b.get("actual_qty", 0)
            wh = b.get("warehouse")
            
            if qty > 0:
                unique_items.add(b.get("item_code"))
                total_stock += qty
                occupied_bins.add(wh)
            else:
                empty_bins.add(wh)
                
        empty_bins = empty_bins - occupied_bins
        
        today = datetime.now().date()
        thirty_days = today + timedelta(days=30)
        
        expiring_soon = 0
        expired = 0
        
        for b in batches:
            exp_date_str = b.get("expiry_date")
            if exp_date_str:
                exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d").date()
                if exp_date < today:
                    expired += 1
                elif today <= exp_date <= thirty_days:
                    expiring_soon += 1
                    
        return {
            "totalItems": len(unique_items),
            "totalStock": total_stock,
            "occupiedBins": len(occupied_bins),
            "emptyBins": len(empty_bins),
            "expiringSoon": expiring_soon,
            "expired": expired
        }
    except Exception as e:
        print("Error fetching dashboard metrics:", e)
        raise HTTPException(status_code=500, detail=str(e))
