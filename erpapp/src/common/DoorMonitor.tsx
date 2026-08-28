import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Alert } from 'react-native';
import { readItems } from '@directus/sdk';
import { directus, refreshAuthToken } from '../lib/directus';
import { getItem, removeItem } from '../Storage/Storage';
import Icon from 'react-native-vector-icons/FontAwesome';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');
const beepSound = new Sound('alarm.mp3', Sound.MAIN_BUNDLE, (error) => {
  if (error) {
    console.log('Failed to load the sound', error);
  } else {
    beepSound.setNumberOfLoops(-1);
  }
});

export default function DoorMonitor({ children }: { children: React.ReactNode }) {
  const [alarmActive, setAlarmActive] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [amoniaHigh, setAmoniaHigh] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkDoorStatus = async () => {
      try {
        // Only check if we are authenticated
        const hasToken = getItem('authToken');
        console.log('DoorMonitor hasToken:', hasToken ? 'YES' : 'NO');
        if (!hasToken) return;

        const futureTime = new Date(Date.now() + 86400000).toISOString();
        
        const params = new URLSearchParams();
        params.append('filter[_and][0][sensor_type][_eq]', 'door_uart');
        params.append('filter[_and][1][created_at][_lte]', futureTime);
        params.append('limit', '1');
        params.append('sort', '-created_at');
        
        const url = `https://dev-directus.rearlytech.com/items/gateway_sensor_readings?${params.toString()}`;
        console.log('DoorMonitor Sending request...', url);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${hasToken}`,
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (res.status === 401) {
          console.log('DoorMonitor fetch got 401, attempting manual refresh...');
          const newAccessToken = await refreshAuthToken();
          
          if (newAccessToken) {
            console.log('DoorMonitor fetch successfully refreshed token!');
            return; // Will retry on the next 5-second tick
          }
          
          removeItem('authToken');
          Alert.alert("Session Expired", "Please restart the app to log in again.");
          return;
        }
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const responseJson = await res.json();
        const response = responseJson.data;
        console.log("DoorMonitor Response Length:", response?.length);

        if (response && response.length > 0) {
          const item = response[0];
          console.log("DoorMonitor latest item:", JSON.stringify(item));

          let isAlarm = false;
          let isAmonia = false;
          let isDoorOpen = false;

          // Check direct DB fields if they exist
          if (String(item.alarm_status).toUpperCase() === 'ACTIVE') {
            isAlarm = true;
          }
          if (String(item.amonia_status).toUpperCase() === 'HIGH') {
            isAmonia = true;
          }
          if (String(item.door_status).toUpperCase() === 'OPEN') {
            isDoorOpen = true;
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
            } catch (e) { }
          }

          setAlarmActive(isAlarm);
          setAmoniaHigh(isAmonia);
          setDoorOpen(isDoorOpen);
        }
      } catch (err) {
        console.log('DoorMonitor fetch failed:', err);
      }
    };

    // Poll every 5 seconds
    interval = setInterval(checkDoorStatus, 5000);
    // Initial check
    checkDoorStatus();

    return () => clearInterval(interval);
  }, []);

  // Make the overall alert state dependent on any of the three flags
  const isAnyAlertActive = alarmActive || doorOpen || amoniaHigh;

  useEffect(() => {
    if (isAnyAlertActive) {
      beepSound.play((success) => {
        if (!success) console.log('Sound playback failed');
      });
    } else {
      beepSound.stop();
    }

    return () => {
      beepSound.stop();
    };
  }, [isAnyAlertActive]);

  let alertMessage = "An emergency alarm has been triggered in the warehouse.";
  if (doorOpen && amoniaHigh) {
    alertMessage = "CRITICAL: Ammonia levels are HIGH and the main warehouse door is OPEN!";
  } else if (doorOpen) {
    alertMessage = "The main warehouse door has been left OPEN.";
  } else if (amoniaHigh) {
    alertMessage = "Ammonia levels are HIGH in the facility!";
  }

  return (
    <>
      {children}
      <Modal
        visible={isAnyAlertActive}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { }} // prevents dismissing via back button on Android
      >
        <View style={styles.modalBackground}>
          <View style={styles.alertBox}>
            <Icon name="warning" size={64} color="#E11D48" style={{ marginBottom: 16 }} />
            <Text style={styles.alertTitle}>EMERGENCY ALARM</Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    backgroundColor: '#FFE4E6',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E11D48',
    width: '100%',
    maxWidth: 400,
  },
  alertTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#E11D48',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 18,
    color: '#9F1239',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
});
