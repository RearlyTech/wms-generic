import requests

payload = {
    "source_rfid": "Pallet 01 - RT",
    "destination_type": "pallet",
    "destination_id": "BIN 001 - RT"
}
try:
    r = requests.post("http://77.42.39.77:8000/wms/move", json=payload)
    print("Status:", r.status_code)
    print("Response:", r.text)
except Exception as e:
    print(e)
