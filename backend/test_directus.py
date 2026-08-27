import requests
import json

url = "https://dev-directus.rearlytech.com/items/gateway_sensor_readings?limit=5&sort=-created_at"
response = requests.get(url)
if response.status_code == 200:
    data = response.json().get("data", [])
    for item in data:
        print(f"ID: {item.get('id')} | Sensor Type: {item.get('sensor_type')}")
        values = item.get("values", {})
        if values:
            print("Values keys:", list(values.keys()))
else:
    print("Failed to fetch:", response.status_code, response.text)
