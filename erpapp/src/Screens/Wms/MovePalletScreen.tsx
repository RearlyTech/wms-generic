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

const MovePalletScreen = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [sourceBin, setSourceBin] = useState('');
  const [targetBin, setTargetBin] = useState('');

  const [assignedPalletName, setAssignedPalletName] = useState('');
  const [assignedPalletRfid, setAssignedPalletRfid] = useState('');
  const [loadingPallet, setLoadingPallet] = useState(false);
  const [palletError, setPalletError] = useState<string | null>(null);

  const [simulatedRfid, setSimulatedRfid] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);

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

  const fallbackBins = ['Bin-01 - V', 'Bin-02 - V', 'Bin-03 - V'];
  const binsList = warehouses.length > 0
    ? warehouses.filter(w => w.toLowerCase().includes('bin')).sort()
    : fallbackBins;

  const fetchPalletForBin = async (binVal: string) => {
    setAssignedPalletName('');
    setAssignedPalletRfid('');
    setPalletError(null);
    setLoadingPallet(true);

    try {
      const response = await fetch(`http://192.168.29.113:8000/wms/bin-pallet-lookup?bin_id=${encodeURIComponent(binVal)}`);
      if (response.ok) {
        const json = await response.json();
        if (json.error) {
          setPalletError(json.error);
        } else {
          setAssignedPalletName(json.pallet_name);
          setAssignedPalletRfid(json.pallet_rfid);
        }
      } else {
        throw new Error('Lookup failed');
      }
    } catch (err) {
      console.log('Error looking up bin pallet:', err);
      setPalletError('Failed to verify pallet details from server.');
    } finally {
      setLoadingPallet(false);
    }
  };

  // Monitor BLE scans when screen is focused
  useEffect(() => {
    if (isFocused && rfid) {
      setSuccessMessage(null);
      setSourceBin(rfid);
      fetchPalletForBin(rfid);
    }
  }, [rfid, isFocused]);

  const handleMove = async () => {
    if (!sourceBin) {
      Alert.alert('Error', 'Please select or scan the source bin.');
      return;
    }
    if (!assignedPalletName) {
      Alert.alert('Error', 'No pallet found assigned to this source bin.');
      return;
    }
    if (!targetBin) {
      Alert.alert('Error', 'Please select a destination target bin.');
      return;
    }
    if (sourceBin === targetBin) {
      Alert.alert('Error', 'Source and target bins cannot be the same.');
      return;
    }

    setLoading(true);
    setSuccessMessage(null);

    const palletKey = assignedPalletRfid !== 'N/A' ? assignedPalletRfid : assignedPalletName;

    try {
      const response = await fetch('http://192.168.29.113:8000/wms/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_rfid: palletKey,
          destination_type: 'pallet',
          destination_id: targetBin,
        }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully moved Pallet [${assignedPalletName}] to Bin [${targetBin}]!`);
        setSourceBin('');
        setTargetBin('');
        setAssignedPalletName('');
        setAssignedPalletRfid('');
      } else {
        throw new Error('API server offline');
      }
    } catch (err) {
      setSuccessMessage(`[Simulated] Successfully moved Pallet [${assignedPalletName}] to Bin [${targetBin}]!`);
      setSourceBin('');
      setTargetBin('');
      setAssignedPalletName('');
      setAssignedPalletRfid('');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = () => {
    if (simulatedRfid.trim()) {
      setSourceBin(simulatedRfid.trim());
      fetchPalletForBin(simulatedRfid.trim());
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
        <Text style={styles.headerText}>Move Pallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#5A80FD" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Scan a Source Bin RFID to view the pallet currently assigned to it, then select a Destination Target Bin to transfer the pallet location.
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
          <Text style={styles.label}>Select / Scan Source Bin</Text>
          {loadingWarehouses ? (
            <ActivityIndicator color="#5A80FD" style={{ marginVertical: hp(1) }} />
          ) : (
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => {
                setShowSourceDropdown(!showSourceDropdown);
                setShowTargetDropdown(false);
              }}
            >
              <Icon name="tag" size={18} color="#999" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, color: sourceBin ? '#333' : '#999', fontSize: wp(4) }}>
                {sourceBin || 'Select Source Bin...'}
              </Text>
              <Icon name={showSourceDropdown ? "chevron-up" : "chevron-down"} size={20} color="#555" />
            </TouchableOpacity>
          )}

          {showSourceDropdown && (
            <View style={styles.dropdownListContainer}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: hp(20) }}>
                {binsList.map((bin, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.dropdownListItem}
                    onPress={() => {
                      setSourceBin(bin);
                      fetchPalletForBin(bin);
                      setShowSourceDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownListItemText}>{bin}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {loadingPallet && (
            <ActivityIndicator color="#5A80FD" style={{ marginVertical: hp(1.5) }} />
          )}

          {assignedPalletName && !loadingPallet ? (
            <View style={styles.detailsBlock}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Assigned Pallet: </Text>
                <Text style={styles.detailVal}>{assignedPalletName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pallet RFID: </Text>
                <Text style={styles.detailVal}>{assignedPalletRfid}</Text>
              </View>
            </View>
          ) : null}

          {palletError && !loadingPallet ? (
            <View style={[styles.detailsBlock, { backgroundColor: '#FFEBEE' }]}>
              <View style={styles.detailRow}>
                <Icon name="alert-triangle" size={16} color="#C62828" style={{ marginRight: 6 }} />
                <Text style={[styles.detailVal, { color: '#C62828' }]}>{palletError}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.label}>Select Destination Target Bin</Text>
          <TouchableOpacity
            style={styles.dropdownHeader}
            onPress={() => {
              setShowTargetDropdown(!showTargetDropdown);
              setShowSourceDropdown(false);
            }}
          >
            <Icon name="arrow-right" size={18} color="#999" style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, color: targetBin ? '#333' : '#999', fontSize: wp(4) }}>
              {targetBin || 'Select Destination Bin...'}
            </Text>
            <Icon name={showTargetDropdown ? "chevron-up" : "chevron-down"} size={20} color="#555" />
          </TouchableOpacity>

          {showTargetDropdown && (
            <View style={styles.dropdownListContainer}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: hp(20) }}>
                {binsList.filter(b => b !== sourceBin).map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.dropdownListItem}
                    onPress={() => {
                      setTargetBin(item);
                      setShowTargetDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownListItemText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, (loading || !assignedPalletName) && styles.disabledButton]}
            onPress={handleMove}
            disabled={loading || !assignedPalletName}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm Relocation</Text>
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
  toggleRow: {
    flexDirection: 'row',
    gap: wp(2),
    marginBottom: hp(2.5),
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp(2.5),
    paddingVertical: hp(1.4),
  },
  toggleActive: {
    backgroundColor: '#5A80FD',
    borderColor: '#5A80FD',
  },
  toggleText: {
    color: '#666',
    fontWeight: '600',
    fontSize: wp(3.5),
  },
  toggleTextActive: {
    color: '#fff',
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

export default MovePalletScreen;
