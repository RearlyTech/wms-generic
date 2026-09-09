from fastapi import APIRouter, HTTPException, status, Header
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import requests
import json
import datetime
from common import *
import fastapi

router = APIRouter(tags=["Mobile"])

@router.post("/wms/receive")
def api_wms_receive(data: WmsReceiveSchema):
    try:
        item_code = resolve_item_from_rfid(data.item_rfid)
        source_wh = get_item_source_warehouse(item_code)
        target_pallet = resolve_warehouse_from_rfid(data.pallet_id)
        se = perform_stock_transfer(item_code, 1.0, source_wh, target_pallet)
        
        # Log activity in ERPNext
        try:
            log_wms_activity(
                activity_type="Location Move",
                operator="System",
                target_location=target_pallet,
                old_tag=data.item_rfid,
                details=f"Received item {item_code} and assigned to Pallet {data.pallet_id}"
            )
        except Exception:
            pass
            
        return {"message": "Success", "stock_entry": se["name"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/empty-bins")
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/resolve-warehouse")
def api_resolve_warehouse(rfid: str):
    try:
        resolved = resolve_warehouse_from_rfid(rfid)
        return {"warehouse": resolved}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/first-empty-bin")
def api_get_first_empty_bin():
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        empty_bins = api_get_empty_bins()
        if empty_bins:
            return {"empty_bin": empty_bins[0]}
        return {"empty_bin": f"BIN 001 - {company_abbr}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/put-away")
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/mobile-tasks")
def api_get_mobile_tasks():
    try:
        r = requests.get(
            f'{ERP_URL}/api/resource/WMS Task',
            headers=HEADERS,
            params={
                "fields": '["name", "task_type", "status", "source_pallet", "target_pallet", "notes", "creation"]',
                "filters": json.dumps([["status", "=", "Pending"]]),
                "order_by": "creation asc",
                "limit_page_length": 100
            }
        )
        if r.status_code == 200:
            return r.json().get("data", [])
        return []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/wms/tasks/{task_id}/complete")
def api_complete_wms_task(task_id: str):
    try:
        payload = {"status": "Completed"}
        return erp_put("WMS Task", task_id, payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/retrieve")
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/bin-pallet-lookup")
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/move")
def api_wms_move(data: WmsMoveSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        pallet_name = resolve_warehouse_from_rfid(data.source_rfid)
        target_bin = resolve_warehouse_from_rfid(data.destination_id)
        
        old_parent_full = "None"
        try:
            r_wh = requests.get(f"{ERP_URL}/api/resource/Warehouse/{pallet_name}", headers=HEADERS)
            if r_wh.status_code == 200:
                old_parent_full = r_wh.json().get("data", {}).get("parent_warehouse") or "None"
        except Exception:
            pass

        if data.expected_source and old_parent_full != data.expected_source:
            raise HTTPException(status_code=400, detail=f"Scanned source bin '{old_parent_full}' does not match expected '{data.expected_source}'")
            
        if data.expected_target and target_bin != data.expected_target:
            raise HTTPException(status_code=400, detail=f"Scanned target bin '{target_bin}' does not match expected '{data.expected_target}'")
        
        old_parent = old_parent_full.replace(f" - {company_abbr}", "") if old_parent_full != "None" else "None"
            
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
    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/repack")
def api_wms_repack(data: WmsRepackSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        
        src_wh = resolve_warehouse_from_rfid(data.item_rfid)
        if not exists("Warehouse", src_wh):
            raise HTTPException(status_code=400, detail="Source pallet/bin not found.")
            
        # Find the item in the source pallet
        r = requests.get(
            f"{ERP_URL}/api/resource/Bin",
            headers=HEADERS,
            params={"filters": json.dumps([["warehouse", "=", src_wh], ["actual_qty", ">", 0]]), "fields": '["item_code", "actual_qty"]'}
        )
        if r.status_code != 200 or not r.json().get("data"):
            raise HTTPException(status_code=400, detail="Source pallet is empty.")
            
        items_in_wh = r.json().get("data", [])
        item_code = items_in_wh[0]["item_code"]
        actual_qty = float(items_in_wh[0].get("actual_qty", 0.0))
        
        if data.repack_qty > actual_qty:
            raise HTTPException(status_code=400, detail=f"Cannot repack {data.repack_qty}. Only {actual_qty} available in source pallet.")
            
        # 1. Perform Material Issue for the quantity taken out
        payload = {
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Issue",
            "purpose": "Material Issue",
            "company": company,
            "items": [
                {
                    "item_code": item_code,
                    "qty": data.repack_qty,
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
        
        # 2. Update RFID tag mapping on the existing warehouse
        if data.new_rfid and data.new_rfid.strip():
            new_tag = data.new_rfid.strip()
            payload_wh = {
                "custom_bin_rfid": new_tag,
                "bin_rfid": new_tag,
                "custom_rfid": new_tag
            }
            erp_put("Warehouse", src_wh, payload_wh)
        
        # 3. Log activity in ERPNext as Manual Exception as requested
        try:
            log_wms_activity(
                activity_type="Manual Exception",
                operator="System",
                target_location=src_wh,
                old_tag=data.item_rfid,
                new_tag=data.new_rfid,
                details=f"Repacked {data.repack_qty} of {item_code} from {src_wh}. RFID updated."
            )
        except Exception:
            pass
                    
        return {"message": "Success", "stock_entry": se["name"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/merge")
def api_wms_merge(data: WmsMergeSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        src_wh = resolve_warehouse_from_rfid(data.pallet_a)
        dest_wh = resolve_warehouse_from_rfid(data.pallet_b)
        
        if data.expected_source and src_wh != data.expected_source:
            raise HTTPException(status_code=400, detail=f"Scanned source '{src_wh}' does not match expected '{data.expected_source}'")
            
        if data.expected_target and dest_wh != data.expected_target:
            raise HTTPException(status_code=400, detail=f"Scanned target '{dest_wh}' does not match expected '{data.expected_target}'")
        
        # Determine quantity from source warehouse
        actual_qty = 1.0
        try:
            r = requests.get(
                f"{ERP_URL}/api/resource/Bin",
                headers=HEADERS,
                params={"filters": json.dumps([["warehouse", "=", src_wh], ["item_code", "=", data.item_code]]), "fields": '["actual_qty"]'}
            )
            if r.status_code == 200:
                bin_data = r.json().get("data", [])
                if bin_data:
                    actual_qty = float(bin_data[0].get("actual_qty", 1.0))
        except Exception:
            pass
        
        se = perform_stock_transfer(data.item_code, actual_qty, src_wh, dest_wh)
        
        # Log activity in ERPNext
        try:
            log_wms_activity(
                activity_type="Location Move",
                operator="System",
                target_location=dest_wh,
                old_tag=data.pallet_a,
                new_tag=data.pallet_b,
                details=f"Merged: Transferred all {actual_qty} of {data.item_code} from Pallet {src_wh} to Pallet {dest_wh}"
            )
        except Exception:
            pass
            
        return {"message": "Success", "stock_entry": se["name"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/find")
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/exception")
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

@router.get("/wms/validate-dispatch")
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
        
        # Verify pallet is marked for dispatch
        wh_dispatch_marked = requests.get(
            f"{ERP_URL}/api/resource/Warehouse",
            headers=HEADERS,
            params={"filters": json.dumps([["name", "=", warehouse_tag], ["custom_marked_for_dispatch", "=", 1]]), "fields": '["name"]'}
        )
        
        is_batch_marked = dispatch_marked.status_code == 200 and dispatch_marked.json().get("data")
        is_wh_marked = wh_dispatch_marked.status_code == 200 and wh_dispatch_marked.json().get("data")
        
        if not is_batch_marked and not is_wh_marked:
             return {"valid": False}
             
        return {"valid": True}
    except Exception:
        return {"valid": False}


@router.get("/wms/marked-for-dispatch")
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
        # Fetch warehouses marked for dispatch
        r_wh = requests.get(
            f"{ERP_URL}/api/resource/Warehouse",
            headers=HEADERS,
            params={
                "filters": json.dumps([["custom_marked_for_dispatch", "=", 1]]),
                "fields": '["name", "warehouse_name"]',
                "limit_page_length": 500
            }
        )
        if r_wh.status_code == 200:
            warehouses = r_wh.json().get("data", [])
            for w in warehouses:
                result.append({
                    "is_pallet": True,
                    "pallet_id": w["name"],
                    "batch_number": "PALLET DISPATCH",
                    "item_code": w.get("warehouse_name", w["name"]),
                    "item_name": w.get("warehouse_name", w["name"]),
                    "batch_qty": 0,
                    "expiry_date": "",
                    "locations": [{"warehouse": w["name"], "actual_qty": "All Items"}]
                })
                
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/dispatch")
def api_wms_dispatch(data: WmsDispatchSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        warehouse_tag = resolve_warehouse_from_rfid(data.pallet_rfid)
        if not exists("Warehouse", warehouse_tag):
            raise HTTPException(status_code=400, detail="Invalid Location/Bin RFID. Please scan a valid bin/pallet tag first.")
            
        if data.expected_location and warehouse_tag != data.expected_location:
            raise HTTPException(status_code=400, detail=f"Scanned location '{warehouse_tag}' does not match the expected task location '{data.expected_location}'.")
            
        # Item RFID check removed for pallet-level dispatch.
        
        # Verify that there is stock in the specified warehouse
        r_bin = requests.get(
            f"{ERP_URL}/api/resource/Bin",
            headers=HEADERS,
            params={
                "filters": json.dumps([["warehouse", "=", warehouse_tag], ["actual_qty", ">", 0]]),
                "fields": '["item_code", "actual_qty"]',
                "limit_page_length": 1000
            }
        )
        
        if r_bin.status_code != 200 or not r_bin.json().get("data"):
            raise HTTPException(status_code=400, detail=f"No items found in location {warehouse_tag} with quantity > 0.")
            
        bins = r_bin.json().get("data")
        
        # Check if the pallet is marked for dispatch
        wh_dispatch_marked = requests.get(
            f"{ERP_URL}/api/resource/Warehouse",
            headers=HEADERS,
            params={"filters": json.dumps([["name", "=", warehouse_tag], ["custom_marked_for_dispatch", "=", 1]]), "fields": '["name"]'}
        )
        
        is_wh_marked = wh_dispatch_marked.status_code == 200 and wh_dispatch_marked.json().get("data")
        
        items_to_issue = []
        for b in bins:
            items_to_issue.append({
                "item_code": b["item_code"],
                "qty": float(b.get("actual_qty", 1.0)),
                "s_warehouse": warehouse_tag
            })
            
        # If it was a pallet dispatch, unmark the pallet
        if is_wh_marked:
            try:
                erp_put("Warehouse", warehouse_tag, {"custom_marked_for_dispatch": 0})
            except Exception:
                pass
                
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/repack-lookup")
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
                else:
                    return {
                        "item_code": "Empty",
                        "item_name": "Pallet is Empty",
                        "qty": 0.0,
                        "uom": "-"
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/split")
def api_wms_split(data: WmsSplitSchema):
    try:
        source_bin = resolve_warehouse_from_rfid(data.source_bin)
        target_bin = resolve_warehouse_from_rfid(data.target_bin)
        
        perform_stock_transfer(data.item_code, data.qty, source_bin, target_bin)
        return {"message": "Success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wms/stock-count")
def api_wms_stock_count(data: WmsStockCountSchema):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        target_warehouse = data.warehouse
        is_group = False
        if target_warehouse:
            target_warehouse = resolve_warehouse_from_rfid(target_warehouse)
            try:
                r_wh = requests.get(f"{ERP_URL}/api/resource/Warehouse/{target_warehouse}", headers=HEADERS)
                if r_wh.status_code == 200:
                    is_group = r_wh.json().get("data", {}).get("is_group", 0) == 1
            except Exception:
                pass
                
        if is_group:
            # Pallet-level reconciliation for Group Warehouses (Bins)
            expected_pallets = []
            try:
                r_children = requests.get(
                    f"{ERP_URL}/api/resource/Warehouse",
                    headers=HEADERS,
                    params={"filters": json.dumps([["parent_warehouse", "=", target_warehouse]]), "fields": '["name"]', "limit_page_length": 500}
                )
                if r_children.status_code == 200:
                    expected_pallets = [w["name"] for w in r_children.json().get("data", [])]
            except Exception:
                pass
                
            scanned_pallets = set()
            for tag in data.scanned_tags:
                try:
                    wh = resolve_warehouse_from_rfid(tag)
                    if exists("Warehouse", wh):
                        # Check if it's a Pallet (is_group == 0) and not a Bin (is_group == 1)
                        r_chk = requests.get(f"{ERP_URL}/api/resource/Warehouse/{wh}", headers=HEADERS)
                        if r_chk.status_code == 200:
                            if not (r_chk.json().get("data", {}).get("is_group", 0) == 1):
                                scanned_pallets.add(wh)
                except Exception:
                    pass
                    
            discrepancies = []
            matched = []
            
            for ep in expected_pallets:
                if ep in scanned_pallets:
                    matched.append(ep.replace(f' - {company_abbr}', ''))
                else:
                    discrepancies.append(f"{ep.replace(f' - {company_abbr}', '')} (Missing)")
                    
            for sp in scanned_pallets:
                if sp not in expected_pallets and sp and sp != target_warehouse:
                    discrepancies.append(f"{sp.replace(f' - {company_abbr}', '')} (Unexpected)")
                    
            detail_msg = ""
            if matched:
                detail_msg += f"Matched: {', '.join(matched)}. "
            if discrepancies:
                detail_msg += f"Discrepancies: {', '.join(discrepancies)}"
            else:
                detail_msg += "All pallets matched successfully."
                    
            try:
                if discrepancies:
                    log_wms_activity(
                        activity_type="Stock Discrepancy",
                        operator="System",
                        target_location=target_warehouse,
                        details=detail_msg.strip()
                    )
                else:
                    log_wms_activity(
                        activity_type="Stock Count",
                        operator="System",
                        target_location=target_warehouse,
                        details=detail_msg.strip()
                    )
            except Exception as e:
                print(f"Failed to log pallet discrepancy: {e}")
                
            return {"message": "Success", "details": "Pallet count logged"}
            
        items_payload = []
        
        if target_warehouse:
            target_warehouses = [target_warehouse]
            try:
                r_children = requests.get(
                    f"{ERP_URL}/api/resource/Warehouse",
                    headers=HEADERS,
                    params={"filters": json.dumps([["parent_warehouse", "=", target_warehouse]]), "fields": '["name"]', "limit_page_length": 100}
                )
                if r_children.status_code == 200:
                    for w in r_children.json().get("data", []):
                        target_warehouses.append(w["name"])
            except Exception:
                pass

            # 1. Fetch expected items in this warehouse (supporting Serial Number and Bin structures)
            expected_items = []
            
            # Serial No lookup
            try:
                sn_url = f"{ERP_URL}/api/resource/Serial No"
                sn_params = {
                    "fields": '["name", "item_code", "item_name", "custom_rfid_tag"]',
                    "filters": json.dumps([["warehouse", "in", target_warehouses], ["status", "=", "Active"]]),
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
                        "filters": json.dumps([["warehouse", "in", target_warehouses], ["actual_qty", ">", 0]]),
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
            reconciled_counts = {}
            item_uom_map = {}
            item_rate_map = {}
            for tag in data.scanned_tags:
                code = resolve_item_from_rfid(tag)
                if code:
                    reconciled_counts[code] = reconciled_counts.get(code, 0.0) + 1.0
                    
            # Also include expected items that were NOT scanned (qty = 0)
            for item in expected_items:
                code = item["item_code"]
                item_uom_map[code] = item["uom"]
                item_rate_map[code] = item["val_rate"]
                if code not in reconciled_counts:
                    reconciled_counts[code] = 0.0
                    
            # Ensure we have UOM and Rate for unexpected scanned items
            for code in reconciled_counts.keys():
                if code not in item_uom_map:
                    try:
                        r_item = requests.get(f"{ERP_URL}/api/resource/Item/{code}", headers=HEADERS)
                        if r_item.status_code == 200:
                            item_data = r_item.json().get("data", {})
                            item_uom_map[code] = item_data.get("stock_uom") or "Nos"
                            item_rate_map[code] = item_data.get("valuation_rate") or item_data.get("standard_rate") or 1.0
                    except Exception:
                        item_uom_map[code] = "Nos"
                        item_rate_map[code] = 1.0
                    
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
            
        # Log activity in ERPNext FIRST
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
                        activity_type="Stock Count",
                        operator="System",
                        target_location=target_warehouse,
                        details="Stock Count completed. All items matched successfully."
                    )
        except Exception:
            pass

        payload = {
            "doctype": "Stock Reconciliation",
            "company": company,
            "purpose": "Stock Reconciliation",
            "items": items_payload
        }
        
        try:
            sr = erp_post("Stock Reconciliation", payload)
            submit_doc("Stock Reconciliation", sr["name"])
            return {"message": "Success", "stock_reconciliation": sr["name"]}
        except Exception as e:
            print(f"Warning: Stock Reconciliation failed (possibly group warehouse): {e}")
            return {"message": "Activity logged, but Stock Reconciliation failed", "error": str(e)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wms/resolve-tag-info")
def api_wms_resolve_tag_info(rfid: str):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)
        
        # 1. Try to resolve as a warehouse
        wh_name = resolve_warehouse_from_rfid(rfid)
        if exists("Warehouse", wh_name):
            r_wh = requests.get(f"{ERP_URL}/api/resource/Warehouse/{wh_name}", headers=HEADERS)
            parent = "None"
            is_reserved = False
            if r_wh.status_code == 200:
                data = r_wh.json().get("data", {})
                parent = data.get("parent_warehouse") or "None"
                is_reserved = data.get("custom_is_reserved") == 1
            return {
                "rfid": rfid,
                "type": "Warehouse",
                "name": wh_name.replace(f" - {company_abbr}", ""),
                "location": parent,
                "is_reserved": is_reserved
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
