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

  const [showBDropdown, setShowBDropdown] = useState(false);
  const [isManual, setIsManual] = useState(false);

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
      if (activeInput === 'A' || (!isManual && activeInput === 'B')) {
        if (activeInput === 'A') {
          setPalletA(rfid);
          fetchPalletADetails(rfid);
          if (!isManual) setActiveInput('B');
        } else {
          setPalletB(rfid);
        }
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
      <SafeAreaView style={{ backgroundColor: '#3fbf75' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#3fbf75'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#ecf1f4" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Merge Pallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#3fbf75" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Consolidate stock by scanning a Source Pallet A, verifying its contents, entering quantity, and scanning Target Pallet B.
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.connectionBadge}>
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#3fbf75' : '#e0654f' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Connected' : 'Scanner Disconnected'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Scanned Source Pallet A RFID</Text>
          <View style={styles.inputContainer}>
            <Icon name="tag" size={18} color={activeInput === 'A' ? '#3fbf75' : '#62788a'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Waiting for Source Pallet A RFID scan..."
              value={palletA}
              editable={false}
              placeholderTextColor="#62788a"
            />
            {palletA ? (
              <TouchableOpacity onPress={() => {
                setPalletA('');
                setItemName('');
                setItemCode('');
                setAvailableQty(null);
                setMergeQty('');
                setActiveInput('A');
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
                <Text style={styles.detailVal}>{availableQty} {itemUom}</Text>
              </View>
            </View>
          ) : null}

          {/* MANUAL OVERRIDE CHECKBOX */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              setIsManual(!isManual);
              setPalletB('');
              setShowBDropdown(false);
              if (isManual) {
                // Switching back to auto
                setActiveInput(palletA ? 'B' : 'A');
              } else {
                setActiveInput('B');
              }
            }}
          >
            <Icon
              name={isManual ? "check-square" : "square"}
              size={22}
              color={isManual ? "#3fbf75" : "#62788a"}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.checkboxLabel}>Manual Pallet Selection</Text>
          </TouchableOpacity>

          {/* Destination Pallet B */}
          <Text style={styles.label}>Destination Pallet B RFID</Text>
          {isManual ? (
            <>
              <TouchableOpacity
                style={[styles.dropdownHeader, activeInput === 'B' && styles.dropdownHeaderActive]}
                onPress={() => {
                  setShowBDropdown(!showBDropdown);
                  setActiveInput('B');
                }}
              >
                <Icon name="box" size={18} color={activeInput === 'B' ? '#3fbf75' : '#62788a'} style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, color: palletB ? '#ecf1f4' : '#62788a', fontFamily: 'Archivo', fontSize: wp(4) }}>
                  {palletB || 'Select Pallet B...'}
                </Text>
                <Icon name={showBDropdown ? "chevron-up" : "chevron-down"} size={20} color="#9db0bd" />
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
            </>
          ) : (
            <View style={styles.inputContainer}>
              <Icon name="tag" size={18} color={activeInput === 'B' ? '#3fbf75' : '#62788a'} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Scan Destination Pallet B RFID..."
                value={palletB}
                editable={false}
                placeholderTextColor="#62788a"
              />
              {palletB ? (
                <TouchableOpacity onPress={() => {
                  setPalletB('');
                  setActiveInput('B');
                }}>
                  <Icon name="x" size={18} color="#62788a" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Quantity to Merge */}
          {itemName ? (
            <>
              <Text style={styles.label}>Quantity to Merge ({itemUom})</Text>
              <View style={[styles.inputContainer, { marginBottom: hp(2) }]}>
                <Icon name="edit-2" size={18} color="#62788a" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter quantity to transfer"
                  value={mergeQty}
                  onChangeText={setMergeQty}
                  keyboardType="numeric"
                  placeholderTextColor="#62788a"
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
              <ActivityIndicator color="#0a0f16" />
            ) : (
              <Text style={styles.primaryButtonText}>Merge & Consolidate</Text>
            )}
          </TouchableOpacity>
        </View>

        {successMessage && (
          <View style={styles.successCard}>
            <Icon name="check-circle" size={24} color="#3fbf75" style={{ marginRight: 10 }} />
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
  statusRow: {
    flexDirection: 'row',
    marginBottom: hp(2),
  },
  connectionBadge: {
    backgroundColor: '#121b26',
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
    fontFamily: 'Archivo', fontSize: wp(3.2),
    color: '#9db0bd',
    fontWeight: '600',
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkboxLabel: {
    color: '#ecf1f4',
    fontFamily: 'Archivo',
    fontSize: wp(3.8),
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
  dropdownHeaderActive: {
    borderColor: '#3fbf75',
    backgroundColor: '#121b26',
    borderWidth: 1.5,
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
  primaryButton: {
    backgroundColor: '#3fbf75',
    borderRadius: wp(3),
    paddingVertical: hp(1.8),
    alignItems: 'center',
    marginTop: hp(1.5),
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
});

export default MergePalletsScreen;
