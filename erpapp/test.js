const fs = require('fs');
const item = {
      "id": "6219",
      "device_id": "cp2b",
      "site_id": "marine-grading-demo",
      "sensor_id": "door_sensor_1",
      "sensor_type": "door_uart",
      "timestamp": "2026-08-26T14:46:57.000Z",
      "temperature_c": null,
      "humidity_rh": null,
      "voltage": null,
      "frequency": null,
      "active_power": null,
      "reactive_power": null,
      "apparent_power": null,
      "power_factor": null,
      "active_energy": null,
      "reactive_energy": null,
      "raw_json": "\"{\\\"device_id\\\": \\\"cp2b\\\", \\\"machine_id\\\": \\\"cp2b\\\", \\\"site_id\\\": \\\"marine-grading-demo\\\", \\\"sensor_id\\\": \\\"door_sensor_1\\\", \\\"sensor_type\\\": \\\"door_uart\\\", \\\"timestamp\\\": \\\"2026-08-26T14:46:57.922496+00:00\\\", \\\"ok\\\": true, \\\"mqtt_connected\\\":true, \\\"values\\\": {\\\"door_status\\\": \\\"CLOSED\\\", \\\"door_open\\\": false, \\\"alarm\\\": false, \\\"amonia\\\": false, \\\"alarm_status\\\": \\\"NORMAL\\\", \\\"amonia_status\\\": \\\"NORMAL\\\"}, \\\"raw\\\": {\\\"uart_line\\\": \\\"000 | Flow : 0.83 L\\\", \\\"port\\\": \\\"/dev/ttyS3\\\"}, \\\"door_status\\\": \\\"CLOSED\\\", \\\"door_open\\\": false, \\\"alarm\\\": false, \\\"amonia\\\": false, \\\"alarm_status\\\": \\\"NORMAL\\\", \\\"amonia_status\\\": \\\"NORMAL\\\"}\"",
      "created_at": "2026-08-26T14:47:27.782Z",
      "machine_id": "cp2b",
      "temperature_register": null,
      "humidity_register": null,
      "door_status": "CLOSED",
      "door_open": false,
      "alarm_status": "NORMAL",
      "amonia_status": "NORMAL"
    };

let isAlarm = false;
let isAmonia = false;
let isDoorOpen = false;

// Check direct DB fields if they exist
if (item.alarm_status) {
  isAlarm = String(item.alarm_status).toUpperCase() === 'ACTIVE';
}
if (item.amonia_status) {
  isAmonia = String(item.amonia_status).toUpperCase() === 'HIGH';
}
if (item.door_status) {
  isDoorOpen = String(item.door_status).toUpperCase() === 'OPEN';
}

if (item.raw_json) {
  try {
    let parsed = typeof item.raw_json === 'string' ? JSON.parse(item.raw_json) : item.raw_json;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);

    const alarmStatus = parsed?.values?.alarm_status || parsed?.alarm_status || '';
    const amoniaStatus = parsed?.values?.amonia_status || parsed?.amonia_status || '';
    const doorStatus = parsed?.values?.door_status || parsed?.door_status || '';
    
    if (String(alarmStatus).toUpperCase() === 'ACTIVE') isAlarm = true;
    if (String(amoniaStatus).toUpperCase() === 'HIGH') isAmonia = true;
    if (String(doorStatus).toUpperCase() === 'OPEN') isDoorOpen = true;
  } catch (e) {
    console.error(e);
  }
}

console.log({isAlarm, isAmonia, isDoorOpen, isAnyAlertActive: isAlarm || isDoorOpen || isAmonia});
