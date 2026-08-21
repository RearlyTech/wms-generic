import requests
import json
url = "http://127.0.0.1:8000/batches"
try:
    r = requests.get(url)
    print("Batches:", r.json()[:2])
except Exception as e:
    print(e)

