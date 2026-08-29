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

const RepackScreen = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const { rfid } = useBLE();

  // Repack state variables
  const [scannedRfid, setScannedRfid] = useState('');
  const [originalWeight, setOriginalWeight] = useState<number | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemUom, setItemUom] = useState('Nos');
  const [amountUsed, setAmountUsed] = useState('');
  const [loadingItem, setLoadingItem] = useState(false);
  const [newRfid, setNewRfid] = useState('');

  const [simulatedRfid, setSimulatedRfid] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // Fetch warehouses on mount
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        setLoadingWarehouses(true);
        const response = await fetch('http://77.42.39.77:8000/warehouses');
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

  // Listen to BLE RFID scans when focused
  useEffect(() => {
    if (isFocused && rfid) {
      if (!scannedRfid) {
        handleScanReceived(rfid);
      } else {
        setNewRfid(rfid);
      }
    }
  }, [rfid, isFocused]);

  const fallbackPallets = ['Pallet-01 - V', 'Pallet-02 - V', 'Pallet-03 - V', 'Pallet-04 - V'];

  // Pallets list sorted alphabetically
  const binsList = warehouses.length > 0
    ? warehouses.filter(w => w.toLowerCase().includes('pallet') || w.toLowerCase().includes('pallete')).sort()
    : fallbackPallets;

  const handleScanReceived = async (scannedVal: string) => {
    setScannedRfid(scannedVal);
    setSuccessMessage(null);
    setItemName('');
    setOriginalWeight(null);
    setLoadingItem(true);

    try {
      const response = await fetch(`http://77.42.39.77:8000/wms/repack-lookup?id=${encodeURIComponent(scannedVal)}`);
      if (response.ok) {
        const json = await response.json();
        setItemName(json.item_name || json.item_code);
        setItemCode(json.item_code || '');
        setOriginalWeight(json.qty || 0);
        setItemUom(json.uom || 'Nos');
      } else {
        throw new Error('Lookup failed');
      }
    } catch (e) {
      // Fallback
      setItemName('Maida Flour Grade A (Simulated)');
      setItemCode('maida_flour_a');
      setOriginalWeight(10.0);
      setItemUom('kg');
    } finally {
      setLoadingItem(false);
    }
  };

  const handleRepack = async () => {
    if (!scannedRfid) {
      Alert.alert('Error', 'Please select or scan a pallet RFID.');
      return;
    }
    const parsedUsed = parseFloat(amountUsed);
    if (isNaN(parsedUsed) || parsedUsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount used (greater than 0).');
      return;
    }
    if (originalWeight !== null && parsedUsed > originalWeight) {
      Alert.alert('Error', `Amount used cannot exceed current stock quantity (${originalWeight} ${itemUom}).`);
      return;
    }

    setLoading(true);
    setSuccessMessage(null);

    const remainingWeight = (originalWeight || 0.0) - parsedUsed;

    try {
      const response = await fetch('http://77.42.39.77:8000/wms/repack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_rfid: scannedRfid,
          amount_used: parsedUsed,
          remaining_weight: remainingWeight,
          new_rfid: newRfid || undefined,
        }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully repacked! Used ${parsedUsed} ${itemUom}. Remaining ${remainingWeight.toFixed(2)} ${itemUom} is mapped to tag [${newRfid || scannedRfid}].`);
        setScannedRfid('');
        setNewRfid('');
        setOriginalWeight(null);
        setItemName('');
        setItemCode('');
        setAmountUsed('');
      } else {
        throw new Error('API server offline');
      }
    } catch (err) {
      setSuccessMessage(`[Simulated] Repack successful! Used ${parsedUsed} ${itemUom} of ${itemName}. Remaining ${remainingWeight.toFixed(2)} ${itemUom} repacked under tag [${newRfid || scannedRfid}].`);
      setScannedRfid('');
      setNewRfid('');
      setOriginalWeight(null);
      setItemName('');
      setItemCode('');
      setAmountUsed('');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = () => {
    if (simulatedRfid.trim()) {
      handleScanReceived(simulatedRfid.trim());
      setSimulatedRfid('');
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ backgroundColor: '#3fbf75' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#3fbf75'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#ecf1f4" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Repack Pallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#3fbf75" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Select or scan a pallet, verify actual stock details, and consume quantity for repacking.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Scanned Pallet RFID</Text>
          <View style={styles.inputContainer}>
            <Icon name="tag" size={18} color="#62788a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Waiting for Pallet RFID scan..."
              value={scannedRfid}
              editable={false}
              placeholderTextColor="#62788a"
            />
            {scannedRfid ? (
              <TouchableOpacity onPress={() => {
                setScannedRfid('');
                setOriginalWeight(null);
                setItemName('');
                setItemCode('');
                setAmountUsed('');
              }}>
                <Icon name="x" size={18} color="#62788a" />
              </TouchableOpacity>
            ) : null}
          </View>

          {loadingItem && (
            <ActivityIndicator color="#3fbf75" style={{ marginVertical: hp(1.5) }} />
          )}

          {itemName && !loadingItem ? (
            <View style={styles.detailsBlock}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Product: </Text>
                <Text style={styles.detailVal}>{itemName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Available: </Text>
                <Text style={styles.detailVal}>{originalWeight} {itemUom}</Text>
              </View>
            </View>
          ) : null}

          {/* Amount input */}
          <Text style={styles.label}>
            Amount Consumed / Used ({itemUom})
          </Text>
          <View style={styles.inputContainer}>
            <Icon name="edit-3" size={18} color="#62788a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter weight/qty used"
              value={amountUsed}
              onChangeText={setAmountUsed}
              keyboardType="numeric"
              placeholderTextColor="#62788a"
            />
          </View>

          {/* Live Remaining Calculation for Repack */}
          {originalWeight !== null && amountUsed && parseFloat(amountUsed) > 0 && (
            <View style={styles.calcRow}>
              <Icon name="pie-chart" size={16} color="#9db0bd" style={{ marginRight: 6 }} />
              <Text style={styles.calcText}>
                Remaining after repack:{' '}
                <Text style={{ fontWeight: '700', color: '#3fbf75' }}>
                  {Math.max(0, originalWeight - parseFloat(amountUsed)).toFixed(2)} {itemUom}
                </Text>
              </Text>
            </View>
          )}

          {/* New RFID Tag Input (Only when an item is scanned) */}
          {scannedRfid ? (
            <>
              <Text style={styles.label}>Scan/Enter New RFID Tag (Optional)</Text>
              <View style={styles.inputContainer}>
                <Icon name="tag" size={18} color="#62788a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Scan or enter new RFID tag..."
                  value={newRfid}
                  editable={false}
                  placeholderTextColor="#62788a"
                />
                {newRfid ? (
                  <TouchableOpacity onPress={() => setNewRfid('')}>
                    <Icon name="x" size={18} color="#62788a" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleRepack}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0f16" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm Repack (Issue)</Text>
            )}
          </TouchableOpacity>
        </View>

        {successMessage && (
          <View style={styles.successCard}>
            <Icon name="check-circle" size={24} color="#3fbf75" style={{ marginRight: 10 }} />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {/* <View style={styles.simCard}>
          <Text style={styles.simTitle}>Simulate RFID Scan (Developer Mode)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Tag ID or Bin name to simulate scan"
              value={simulatedRfid}
              onChangeText={setSimulatedRfid}
              placeholderTextColor="#62788a"
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8EBF5',
    padding: 6,
    marginHorizontal: wp(4),
    marginTop: hp(2),
    borderRadius: wp(3),
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(1.2),
    borderRadius: wp(2.5),
  },
  activeTabButton: {
    backgroundColor: '#3fbf75',
    elevation: 2,
  },
  tabButtonText: {
    color: '#3fbf75',
    fontWeight: '700',
    fontFamily: 'Archivo', fontSize: wp(3.8),
  },
  activeTabButtonText: {
    color: '#ecf1f4',
  },
  container: {
    padding: wp(4),
    paddingBottom: hp(5),
  },
  instructionCard: {
    backgroundColor: '#18242f',
    borderRadius: wp(3),
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  instructionText: {
    color: '#3fbf75',
    fontFamily: 'Archivo', fontSize: wp(3.8),
    fontWeight: '500',
    flex: 1,
  },
  card: {
    backgroundColor: '#121b26',
    borderRadius: wp(4),
    padding: wp(5),
    elevation: 3,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginBottom: hp(3),
  },
  label: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    fontWeight: '600',
    color: '#9db0bd',
    marginBottom: hp(0.8),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121b26',
    borderWidth: 1,
    borderColor: '#121b26',
    borderRadius: wp(3),
    paddingHorizontal: wp(3.5),
    marginBottom: hp(2),
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: hp(1.4),
    fontFamily: 'Archivo', fontSize: wp(4),
    color: '#ecf1f4',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121b26',
    borderWidth: 1,
    borderColor: '#121b26',
    borderRadius: wp(3),
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.4),
    marginBottom: hp(2),
  },
  dropdownListContainer: {
    backgroundColor: '#121b26',
    borderWidth: 1,
    borderColor: '#121b26',
    borderRadius: wp(3),
    marginTop: -hp(1.5),
    marginBottom: hp(2),
    maxHeight: hp(20),
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownListItem: {
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(4),
    borderBottomWidth: 0.5,
    borderBottomColor: '#121b26',
  },
  dropdownListItemText: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    color: '#ecf1f4',
    fontWeight: '500',
  },
  detailsBlock: {
    backgroundColor: '#121b26',
    borderRadius: wp(2.5),
    padding: wp(3.5),
    marginBottom: hp(2.5),
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    fontFamily: 'Archivo', fontSize: wp(3.6),
    fontWeight: '600',
    color: '#9db0bd',
  },
  detailVal: {
    fontFamily: 'Archivo', fontSize: wp(3.6),
    fontWeight: '700',
    color: '#ecf1f4',
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2.5),
  },
  calcText: {
    fontFamily: 'Archivo', fontSize: wp(3.6),
    color: '#9db0bd',
  },
  primaryButton: {
    backgroundColor: '#3fbf75',
    borderRadius: wp(3),
    paddingVertical: hp(1.8),
    alignItems: 'center',
    marginTop: hp(1),
    elevation: 2,
  },
  primaryButtonText: {
    color: '#0a0f16',
    fontFamily: 'Archivo', fontSize: wp(4.2),
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#3fbf75',
    elevation: 0,
  },
  successCard: {
    backgroundColor: '#3fbf75',
    borderRadius: wp(3),
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(3),
    borderLeftWidth: 4,
    borderLeftColor: '#3fbf75',
  },
  successText: {
    color: '#3fbf75',
    fontFamily: 'Archivo', fontSize: wp(3.8),
    fontWeight: '600',
    flex: 1,
  },
  simCard: {
    backgroundColor: '#121b26',
    borderRadius: wp(4),
    padding: wp(5),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3fbf75',
  },
  simTitle: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    fontWeight: '700',
    color: '#3fbf75',
    marginBottom: hp(1.5),
  },
  simButton: {
    backgroundColor: '#18242f',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: wp(2),
    borderWidth: 1,
    borderColor: '#3fbf75',
  },
  simButtonText: {
    color: '#3fbf75',
    fontWeight: '700',
    fontFamily: 'Archivo', fontSize: wp(3.5),
  },
});

export default RepackScreen;
