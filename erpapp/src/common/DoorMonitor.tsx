import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { readItems } from '@directus/sdk';
import { directus } from '../lib/directus';
import { getItem } from '../Storage/Storage';
import Icon from 'react-native-vector-icons/FontAwesome';

export default function DoorMonitor({ children }: { children: React.ReactNode }) {
  const [doorOpen, setDoorOpen] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkDoorStatus = async () => {
      try {
        // Only check if we are authenticated
        const hasToken = getItem('authToken');
        if (!hasToken) return;

        const response = await directus.request(
          readItems('gateway_sensor_readings', {
            filter: { sensor_type: { _eq: 'door_uart' } },
            limit: 1,
            sort: ['-created_at'],
          })
        );

        if (response && response.length > 0) {
          const status = response[0].door_status?.toLowerCase();
          setDoorOpen(status === 'open');
        }
      } catch (err) {
        // console.warn('Failed to check door status:', err);
      }
    };

    // Poll every 5 seconds
    interval = setInterval(checkDoorStatus, 5000);
    // Initial check
    checkDoorStatus();

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {children}
      <Modal
        visible={doorOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { }} // prevents dismissing via back button on Android
      >
        <View style={styles.modalBackground}>
          <View style={styles.alertBox}>
            <Icon name="warning" size={64} color="#E11D48" style={{ marginBottom: 16 }} />
            <Text style={styles.alertTitle}>DOOR IS OPEN</Text>
            <Text style={styles.alertMessage}>
              Please close the main warehouse door to continue using the application.
            </Text>
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
