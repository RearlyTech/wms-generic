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

const DispatchScreen = ({ navigation, route }: { navigation: any, route?: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [palletRfid, setPalletRfid] = useState(route?.params?.initialSourcePallet || '');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [activeTaskId, setActiveTaskId] = useState(route?.params?.taskId || null);
  const [expectedPalletRfid, setExpectedPalletRfid] = useState('');
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(false);

  useEffect(() => {
    if (isFocused && rfid) {
      setPalletRfid(rfid);
      setSuccessMessage(null);
    }

    if (isFocused) {
      fetchPendingTasks();
    }
  }, [rfid, isFocused]);

  const fetchPendingTasks = async () => {
    setFetchingTasks(true);
    try {
      const response = await fetch('http://77.42.39.77:8000/wms/mobile-tasks');
      if (response.ok) {
        const data = await response.json();
        setPendingTasks(data.filter((t: any) => t.task_type === 'Dispatch' && t.status === 'Pending'));
      }
    } catch (err) {
      console.warn('Failed to fetch pending tasks', err);
    } finally {
      setFetchingTasks(false);
    }
  };

  const handleDispatch = async () => {
    if (!palletRfid.trim()) {
      Alert.alert('Error', 'Please scan the Bin/Pallet RFID.');
      return;
    }

    if (!activeTaskId || !expectedPalletRfid) {
      Alert.alert('Error', 'Please select a pending dispatch task.');
      return;
    }

    setLoading(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('http://77.42.39.77:8000/wms/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_rfid: palletRfid.trim(),
          expected_location: expectedPalletRfid.trim(),
        }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully dispatched items from Pallet!`);
        setPalletRfid('');
        
        if (activeTaskId) {
          try {
            await fetch(`http://77.42.39.77:8000/wms/tasks/${activeTaskId}/complete`, {
              method: 'PUT',
            });
            setActiveTaskId(null);
          } catch (e) {
            console.error('Failed to complete task', e);
          }
        }
        
        fetchPendingTasks(); // Refresh the list
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.detail || 'Failed to dispatch';
        Alert.alert('ERPNext Error', errMsg);
      }
    } catch (err: any) {
      Alert.alert('Dispatch Failed', 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async () => {
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
        {route?.params?.taskId ? (
          <TouchableOpacity onPress={handleCompleteTask} style={{ padding: 4 }}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Done</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
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
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#3fbf75' : 'transparent' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Connected' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="list" size={20} color="#3fbf75" />
            <Text style={styles.cardTitle}>Pending Dispatch Tasks ({pendingTasks.length})</Text>
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
                  setExpectedPalletRfid(task.source_pallet || '');
                  setActiveTaskId(task.name);
                }}
              >
                <View style={styles.taskHeader}>
                  <Text style={styles.taskName}>{task.name}</Text>
                  <Text style={styles.taskDate}>{new Date(task.creation).toLocaleDateString()}</Text>
                </View>
                <View style={styles.taskBody}>
                  <Text style={styles.taskDetail}>Source Location: {task.source_pallet}</Text>
                  {task.notes && <Text style={styles.taskNotes}>Notes: {task.notes}</Text>}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyTasksText}>No pending tasks found.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>1. Scan Location (Bin/Pallet)</Text>
          <View style={styles.inputContainer}>
            <Icon name="map-pin" size={18} color="#62788a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Scan Bin/Pallet..."
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

          <TouchableOpacity
            style={[
              styles.primaryButton, 
              (loading || !palletRfid || !activeTaskId || !expectedPalletRfid) && styles.disabledButton
            ]}
            onPress={handleDispatch}
            disabled={loading || !palletRfid || !activeTaskId || !expectedPalletRfid}
          >
            {loading ? (
              <ActivityIndicator color="#0a0f16" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {(!activeTaskId || !expectedPalletRfid) ? "Select a Task" : "Dispatch Pallet"}
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
    color: '#000',
    fontFamily: 'Archivo', fontSize: wp(3.8),
    fontWeight: '600',
    flex: 1,
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

export default DispatchScreen;
