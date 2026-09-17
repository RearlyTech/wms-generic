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

def create_single_batch(rfid):
    payload = {
        "doctype": "Batch",
        "item": "SHRIMP-RAW",
        "batch_id": rfid,
        "custom_rfid": rfid,
        "rfid_tag": rfid,
        "rfid": rfid
    }
    try:
        r = requests.post(f"{ERP_URL}/api/resource/Batch", headers=HEADERS, json=payload)
        if r.status_code in [200, 201]:
            print(f"SUCCESS: Batch {rfid} created.")
            return True
        elif r.status_code == 409 or "Duplicate" in r.text:
            print(f"SKIPPED: Batch {rfid} already exists.")
            return True
        else:
            print(f"FAILED: Could not create {rfid}. Response: {r.text}")
            return False
    except Exception as e:
        print(f"EXCEPTION while creating {rfid}: {e}")
        return False

def create_shrimp_batches():
    print("Starting FAST batch creation for SHRIMP-RAW...")
    
    # Generate the 100 exact RFID tags specified
    rfid_tags = [f"525400000000000001900{i:03d}" for i in range(1, 101)]
    
    success_count = 0
    fail_count = 0
    
    # Use ThreadPoolExecutor to run requests in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(create_single_batch, rfid_tags)
        
    for res in results:
        if res:
            success_count += 1
        else:
            fail_count += 1
            
    print(f"\n=== BATCH CREATION COMPLETE ===")
    print(f"Successfully processed: {success_count}")
    print(f"Failed: {fail_count}")

if __name__ == "__main__":
    confirm = input("This will concurrently create 100 new Batches for SHRIMP-RAW. Proceed? (y/n): ")
    if confirm.lower() == 'y':
        create_shrimp_batches()
    else:
        print("Aborted.")
