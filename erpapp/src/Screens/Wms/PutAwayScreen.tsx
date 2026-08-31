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
  KeyboardAvoidingView,
  Platform,
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

const PutAwayScreen = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [palletRfid, setPalletRfid] = useState('');
  const [selectedBin, setSelectedBin] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [loadingEmptyBin, setLoadingEmptyBin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [showBinDropdown, setShowBinDropdown] = useState(false);

  // Verification-related states
  const [scanStep, setScanStep] = useState<'pallet' | 'bin'>('pallet');
  const [scannedBinRfid, setScannedBinRfid] = useState('');
  const [isBinVerified, setIsBinVerified] = useState<boolean | null>(null);
  const [verifyingBin, setVerifyingBin] = useState(false);

  // Fetch empty warehouses list on mount
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        setLoadingWarehouses(true);
        const response = await fetch('http://77.42.39.77:8000/wms/empty-bins');
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

  const fallbackBins = ['Bin-01 - V', 'Bin-02 - V', 'Bin-03 - V'];
  const binsList = warehouses.length > 0
    ? warehouses.sort()
    : fallbackBins;

  // Listen to BLE RFID scans when focused
  useEffect(() => {
    if (isFocused && rfid) {
      if (scanStep === 'pallet') {
        setPalletRfid(rfid);
        setSuccessMessage(null);
        setIsBinVerified(null);
        setScannedBinRfid('');
        setScanStep('bin');
      } else if (scanStep === 'bin') {
        setScannedBinRfid(rfid);
        verifyScannedBin(rfid);
      }
    }
  }, [rfid, isFocused]);

  // Retrieve first empty bin automatically on scan or manual toggled off
  useEffect(() => {
    if (palletRfid && !isManual) {
      fetchFirstEmptyBin();
    }
  }, [palletRfid, isManual]);

  const fetchFirstEmptyBin = async () => {
    if (warehouses.length > 0) {
      setSelectedBin(warehouses[0]);
      return;
    }
    try {
      setLoadingEmptyBin(true);
      const response = await fetch('http://77.42.39.77:8000/wms/first-empty-bin');
      if (response.ok) {
        const json = await response.json();
        if (json.empty_bin) {
          setSelectedBin(json.empty_bin);
        }
      }
    } catch (err) {
      console.error('Error fetching empty bin:', err);
    } finally {
      setLoadingEmptyBin(false);
    }
  };

  const verifyScannedBin = async (binRfid: string) => {
    if (!selectedBin) return;
    try {
      setVerifyingBin(true);
      const response = await fetch(`http://77.42.39.77:8000/wms/resolve-warehouse?rfid=${encodeURIComponent(binRfid.trim())}`);
      if (response.ok) {
        const json = await response.json();
        const resolvedName = json.warehouse;
        
        // Normalize names for comparison (remove hyphens, spaces, casing)
        const normalize = (val: string) => val.toLowerCase().replace(/[- ]/g, '').trim();
        if (normalize(resolvedName) === normalize(selectedBin)) {
          setIsBinVerified(true);
        } else {
          setIsBinVerified(false);
          Alert.alert('Wrong Location', `Scanned Bin [${resolvedName}] does not match the assigned Bin [${selectedBin}]. Please place it in [${selectedBin}].`);
        }
      } else {
        setIsBinVerified(false);
      }
    } catch (err) {
      console.error(err);
      setIsBinVerified(false);
    } finally {
      setVerifyingBin(false);
    }
  };

  const handlePutAway = async () => {
    if (!palletRfid.trim()) {
      Alert.alert('Error', 'Please scan or enter a Pallet RFID first.');
      return;
    }
    if (!selectedBin.trim()) {
      Alert.alert('Error', 'No target Bin selected/assigned.');
      return;
    }
    if (!isManual && isBinVerified !== true) {
      Alert.alert('Error', 'Please scan the target Bin RFID to verify the location first.');
      return;
    }

    setLoading(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('http://77.42.39.77:8000/wms/put-away', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_rfid: palletRfid.trim(),
          bin_id: selectedBin.trim(),
        }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully put away Pallet [${palletRfid}] into Bin [${selectedBin}]!`);
        setPalletRfid('');
        setSelectedBin('');
        setScannedBinRfid('');
        setIsBinVerified(null);
        setScanStep('pallet');
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.detail || 'Failed to put away';
        Alert.alert('ERPNext Error', 'Operation failed. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Put Away Failed', 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
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
        <Text style={styles.headerText}>Put Away Pallet</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* INSTRUCTIONS */}
          <View style={styles.instructionCard}>
            <Icon name="info" size={20} color="#3fbf75" style={{ marginRight: 8 }} />
            <Text style={styles.instructionText}>
              {scanStep === 'pallet'
                ? 'Scan the Pallet RFID tag to check vacant slot recommendations.'
                : `Walk to ${selectedBin} and scan its physical Bin RFID to verify location.`
              }
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
            <Text style={styles.label}>Scanned Pallet RFID</Text>
            <View style={styles.inputContainer}>
              <Icon name="tag" size={18} color="#62788a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Scan or enter Pallet RFID..."
                value={palletRfid}
                editable={scanStep === 'pallet'}
                onChangeText={(text) => {
                  setPalletRfid(text);
                  if (text) setScanStep('bin');
                }}
                placeholderTextColor="#62788a"
              />
              {palletRfid ? (
                <TouchableOpacity onPress={() => {
                  setPalletRfid('');
                  setSelectedBin('');
                  setScannedBinRfid('');
                  setIsBinVerified(null);
                  setScanStep('pallet');
                }}>
                  <Icon name="rotate-ccw" size={18} color="#3fbf75" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* MANUAL OVERRIDE CHECKBOX */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                setIsManual(!isManual);
                setSelectedBin('');
                setShowBinDropdown(false);
                setScannedBinRfid('');
                setIsBinVerified(null);
              }}
            >
              <Icon
                name={isManual ? "check-square" : "square"}
                size={22}
                color={isManual ? "#3fbf75" : "#62788a"}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.checkboxLabel}>Manual Assignment Override</Text>
            </TouchableOpacity>

            {/* TARGET BIN ASSIGNMENT */}
            <Text style={styles.label}>Target Assignment Bin</Text>
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
                    <Text style={{ flex: 1, color: selectedBin ? '#ecf1f4' : '#62788a', fontFamily: 'Archivo', fontSize: wp(4) }}>
                      {selectedBin || 'Select Target Bin...'}
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
                          setSelectedBin(bin);
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
              <View style={[styles.dropdownHeader, { backgroundColor: '#121b26', borderColor: '#3fbf75' }]}>
                <Icon name="box" size={18} color="#3fbf75" style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, color: selectedBin ? '#ecf1f4' : '#62788a', fontFamily: 'Archivo', fontSize: wp(4), fontWeight: '600' }}>
                  {loadingEmptyBin ? 'Finding vacant bin...' : (selectedBin || 'No vacant bin found')}
                </Text>
                {loadingEmptyBin && <ActivityIndicator size="small" color="#3fbf75" />}
              </View>
            )}

            {/* STEP 2: VERIFICATION SECTION */}
            {palletRfid && !isManual && selectedBin ? (
              <View style={styles.verificationContainer}>
                <Text style={styles.label}>Verify Location: Scan Bin RFID</Text>
                <View style={[
                  styles.inputContainer,
                  isBinVerified === true && { borderColor: '#3fbf75', backgroundColor: '#3fbf75' },
                  isBinVerified === false && { borderColor: '#e0654f', backgroundColor: '#e0654f' }
                ]}>
                  <Icon name="map-pin" size={18} color={isBinVerified === true ? '#3fbf75' : (isBinVerified === false ? '#e0654f' : '#62788a')} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Scan or enter Bin RFID..."
                    value={scannedBinRfid}
                    onChangeText={(text) => {
                      setScannedBinRfid(text);
                      if (text.length >= 4) verifyScannedBin(text);
                    }}
                    placeholderTextColor="#62788a"
                  />
                  {verifyingBin && <ActivityIndicator size="small" color="#3fbf75" />}
                  {isBinVerified === true && <Icon name="check" size={20} color="#3fbf75" />}
                  {isBinVerified === false && <Icon name="x" size={20} color="#e0654f" />}
                </View>

                {/* Status helper text */}
                {isBinVerified === true ? (
                  <Text style={styles.successHelperText}>Bin verified successfully! You may now confirm.</Text>
                ) : isBinVerified === false ? (
                  <Text style={styles.errorHelperText}>Verification failed! Bins do not match.</Text>
                ) : (
                  <Text style={styles.infoHelperText}>Please walk to {selectedBin} and scan its Bin RFID tag.</Text>
                )}
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (loading || (!isManual && isBinVerified !== true)) && styles.disabledButton
              ]}
              onPress={handlePutAway}
              disabled={loading || (!isManual && isBinVerified !== true)}
            >
              {loading ? (
                <ActivityIndicator color="#0a0f16" />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm Put Away</Text>
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
      </KeyboardAvoidingView>
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
    marginTop: hp(1.5),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121b26',
    borderWidth: 1,
    borderColor: '#121b26',
    borderRadius: wp(3),
    paddingHorizontal: wp(3.5),
    marginBottom: hp(1),
  },
  inputIcon: {
    marginRight: wp(2),
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
    paddingVertical: hp(1.5),
    marginBottom: hp(1),
  },
  checkboxLabel: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    color: '#4B5563',
    fontWeight: '600',
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
    paddingVertical: hp(1.4),
    paddingHorizontal: wp(4),
    borderBottomWidth: 0.5,
    borderBottomColor: '#0a0f16',
  },
  dropdownListItemText: {
    fontFamily: 'Archivo', fontSize: wp(4),
    color: '#ecf1f4',
    fontWeight: '500',
  },
  verificationContainer: {
    marginTop: hp(1),
    borderTopWidth: 1,
    borderTopColor: '#0a0f16',
    paddingTop: hp(1.5),
  },
  successHelperText: {
    color: '#3fbf75',
    fontFamily: 'Archivo', fontSize: wp(3.4),
    fontWeight: '600',
    marginBottom: hp(1.5),
  },
  errorHelperText: {
    color: '#e0654f',
    fontFamily: 'Archivo', fontSize: wp(3.4),
    fontWeight: '600',
    marginBottom: hp(1.5),
  },
  infoHelperText: {
    color: '#6B7280',
    fontFamily: 'Archivo', fontSize: wp(3.4),
    fontWeight: '500',
    marginBottom: hp(1.5),
  },
  primaryButton: {
    backgroundColor: '#3fbf75',
    borderRadius: wp(3),
    paddingVertical: hp(1.8),
    alignItems: 'center',
    marginTop: hp(2),
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
});

export default PutAwayScreen;
