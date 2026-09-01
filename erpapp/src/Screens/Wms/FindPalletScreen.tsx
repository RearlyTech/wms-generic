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

interface PalletLocation {
  pallet_id: string;
  row: string;
  rack: string;
  bin: string;
  item_name: string;
  weight: string;
  status: string;
}

const FindPalletScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [palletId, setPalletId] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationResult, setLocationResult] = useState<PalletLocation | null>(null);
  const [simulatedRfid, setSimulatedRfid] = useState('');

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [showBinDropdown, setShowBinDropdown] = useState(false);

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

  const fallbackBins = ['Bin-01 - V', 'Bin-02 - V', 'Bin-03 - V'];
  const binsList = warehouses.length > 0
    ? warehouses.filter(w => w.toLowerCase().includes('bin'))
    : fallbackBins;

  const handleSearch = async (searchId: string) => {
    const queryId = searchId.trim() || palletId.trim();
    if (!queryId) {
      Alert.alert('Error', 'Please select or scan a Bin ID to search.');
      return;
    }

    setPalletId(queryId);
    setLoading(true);
    setLocationResult(null);

    try {
      const response = await fetch(`http://77.42.39.77:8000/wms/find?pallet_id=${encodeURIComponent(queryId)}`);
      if (response.ok) {
        const json = await response.json();
        setLocationResult(json);
      } else {
        throw new Error('API server offline');
      }
    } catch (err) {
      // Local Mock fallback search
      const mockLocations: { [key: string]: PalletLocation } = {
        'Bin-01 - V': {
          pallet_id: 'Bin-01 - V',
          row: 'Row A',
          rack: 'Rack 01',
          bin: 'Shelf A',
          item_name: 'Maida Flour Grade A',
          weight: '450 kg',
          status: 'Stored',
        },
        'Bin-02 - V': {
          pallet_id: 'Bin-02 - V',
          row: 'Row B',
          rack: 'Rack 02',
          bin: 'Shelf B',
          item_name: 'Sugar Fine Granules',
          weight: '800 kg',
          status: 'Stored',
        },
      };

      setLocationResult(
        mockLocations[queryId] || {
          pallet_id: queryId,
          row: 'Row F (MOCKED)',
          rack: 'Rack 02 (MOCKED)',
          bin: 'Shelf C (MOCKED)',
          item_name: 'Wheat Grain Premium',
          weight: '120 kg',
          status: 'Active',
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = () => {
    if (simulatedRfid.trim()) {
      handleSearch(simulatedRfid.trim());
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
        <Text style={styles.headerText}>Find Bin / Location</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#3fbf75" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Select or scan a Bin RFID to lookup its designated coordinates (Row, Rack, Shelf) inside the warehouse.
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.connectionBadge}>
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#3fbf75' : 'transparent' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Connected' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Select Bin ID</Text>
          {loadingWarehouses ? (
            <ActivityIndicator color="#3fbf75" style={{ marginVertical: hp(1) }} />
          ) : (
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => setShowBinDropdown(!showBinDropdown)}
            >
              <Icon name="search" size={18} color="#62788a" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, color: palletId ? '#ecf1f4' : '#62788a', fontFamily: 'Archivo', fontSize: wp(4) }}>
                {palletId || 'Select/Scan Bin...'}
              </Text>
              <Icon name={showBinDropdown ? "chevron-up" : "chevron-down"} size={20} color="#9db0bd" />
            </TouchableOpacity>
          )}

          {showBinDropdown && (
            <View style={styles.dropdownListContainer}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: hp(20) }}>
                {binsList.map((bin, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.dropdownListItem}
                    onPress={() => {
                      handleSearch(bin);
                      setShowBinDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownListItemText}>{bin}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={() => handleSearch(palletId)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0f16" />
            ) : (
              <Text style={styles.primaryButtonText}>Search Location</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* RESULTS CARD */}
        {locationResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Icon name="map-pin" size={22} color="#3fbf75" />
              <Text style={styles.resultTitle}>Location Coordinates</Text>
            </View>

            <View style={styles.coordGrid}>
              <View style={styles.coordBox}>
                <Text style={styles.coordLabel}>ROW</Text>
                <Text style={styles.coordVal}>{locationResult.row}</Text>
              </View>
              <View style={styles.coordBox}>
                <Text style={styles.coordLabel}>RACK</Text>
                <Text style={styles.coordVal}>{locationResult.rack}</Text>
              </View>
              <View style={styles.coordBox}>
                <Text style={styles.coordLabel}>SHELF</Text>
                <Text style={styles.coordVal}>{locationResult.bin}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailsList}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Bin ID</Text>
                <Text style={styles.detailValue}>{locationResult.pallet_id}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Item Label</Text>
                <Text style={styles.detailValue}>{locationResult.item_name}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Stock Qty/Weight</Text>
                <Text style={styles.detailValue}>{locationResult.weight}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: locationResult.status === 'Stored' ? '#3fbf75' : '#0a0f163E0' }]}>
                  <Text style={[styles.statusText, { color: locationResult.status === 'Stored' ? '#3fbf75' : '#d9933f' }]}>{locationResult.status}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* <View style={styles.simCard}>
          <Text style={styles.simTitle}>Simulate RFID Scan (Developer Mode)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Tag to simulate..."
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
    marginBottom: hp(2),
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
  resultCard: {
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
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2.5),
  },
  resultTitle: {
    fontFamily: 'Archivo', fontSize: wp(4.5),
    fontWeight: '700',
    color: '#ecf1f4',
    marginLeft: wp(2),
  },
  coordGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: wp(2),
    marginBottom: hp(2.5),
  },
  coordBox: {
    flex: 1,
    backgroundColor: '#18242f',
    borderRadius: wp(2.5),
    padding: wp(3.5),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4E2FF',
  },
  coordLabel: {
    fontFamily: 'Archivo', fontSize: wp(3),
    color: '#3fbf75',
    fontWeight: '700',
    marginBottom: 4,
  },
  coordVal: {
    fontFamily: 'Archivo', fontSize: wp(4.2),
    color: '#3fbf75',
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#283845',
    marginBottom: hp(2),
  },
  detailsList: {},
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp(1.2),
    borderBottomWidth: 0.5,
    borderBottomColor: '#283845',
  },
  detailLabel: {
    fontFamily: 'Archivo', fontSize: wp(3.6),
    color: '#9db0bd',
    fontWeight: '500',
  },
  detailValue: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    color: '#ecf1f4',
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.5),
    borderRadius: 50,
  },
  statusText: {
    fontFamily: 'Archivo', fontSize: wp(3.2),
    fontWeight: '700',
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

export default FindPalletScreen;
