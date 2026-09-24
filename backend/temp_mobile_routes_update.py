import requests
import json
from common import resolve_latest_doc, get_company_abbr, resolve_batch_from_rfid, resolve_warehouse_from_rfid, exists, HEADERS, ERP_URL
from fastapi import APIRouter, HTTPException

def get_location_details(rfid: str):
    try:
        company = resolve_latest_doc("Company") or "Rearly Tech"
        company_abbr = get_company_abbr(company)

        pallet = "N/A"
        bin_val = "N/A"
        row = "N/A"
        rack = "N/A"
        warehouse_val = "N/A"
        item_name = "N/A"
        weight_str = "0"

        batch = resolve_batch_from_rfid(rfid)
        current_location = None

        if batch:
            item_code = batch.get("item")
            item_name = item_code
            try:
                r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
                if r_item.status_code == 200:
                    item_name = r_item.json().get("data", {}).get("item_name") or item_code
            except Exception:
                pass
            
            try:
                r_bin = requests.get(
                    f"{ERP_URL}/api/resource/Bin",
                    headers=HEADERS,
                    params={"filters": json.dumps([["item_code", "=", item_code], ["actual_qty", ">", 0]]), "fields": '["warehouse", "actual_qty"]'}
                )
                if r_bin.status_code == 200:
                    bins = r_bin.json().get("data", [])
                    if bins:
                        current_location = bins[0]["warehouse"]
                        weight_str = str(bins[0]["actual_qty"])
            except Exception:
                pass
        else:
            wh_resolved = resolve_warehouse_from_rfid(rfid)
            if exists("Warehouse", wh_resolved):
                current_location = wh_resolved
            
        if current_location:
            chain = []
            curr = current_location
            while curr:
                chain.append(curr)
                try:
                    r_wh = requests.get(f"{ERP_URL}/api/resource/Warehouse/{curr}", headers=HEADERS)
                    if r_wh.status_code == 200:
                        curr = r_wh.json().get("data", {}).get("parent_warehouse")
                    else:
                        break
                except Exception:
                    break

            for loc in chain:
                loc_clean = loc.replace(f" - {company_abbr}", "")
                loc_lower = loc_clean.lower()
                if "pallet" in loc_lower:
                    pallet = loc_clean
                elif "bin" in loc_lower:
                    bin_val = loc_clean
                elif "rack" in loc_lower:
                    rack = loc_clean
                elif "row" in loc_lower:
                    row = loc_clean
                else:
                    if warehouse_val == "N/A" and loc != current_location:
                        warehouse_val = loc_clean

            if not batch and current_location:
                try:
                    r_bin = requests.get(
                        f"{ERP_URL}/api/resource/Bin",
                        headers=HEADERS,
                        params={"filters": json.dumps([["warehouse", "=", current_location], ["actual_qty", ">", 0]]), "fields": '["item_code", "actual_qty"]'}
                    )
                    if r_bin.status_code == 200:
                        bins = r_bin.json().get("data", [])
                        if bins:
                            item_code = bins[0]["item_code"]
                            qty = float(bins[0]["actual_qty"])
                            uom = "Nos"
                            name_val = item_code
                            
                            try:
                                r_item = requests.get(f"{ERP_URL}/api/resource/Item/{item_code}", headers=HEADERS)
                                if r_item.status_code == 200:
                                    item_data = r_item.json().get("data", {})
                                    name_val = item_data.get("item_name") or item_code
                                    uom = item_data.get("stock_uom") or "Nos"
                            except Exception:
                                pass
                                
                            item_name = name_val
                            weight_str = f"{qty} {uom}"
                except Exception:
                    pass

        return {
            "pallet": pallet,
            "bin": bin_val,
            "row": row,
            "rack": rack,
            "warehouse": warehouse_val,
            "item": item_name,
            "weight": weight_str
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
