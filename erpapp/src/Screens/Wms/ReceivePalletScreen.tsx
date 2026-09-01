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

  const [isManual, setIsManual] = useState(false);
  const [scanStep, setScanStep] = useState<'item' | 'pallet'>('item');

  // Fetch warehouse list on mount
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
      if (scanStep === 'item' || (!scannedRfid && scanStep === 'pallet')) {
        setScannedRfid(rfid);
        if (!isManual) setScanStep('pallet');
      } else {
        setPalletId(rfid);
      }
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
      const response = await fetch('http://77.42.39.77:8000/wms/receive', {
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
        setScanStep('item');
      } else {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'API request failed');
      }
    } catch (err: any) {
      Alert.alert('Assignment Failed', 'Operation failed. Please try again.');
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
      <SafeAreaView style={{ backgroundColor: '#3fbf75' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#3fbf75'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#ecf1f4" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Assign to Pallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* INSTRUCTIONS */}
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#3fbf75" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            {isManual
              ? 'Scan an RFID-labelled item, then manually select the target Pallet ID.'
              : scanStep === 'item'
                ? 'Step 1: Scan an RFID-labelled item.'
                : `Step 2: Scan the Target Pallet RFID for item [${scannedRfid}].`
            }
          </Text>
        </View>

        {/* SCAN STATUS */}
        <View style={styles.statusRow}>
          <View style={styles.connectionBadge}>
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#3fbf75' : 'transparent' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Connected' : ''}
            </Text>
          </View>
        </View>

        {/* INPUTS CONTAINER */}
        <View style={styles.card}>
          <Text style={styles.label}>Scanned Item RFID Tag</Text>
          <View style={styles.inputContainer}>
            <Icon name="tag" size={18} color="#62788a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Scan Item RFID..."
              value={scannedRfid}
              editable={false}
              placeholderTextColor="#62788a"
            />
            {scannedRfid ? (
              <TouchableOpacity onPress={() => {
                setScannedRfid('');
                setScanStep('item');
              }}>
                <Icon name="x" size={18} color="#62788a" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* MANUAL OVERRIDE CHECKBOX */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              setIsManual(!isManual);
              setPalletId('');
              setShowBinDropdown(false);
              if (isManual) {
                // switching to auto (scanner)
                setScanStep(scannedRfid ? 'pallet' : 'item');
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

          <Text style={styles.label}>Assign to Pallet ID</Text>
          {isManual ? (
            <>
              {loadingWarehouses ? (
                <ActivityIndicator color="#3fbf75" style={{ marginVertical: hp(1) }} />
              ) : (
                <TouchableOpacity
                  style={styles.dropdownHeader}
                  onPress={() => setShowBinDropdown(!showBinDropdown)}
                >
                  <Icon name="box" size={18} color="#62788a" style={{ marginRight: 8 }} />
                  <Text style={{ flex: 1, color: palletId ? '#ecf1f4' : '#62788a', fontFamily: 'Archivo', fontSize: wp(4) }}>
                    {palletId || 'Select Target Pallet...'}
                  </Text>
                  <Icon name={showBinDropdown ? "chevron-up" : "chevron-down"} size={20} color="#9db0bd" />
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
            </>
          ) : (
            <View style={styles.inputContainer}>
              <Icon name="tag" size={18} color="#62788a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Scan Pallet..."
                value={palletId}
                editable={scanStep === 'pallet'}
                onChangeText={(text) => setPalletId(text)}
                placeholderTextColor="#62788a"
              />
              {palletId ? (
                <TouchableOpacity onPress={() => setPalletId('')}>
                  <Icon name="x" size={18} color="#62788a" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleAssign}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0f16" />
            ) : (
              <Text style={styles.primaryButtonText}>Assign to Pallet</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* FEEDBACK STATUS */}
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
    borderColor: '#283845',
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
  dropdownListInline: {
    backgroundColor: '#121b26',
    borderWidth: 1,
    borderColor: '#283845',
    borderRadius: wp(3),
    marginBottom: hp(2),
    overflow: 'hidden',
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
    color: '#000',
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

export default ReceivePalletScreen;
