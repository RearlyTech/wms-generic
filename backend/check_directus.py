import requests

url = "https://dev-directus.rearlytech.com/items/gateway_sensor_readings?limit=1"
response = requests.get(url)
print(response.status_code, response.text)
