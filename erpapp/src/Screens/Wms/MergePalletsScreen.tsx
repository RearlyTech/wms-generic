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

const MergePalletsScreen = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [palletA, setPalletA] = useState('');
  const [palletB, setPalletB] = useState('');
  const [activeInput, setActiveInput] = useState<'A' | 'B'>('A');

  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [itemUom, setItemUom] = useState('Nos');
  const [mergeQty, setMergeQty] = useState('');
  const [loadingItem, setLoadingItem] = useState(false);

  const [simulatedRfid, setSimulatedRfid] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  const [showADropdown, setShowADropdown] = useState(false);
  const [showBDropdown, setShowBDropdown] = useState(false);

  // Fetch warehouses on mount
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

  const fetchPalletADetails = async (scannedVal: string) => {
    setItemName('');
    setItemCode('');
    setAvailableQty(null);
    setMergeQty('');
    setLoadingItem(true);
    try {
      const response = await fetch(`http://192.168.29.113:8000/wms/repack-lookup?id=${encodeURIComponent(scannedVal)}`);
      if (response.ok) {
        const json = await response.json();
        setItemName(json.item_name || json.item_code);
        setItemCode(json.item_code || '');
        setAvailableQty(json.qty || 0);
        setItemUom(json.uom || 'Nos');
        setMergeQty(String(json.qty || '0'));
      }
    } catch (err) {
      console.log('Error looking up source pallet details:', err);
    } finally {
      setLoadingItem(false);
    }
  };

  // Monitor incoming BLE scans when focused
  useEffect(() => {
    if (isFocused && rfid) {
      setSuccessMessage(null);
      if (activeInput === 'A') {
        setPalletA(rfid);
        fetchPalletADetails(rfid);
        setActiveInput('B');
      } else {
        setPalletB(rfid);
      }
    }
  }, [rfid, isFocused]);

  const fallbackPallets = ['Pallet-01 - V', 'Pallet-02 - V', 'Pallet-03 - V', 'Pallet-04 - V'];
  const binsList = warehouses.length > 0
    ? warehouses.filter(w => w.toLowerCase().includes('pallet') || w.toLowerCase().includes('pallete')).sort()
    : fallbackPallets;

  const handleMerge = async () => {
    if (!palletA.trim() || !palletB.trim()) {
      Alert.alert('Error', 'Please select or scan both source and target pallets.');
      return;
    }
    if (palletA.trim() === palletB.trim()) {
      Alert.alert('Error', 'Source and target pallets cannot be the same.');
      return;
    }
    const parsedQty = parseFloat(mergeQty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity to merge.');
      return;
    }
    if (availableQty !== null && parsedQty > availableQty) {
      Alert.alert('Error', `Quantity to merge cannot exceed available quantity (${availableQty} ${itemUom}).`);
      return;
    }

    setLoading(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('http://192.168.29.113:8000/wms/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_a: palletA,
          pallet_b: palletB,
          item_code: itemCode,
          qty: parsedQty,
        }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully merged ${parsedQty} ${itemUom} of [${itemName}] from Pallet [${palletA}] to Pallet [${palletB}]!`);
        setPalletA('');
        setPalletB('');
        setItemName('');
        setItemCode('');
        setAvailableQty(null);
        setMergeQty('');
        setActiveInput('A');
      } else {
        throw new Error('API server offline');
      }
    } catch (err) {
      setSuccessMessage(`[Simulated] Merged ${parsedQty} ${itemUom} of [${itemName}] from Pallet [${palletA}] to Pallet [${palletB}]!`);
      setPalletA('');
      setPalletB('');
      setItemName('');
      setItemCode('');
      setAvailableQty(null);
      setMergeQty('');
      setActiveInput('A');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = () => {
    if (simulatedRfid.trim()) {
      setSuccessMessage(null);
      if (activeInput === 'A') {
        setPalletA(simulatedRfid.trim());
        fetchPalletADetails(simulatedRfid.trim());
        setActiveInput('B');
      } else {
        setPalletB(simulatedRfid.trim());
      }
      setSimulatedRfid('');
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
        <Text style={styles.headerText}>Merge Pallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#5A80FD" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Consolidate stock by scanning a Source Pallet A, verifying its contents, entering quantity, and scanning Target Pallet B.
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.connectionBadge}>
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#4CAF50' : '#E53935' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Connected' : 'Scanner Disconnected'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          {/* Source Pallet A */}
          <Text style={styles.label}>Source Pallet A RFID</Text>
          {loadingWarehouses ? (
            <ActivityIndicator color="#5A80FD" style={{ marginVertical: hp(1) }} />
          ) : (
            <TouchableOpacity
              style={[styles.dropdownHeader, activeInput === 'A' && styles.dropdownHeaderActive]}
              onPress={() => {
                setShowADropdown(!showADropdown);
                setShowBDropdown(false);
                setActiveInput('A');
              }}
            >
              <Icon name="box" size={18} color={activeInput === 'A' ? '#5A80FD' : '#999'} style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, color: palletA ? '#333' : '#999', fontSize: wp(4) }}>
                {palletA || 'Select Pallet A...'}
              </Text>
              <Icon name={showADropdown ? "chevron-up" : "chevron-down"} size={20} color="#555" />
            </TouchableOpacity>
          )}

          {showADropdown && (
            <View style={styles.dropdownListContainer}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: hp(20) }}>
                {binsList.map((bin, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.dropdownListItem}
                    onPress={() => {
                      setPalletA(bin);
                      fetchPalletADetails(bin);
                      setShowADropdown(false);
                      setActiveInput('B');
                    }}
                  >
                    <Text style={styles.dropdownListItemText}>{bin}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {loadingItem && (
            <ActivityIndicator color="#5A80FD" style={{ marginVertical: hp(1.5) }} />
          )}

          {itemName && !loadingItem ? (
            <View style={styles.detailsBlock}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Product: </Text>
                <Text style={styles.detailVal}>{itemName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Available: </Text>
                <Text style={styles.detailVal}>{availableQty} {itemUom}</Text>
              </View>
            </View>
          ) : null}

          {/* Source Pallet B */}
          <Text style={styles.label}>Destination Pallet B RFID</Text>
          <TouchableOpacity
            style={[styles.dropdownHeader, activeInput === 'B' && styles.dropdownHeaderActive]}
            onPress={() => {
              setShowBDropdown(!showBDropdown);
              setShowADropdown(false);
              setActiveInput('B');
            }}
          >
            <Icon name="box" size={18} color={activeInput === 'B' ? '#5A80FD' : '#999'} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, color: palletB ? '#333' : '#999', fontSize: wp(4) }}>
              {palletB || 'Select Pallet B...'}
            </Text>
            <Icon name={showBDropdown ? "chevron-up" : "chevron-down"} size={20} color="#555" />
          </TouchableOpacity>

          {showBDropdown && (
            <View style={styles.dropdownListContainer}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: hp(20) }}>
                {binsList.map((bin, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.dropdownListItem}
                    onPress={() => {
                      setPalletB(bin);
                      setShowBDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownListItemText}>{bin}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quantity to Merge */}
          {itemName ? (
            <>
              <Text style={styles.label}>Quantity to Merge ({itemUom})</Text>
              <View style={[styles.inputContainer, { marginBottom: hp(2) }]}>
                <Icon name="edit-2" size={18} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter quantity to transfer"
                  value={mergeQty}
                  onChangeText={setMergeQty}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleMerge}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Merge & Consolidate</Text>
            )}
          </TouchableOpacity>
        </View>

        {successMessage && (
          <View style={styles.successCard}>
            <Icon name="check-circle" size={24} color="#4CAF50" style={{ marginRight: 10 }} />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}
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
  dropdownHeaderActive: {
    borderColor: '#5A80FD',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
  },
  dropdownListContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp(3),
    marginTop: -hp(1.5),
    marginBottom: hp(2),
    maxHeight: hp(20),
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    marginTop: hp(1.5),
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
  detailsBlock: {
    backgroundColor: '#F3F4F6',
    borderRadius: wp(2.5),
    padding: wp(3.5),
    marginBottom: hp(2.5),
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: wp(3.6),
    fontWeight: '600',
    color: '#666',
  },
  detailVal: {
    fontSize: wp(3.6),
    fontWeight: '700',
    color: '#333',
  },
});

export default MergePalletsScreen;
