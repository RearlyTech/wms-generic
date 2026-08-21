import requests
url = "http://127.0.0.1:8000/warehouses"
try:
    # Just checking what fields are available from an existing endpoint
    # that gets warehouses, maybe it includes our field.
    r = requests.get(url)
    print("Warehouses endpoint works.")
except Exception as e:
    print(e)
