from fastapi import APIRouter, HTTPException, status, Header
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import requests
import json
import datetime
import jwt
from common import *
import fastapi

router = APIRouter(tags=["Web"])

@router.post("/api/auth/login")
def login_user(data: LoginRequest):
    payload = {
        "email": data.email,
        "password": data.password
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    session = requests.Session()
    login_response = session.post("https://dev-directus.rearlytech.com/auth/login", json=payload, headers=headers)    
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

@router.post("/putaway-rule")
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

@router.post("/rawmaterials")
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

@router.post("/product")
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

@router.post("/bom")
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

@router.get("/bom/active")
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

@router.post("/salesorder")
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

@router.post("/payment-entry")
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

@router.post("/supplier-payment")
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

@router.post("/purchase-order")
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

@router.post("/purchase-order/approve")
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

@router.post("/purchase-receipt")
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

@router.post("/work-order")
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

@router.post("/work-order/start")
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

@router.post("/work-order/finish")
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

@router.post("/purchase-invoice")
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

@router.post("/sales-invoice")
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

@router.get("/history/payments")
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

@router.get("/history/stock-entries")
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

@router.get("/history/purchase-orders")
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

@router.get("/companies")
def api_get_companies():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Company", headers=HEADERS, params={"fields": '["name"]', "limit_page_length": 50})
        if r.status_code == 200:
            return [c["name"] for c in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/customers")
def api_get_customers():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Customer", headers=HEADERS, params={"fields": '["name"]', "limit_page_length": 100})
        if r.status_code == 200:
            return [c["name"] for c in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/suppliers")
def api_get_suppliers():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Supplier", headers=HEADERS, params={"fields": '["name"]', "limit_page_length": 100})
        if r.status_code == 200:
            return [s["name"] for s in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/invoice-balance")
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

@router.post("/doctype")
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

@router.get("/items")
def api_get_items():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Item", headers=HEADERS, params={"fields": '["name", "item_name", "item_group"]', "limit_page_length": 150})
        if r.status_code == 200:
            return r.json().get("data", [])
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batches")
def api_get_batches():
    try:
        r = requests.get(f"{ERP_URL}/api/resource/Batch", headers=HEADERS, params={"fields": '["name", "item", "expiry_date"]', "limit_page_length": 150})
        if r.status_code == 200:
            return [{"batch_number": b["name"], "item": b["item"], "expiry_date": b.get("expiry_date")} for b in r.json().get("data", [])]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/warehouse-item-check")
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
            "fields": '["name", "warehouse_name", "parent_warehouse", "is_group", "custom_is_reserved"]',
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
                    "expiry_date": expiry_str,
                    "is_reserved": wh_dict.get(wh_name, {}).get("custom_is_reserved") == 1
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
                    "expiry_date": expiry_str,
                    "is_reserved": wh_dict.get(wh_name, {}).get("custom_is_reserved") == 1
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

@router.get("/warehouse-items")
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


metrics_cache = {
    "data": {},
    "last_fetched": 0
}

@router.get("/wms/dashboard-metrics")
def get_dashboard_metrics():
    global metrics_cache
    if time.time() - metrics_cache["last_fetched"] < 60:
        return metrics_cache["data"]

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
                    
        result = {
            "totalItems": len(unique_items),
            "totalStock": total_stock,
            "occupiedBins": len(occupied_bins),
            "emptyBins": len(empty_bins),
            "expiringSoon": expiring_soon,
            "expired": expired
        }
        
        metrics_cache["data"] = result
        metrics_cache["last_fetched"] = time.time()
        
        return result
    except Exception as e:
        print("Error fetching dashboard metrics:", e)
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/wms/door-status")
def get_door_status(authorization: str = fastapi.Header(default=None)):
    try:
        url = "https://dev-directus.rearlytech.com/items/gateway_sensor_readings?filter[sensor_type][_eq]=door_uart&limit=1&sort=-created_at&fields=door_status,raw_json"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        if authorization:
            headers["Authorization"] = authorization
            
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("data") and len(data["data"]) > 0:
                print(f"door_status is success")
                item = data["data"][0]
                door_status = item.get("door_status", "Unknown")
                
                alarm_status = "NORMAL"
                amonia_status = "NORMAL"
                if item.get("raw_json"):
                    try:
                        raw_parsed = json.loads(item["raw_json"])
                        if isinstance(raw_parsed, str):
                            raw_parsed = json.loads(raw_parsed)
                            
                        alarm_status = raw_parsed.get("values", {}).get("alarm_status") or raw_parsed.get("alarm_status", "NORMAL")
                        amonia_status = raw_parsed.get("values", {}).get("amonia_status") or raw_parsed.get("amonia_status", "NORMAL")
                    except Exception as parse_e:
                        print("Error parsing raw_json for alarm/amonia:", parse_e)

                return {
                    "door_status": door_status,
                    "alarm_status": alarm_status,
                    "amonia_status": amonia_status
                }
            else:
                print(f"door_status is failed (no data). Data: {data}")
                return {"door_status": "Empty Data (Check Directus 'All Access' rule)", "alarm_status": "Empty", "amonia_status": "Empty"}
        elif response.status_code == 401:
            print(f"door_status is failed with status 401. Raising 401 to frontend.")
            raise HTTPException(status_code=401, detail="Directus token expired or invalid")
        else:
            print(f"door_status is failed with status {response.status_code}. Response: {response.text}")
            return {"door_status": f"HTTP {response.status_code} Error", "alarm_status": "Error", "amonia_status": "Error"}
    except Exception as e:
        print(f"Error fetching door status: {e}")
        return {"door_status": "Backend Exception", "alarm_status": "Error", "amonia_status": "Error"}

@router.get("/wms/gateway-status")
def get_gateway_status(authorization: str = fastapi.Header(default=None)):
    try:
        from datetime import datetime, timezone
        
        sensors = ["ambient_xyth_1", "energy_meter_1", "door_sensor_1"]
        sensor_status = {}
        gateway_online = False
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        if authorization:
            headers["Authorization"] = authorization
            
        for sensor_id in sensors:
            url = f"https://dev-directus.rearlytech.com/items/gateway_sensor_readings?filter[sensor_id][_eq]={sensor_id}&limit=1&sort=-created_at&fields=created_at"
            response = requests.get(url, headers=headers, timeout=5)
            
            is_online = False
            last_seen = None
            
            if response.status_code == 200:
                data = response.json()
                if data.get("data") and len(data["data"]) > 0:
                    last_seen_str = data["data"][0].get("created_at")
                    if last_seen_str:
                        last_seen = last_seen_str
                        # Parse ISO format and make it offset-aware (UTC) if it doesn't have timezone
                        try:
                            last_seen_dt = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
                            now_dt = datetime.now(timezone.utc)
                            diff_seconds = (now_dt - last_seen_dt).total_seconds()
                            
                            # Threshold for online is 2 minutes (120 seconds)
                            if diff_seconds <= 120:
                                is_online = True
                                gateway_online = True
                        except Exception as parse_e:
                            print(f"Error parsing date for {sensor_id}: {parse_e}")
            elif response.status_code == 401:
                raise HTTPException(status_code=401, detail="Directus token expired or invalid")
                
            sensor_status[sensor_id] = {
                "online": is_online,
                "last_seen": last_seen
            }
            
        return {
            "gateway_online": gateway_online,
            "sensors": sensor_status
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching gateway status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


import time
import concurrent.futures

layout_cache = {
    "data": {},
    "last_fetched": 0
}

@router.get("/wms/warehouse-layout")
def get_warehouse_layout():
    global layout_cache
    if time.time() - layout_cache["last_fetched"] < 60:
        return layout_cache["data"]

    try:
        r_wh = requests.get(f'{ERP_URL}/api/resource/Warehouse?fields=["name","parent_warehouse","is_group","custom_marked_for_dispatch"]&limit_page_length=2000', headers=HEADERS)
        r_bin = requests.get(f'{ERP_URL}/api/resource/Bin?fields=["item_code","warehouse","actual_qty"]&limit_page_length=5000', headers=HEADERS)
        r_batch = requests.get(f'{ERP_URL}/api/resource/Batch?fields=["name","item","expiry_date","custom_marked_for_dispatch"]&limit_page_length=5000', headers=HEADERS)
        
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
                
        def build_tree(node_name):
            children = children_map.get(node_name, [])
            node_items = stock_map.get(node_name, [])
            node_wh_obj = next((w for w in warehouses if w["name"] == node_name), {})
            node = {
                "id": node_name,
                "name": node_name.split(" - ")[0],
                "items": node_items,
                "markedForDispatch": node_wh_obj.get("custom_marked_for_dispatch") == 1,
                "children": []
            }
            
            for child in children:
                child_node = build_tree(child["name"])
                node["children"].append(child_node)
                
            return node

        top_warehouses = [w for w in warehouses if w.get("parent_warehouse") == "All Warehouses - V"]
        
        result = {}
        for root in top_warehouses:
            root_children = children_map.get(root["name"], [])
            result[root["name"]] = [build_tree(child["name"]) for child in root_children]
            
        layout_cache["data"] = result
        layout_cache["last_fetched"] = time.time()
            
        return result
    except Exception as e:
        print("Error fetching warehouse layout:", e)
        return {}

@router.put("/wms/mark-dispatch/{batch_no}")
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

@router.put("/wms/mark-pallet-dispatch/{pallet_id}")
def api_wms_mark_pallet_dispatch(pallet_id: str):
    try:
        # Resolve to internal name if it's an RFID or simple ID
        if " - " not in pallet_id:
            pallet_id = f"{pallet_id} - V"
        
        r = requests.put(
            f"{ERP_URL}/api/resource/Warehouse/{pallet_id}",
            headers=HEADERS,
            json={"custom_marked_for_dispatch": 1}
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/tasks")
def api_create_wms_task(data: WMSTaskSchema):
    try:
        payload = {
            "task_type": data.task_type,
            "status": "Pending",
            "source_pallet": data.source_pallet,
            "target_pallet": data.target_pallet,
            "notes": data.notes
        }
        return erp_post("WMS Task", payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/tasks")
def api_get_wms_tasks(status: str = "Pending"):
    try:
        r = requests.get(
            f'{ERP_URL}/api/resource/WMS Task',
            headers=HEADERS,
            params={
                "fields": '["name", "task_type", "status", "source_pallet", "target_pallet", "notes", "creation"]',
                "filters": json.dumps([["status", "=", status]]),
                "order_by": "creation desc",
                "limit_page_length": 100
            }
        )
        if r.status_code == 200:
            return r.json().get("data", [])
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/root-warehouses")
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

@router.get("/api/energy/live")
def get_energy_live(authorization: str = fastapi.Header(default=None)):
    try:
        url = "https://dev-directus.rearlytech.com/items/gateway_sensor_readings?filter[sensor_id][_eq]=energy_meter_1&limit=1&sort=-created_at&fields=voltage,frequency,active_power,power_factor,active_energy"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        if authorization:
            headers["Authorization"] = authorization
            
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("data") and len(data["data"]) > 0:
                item = data["data"][0]
                values = {
                    "voltage": item.get("voltage"),
                    "frequency": item.get("frequency"),
                    "activePower": item.get("active_power"),
                    "powerFactor": item.get("power_factor"),
                    "activeEnergy": item.get("active_energy")
                }
                return {"success": True, "values": values}
            else:
                return {"success": False, "message": "No energy data found"}
        elif response.status_code == 401:
            raise HTTPException(status_code=401, detail="Directus token expired or invalid")
        else:
            return {"success": False, "message": f"Directus returned {response.status_code}", "directus_error": response.text}
    except HTTPException:
        raise
    except Exception as e:
        print("Error fetching energy live:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/energy/history")
def get_energy_history(authorization: str = fastapi.Header(default=None)):
    try:
        from datetime import datetime, timedelta
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%dT00:00:00Z")
        url = f"https://dev-directus.rearlytech.com/items/gateway_sensor_readings?filter[sensor_id][_eq]=energy_meter_1&filter[created_at][_gte]={seven_days_ago}&limit=-1&sort=-created_at&fields=active_energy,created_at"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        if authorization:
            headers["Authorization"] = authorization
            
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("data"):
                # Sort by created_at ascending for charting
                readings = sorted(data["data"], key=lambda x: x.get("created_at", ""))
                history_data = []
                for r in readings:
                    history_data.append({
                        "created_at": r.get("created_at"),
                        "values": {
                            "activeEnergy": r.get("active_energy")
                        }
                    })
                return {"success": True, "history": history_data}
            else:
                return {"success": True, "history": []}
        elif response.status_code == 401:
            raise HTTPException(status_code=401, detail="Directus token expired or invalid")
        else:
            return {"success": False, "message": f"Directus returned {response.status_code}", "directus_error": response.text}
    except HTTPException:
        raise
    except Exception as e:
        print("Error fetching energy history:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/temperature/live")
def get_temperature_live(authorization: str = fastapi.Header(default=None)):
    try:
        url = "https://dev-directus.rearlytech.com/items/gateway_sensor_readings?filter[sensor_id][_eq]=ambient_xyth_1&limit=1&sort=-created_at&fields=temperature_c,humidity_rh"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        if authorization:
            headers["Authorization"] = authorization
            
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("data") and len(data["data"]) > 0:
                item = data["data"][0]
                values = {
                    "temperature": item.get("temperature_c"),
                    "humidity": item.get("humidity_rh"),
                }
                return {"success": True, "values": values}
            else:
                return {"success": False, "message": "No temperature data found"}
        elif response.status_code == 401:
            raise HTTPException(status_code=401, detail="Directus token expired or invalid")
        else:
            return {"success": False, "message": f"Directus returned {response.status_code}", "directus_error": response.text}
    except HTTPException:
        raise
    except Exception as e:
        print("Error fetching temperature live:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/temperature/history")
def get_temperature_history(authorization: str = fastapi.Header(default=None)):
    try:
        from datetime import datetime, timedelta
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%dT00:00:00Z")
        url = f"https://dev-directus.rearlytech.com/items/gateway_sensor_readings?filter[sensor_id][_eq]=ambient_xyth_1&filter[created_at][_gte]={seven_days_ago}&limit=-1&sort=-created_at&fields=temperature_c,humidity_rh,created_at"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        if authorization:
            headers["Authorization"] = authorization
            
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("data"):
                # Sort by created_at ascending for charting
                readings = sorted(data["data"], key=lambda x: x.get("created_at", ""))
                history_data = []
                for r in readings:
                    history_data.append({
                        "created_at": r.get("created_at"),
                        "values": {
                            "temperature": r.get("temperature_c"),
                            "humidity": r.get("humidity_rh"),
                        }
                    })
                return {"success": True, "history": history_data}
            else:
                return {"success": True, "history": []}
        elif response.status_code == 401:
            raise HTTPException(status_code=401, detail="Directus token expired or invalid")
        else:
            return {"success": False, "message": f"Directus returned {response.status_code}", "directus_error": response.text}
    except HTTPException:
        raise
    except Exception as e:
        print("Error fetching temperature history:", e)
        raise HTTPException(status_code=500, detail=str(e))

import os

THRESHOLDS_FILE = os.path.join(os.path.dirname(__file__), "thresholds.json")

def get_default_thresholds():
    return {
        "temperature": 30.0,
        "humidity": 70.0,
        "energy": 50.0
    }

@router.get("/wms/thresholds")
def get_thresholds():
    try:
        if os.path.exists(THRESHOLDS_FILE):
            with open(THRESHOLDS_FILE, "r") as f:
                data = json.load(f)
                return data
        return get_default_thresholds()
    except Exception as e:
        print("Error reading thresholds:", e)
        return get_default_thresholds()

@router.post("/wms/thresholds")
async def update_thresholds(request: fastapi.Request):
    try:
        body = await request.json()
        current = get_default_thresholds()
        
        if os.path.exists(THRESHOLDS_FILE):
            try:
                with open(THRESHOLDS_FILE, "r") as f:
                    current.update(json.load(f))
            except:
                pass
                
        if "temperature" in body:
            current["temperature"] = float(body["temperature"])
        if "humidity" in body:
            current["humidity"] = float(body["humidity"])
        if "energy" in body:
            current["energy"] = float(body["energy"])
            
        with open(THRESHOLDS_FILE, "w") as f:
            json.dump(current, f)
            
        return {"success": True, "thresholds": current}
    except Exception as e:
        print("Error updating thresholds:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/pallets-summary")
def get_pallets_summary():
    try:
        r_wh = requests.get(f'{ERP_URL}/api/resource/Warehouse?fields=["name","parent_warehouse"]&limit_page_length=1000', headers=HEADERS)
        r_bin = requests.get(f'{ERP_URL}/api/resource/Bin?fields=["item_code","warehouse","actual_qty"]&limit_page_length=1000', headers=HEADERS)
        
        warehouses = r_wh.json().get("data", []) if r_wh.status_code == 200 else []
        bins = r_bin.json().get("data", []) if r_bin.status_code == 200 else []
        
        pallets = [w for w in warehouses if "pallet" in w["name"].lower()]
        
        r_items = requests.get(f'{ERP_URL}/api/resource/Item?fields=["name","item_name","stock_uom","weight_per_unit","weight_uom"]&limit_page_length=1000', headers=HEADERS)
        items_data = r_items.json().get("data", []) if r_items.status_code == 200 else []
        item_map = {item["name"]: {
            "name": item.get("item_name", item["name"]), 
            "uom": item.get("stock_uom", "Nos"),
            "weight_per_unit": float(item.get("weight_per_unit") or 0.0),
            "weight_uom": item.get("weight_uom") or "kg"
        } for item in items_data}
        
        summary = []
        for p in pallets:
            p_name = p["name"]
            p_items = []
            total_qty = 0.0
            total_weight = 0.0
            
            for b in bins:
                if b["warehouse"] == p_name and float(b.get("actual_qty", 0)) > 0:
                    qty = float(b["actual_qty"])
                    i_code = b["item_code"]
                    i_info = item_map.get(i_code, {"name": i_code, "uom": "Nos", "weight_per_unit": 0.0, "weight_uom": "kg"})
                    
                    item_weight = qty * i_info["weight_per_unit"]
                    total_qty += qty
                    total_weight += item_weight
                    
                    p_items.append({
                        "itemCode": i_code,
                        "itemName": i_info["name"],
                        "quantity": qty,
                        "uom": i_info["uom"],
                        "totalWeight": item_weight,
                        "weightUom": i_info["weight_uom"]
                    })
            
            if len(p_items) > 0:
                summary.append({
                    "palletName": p_name.split(" - ")[0],
                    "palletFullName": p_name,
                    "totalQuantity": total_qty,
                    "totalWeight": total_weight,
                    "items": p_items
                })
                
        return summary
    except Exception as e:
        print("Error fetching pallets summary:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/slow-moving-items")
def get_slow_moving_items():
    from datetime import datetime
    try:
        r_bin = requests.get(f'{ERP_URL}/api/resource/Bin?fields=["item_code","warehouse","actual_qty","creation","modified"]&limit_page_length=1000', headers=HEADERS)
        bins = r_bin.json().get("data", []) if r_bin.status_code == 200 else []
        active_bins = [b for b in bins if float(b.get("actual_qty", 0)) > 0]
        
        r_items = requests.get(f'{ERP_URL}/api/resource/Item?fields=["name","item_name","item_group"]&limit_page_length=1000', headers=HEADERS)
        items_data = r_items.json().get("data", []) if r_items.status_code == 200 else []
        item_details = {item["name"]: item for item in items_data}
        
        now = datetime.now()
        results = []
        for b in active_bins:
            item_code = b["item_code"]
            
            c_date_str = b.get("creation")
            if c_date_str:
                creation_date = datetime.strptime(c_date_str.split(".")[0], "%Y-%m-%d %H:%M:%S")
            else:
                creation_date = now
                
            days_ago = (now.date() - creation_date.date()).days
            if days_ago < 0:
                days_ago = 0
            
            info = item_details.get(item_code, {})
            
            results.append({
                "warehouse": b["warehouse"],
                "itemCode": item_code,
                "itemName": info.get("item_name", item_code),
                "itemGroup": info.get("item_group", "Unknown"),
                "quantity": float(b["actual_qty"]),
                "daysAgo": days_ago,
                "creationDate": creation_date.strftime("%Y-%m-%d")
            })
            
        results.sort(key=lambda x: x["daysAgo"], reverse=True)
        return results
    except Exception as e:
        print("Error fetching slow moving items:", e)
        raise HTTPException(status_code=500, detail=str(e))


# --- PALLET APPROVAL SYSTEM ---
import os
import json
import uuid
from datetime import datetime

APPROVALS_FILE = os.path.join(os.path.dirname(__file__), "approvals.json")

def read_approvals():
    if os.path.exists(APPROVALS_FILE):
        try:
            with open(APPROVALS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {"requests": []}
    return {"requests": []}

def write_approvals(data):
    with open(APPROVALS_FILE, "w") as f:
        json.dump(data, f, indent=4)

class ApprovalRequest(BaseModel):
    pallet_id: str
    type: str # "Damaged" or "Expired"
    requested_by: str = "Mobile User"

@router.post("/wms/approval-requests")
def create_approval_request(req: ApprovalRequest):
    data = read_approvals()
    
    new_req = {
        "id": str(uuid.uuid4()),
        "pallet_id": req.pallet_id,
        "type": req.type,
        "status": "Pending",
        "requested_by": req.requested_by,
        "timestamp": datetime.now().isoformat()
    }
    
    data["requests"].append(new_req)
    write_approvals(data)
    
    return {"success": True, "request": new_req}

@router.get("/wms/approval-requests")
def get_approval_requests():
    return read_approvals()

class ApprovalResolution(BaseModel):
    status: str # "Approved" or "Rejected"

@router.put("/wms/approval-requests/{request_id}")
def resolve_approval_request(request_id: str, resolution: ApprovalResolution):
    if resolution.status not in ["Approved", "Rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    data = read_approvals()
    for req in data.get("requests", []):
        if req["id"] == request_id:
            req["status"] = resolution.status
            req["resolved_at"] = datetime.now().isoformat()
            write_approvals(data)
            return {"success": True, "request": req}
            
    raise HTTPException(status_code=404, detail="Request not found")

# --- NATIVE PALLET RESERVATION SYSTEM ---

@router.get("/wms/pallets/all")
def get_all_pallets():
    """Get all active pallets (Warehouses with pallet in name and custom_is_reserved=0)"""
    try:
        url = f"{ERP_URL}/api/resource/Warehouse?fields=[\"name\",\"warehouse_name\",\"custom_is_reserved\"]&limit_page_length=0"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        data = response.json().get("data", [])
        
        pallets = []
        for w in data:
            if w.get("custom_is_reserved") == 1:
                continue
            if "pallet" in w.get("warehouse_name", "").lower() or "pallet" in w.get("name", "").lower():
                pallets.append(w)
        return {"success": True, "pallets": pallets}
    except Exception as e:
        print("Error fetching all pallets:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/reserved-pallets")
def get_reserved_pallets_with_stock():
    """Get all reserved pallets and their current stock quantities."""
    try:
        # Fetch reserved pallets directly from ERPNext
        url = f"{ERP_URL}/api/resource/Warehouse?fields=[\"name\",\"custom_is_reserved\"]&filters=[[\"custom_is_reserved\",\"=\",1]]&limit_page_length=0"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        data = response.json().get("data", [])
        
        reserved_list = [w["name"] for w in data]
        
        if not reserved_list:
            return {"success": True, "reserved_pallets": []}
            
        results = []
        for pallet_id in reserved_list:
            # Get stock in this pallet
            bin_url = f"{ERP_URL}/api/resource/Bin?filters=[[\"warehouse\",\"=\",\"{pallet_id}\"]]&fields=[\"item_code\",\"actual_qty\"]"
            bin_resp = requests.get(bin_url, headers=HEADERS)
            if bin_resp.status_code == 200:
                bins = bin_resp.json().get("data", [])
                
                # Filter out zero qty
                items = []
                for b in bins:
                    if b.get("actual_qty", 0) > 0:
                        # fetch item name
                        item_url = f"{ERP_URL}/api/resource/Item/{b['item_code']}"
                        item_resp = requests.get(item_url, headers=HEADERS)
                        item_name = b['item_code']
                        if item_resp.status_code == 200:
                            item_data = item_resp.json().get("data", {})
                            item_name = item_data.get("item_name", item_name)
                            
                        items.append({
                            "item_code": b["item_code"],
                            "item_name": item_name,
                            "qty": b["actual_qty"]
                        })
                
                results.append({
                    "pallet_id": pallet_id,
                    "items": items
                })
            else:
                results.append({
                    "pallet_id": pallet_id,
                    "items": []
                })
                
        return {"success": True, "reserved_pallets": results}
        
    except Exception as e:
        print("Error fetching reserved pallets:", e)
        raise HTTPException(status_code=500, detail=str(e))

class ReserveAction(BaseModel):
    pallet_id: str
    action: str # "reserve" or "unreserve"

@router.post("/wms/pallets/reserve")
def toggle_pallet_reservation(action: ReserveAction):
    if action.action not in ["reserve", "unreserve"]:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    new_status = 1 if action.action == "reserve" else 0
    
    try:
        url = f"{ERP_URL}/api/resource/Warehouse/{action.pallet_id}"
        payload = {"custom_is_reserved": new_status}
        response = requests.put(url, headers=HEADERS, json=payload)
        
        if response.status_code == 200:
            return {"success": True, "reserved_status": new_status}
        else:
            print("Failed to update ERPNext:", response.text)
            raise HTTPException(status_code=response.status_code, detail="Failed to update ERPNext")
            
    except Exception as e:
        print("Error updating reservation:", e)
        raise HTTPException(status_code=500, detail=str(e))

