import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/Feather';
import CustomStatusBar from '../common/customstatusbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBLE } from './Blecontext';
import { useIsFocused } from '@react-navigation/native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

const { width } = Dimensions.get('window');

const WMS_ACTIONS = [
  {
    id: 'receive',
    title: 'Assign to Pallet',
    description: 'Assign scanned RFID items to a storage pallet',
    icon: 'plus-circle',
    route: 'ReceivePallet',
    color: '#3fbf75',
  },
  {
    id: 'putaway',
    title: 'Put Away',
    description: 'Assign storage bin to a rack/shelf location',
    icon: 'arrow-down-circle',
    route: 'PutAway',
    color: '#3fbf75',
  },
  // {
  //   id: 'retrieve',
  //   title: 'Retrieve',
  //   description: 'Retrieve items from a storage bin',
  //   icon: 'arrow-up-circle',
  //   route: 'Retrieve',
  //   color: '#d9933f',
  // },
  {
    id: 'move',
    title: 'Move pallet',
    description: 'Move items/bins between locations',
    icon: 'refresh-cw',
    route: 'MovePallet',
    color: '#00BCD4',
  },
  {
    id: 'receive',
    title: 'Receive pallet',
    description: 'Register incoming pallets and items',
    icon: 'download',
    route: 'ReceivePallet',
    color: '#4CAF50',
  },
  {
    id: 'repack',
    title: 'Repack pallet',
    description: 'Repack remaining stock in a bin',
    icon: 'scissors',
    route: 'Repack',
    color: '#9C27B0',
  },
  {
    id: 'merge',
    title: 'Merge Pallet',
    description: 'Consolidate stock of two bins',
    icon: 'git-merge',
    route: 'MergePallets',
    color: '#E91E63',
  },
  {
    id: 'count',
    title: 'Stock Count',
    description: 'Perform sweep counts of inventory',
    icon: 'list',
    route: 'StockCount',
    color: '#607D8B',
  },
  {
    id: 'find',
    title: 'Find Bin/Location',
    description: 'Scan a bin/item to find its Row, Rack & Shelf',
    icon: 'search',
    route: 'FindPallet',
    color: '#795548',
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    description: 'Dispatch bin contents to loading dock',
    icon: 'truck',
    route: 'Dispatch',
    color: '#FF5722',
  },
  {
    id: 'exception',
    title: 'Exception Report',
    description: 'Report issues with bins, racks, or shelves',
    icon: 'alert-triangle',
    route: 'ExceptionReport',
    color: '#e0654f',
  },
  {
    id: 'flag_pallet',
    title: 'Flag Pallet',
    description: 'Mark pallet as damaged or expired',
    icon: 'flag',
    route: 'FlagPallet',
    color: '#d9933f',
  }
];

const WmsDashboard = ({ navigation, route }: { navigation: any; route: any }) => {
  const isFocused = useIsFocused();
  const { rfid } = useBLE();
  const [scannedTag, setScannedTag] = useState(route.params?.rfid || '');

  // Monitor incoming BLE scans when screen is focused
  useEffect(() => {
    if (isFocused && rfid) {
      setScannedTag(rfid);
    }
  }, [rfid, isFocused]);

  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    if (!isFocused) return;
    const fetchAlarms = async () => {
      try {
        const [thRes, tempRes, energyRes] = await Promise.all([
          fetch('http://77.42.39.77:8000/wms/thresholds'),
          fetch('http://77.42.39.77:8000/api/temperature/live'),
          fetch('http://77.42.39.77:8000/api/energy/live'),
        ]);

        const thresholds = await thRes.json();
        const tempData = await tempRes.json();
        const energyData = await energyRes.json();

        let newAlerts: string[] = [];
        if (tempData.success && tempData.values) {
          if (tempData.values.temperature > thresholds.temperature) {
            newAlerts.push(`High Temp: ${tempData.values.temperature}°C`);
          }
          if (tempData.values.humidity > thresholds.humidity) {
            newAlerts.push(`High Humidity: ${tempData.values.humidity}%`);
          }
        }
        if (energyData.success && energyData.values) {
          if (energyData.values.activeEnergy > thresholds.energy) {
            newAlerts.push(`High Energy: ${energyData.values.activeEnergy}kWh`);
          }
        }

        setAlerts(newAlerts);
      } catch (err) {
        console.warn("Failed to fetch alarms", err);
      }
    };

    fetchAlarms();
    const interval = setInterval(fetchAlarms, 10000);
    return () => {
      clearInterval(interval);
    };
  }, [isFocused]);

  // Update scannedTag if navigation parameter changes
  useEffect(() => {
    if (route.params?.rfid) {
      setScannedTag(route.params.rfid);
    }
  }, [route.params?.rfid]);

  const handleActionPress = (action: typeof WMS_ACTIONS[0]) => {
    if (action.route === 'Detailscreen') {
      navigation.navigate(action.route, { rfid: scannedTag });
    } else {
      navigation.navigate(action.route, { prefilledRfid: scannedTag });
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ backgroundColor: '#3fbf75' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#3fbf75'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Scan')}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#ecf1f4" />
        </TouchableOpacity>
        <Text style={styles.headerText}>WMS Actions</Text>
      </View>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <View style={styles.alertCard}>
          <Icon name="alert-triangle" size={24} color="#e0654f" />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.alertTitle}>Threshold Exceeded!</Text>
            {alerts.map((a, i) => <Text key={i} style={styles.alertText}>• {a}</Text>)}
          </View>
        </View>
      )}

      {/* ACTIVE TAG CARD */}
      {scannedTag ? (
        <View style={styles.activeTagCard}>
          <View style={styles.activeTagLeft}>
            <Icon name="tag" size={20} color="#3fbf75" />
            <View style={{ marginLeft: wp(2.5) }}>
              <Text style={styles.activeTagLabel}>Active Scanned Tag</Text>
              <Text style={styles.activeTagValue} numberOfLines={1}>{scannedTag}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setScannedTag('')} style={styles.activeTagClear}>
            <Icon name="x" size={18} color="#62788a" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ACTION CARD GRID */}
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Select a warehouse operation to process the tag:</Text>

        <View style={styles.grid}>
          {WMS_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => handleActionPress(action)}
            >
              <View style={[styles.iconContainer, { backgroundColor: action.color + '15' }]}>
                <Icon name={action.icon} size={28} color={action.color} />
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{action.description}</Text>
              <View style={styles.arrowContainer}>
                <Icon name="chevron-right" size={16} color="#62788a" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#121b26',
  },
  header: {
    backgroundColor: '#3fbf75',
    flexDirection: 'row',
    alignItems: 'center',
    height: hp(8),
    paddingHorizontal: wp(4),
    elevation: 4,
  },
  backButton: {
    backgroundColor: '#18242f',
    borderRadius: 50,
    padding: 6,
  },
  headerText: {
    color: '#ecf1f4',
    fontFamily: 'Archivo', fontSize: wp(5.5),
    fontWeight: '600',
    marginLeft: wp(4),
  },
  scrollContainer: {
    padding: wp(4),
    paddingBottom: hp(5),
  },
  subtitle: {
    fontFamily: 'Archivo', fontSize: wp(4),
    fontWeight: '500',
    color: '#9db0bd',
    marginBottom: hp(2),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#121b26',
    width: (width - wp(12)) / 2,
    borderRadius: wp(3.5),
    padding: wp(4),
    marginBottom: hp(2),
    elevation: 3,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    position: 'relative',
  },
  iconContainer: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(2.5),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1.2),
  },
  cardTitle: {
    fontFamily: 'Archivo', fontSize: wp(4.2),
    fontWeight: '700',
    color: '#ecf1f4',
    marginBottom: hp(0.5),
  },
  cardDesc: {
    fontFamily: 'Archivo', fontSize: wp(3.2),
    color: '#9db0bd',
    lineHeight: hp(1.8),
    marginBottom: hp(1.5),
  },
  arrowContainer: {
    position: 'absolute',
    bottom: wp(3),
    right: wp(3),
  },
  activeTagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18242f',
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    marginHorizontal: wp(4),
    marginTop: hp(2),
    borderWidth: 1.5,
    borderColor: '#3fbf75',
  },
  activeTagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeTagLabel: {
    fontFamily: 'Archivo', fontSize: wp(3.2),
    fontWeight: '700',
    color: '#3fbf75',
    textTransform: 'uppercase',
  },
  activeTagValue: {
    fontFamily: 'Archivo', fontSize: wp(4),
    fontWeight: '700',
    color: '#3fbf75',
    marginTop: 2,
  },
  activeTagClear: {
    padding: 4,
  },
  alertCard: {
    backgroundColor: '#e0654f',
    borderWidth: 1,
    borderColor: '#EF5350',
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    marginHorizontal: wp(4),
    marginTop: hp(2),
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertTitle: {
    fontFamily: 'Archivo', fontSize: wp(4),
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  alertText: {
    color: '#ffffff',
    fontFamily: 'Archivo', fontSize: wp(3.5),
    fontWeight: '500',
  },
});

export default WmsDashboard;
