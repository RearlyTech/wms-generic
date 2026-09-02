import requests
import json
import time

ERP_URL = "http://77.42.39.77:8080"

API_KEY = "fe91c1c285be2e8"
API_SECRET = "5c74a42513ab096"

HEADERS = {
    "Authorization": f"token {API_KEY}:{API_SECRET}",
    "Content-Type": "application/json"
}
# Try loading from common.py for consistency
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
# from common import ERP_URL, HEADERS

def get_submitted_docs(doctype):
    print(f"Fetching submitted {doctype}s...")
    docs = []
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/{doctype}",
            headers=HEADERS,
            params={
                "filters": json.dumps([["docstatus", "=", 1]]),
                "limit_page_length": 1000,
                "order_by": "creation asc"
            }
        )
        if r.status_code == 200:
            data = r.json().get("data", [])
            docs = [d["name"] for d in data]
            print(f"Found {len(docs)} submitted {doctype}(s).")
        else:
            print(f"Error fetching {doctype}: {r.text}")
    except Exception as e:
        print(f"Exception fetching {doctype}: {e}")
    return docs

def get_all_docs(doctype):
    print(f"Fetching all {doctype}s...")
    docs = []
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/{doctype}",
            headers=HEADERS,
            params={
                "limit_page_length": 1000
            }
        )
        if r.status_code == 200:
            data = r.json().get("data", [])
            docs = [d["name"] for d in data]
            print(f"Found {len(docs)} {doctype}(s).")
        else:
            print(f"Error fetching {doctype}: {r.text}")
    except Exception as e:
        print(f"Exception fetching {doctype}: {e}")
    return docs

def cancel_doc(doctype, name):
    print(f"Cancelling {doctype} {name}...")
    try:
        payload = {"doctype": doctype, "name": name}
        # Check if this doc is related to 'marine' before cancelling
        doc_details = requests.get(f"{ERP_URL}/api/resource/{doctype}/{name}", headers=HEADERS).json().get("data", {})
        is_marine = False
        
        if doctype == "Stock Entry":
            for item in doc_details.get("items", []):
                s_wh = (item.get("s_warehouse") or "").lower()
                t_wh = (item.get("t_warehouse") or "").lower()
                item_code = (item.get("item_code") or "").lower()
                
                # Protect initial stock additions to Stores
                if "stores" in t_wh and not s_wh:
                    is_marine = False
                    break

                if "marine" in s_wh or "marine" in t_wh or "marine" in item_code:
                    is_marine = True
        elif doctype == "Stock Reconciliation":
            for item in doc_details.get("items", []):
                wh = (item.get("warehouse") or "").lower()
                item_code = (item.get("item_code") or "").lower()
                
                # Protect initial stock setting in Stores
                if "stores" in wh:
                    is_marine = False
                    break
                    
                if "marine" in wh or "marine" in item_code:
                    is_marine = True
                    
        if not is_marine:
            print(f"Skipping {doctype} {name} (Not related to marine)")
            return

        r = requests.post(f"{ERP_URL}/api/method/frappe.client.cancel", headers=HEADERS, json=payload)
        if r.status_code == 200:
            print(f"Successfully cancelled {name}")
        else:
            print(f"Failed to cancel {name}: {r.text}")
    except Exception as e:
        print(f"Exception cancelling {name}: {e}")

def delete_doc(doctype, name):
    print(f"Deleting {doctype} {name}...")
    try:
        # Check if this doc is related to 'marine' before deleting
        doc_details = requests.get(f"{ERP_URL}/api/resource/{doctype}/{name}", headers=HEADERS).json().get("data", {})
        is_marine = False
        
        if doctype == "WMS Task":
            src = (doc_details.get("source_pallet") or "").lower()
            tgt = (doc_details.get("target_pallet") or "").lower()
            notes = (doc_details.get("notes") or "").lower()
            if "marine" in src or "marine" in tgt or "marine" in notes:
                is_marine = True
        elif doctype == "WMS Activity Log":
            tgt = (doc_details.get("target_location") or "").lower()
            details = (doc_details.get("details") or "").lower()
            if "marine" in tgt or "marine" in details:
                is_marine = True
                
            old_tag = doc_details.get("old_tag")
            new_tag = doc_details.get("new_tag")
            target_loc = doc_details.get("target_location")
            if old_tag and new_tag and old_tag != new_tag and target_loc:
                print(f"Reverting RFID for {target_loc} back to {old_tag}...")
                payload_wh = {
                    "custom_bin_rfid": old_tag,
                    "bin_rfid": old_tag,
                    "custom_rfid": old_tag
                }
                requests.put(f"{ERP_URL}/api/resource/Warehouse/{target_loc}", headers=HEADERS, json=payload_wh)
                
        if not is_marine:
            print(f"Skipping {doctype} {name} (Not related to marine)")
            return

        r = requests.delete(f"{ERP_URL}/api/resource/{doctype}/{name}", headers=HEADERS)
        if r.status_code == 202 or r.status_code == 200:
            print(f"Successfully deleted {name}")
        else:
            print(f"Failed to delete {name}: {r.text}")
    except Exception as e:
        print(f"Exception deleting {name}: {e}")

def reset_pallets():
    print("Fetching and resetting all Pallet configurations...")
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/Warehouse",
            headers=HEADERS,
            params={"limit_page_length": 1000}
        )
        if r.status_code == 200:
            warehouses = r.json().get("data", [])
            for w in warehouses:
                name = w["name"]
                if "pallet" in name.lower() and "marine" in name.lower():
                    # Reset the pallet to the root and clear flags
                    print(f"Resetting Pallet: {name}")
                    payload = {
                        "parent_warehouse": "All Warehouses - V",
                        "disabled": 0,
                        "custom_exception": 0,
                        "custom_marked_for_dispatch": 0,
                        "custom_dispatch_success": 0
                    }
                    requests.put(f"{ERP_URL}/api/resource/Warehouse/{name}", headers=HEADERS, json=payload)
    except Exception as e:
        print(f"Exception resetting pallets: {e}")

def reset_erp():
    print("=== STARTING ERP RESET ===")
    
    # 1. Cancel all Stock Entries (Material Transfer, Issue, etc. from Move/Putaway/Assign/Dispatch)
    stock_entries = get_submitted_docs("Stock Entry")
    # Cancel them in reverse order (LIFO) to avoid dependencies issues
    for se in reversed(stock_entries):
        cancel_doc("Stock Entry", se)
        time.sleep(0.1)
        
    # 2. Cancel all Stock Reconciliations (from Stock Count)
    stock_recons = get_submitted_docs("Stock Reconciliation")
    for sr in reversed(stock_recons):
        cancel_doc("Stock Reconciliation", sr)
        time.sleep(0.1)
        
    # 3. Delete all WMS Tasks
    wms_tasks = get_all_docs("WMS Task")
    for task in wms_tasks:
        delete_doc("WMS Task", task)
        time.sleep(0.1)
        
    # 4. Delete all WMS Activity Logs
    wms_logs = get_all_docs("WMS Activity Log")
    for log in wms_logs:
        delete_doc("WMS Activity Log", log)
        time.sleep(0.1)
        
    # 5. Reset Pallet properties (move back to all warehouse, clear flags)
    reset_pallets()

    print("=== ERP RESET COMPLETE ===")
    print("All stock should now be returned to its original state, and tasks/logs are cleared.")

if __name__ == "__main__":
    confirm = input("WARNING: This will cancel ALL submitted Stock Entries and Stock Reconciliations in ERPNext, and delete all WMS Tasks/Logs. Are you sure you want to proceed? (y/n): ")
    if confirm.lower() == 'y':
        reset_erp()
    else:
        print("Reset aborted.")
