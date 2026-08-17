import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { t } from '../../node_modules/i18next';
import { bluetooth } from '../common/images';
import Icon from 'react-native-vector-icons/FontAwesome';
import { Card } from 'react-native-paper';
import CustomStatusBar from '../common/customstatusbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useIsFocused } from '@react-navigation/native';
const { width, height } = Dimensions.get('window');
import { normalize } from '../common/String/fontsize';
import { useBLE } from './Blecontext';
import usePermissions from './userpermission';
const baseSize = width * 0.55;
import {
  heightPercentageToDP as hp,
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';

const Scan = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const { permissionStatus1, requestPermissions1 } = usePermissions();
  const {
    devices,
    scanDevices,
    connectToDevice,
    disconnectDevice,
    isScanning,
    connectedDevice,
    rfid,
  } = useBLE();
  const scaleAnim2 = useRef(new Animated.Value(1)).current;
  const scaleAnim3 = useRef(new Animated.Value(1)).current;

  // Removed automatic navigation on scan - user must tap dashboard button to navigate

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim2, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim2, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim3, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim3, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      scaleAnim2.setValue(1);
      scaleAnim3.setValue(1);
    }
  }, [isScanning]);
  const showSuccessToast = (message: string) => {
    Toast.show({
      type: 'success',
      position: 'top',
      text1: '✅ Success',
      text2: message,
      visibilityTime: 3000,
      autoHide: true,
      topOffset: 20,
      bottomOffset: 40,
    });
  };
  const showErrorToast = (message: string) => {
    Toast.show({
      type: 'error',
      position: 'top',
      text1: '⚠ Error',
      text2: message,
      visibilityTime: 3000,
      autoHide: true,
      topOffset: 60,
      bottomOffset: 40,
    });
  };

  const handlescan = async () => {
    try {
      scanDevices();
    } catch (error) {
      console.error('Error saving scanning state:', error);
    }
  };

  useEffect(() => {
    requestPermissions1();
  }, []);

  const ok = async (item: any) => {
    try {
      await connectToDevice(item);
      showSuccessToast('Paired successfully');
    } catch (error) {
      console.error('Failed to pair:', error);
      showErrorToast('Pairing failed');
    }
  };

  const RenderDeviceList = () => (
    <View style={{ flex: 1, width: '100%' }}>
      <View style={styles.Header}>
        <Text style={styles.Text1}>{t('Scan') || 'Scan'}</Text>
      </View>
      {rfid ? (
        <View style={styles.rfidBanner}>
          <Icon name="tag" size={18} color="#2E7D32" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rfidLabel}>Active RFID Tag Scanned</Text>
            <Text style={styles.rfidText}>{rfid}</Text>
          </View>
        </View>
      ) : null}
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: rfid ? '10%' : '20%',
        }}
      >
        <Animated.View
          style={[styles.container3, { transform: [{ scale: scaleAnim3 }] }]}
        >
          <Animated.View
            style={[styles.container2, { transform: [{ scale: scaleAnim2 }] }]}
          >
            <View style={styles.container1}>
              <View style={styles.imageContainer}>
                <Image source={bluetooth} style={styles.image} />
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
      <Text style={styles.scanningText}>
        {connectedDevice
          ? `${connectedDevice.name} is connected`
          : t('Scanning for device')}
      </Text>
      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({ item }: { item: any }) => (
          <Card style={styles.card}>
            <View style={styles.connectedDeviceContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="bluetooth-b" size={24} color="#000" />
                <Text style={{ paddingLeft: 20 }}>{item.name}</Text>
              </View>
              <TouchableOpacity
                style={
                  connectedDevice?.name === item.name
                    ? styles.connectButton2
                    : styles.connectButton
                }
                onPress={async () => {
                  console.log({ item })
                  connectedDevice?.name === item.name
                    ? await disconnectDevice(item)
                    : ok(item)
                }}
              >
                <Text style={{ color: '#fff' }}>
                  {t(connectedDevice?.name === item.name ? 'Unpair' : 'Pair')}{' '}
                  {connectedDevice?.name === item.name ? 'Unpair' : 'Pair'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView style={{ backgroundColor: '#5A80FD' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#5A80FD'} />
      <View style={styles.mainContainer}>
        <RenderDeviceList />
      </View>

      <TouchableOpacity
        style={styles.wmsButton}
        onPress={() => navigation.navigate('WmsDashboard', { rfid: rfid || undefined })}
      >
        <Text style={styles.wmsButtonText}>Open WMS Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.Button,
          {
            backgroundColor: connectedDevice
              ? 'grey'
              : isScanning
                ? 'grey'
                : '#5A80FD',
          },
        ]}
        onPress={!isScanning && !connectedDevice ? handlescan : undefined}
        disabled={!!isScanning || !!connectedDevice}
      >
        <Text style={styles.text}>{t('Scan') || 'Scan'}</Text>
      </TouchableOpacity>
      <SafeAreaView style={{ backgroundColor: '#fff' }} edges={['bottom']} />
    </View>
  );
};

export default Scan;
const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  mainContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  initialTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '35%',
    height: height * 0.52,
  },
  scanTitle: {
    color: '#5A80FD',
    fontSize: normalize(25),
    fontWeight: '400',
  },
  scanDescription: {
    color: '#000',
    fontSize: normalize(18),
    fontWeight: '500',
    marginTop: 5,
    marginLeft: 6,
    textAlign: 'center',
  },
  Image: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    tintColor: '#fff',
  },
  imageContainer: {
    width: baseSize * 0.5,
    height: baseSize * 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
    tintColor: '#fff',
  },
  container1: {
    width: baseSize * 0.6,
    height: baseSize * 0.6,
    borderRadius: (baseSize * 0.6) / 2,
    backgroundColor: '#86A2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container2: {
    width: baseSize * 0.8,
    height: baseSize * 0.8,
    borderRadius: (baseSize * 0.8) / 2,
    backgroundColor: '#96AEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container3: {
    width: baseSize,
    height: baseSize,
    borderRadius: baseSize / 2,
    backgroundColor: '#A3B9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  Button: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    alignItems: 'center',
    height: height * 0.07,
    width: width * 0.9,
    marginLeft: 20,
    justifyContent: 'center',
    position: 'absolute',
    bottom: '6%',
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: normalize(24),
    textAlign: 'center',
  },
  scanningText: {
    color: '#5A80FD',
    fontSize: normalize(16),
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    marginBottom: 100, // push list up to not overlap buttons
  },
  wmsButton: {
    backgroundColor: '#fff',
    borderColor: '#5A80FD',
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    height: height * 0.07,
    width: width * 0.9,
    marginLeft: 20,
    justifyContent: 'center',
    position: 'absolute',
    bottom: '15%',
  },
  wmsButtonText: {
    color: '#5A80FD',
    fontWeight: '700',
    fontSize: normalize(20),
  },
  connectButton: {
    backgroundColor: '#5A80FD',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    width: width * 0.2,
  },
  connectButton2: {
    backgroundColor: '#FD5A5D',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    width: width * 0.2,
  },
  connectedDeviceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    width: width * 0.9,
    justifyContent: 'center',
    borderRadius: 6,
    shadowRadius: 6,
    marginTop: 10,
    marginLeft: 20,
    padding: 8,
    elevation: 2,
    borderWidth: 0.1,
  },
  Header: {
    height: hp(8),
    backgroundColor: '#5A80FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    width: '100%',
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: wp(2),
  },
  backButton: {
    marginRight: wp(1.5),
  },
  Text1: {
    fontSize: wp(5.5),
    fontWeight: '600',
    color: '#fff',
  },
  rfidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderColor: '#81C784',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 15,
    elevation: 1,
  },
  rfidLabel: {
    fontSize: normalize(12),
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  rfidText: {
    fontSize: normalize(15),
    color: '#1B5E20',
    fontFamily: 'monospace',
    marginTop: 2,
    letterSpacing: 0.5,
  },
});