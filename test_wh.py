import requests
import json
from backend.web_routes import ERP_URL, HEADERS

url = f"{ERP_URL}/api/resource/Warehouse?fields=[\"name\",\"warehouse_name\",\"is_group\"]&limit_page_length=0"
res = requests.get(url, headers=HEADERS)
data = res.json().get("data", [])
for w in data:
    if "marine" in w.get("name", "").lower() or "marine" in w.get("warehouse_name", "").lower():
        print(w)
