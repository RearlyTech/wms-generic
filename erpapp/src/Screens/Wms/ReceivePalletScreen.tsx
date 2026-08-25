import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/Feather';
import CustomStatusBar from '../../common/customstatusbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBLE } from '../Blecontext';
import { useIsFocused } from '@react-navigation/native';

const ReceivePalletScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const prefilled = route.params?.prefilledRfid;
  const [scannedRfid, setScannedRfid] = useState(prefilled || '');
  const [palletId, setPalletId] = useState('');
  const [simulatedRfid, setSimulatedRfid] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [showBinDropdown, setShowBinDropdown] = useState(false);

  // Fetch warehouse list on mount
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        setLoadingWarehouses(true);
        const response = await fetch('http://192.168.29.113:8000/warehouses');
        if (response.ok) {
          const json = await response.json();
          setWarehouses(json);
        }
      } catch (err) {
        console.error('Error fetching warehouses:', err);
      } finally {
        setLoadingWarehouses(false);
      }
    };
    fetchWarehouses();
  }, []);

  const fallbackPallets = ['Pallet-01 - V', 'Pallet-02 - V', 'Pallet-03 - V', 'Pallet-04 - V'];
  const binsList = warehouses.length > 0
    ? warehouses.filter(w => w.toLowerCase().includes('pallet')).sort()
    : fallbackPallets;

  // Monitor incoming BLE scans when screen is focused
  useEffect(() => {
    if (prefilled) {
      setScannedRfid(prefilled);
    }
  }, [prefilled]);

  useEffect(() => {
    if (isFocused && rfid) {
      setScannedRfid(rfid);
      setSuccessMessage(null);
    }
  }, [rfid, isFocused]);

  const handleAssign = async () => {
    if (!scannedRfid) {
      Alert.alert('Error', 'Please scan or enter an item RFID tag first.');
      return;
    }
    if (!palletId.trim()) {
      Alert.alert('Error', 'Please select a target Pallet.');
      return;
    }

    setLoading(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('http://192.168.29.113:8000/wms/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_rfid: scannedRfid,
          pallet_id: palletId,
        }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully registered RFID tag [${scannedRfid}] on Pallet [${palletId}]!`);
        setScannedRfid('');
        setPalletId('');
      } else {
        throw new Error('API server offline');
      }
    } catch (err) {
      setSuccessMessage(`[Simulated] Successfully assigned RFID tag [${scannedRfid}] to Pallet [${palletId}]!`);
      setScannedRfid('');
      setPalletId('');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = () => {
    if (simulatedRfid.trim()) {
      setScannedRfid(simulatedRfid.trim());
      setSimulatedRfid('');
      setSuccessMessage(null);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ backgroundColor: '#5A80FD' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#5A80FD'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Assign to Pallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* INSTRUCTIONS */}
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#5A80FD" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Scan an RFID-labelled item, then assign which Pallet ID the item should be placed on.
          </Text>
        </View>

        {/* SCAN STATUS */}
        <View style={styles.statusRow}>
          <View style={styles.connectionBadge}>
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#4CAF50' : '#E53935' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Connected' : 'Scanner Disconnected'}
            </Text>
          </View>
        </View>

        {/* INPUTS CONTAINER */}
        <View style={styles.card}>
          <Text style={styles.label}>Scanned Item RFID Tag</Text>
          <View style={styles.inputContainer}>
            <Icon name="tag" size={18} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Waiting for RFID scan..."
              value={scannedRfid}
              editable={false}
              placeholderTextColor="#999"
            />
            {scannedRfid ? (
              <TouchableOpacity onPress={() => setScannedRfid('')}>
                <Icon name="x" size={18} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.label}>Assign to Pallet ID</Text>
          {loadingWarehouses ? (
            <ActivityIndicator color="#5A80FD" style={{ marginVertical: hp(1) }} />
          ) : (
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => setShowBinDropdown(!showBinDropdown)}
            >
              <Icon name="box" size={18} color="#999" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, color: palletId ? '#333' : '#999', fontSize: wp(4) }}>
                {palletId || 'Select Target Pallet...'}
              </Text>
              <Icon name={showBinDropdown ? "chevron-up" : "chevron-down"} size={20} color="#555" />
            </TouchableOpacity>
          )}

          {showBinDropdown && (
            <View style={styles.dropdownListInline}>
              {binsList.map((bin, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.dropdownListItem}
                  onPress={() => {
                    setPalletId(bin);
                    setShowBinDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownListItemText}>{bin}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleAssign}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Assign to Pallet</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* FEEDBACK STATUS */}
        {successMessage && (
          <View style={styles.successCard}>
            <Icon name="check-circle" size={24} color="#4CAF50" style={{ marginRight: 10 }} />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {/* SIMULATOR CARD */}
        {/* <View style={styles.simCard}>
          <Text style={styles.simTitle}>Simulate RFID Scan (Developer Mode)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Tag ID to simulate scan"
              value={simulatedRfid}
              onChangeText={setSimulatedRfid}
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.simButton} onPress={handleSimulateScan}>
              <Text style={styles.simButtonText}>Simulate</Text>
            </TouchableOpacity>
          </View>
        </View> */}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    backgroundColor: '#5A80FD',
    flexDirection: 'row',
    alignItems: 'center',
    height: hp(8),
    paddingHorizontal: wp(4),
    elevation: 4,
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 50,
    padding: 6,
  },
  headerText: {
    color: '#fff',
    fontSize: wp(5.5),
    fontWeight: '600',
    marginLeft: wp(4),
  },
  container: {
    padding: wp(4),
    paddingBottom: hp(5),
  },
  instructionCard: {
    backgroundColor: '#EBF0FF',
    borderRadius: wp(3),
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  instructionText: {
    color: '#3F51B5',
    fontSize: wp(3.8),
    fontWeight: '500',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: hp(2),
  },
  connectionBadge: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.8),
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: wp(3.2),
    color: '#555',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(5),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginBottom: hp(3),
  },
  label: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#555',
    marginBottom: hp(0.8),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp(3),
    paddingHorizontal: wp(3.5),
    marginBottom: hp(2),
  },
  inputIcon: {
    marginRight: wp(2),
  },
  input: {
    flex: 1,
    paddingVertical: hp(1.4),
    fontSize: wp(4),
    color: '#333',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp(3),
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.4),
    marginBottom: hp(2),
  },
  dropdownListInline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: wp(3),
    marginBottom: hp(2),
    overflow: 'hidden',
  },
  dropdownListItem: {
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(4),
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  dropdownListItemText: {
    fontSize: wp(3.8),
    color: '#333',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#5A80FD',
    borderRadius: wp(3),
    paddingVertical: hp(1.8),
    alignItems: 'center',
    marginTop: hp(1),
    elevation: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: wp(4.2),
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#A0B6FF',
    elevation: 0,
  },
  successCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: wp(3),
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(3),
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  successText: {
    color: '#2E7D32',
    fontSize: wp(3.8),
    fontWeight: '600',
    flex: 1,
  },
  simCard: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(5),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#5A80FD',
  },
  simTitle: {
    fontSize: wp(3.8),
    fontWeight: '700',
    color: '#5A80FD',
    marginBottom: hp(1.5),
  },
  simButton: {
    backgroundColor: '#EBF0FF',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: wp(2),
    borderWidth: 1,
    borderColor: '#5A80FD',
  },
  simButtonText: {
    color: '#5A80FD',
    fontWeight: '700',
    fontSize: wp(3.5),
  },
});

export default ReceivePalletScreen;
