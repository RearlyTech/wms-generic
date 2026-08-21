import requests
import json

from main_dynamic import ERP_URL, HEADERS

try:
    r = requests.get(f"{ERP_URL}/api/resource/Batch?limit_page_length=1", headers=HEADERS)
    if r.status_code == 200:
        data = r.json().get("data", [])
        if data:
            batch_name = data[0]["name"]
            r2 = requests.get(f"{ERP_URL}/api/resource/Batch/{batch_name}", headers=HEADERS)
            if r2.status_code == 200:
                batch_data = r2.json().get("data", {})
                fields = [k for k in batch_data.keys()]
                print("Batch Fields:", fields)
            else:
                print("Failed to get batch details")
except Exception as e:
    print(e)
