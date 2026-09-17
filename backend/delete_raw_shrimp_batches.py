import requests
import json
import time
import os
import sys
import concurrent.futures

# Try loading from common.py for consistency
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

ERP_URL = "http://77.42.39.77:8080"
API_KEY = "fe91c1c285be2e8"
API_SECRET = "5c74a42513ab096"

HEADERS = {
    "Authorization": f"token {API_KEY}:{API_SECRET}",
    "Content-Type": "application/json"
}

def get_all_stock_entries():
    docs = []
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/Stock Entry",
            headers=HEADERS,
            params={
                "limit_page_length": 1000,
                "order_by": "creation asc"
            },
            timeout=120
        )
        if r.status_code == 200:
            data = r.json().get("data", [])
            docs = [d["name"] for d in data]
    except Exception as e:
        print(f"Error fetching Stock Entries: {e}")
    return docs

def check_stock_entry_has_item(se, item_code):
    try:
        doc_details = requests.get(f"{ERP_URL}/api/resource/Stock Entry/{se}", headers=HEADERS, timeout=60).json().get("data", {})
        for item in doc_details.get("items", []):
            if item.get("item_code") == item_code:
                return (se, doc_details.get("docstatus", 0))
    except Exception:
        pass
    return None

def clean_up_serial_batch_bundles(item_code):
    print("\n--- STEP 1.5: Cleaning up Serial and Batch Bundles ---")
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/Serial and Batch Bundle",
            headers=HEADERS,
            params={
                "filters": json.dumps([["item_code", "=", item_code]]),
                "limit_page_length": 1000
            },
            timeout=30
        )
        if r.status_code == 200:
            bundles = r.json().get("data", [])
            print(f"Found {len(bundles)} Bundle(s) to delete.")
            for b in bundles:
                name = b["name"]
                try:
                    # Fetch details to check docstatus
                    b_details_r = requests.get(f"{ERP_URL}/api/resource/Serial and Batch Bundle/{name}", headers=HEADERS, timeout=60)
                    if b_details_r.status_code == 200:
                        docstatus = b_details_r.json().get("data", {}).get("docstatus", 0)
                        if docstatus == 1:
                            payload = {"doctype": "Serial and Batch Bundle", "name": name}
                            requests.post(f"{ERP_URL}/api/method/frappe.client.cancel", headers=HEADERS, json=payload, timeout=120)
                    
                    del_r = requests.delete(f"{ERP_URL}/api/resource/Serial and Batch Bundle/{name}", headers=HEADERS, timeout=120)
                    if del_r.status_code in [200, 202, 404]:
                        print(f"  -> Deleted Bundle {name}")
                    else:
                        print(f"  -> Failed to delete Bundle {name}: {del_r.text}")
                except Exception as e:
                    print(f"  -> Exception while cleaning Bundle {name}: {e}")
    except Exception as e:
        print(f"Error cleaning bundles: {e}")

def delete_single_batch(batch_id):
    try:
        del_r = requests.delete(f"{ERP_URL}/api/resource/Batch/{batch_id}", headers=HEADERS, timeout=60)
        return batch_id, del_r.status_code in [200, 202, 404], del_r.text
    except Exception as e:
        return batch_id, False, str(e)

def reset_and_delete_batches(item_code):
    print(f"\nStarting FAST reset and deletion for {item_code}...")
    
    # 1. Cancel and Delete Stock Entries related to this item to clear the warehouse
    print("\n--- STEP 1: Cancelling & Deleting Stock Entries ---")
    print("Fetching ALL Stock Entries (including cancelled ones)...")
    stock_entries = get_all_stock_entries()
    
    found_entries = {}
    total_entries = len(stock_entries)
    print(f"Found {total_entries} Stock Entries total.")
    print("Scanning them concurrently to find which ones contain our shrimp (Please wait)...")
    
    checked = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(check_stock_entry_has_item, se, item_code): se for se in stock_entries}
        for future in concurrent.futures.as_completed(futures):
            checked += 1
            if checked % 10 == 0 or checked == total_entries:
                print(f"  ... Scanned {checked}/{total_entries} entries ...", flush=True)
                
            res = future.result()
            if res:
                se_name, se_status = res
                found_entries[se_name] = se_status
                
    # We MUST process them sequentially in reverse chronological order (LIFO)
    entries_to_process = [(se, found_entries[se]) for se in reversed(stock_entries) if se in found_entries]
    
    print(f"\nFound {len(entries_to_process)} entries to cancel and delete.")
    for se, docstatus in entries_to_process:
        try:
            print(f"Processing Stock Entry {se} (docstatus: {docstatus})...")
            
            # If it's submitted, we must cancel it first
            if docstatus == 1:
                payload = {"doctype": "Stock Entry", "name": se}
                r = requests.post(f"{ERP_URL}/api/method/frappe.client.cancel", headers=HEADERS, json=payload, timeout=120)
                if r.status_code in [200, 409]:
                    print(f"  -> Successfully cancelled {se}")
                else:
                    print(f"  -> Failed to cancel {se}: {r.text}")
                    
            # Now delete it completely so it removes the link to the Batch!
            del_r = requests.delete(f"{ERP_URL}/api/resource/Stock Entry/{se}", headers=HEADERS, timeout=120)
            if del_r.status_code in [200, 202, 404]:
                print(f"  -> Successfully deleted {se}")
            else:
                print(f"  -> Failed to delete {se}: {del_r.text}")
        except Exception as e:
            print(f"  -> Exception while processing {se}: {e}")
            
    # Clean up bundles
    clean_up_serial_batch_bundles(item_code)
            
    # 2. Now that stock is cleared and links are deleted, we can delete the batches
    print(f"\n--- STEP 2: Deleting Batches Concurrently ---")
    print("Fetching the list of batches...")
    try:
        r = requests.get(
            f"{ERP_URL}/api/resource/Batch",
            headers=HEADERS,
            params={
                "filters": json.dumps([["item", "=", item_code]]),
                "limit_page_length": 1000
            },
            timeout=30
        )
        if r.status_code == 200:
            batches = r.json().get("data", [])
            print(f"Found {len(batches)} batch(es) to delete.")
            batch_names = [b["name"] for b in batches]
            
            deleted = 0
            with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
                futures = {executor.submit(delete_single_batch, b): b for b in batch_names}
                for future in concurrent.futures.as_completed(futures):
                    deleted += 1
                    b_id, success, msg = future.result()
                    if success:
                        print(f"[{deleted}/{len(batches)}] Successfully deleted Batch {b_id}")
                    else:
                        print(f"[{deleted}/{len(batches)}] Failed to delete Batch {b_id}: {msg}")
                
    except Exception as e:
        print(f"Exception fetching batches: {e}")

if __name__ == "__main__":
    confirm = input(f"WARNING: This will cancel all Stock Entries for 'SHRIMP-RAW' and then DELETE all its batches. Proceed? (y/n): ")
    if confirm.lower() == 'y':
        reset_and_delete_batches("SHRIMP-RAW")
        print("\nAll done! You can now restart your demo cycle.")
    else:
        print("Aborted.")
