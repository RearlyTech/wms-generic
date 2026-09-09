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

const MovePalletScreen = ({ navigation, route }: { navigation: any, route?: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [sourceBin, setSourceBin] = useState(route?.params?.initialSourcePallet || '');
  const [targetBin, setTargetBin] = useState(route?.params?.initialTargetPallet || '');

  const [assignedPalletName, setAssignedPalletName] = useState('');
  const [assignedPalletRfid, setAssignedPalletRfid] = useState('');
  const [loadingPallet, setLoadingPallet] = useState(false);
  const [palletError, setPalletError] = useState<string | null>(null);

  const [simulatedRfid, setSimulatedRfid] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [isManual, setIsManual] = useState(false);

  const [activeTaskId, setActiveTaskId] = useState(route?.params?.taskId || null);
  const [expectedSourceBin, setExpectedSourceBin] = useState('');
  const [expectedTargetBin, setExpectedTargetBin] = useState('');
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(false);

  const fetchPendingTasks = async () => {
    setFetchingTasks(true);
    try {
      const response = await fetch('http://77.42.39.77:8000/wms/mobile-tasks');
      if (response.ok) {
        const data = await response.json();
        setPendingTasks(data.filter((t: any) => t.task_type === 'Move Pallet' && t.status === 'Pending'));
      }
    } catch (err) {
      console.warn('Failed to fetch tasks', err);
    } finally {
      setFetchingTasks(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchPendingTasks();
    }
  }, [isFocused]);

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

    if (route?.params?.initialSourcePallet) {
      fetchPalletForBin(route.params.initialSourcePallet);
    }
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
      const response = await fetch(`http://77.42.39.77:8000/wms/bin-pallet-lookup?bin_id=${encodeURIComponent(binVal)}`);
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

  useEffect(() => {
    if (isFocused && rfid) {
      setSuccessMessage(null);
      if (!sourceBin || (!isManual && sourceBin && !targetBin)) {
        if (!sourceBin) {
          setSourceBin(rfid);
          fetchPalletForBin(rfid);
        } else {
          setTargetBin(rfid);
        }
      }
    }
  }, [rfid, isFocused, sourceBin, isManual]);

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
      const response = await fetch('http://77.42.39.77:8000/wms/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_rfid: palletKey,
          destination_type: 'pallet',
          destination_id: targetBin,
          expected_source: activeTaskId ? expectedSourceBin : null,
          expected_target: activeTaskId ? expectedTargetBin : null,
        }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully moved Pallet [${assignedPalletName}] to Bin [${targetBin}]!`);
        setSourceBin('');
        setTargetBin('');
        setAssignedPalletName('');
        setAssignedPalletRfid('');

        if (activeTaskId) {
          try {
            await fetch(`http://77.42.39.77:8000/wms/tasks/${activeTaskId}/complete`, {
              method: 'PUT',
            });
            setActiveTaskId(null);
            fetchPendingTasks();
          } catch (e) {
            console.error('Failed to complete task', e);
          }
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'API request failed');
      }
    } catch (err: any) {
      Alert.alert('Move Failed', 'Operation failed. Please try again.');
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
      <SafeAreaView style={{ backgroundColor: '#3fbf75' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#3fbf75'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#ecf1f4" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Move Pallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#3fbf75" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Scan a Source Bin RFID to view the pallet currently assigned to it, then select a Destination Target Bin to transfer the pallet location.
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
          <Text style={styles.label}>Scanned Source Bin</Text>
          <View style={styles.inputContainer}>
            <Icon name="tag" size={18} color="#62788a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Scan Source Bin..."
              value={sourceBin}
              editable={false}
              placeholderTextColor="#62788a"
            />
            {sourceBin ? (
              <TouchableOpacity onPress={() => {
                setSourceBin('');
                setAssignedPalletName('');
                setAssignedPalletRfid('');
                setPalletError(null);
              }}>
                <Icon name="x" size={18} color="#62788a" />
              </TouchableOpacity>
            ) : null}
          </View>

          {loadingPallet && (
            <ActivityIndicator color="#3fbf75" style={{ marginVertical: hp(1.5) }} />
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
            <View style={[styles.detailsBlock, { backgroundColor: '#e0654f' }]}>
              <View style={styles.detailRow}>
                <Icon name="alert-triangle" size={16} color="#e0654f" style={{ marginRight: 6 }} />
                <Text style={[styles.detailVal, { color: '#ffffff' }]}>{palletError}</Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              setIsManual(!isManual);
              setTargetBin('');
              setShowTargetDropdown(false);
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

          <Text style={styles.label}>Destination Target Bin</Text>
          {isManual ? (
            <>
              <TouchableOpacity
                style={styles.dropdownHeader}
                onPress={() => {
                  setShowTargetDropdown(!showTargetDropdown);
                }}
              >
                <Icon name="arrow-right" size={18} color="#62788a" style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, color: targetBin ? '#ecf1f4' : '#62788a', fontFamily: 'Archivo', fontSize: wp(4) }}>
                  {targetBin || 'Select Destination Bin...'}
                </Text>
                <Icon name={showTargetDropdown ? "chevron-up" : "chevron-down"} size={20} color="#9db0bd" />
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
            </>
          ) : (
            <View style={styles.inputContainer}>
              <Icon name="tag" size={18} color="#62788a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Scan Target Bin..."
                value={targetBin}
                editable={false}
                placeholderTextColor="#62788a"
              />
              {targetBin ? (
                <TouchableOpacity onPress={() => setTargetBin('')}>
                  <Icon name="x" size={18} color="#62788a" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, (loading || !assignedPalletName || !activeTaskId || !sourceBin || !targetBin) && styles.disabledButton]}
            onPress={handleMove}
            disabled={loading || !assignedPalletName || !activeTaskId || !sourceBin || !targetBin}
          >
            {loading ? (
              <ActivityIndicator color="#0a0f16" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {!activeTaskId ? "Select a Task" : (!sourceBin || !targetBin) ? "Scan Locations First" : "Confirm Relocation"}
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

        {/* PENDING TASKS QUEUE */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="list" size={20} color="#3fbf75" />
            <Text style={styles.cardTitle}>Pending Move Tasks ({pendingTasks.length})</Text>
          </View>
          {fetchingTasks ? (
            <ActivityIndicator color="#3fbf75" style={{ marginVertical: 10 }} />
          ) : pendingTasks.length > 0 ? (
            pendingTasks.map((task) => (
              <TouchableOpacity
                key={task.name}
                style={[
                  styles.taskItem,
                  activeTaskId === task.name && { borderColor: '#3fbf75', borderWidth: 2 }
                ]}
                onPress={() => {
                  setExpectedSourceBin(task.source_pallet || '');
                  setExpectedTargetBin(task.target_pallet || '');
                  setActiveTaskId(task.name);
                }}
              >
                <View style={styles.taskHeader}>
                  <Text style={styles.taskName}>{task.name}</Text>
                  <Text style={styles.taskDate}>{new Date(task.creation).toLocaleDateString()}</Text>
                </View>
                <View style={styles.taskBody}>
                  <Text style={styles.taskDetail}>Source: {task.source_pallet}</Text>
                  <Text style={styles.taskDetail}>Target: {task.target_pallet}</Text>
                  {task.notes && <Text style={styles.taskNotes}>Notes: {task.notes}</Text>}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyTasksText}>No pending tasks found.</Text>
          )}
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
  toggleRow: {
    flexDirection: 'row',
    gap: wp(2),
    marginBottom: hp(2.5),
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121b26',
    borderWidth: 1,
    borderColor: '#121b26',
    borderRadius: wp(2.5),
    paddingVertical: hp(1.4),
  },
  toggleActive: {
    backgroundColor: '#3fbf75',
    borderColor: '#3fbf75',
  },
  toggleText: {
    color: '#9db0bd',
    fontWeight: '600',
    fontFamily: 'Archivo', fontSize: wp(3.5),
  },
  toggleTextActive: {
    color: '#ecf1f4',
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
    fontFamily: 'Archivo',
    fontSize: wp(3.6),
    fontWeight: '700',
    color: '#ecf1f4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Archivo',
    fontSize: wp(4),
    fontWeight: 'bold',
    color: '#3fbf75',
    marginLeft: 8,
  },
  taskItem: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3fbf75',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  taskName: {
    color: '#ecf1f4',
    fontWeight: 'bold',
    fontSize: wp(3.5),
  },
  taskDate: {
    color: '#9db0bd',
    fontSize: wp(3),
  },
  taskBody: {
    flexDirection: 'column',
  },
  taskDetail: {
    color: '#9db0bd',
    fontSize: wp(3.5),
  },
  taskNotes: {
    color: '#e0654f',
    fontSize: wp(3.2),
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyTasksText: {
    color: '#9db0bd',
    fontSize: wp(3.5),
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  }
});

export default MovePalletScreen;
