import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
  PermissionsAndroid,
  Platform,
  Alert,
  NativeModules,
  Linking,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { Buffer } from 'buffer';

// Interface for BLE context
interface BLEContextProps {
  bleManager: BleManager;
  devices: Device[];
  connectedDevice: Device | null;
  scanDevices: () => void;
  connectToDevice: (device: Device) => Promise<void>;
  disconnectDevice: (device: Device) => Promise<void>;
  isScanning: boolean;
  rfid: string;
  setRfid: (rfid: string) => void;
  readCharacteristic: (
    serviceUUID: string,
    characteristicUUID: string,
  ) => Promise<string | null>;
  startNotifications: (
    serviceUUID: string,
    characteristicUUID: string,
    callback: (value: string) => void,
  ) => Promise<void>;
  stopNotifications: () => Promise<void>;
}

// Define BLEProvider Props (Include children)
interface BLEProviderProps {
  children: ReactNode;
}

// Create BLE context
const BLEContext = createContext<BLEContextProps | undefined>(undefined);

export const BLEProvider: React.FC<BLEProviderProps> = ({ children }) => {
  const [bleManager] = useState(new BleManager());
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [rfid, setRfid] = useState('');
  const [notificationSubscription, setNotificationSubscription] =
    useState<Subscription | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Request permissions for BLE (Android-specific)
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const permissions =
          Platform.Version >= 31
            ? [
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]
            : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        return Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED,
        );
      } catch (err) {
        console.error('Permission request failed:', err);
        return false;
      }
    }
    return true;
  };
  const isLocationEnabled = async (): Promise<boolean> => {
    return new Promise(resolve => {
      Geolocation.getCurrentPosition(
        pos => resolve(true),
        err => {
          console.log('Location check failed, retrying...', err);
          setTimeout(() => {
            Geolocation.getCurrentPosition(
              () => resolve(true),
              () => resolve(false),
              { enableHighAccuracy: true, timeout: 3000, maximumAge: 1000 }
            );
          }, 1000);
        },
        { enableHighAccuracy: true, timeout: 3000, maximumAge: 1000 },
      );
    });
  };

  const checkBluetoothState = async (
    bleManager: BleManager,
  ): Promise<boolean> => {
    try {
      const state = await bleManager.state();
      console.log('Bluetooth state:', state);

      if (state === 'PoweredOn') {
        return true;
      } else {
        if (Platform.OS === 'android') {
          await NativeModules.BluetoothStateManager.openSettings();
        }
        return false;
      }
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      return false;
    }
  };
  // Scan for BLE devices
  const scanDevices = async () => {
    try {
      if (isScanning) {
        console.log('Scan already in progress');
        return;
      }

      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permissions Denied',
          'Bluetooth & Location permissions are required to scan devices.',
        );
        return;
      }

      let bluetoothEnabled = await checkBluetoothState(bleManager);
      console.log({ bluetoothEnabled })
      if (!bluetoothEnabled) {
        await new Promise<void>(resolve => {
          Alert.alert(
            'Bluetooth Required',
            'Please enable Bluetooth to scan for devices.',
            [
              {
                text: 'ON',
                onPress: async () => {
                  try {
                    if (Platform.OS === 'android') {
                      if (Platform.Version <= 12) {
                        await bleManager.enable();
                      } else {
                        Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
                      }
                    }
                  } catch (err) {
                    console.warn('Cannot enable Bluetooth programmatically', err);
                  }
                  resolve();
                },
              },
            ],
            { cancelable: false },
          );
        });
        bluetoothEnabled = await checkBluetoothState(bleManager);
        if (!bluetoothEnabled) return;
      }

      if (Platform.OS === 'android') {
        const enabled = await isLocationEnabled();
        if (!enabled) {
          await new Promise<void>(resolve => {
            Alert.alert(
              'Location is OFF',
              'Please turn on location to use Bluetooth scanning.',
              [
                {
                  text: 'Turn ON',
                  onPress: () => {
                    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
                    resolve();
                  },
                },
              ],
              { cancelable: false },
            );
          });
          return;
        }
      }

      bleManager.stopDeviceScan();
      setDevices([]);
      setIsScanning(true);

      const serviceUUID = '52454152-4C59-5445-4348-5056544C5444'.toLowerCase();

      bleManager.startDeviceScan(
        [serviceUUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('Scan error:', error);
            setIsScanning(false);
            return;
          }

          if (device?.name) {
            setDevices(prevDevices => {
              const exists = prevDevices.some(d => d.id === device.id);
              return exists ? prevDevices : [...prevDevices, device];
            });
          }
        },
      );

      setTimeout(() => {
        bleManager.stopDeviceScan();
        setIsScanning(false);
      }, 10000); // ⏱ increase to 10s
    } catch (error) {
      console.error('Error during scan:', error);
      setIsScanning(false);
    }
  };

  // Connect to a device
  const connectToDevice = async (device: Device) => {
    try {
      console.log(`Connecting to device: ${device.name} (${device.id})`);
      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan();

      const serviceUUID = '52454152-4C59-5445-4348-5056544C5444'.toLowerCase();
      const characteristicUUID =
        '52454152-4C59-4848-5244-4E4F54494659'.toLowerCase();

      // Monitor notifications safely
      const subscription = connectedDevice.monitorCharacteristicForService(
        serviceUUID,
        characteristicUUID,
        (error, characteristic) => {
          if (error) {
            console.error('Notification error:', error.message || error);
            return;
          }

          if (characteristic?.value) {
            const rawData = decodeBase64(characteristic.value);
            const hexString = Array.from(new Uint8Array(Buffer.from(rawData)))
              .map(byte => byte.toString(16).toUpperCase().padStart(2, '0'))
              .join('');
            const hexPairs = hexString.match(/.{1,2}/g) || [];
            console.log('Notification received:', hexPairs.join(''));
            setRfid(hexPairs.join(''));
          }
        },
      );

      console.log('subscription:', subscription);
      setNotificationSubscription(subscription);
      setConnectedDevice(connectedDevice);
      console.log('Device connected successfully');
    } catch (error: any) {
      console.error('Connection error:', error.message || error);
      Alert.alert(
        'Connection Error',
        error.message || 'Failed to connect to device.',
      );
    }
  };

  // Disconnect from the device
  const disconnectDevice = async (device: Device) => {
    const targetDevice = device;
    if (!targetDevice) {
      console.log('No device to disconnect');
      return;
    }

    try {
      console.log('Attempting to disconnect from device:', targetDevice.id);

      // Stop notifications first
      await stopNotifications();

      // Small delay to ensure notifications are cleaned up
      await new Promise<void>(resolve => setTimeout(resolve, 100));

      // Check if device is still connected before attempting to disconnect
      const isConnected = await targetDevice.isConnected();
      console.log('Device connected status:', isConnected);

      if (isConnected) {
        try {
          await bleManager.cancelDeviceConnection(targetDevice.id);
          console.log('Device disconnected successfully');
        } catch (disconnectError: any) {
          // Check if the error is because device is already disconnected
          if (disconnectError.message?.includes('not connected')) {
            console.log('Device was already disconnected');
          } else {
            console.error(
              'Disconnection error:',
              disconnectError.message || disconnectError,
            );
            throw disconnectError;
          }
        }
      } else {
        console.log('Device is not connected, skipping cancelConnection.');
      }

      // Clear state regardless of disconnect success
      setRfid('');
      setConnectedDevice(null);
      console.log('Connection state cleared');
    } catch (error: any) {
      console.error('Disconnection error:', error.message || error);

      // Clear state even on error to prevent stuck state
      setRfid('');
      setConnectedDevice(null);

      // Only show alert for unexpected errors
      if (!error.message?.includes('not connected')) {
        Alert.alert(
          'Disconnection Error',
          error.message || 'Failed to disconnect from device.',
        );
      }
    }
  };
  // Read characteristic
  const readCharacteristic = async (
    serviceUUID: string,
    characteristicUUID: string,
  ): Promise<string | null> => {
    try {
      if (!connectedDevice) throw new Error('No device connected');
      const characteristic = await connectedDevice.readCharacteristicForService(
        serviceUUID,
        characteristicUUID,
      );
      return characteristic?.value ? decodeBase64(characteristic.value) : null;
    } catch (error: any) {
      console.error('Read characteristic error:', error.message || error);
      return null;
    }
  };

  // Start notifications
  const startNotifications = async (
    serviceUUID: string,
    characteristicUUID: string,
    callback: (value: string) => void,
  ) => {
    try {
      if (!connectedDevice) throw new Error('No connected device');
      await connectedDevice.discoverAllServicesAndCharacteristics();
      connectedDevice.monitorCharacteristicForService(
        serviceUUID,
        characteristicUUID,
        (error, characteristic) => {
          if (error) {
            console.error('Notification error:', error.message || error);
            return;
          }

          if (characteristic?.value) {
            callback(decodeBase64(characteristic.value));
          }
        },
      );
    } catch (error: any) {
      console.error('Start notification error:', error.message || error);
    }
  };

  // Stop notifications
  const stopNotifications = async () => {
    if (!notificationSubscription) return;

    try {
      // Wrap in try/catch to prevent native crashes
      notificationSubscription.remove();
    } catch (err) {
      console.warn(
        'Failed to remove subscription (safe to ignore after disconnect):',
        err,
      );
    }
    setNotificationSubscription(null);

    // small delay to let native cleanup happen
    await new Promise<void>(resolve => setTimeout(resolve, 100));
  };

  // Decode base64
  const decodeBase64 = (value: string): string => {
    try {
      return Buffer.from(value, 'base64').toString();
    } catch (error: any) {
      console.error('Decode base64 error:', error.message || error);
      return '';
    }
  };
  useEffect(() => {
    return () => {
      if (bleManager) {
        bleManager.stopDeviceScan();
      }
    };
  }, []);

  // Return BLE context provider
  return (
    <BLEContext.Provider
      value={{
        bleManager,
        devices,
        connectedDevice,
        scanDevices,
        connectToDevice,
        disconnectDevice,
        isScanning,
        rfid,
        setRfid,
        readCharacteristic,
        startNotifications,
        stopNotifications,
      }}>
      {children}
    </BLEContext.Provider>
  );
};

// Custom hook to use BLE context
export const useBLE = (): BLEContextProps => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLE must be used within a BLEProvider');
  }
  return context;
};