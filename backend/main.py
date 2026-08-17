from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Tuple, Optional, Dict, Any
import requests
import os
import json

app = FastAPI(title="ERP System", description="ERP System API", version="1.0.0")

# ERP_URL = "https://erpnext-vrd-abg.m.frappe.cloud"
ERP_URL = "http://192.168.29.59:8000"

# API_KEY = "974c53fdd880655"
API_KEY = "fe91c1c285be2e8"
# API_SECRET = "7db19dda44520ce"
API_SECRET = "5c74a42513ab096"

HEADERS = {
    "Authorization": f"token {API_KEY}:{API_SECRET}",
    "Content-Type": "application/json"
}

COMPANY = "Vishwha Murukku Foods"
COMPANY_ABBR = "VMF"

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

def ensure_warehouse(warehouse_name: str):
    full_name = f"{warehouse_name} - {COMPANY_ABBR}"
    if not exists("Warehouse", full_name):
        payload = {
            "warehouse_name": warehouse_name,
            "parent_warehouse": f"All Warehouses - {COMPANY_ABBR}",
            "company": COMPANY
        }
        erp_post("Warehouse", payload)

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

class RawMaterialSchema(BaseModel):
    item_code: str = "Maida5"
    item_name: str = "Maida5"
    item_group: str = "Raw Material"
    stock_uom: str = "Kg"
    gst_hsn_code: str = "44022010"

class ProductSchema(BaseModel):
    item_code: str = "Biscuit5"
    item_name: str = "Biscuit5"
    item_group: str = "Products"
    stock_uom: str = "Kg"
    gst_hsn_code: str = "19059090"

class BOMSchema(BaseModel):
    item: str = "Biscuit5"
    quantity: float = 100.0
    uom: str = "Kg"
    raw_material: str = "Maida5"
    raw_material_qty: float = 900.0
    raw_material_rate: float = 35.00

class SalesOrderSchema(BaseModel):
    qty: float = 100.0
    rate: float = 360.00
    customer: str = "Customer1"
    warehouse: str = "Biscuit5 finished warehouse - VMF"

class PaymentEntrySchema(BaseModel):
    sales_order_name: str
    amount: float = 18000.0
    customer: str = "Customer1"

class SupplierPaymentSchema(BaseModel):
    purchase_order_name: str
    amount: float = 9000.0
    supplier: str = "ABC Flour Mills"

class PurchaseOrderSchema(BaseModel):
    supplier: str = "ABC Flour Mills"
    total_qty: float = 900.0
    rate: float = 35.00
    warehouse: str = "Maida5 warehouse - VMF"

class ApprovePOSchema(BaseModel):
    purchase_order_name: str

class PurchaseReceiptSchema(BaseModel):
    purchase_order_name: str
    item_row_index: int = 0

class WorkOrderSchema(BaseModel):
    qty: float = 33.3333
    bom_no: str
    production_item: str = "Biscuit5"
    source_warehouse: str = "Maida5 warehouse - VMF"
    wip_warehouse: str = "Work In Progress - VMF"
    fg_warehouse: str = "Biscuit5 finished warehouse - VMF"

class StartWorkOrderSchema(BaseModel):
    work_order_name: str
    qty: float = 33.3333

class FinishWorkOrderSchema(BaseModel):
    work_order_name: str
    qty: float = 33.3333

class SalesInvoiceSchema(BaseModel):
    sales_order_name: str

class PurchaseInvoiceSchema(BaseModel):
    purchase_order_name: str
    bill_no: str = "BILL-12345"
    bill_date: str = "2026-06-13"

@app.on_event("startup")
def startup_event():
    ensure_warehouse("Maida5 warehouse")
    ensure_warehouse("Biscuit5 finished warehouse")

@app.post("/rawmaterials")
def api_create_raw_material(data: RawMaterialSchema = RawMaterialSchema()):
    payload = {
        "item_code": data.item_code,
        "item_name": data.item_name,
        "item_group": data.item_group,
        "stock_uom": data.stock_uom,
        "is_stock_item": 1,
        "gst_hsn_code": data.gst_hsn_code
    }
    return erp_post("Item", payload)

@app.post("/product")
def api_create_product(data: ProductSchema = ProductSchema()):
    payload = {
        "item_code": data.item_code,
        "item_name": data.item_name,
        "item_group": data.item_group,
        "stock_uom": data.stock_uom,
        "is_stock_item": 1,
        "gst_hsn_code": data.gst_hsn_code
    }
    return erp_post("Item", payload)

@app.post("/bom")
def api_create_bom(data: BOMSchema = BOMSchema()):
    payload = {
        "item": data.item,
        "company": COMPANY,
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
    return erp_post("BOM", payload)

@app.get("/bom/active")
def api_get_active_bom(item: str = "Biscuit5"):
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
    so_payload = {
        "customer": data.customer,
        "company": COMPANY,
        "transaction_date": "2026-06-13",
        "delivery_date": "2026-06-20",
        "selling_price_list": "Standard Selling",
        "currency": "INR",
        "company_address": "Vishwha Murukku Foods-Billing",
        "customer_address": f"{data.customer}-Billing",
        "shipping_address_name": f"{data.customer}-Billing",
        "taxes_and_charges": "Output GST In-state - VMF",
        "taxes": [
            {
                "charge_type": "On Net Total",
                "account_head": f"Output Tax SGST - {COMPANY_ABBR}",
                "description": "SGST",
                "rate": 9.0
            },
            {
                "charge_type": "On Net Total",
                "account_head": f"Output Tax CGST - {COMPANY_ABBR}",
                "description": "CGST",
                "rate": 9.0
            }
        ],
        "items": [
            {
                "item_code": "Biscuit5",
                "qty": data.qty,
                "rate": data.rate,
                "uom": "Kg",
                "conversion_factor": 1.0,
                "delivery_date": "2026-06-20",
                "warehouse": data.warehouse
            }
        ]
    }
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
        "company": COMPANY,
        "paid_from": "Debtors - VMF",
        "paid_to": "50200084736291 - HDFC Bank - Current A/C - VMF",
        "received_amount": allocated,
        "paid_amount": allocated,
        "reference_no": f"ADV-{so_name}",
        "reference_date": "2026-06-13",
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
        "company": COMPANY,
        "paid_from": "50200084736291 - HDFC Bank - Current A/C - VMF",
        "paid_to": "Creditors - VMF",
        "received_amount": allocated,
        "paid_amount": allocated,
        "reference_no": f"SUP-PAY-{po_name}",
        "reference_date": "2026-06-13",
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
    row_qty = data.total_qty / 3.0
    po_payload = {
        "company": COMPANY,
        "supplier": data.supplier,
        "transaction_date": "2026-06-13",
        "schedule_date": "2026-06-15",
        "billing_address": "Vishwha Murukku Foods-Billing",
        "shipping_address": "Vishwha Murukku Foods-Billing",
        "supplier_address": f"{data.supplier}-Billing",
        "taxes_and_charges": "Input GST Out-state - VMF",
        "taxes": [
            {
                "category": "Total",
                "add_deduct_tax": "Add",
                "charge_type": "On Net Total",
                "account_head": f"Input Tax IGST - {COMPANY_ABBR}",
                "description": "IGST",
                "rate": 18.0
            }
        ],
        "items": [
            {
                "item_code": "Maida5",
                "qty": row_qty,
                "rate": data.rate,
                "uom": "Kg",
                "warehouse": data.warehouse,
                "schedule_date": "2026-06-15"
            },
            {
                "item_code": "Maida5",
                "qty": row_qty,
                "rate": data.rate,
                "uom": "Kg",
                "warehouse": data.warehouse,
                "schedule_date": "2026-06-15"
            },
            {
                "item_code": "Maida5",
                "qty": row_qty,
                "rate": data.rate,
                "uom": "Kg",
                "warehouse": data.warehouse,
                "schedule_date": "2026-06-15"
            }
        ]
    }
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
    
    if len(pr_payload["items"]) > data.item_row_index:
        pr_payload["items"] = [pr_payload["items"][data.item_row_index]]
    else:
        pr_payload["items"] = [pr_payload["items"][0]]
        
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

    bom_no = data.bom_no
    if bom_no == "string" or not bom_no:
        resolved = resolve_latest_doc("BOM", [["item", "=", data.production_item], ["is_active", "=", 1], ["docstatus", "=", 1]])
        if resolved:
            bom_no = resolved
            print(f"Resolved 'string' to active BOM: {bom_no}")
        else:
            raise HTTPException(status_code=400, detail=f"Could not find any active, submitted BOM for item {data.production_item} to resolve 'string' placeholder.")

    wo_payload = {
        "company": COMPANY,
        "production_item": data.production_item,
        "bom_no": bom_no,
        "qty": data.qty,
        "wip_warehouse": data.wip_warehouse,
        "fg_warehouse": data.fg_warehouse,
        "source_warehouse": data.source_warehouse,
        "use_multi_level_bom": 0
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
    
    # Query current available Biscuit5 stock to handle floating point precision limits
    available_qty = None
    try:
        r_bin = requests.get(
            f"{ERP_URL}/api/resource/Bin",
            headers=HEADERS,
            params={
                "filters": f'[["item_code", "=", "Biscuit5"], ["warehouse", "=", "Biscuit5 finished warehouse - {COMPANY_ABBR}"]]',
                "fields": '["actual_qty"]'
            }
        )
        if r_bin.status_code == 200:
            bin_data = r_bin.json().get("data", [])
            if bin_data:
                available_qty = float(bin_data[0].get("actual_qty", 0.0))
                print(f"Available stock of Biscuit5 found in finished warehouse: {available_qty}")
    except Exception as e:
        print(f"Failed to query stock bin level: {e}")

    for item in si_payload.get("items", []):
        item["warehouse"] = f"Biscuit5 finished warehouse - {COMPANY_ABBR}"
        if available_qty is not None and item["item_code"] == "Biscuit5":
            # If stock is slightly below requested amount due to division (e.g. 99.999 instead of 100)
            if available_qty < item["qty"] and (item["qty"] - available_qty) < 0.05:
                print(f"Adjusting invoice item qty from {item['qty']} to match actual stock: {available_qty}")
                item["qty"] = available_qty

    si = erp_post("Sales Invoice", si_payload)
    submit_doc("Sales Invoice", si["name"])
    return si