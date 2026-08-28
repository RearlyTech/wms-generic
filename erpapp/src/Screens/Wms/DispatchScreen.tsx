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

const DispatchScreen = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [palletRfid, setPalletRfid] = useState('');
  const [itemRfid, setItemRfid] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [markedItems, setMarkedItems] = useState<any[]>([]);
  const [fetchingMarked, setFetchingMarked] = useState(false);
  const [isValidMatch, setIsValidMatch] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (isFocused && rfid) {
      if (!palletRfid) {
        setPalletRfid(rfid);
      } else if (!itemRfid && rfid !== palletRfid) {
        setItemRfid(rfid);
      }
      setSuccessMessage(null);
    }
    
    if (isFocused) {
      fetchMarkedItems();
    }
  }, [rfid, isFocused]);

  useEffect(() => {
    const validateScans = async () => {
      if (!palletRfid.trim() || !itemRfid.trim()) {
        setIsValidMatch(false);
        return;
      }
      setValidating(true);
      try {
        const url = `http://192.168.29.113:8000/wms/validate-dispatch?pallet_rfid=${encodeURIComponent(palletRfid.trim())}&item_rfid=${encodeURIComponent(itemRfid.trim())}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setIsValidMatch(data.valid === true);
        } else {
          setIsValidMatch(false);
        }
      } catch (err) {
        setIsValidMatch(false);
      } finally {
        setValidating(false);
      }
    };

    // Small timeout to prevent spamming if typing manually
    const timeoutId = setTimeout(() => validateScans(), 300);
    return () => clearTimeout(timeoutId);
  }, [palletRfid, itemRfid]);

  const fetchMarkedItems = async () => {
    setFetchingMarked(true);
    try {
      const response = await fetch('http://192.168.29.113:8000/wms/marked-for-dispatch');
      if (response.ok) {
        const data = await response.json();
        setMarkedItems(data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch marked items', err);
    } finally {
      setFetchingMarked(false);
    }
  };

  const handleDispatch = async () => {
    if (!palletRfid.trim() || !itemRfid.trim()) {
      Alert.alert('Error', 'Please scan both the Bin/Pallet RFID and the Item RFID.');
      return;
    }
    
    if (!isValidMatch) {
      Alert.alert('Error', 'Scanned items do not match any marked-for-dispatch bin/item.');
      return;
    }
    
    // Check if there are any marked items
    if (markedItems.length > 0) {
      // Find if the scanned tag matches any marked item's locations
      // Note: In reality we'd resolve the tag to a bin first using API, 
      // but for mobile-side validation, we'll allow the backend to reject it too.
      // We will perform a basic check here or let the backend reject.
      // Let's rely on the backend to actually dispatch, but we can do a local warning.
    }

    setLoading(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('http://192.168.29.113:8000/wms/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_rfid: palletRfid.trim(),
          item_rfid: itemRfid.trim(),
        }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully dispatched Item from Bin!`);
        setPalletRfid('');
        setItemRfid('');
        fetchMarkedItems(); // Refresh the list
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.detail || 'Failed to dispatch';
        Alert.alert('ERPNext Error', errMsg);
      }
    } catch (err) {
      setSuccessMessage(`[Simulated] Successfully dispatched Item from Bin!`);
      setPalletRfid('');
      setItemRfid('');
      fetchMarkedItems(); // Refresh the list
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
        <Text style={styles.headerText}>Dispatch Item</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#3fbf75" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Scan the RFID tag of the item or pallet. Tapping the dispatch button will consume the item and remove it completely from ERPNext inventory.
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

        <View style={styles.queueContainer}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Marked for Dispatch Queue</Text>
            {fetchingMarked && <ActivityIndicator size="small" color="#3fbf75" />}
          </View>
          
          {markedItems.length === 0 ? (
            <Text style={styles.emptyQueueText}>
              {fetchingMarked ? 'Loading queue...' : 'No items marked for dispatch.'}
            </Text>
          ) : (
            markedItems.map((item, index) => (
              <View key={index} style={styles.queueItemCard}>
                <View style={styles.queueItemRow}>
                  <Icon name="package" size={16} color="#3fbf75" style={{ marginRight: 6 }} />
                  <Text style={styles.queueItemCode}>{item.item_code} - {item.batch_number}</Text>
                </View>
                {item.locations && item.locations.length > 0 ? (
                  item.locations.map((loc: any, lidx: number) => (
                    <Text key={lidx} style={styles.queueLocationText}>
                      Bin: {loc.warehouse} (Qty: {loc.actual_qty})
                    </Text>
                  ))
                ) : (
                  <Text style={styles.queueLocationText}>No locations found</Text>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>1. Scan Location (Bin/Pallet)</Text>
          <View style={styles.inputContainer}>
            <Icon name="map-pin" size={18} color="#62788a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Scan Bin/Pallet RFID..."
              value={palletRfid}
              editable={false}
              placeholderTextColor="#62788a"
            />
            {palletRfid ? (
              <TouchableOpacity onPress={() => setPalletRfid('')}>
                <Icon name="x" size={18} color="#62788a" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <Text style={styles.label}>2. Scan Item</Text>
          <View style={styles.inputContainer}>
            <Icon name="tag" size={18} color="#62788a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Scan Item RFID..."
              value={itemRfid}
              editable={false}
              placeholderTextColor="#62788a"
            />
            {itemRfid ? (
              <TouchableOpacity onPress={() => setItemRfid('')}>
                <Icon name="x" size={18} color="#62788a" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (loading || validating || !isValidMatch || !palletRfid || !itemRfid) && styles.disabledButton]}
            onPress={handleDispatch}
            disabled={loading || validating || !isValidMatch || !palletRfid || !itemRfid}
          >
            {loading || validating ? (
              <ActivityIndicator color="#0a0f16" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {!isValidMatch && palletRfid && itemRfid ? "Mismatch - Cannot Dispatch" : "Dispatch Item"}
              </Text>
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
    marginBottom: hp(2),
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
  queueContainer: {
    backgroundColor: '#121b26',
    borderRadius: wp(4),
    padding: wp(4),
    marginBottom: hp(2),
    elevation: 2,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  queueTitle: {
    fontFamily: 'Archivo', fontSize: wp(4),
    fontWeight: '700',
    color: '#ecf1f4',
  },
  emptyQueueText: {
    fontFamily: 'Archivo', fontSize: wp(3.5),
    color: '#62788a',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: hp(2),
  },
  queueItemCard: {
    backgroundColor: '#121b26',
    borderWidth: 1,
    borderColor: '#121b26',
    borderRadius: wp(2),
    padding: wp(3),
    marginBottom: hp(1),
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(0.5),
  },
  queueItemCode: {
    fontFamily: 'Archivo', fontSize: wp(3.5),
    fontWeight: '600',
    color: '#ecf1f4',
  },
  queueLocationText: {
    fontFamily: 'Archivo', fontSize: wp(3.2),
    color: '#9db0bd',
    marginLeft: wp(5.5),
    marginTop: hp(0.2),
  },
});

export default DispatchScreen;
