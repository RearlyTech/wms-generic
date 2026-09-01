import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
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

interface ScannedItem {
  rfid: string;
  name: string;
  expectedLocation: string;
  scannedContainerName: string | null;
  isCorrect: boolean;
  type: string;
  is_reserved?: boolean;
}

const StockCountScreen = ({ navigation, route }: { navigation: any, route?: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [activeContainer, setActiveContainer] = useState<{ name: string, rfid: string, location?: string } | null>(null);
  const [scanHistory, setScanHistory] = useState<ScannedItem[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [activeTaskId, setActiveTaskId] = useState(route?.params?.taskId || null);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(false);

  const fetchPendingTasks = async () => {
    setFetchingTasks(true);
    try {
      const response = await fetch('http://77.42.39.77:8000/wms/mobile-tasks');
      if (response.ok) {
        const data = await response.json();
        setPendingTasks(data.filter((t: any) => t.task_type === 'Stock Count' && t.status === 'Pending'));
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

  useEffect(() => {
    if (isFocused && rfid) {
      handleScanRFID(rfid);
    }
  }, [rfid, isFocused]);

  useEffect(() => {
    if (route?.params?.initialSourcePallet) {
      handleScanRFID(route.params.initialSourcePallet);
    }
  }, []);

  const handleCompleteTask = async () => {
    if (activeTaskId) {
      try {
        await fetch(`http://77.42.39.77:8000/wms/tasks/${activeTaskId}/complete`, {
          method: 'PUT',
        });
        setActiveTaskId(null);
        fetchPendingTasks();
        Alert.alert('Task Completed', 'The stock count task was marked as completed.');
      } catch (e) {
        console.error('Failed to complete task', e);
      }
    }
  };

  const handleScanRFID = async (tag: string) => {
    setIsResolving(true);
    try {
      const response = await fetch(`http://77.42.39.77:8000/wms/resolve-tag-info?rfid=${encodeURIComponent(tag)}`);
      if (response.ok) {
        const json = await response.json();

        if (json.type === 'Warehouse') {
          const isBin = json.name.toLowerCase().includes('bin');
          if (!activeContainer && isBin) {
            // It's a bin, set as active
            setActiveContainer({
              name: json.name,
              rfid: json.rfid,
              location: json.location,
            });
          } else if (activeContainer) {
            // Treat scanned pallet (or anything else) as a verified item against the active bin
            if (scanHistory.some(item => item.rfid === tag)) {
              setIsResolving(false);
              return;
            }

            const cleanExpected = json.location ? json.location.split(' - ')[0].trim() : '';
            const cleanActive = activeContainer ? activeContainer.name.split(' - ')[0].trim() : '';
            const isCorrect = activeContainer ? cleanExpected === cleanActive : false;

            setScanHistory(prev => [{
              rfid: json.rfid,
              name: json.name,
              expectedLocation: cleanExpected || json.location,
              scannedContainerName: activeContainer ? cleanActive : null,
              isCorrect: isCorrect,
              type: json.type,
              is_reserved: json.is_reserved
            }, ...prev]);
          } else {
            Alert.alert('Scan Error', 'Please scan a Bin first before scanning pallets.');
          }
        } else if (json.type === 'Item') {
          // Ensure we don't add duplicates to history, or just bring it to top if you want
          if (scanHistory.some(item => item.rfid === tag)) {
            setIsResolving(false);
            return;
          }

          const cleanExpected = json.location ? json.location.split(' - ')[0].trim() : '';
          const cleanActive = activeContainer ? activeContainer.name.split(' - ')[0].trim() : '';
          const isCorrect = activeContainer ? cleanExpected === cleanActive : false;

          setScanHistory(prev => [{
            rfid: json.rfid,
            name: json.name,
            expectedLocation: cleanExpected || json.location,
            scannedContainerName: activeContainer ? cleanActive : null,
            isCorrect: isCorrect,
            type: json.type,
            is_reserved: json.is_reserved
          }, ...prev]);
        } else {
          // Unknown tag
          if (scanHistory.some(item => item.rfid === tag)) return;

          setScanHistory(prev => [{
            rfid: tag,
            name: 'Unknown Tag',
            expectedLocation: 'N/A',
            scannedContainerName: activeContainer ? activeContainer.name : null,
            isCorrect: false,
            type: 'Unknown'
          }, ...prev]);
        }
      }
    } catch (err) {
      console.log('Error resolving tag info:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleClear = () => {
    setActiveContainer(null);
    setScanHistory([]);
  };

  const handleItemPress = (item: ScannedItem) => {
    setSelectedItemDetail({
      item_code: item.name,
      item_name: item.name,
      rfid_tag: item.rfid,
      location: item.expectedLocation,
      type: item.type,
      scanned_in: item.scannedContainerName || 'None'
    });
    setShowDetailModal(true);
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
        <Text style={styles.headerText}>Stock Count</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* CONNECTION BADGE */}
        <View style={styles.statusRow}>
          <View style={styles.connectionBadge}>
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#3fbf75' : 'transparent' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Active' : ''}
            </Text>
          </View>
        </View>

        {/* INSTRUCTIONS */}
        <View style={styles.instructionCard}>
          <Icon name="info" size={24} color="#3fbf75" style={{ marginRight: 12 }} />
          <Text style={styles.instructionText}>
            Step 1: Select a Task or Scan a Bin.{'\n'}
            Step 2: Scan Pallets (or Items) to verify they are in this Bin.
          </Text>
        </View>

        {/* ACTIVE CONTAINER CARD */}
        <View style={styles.activeContainerCard}>
          <View style={styles.activeContainerHeader}>
            <Icon name="box" size={24} color={activeContainer ? '#3fbf75' : '#A0AEC0'} />
            <Text style={styles.activeContainerTitle}>Active Location (Bin/Pallet)</Text>
          </View>
          {activeContainer ? (
            <View style={styles.activeContainerDetails}>
              <Text style={styles.activeContainerName}>{activeContainer.name}</Text>
              <Text style={styles.activeContainerRfid}>RFID: {activeContainer.rfid}</Text>
              {activeContainer.location && (
                <Text style={styles.activeContainerLocation}>Parent Location: {activeContainer.location}</Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyContainerState}>
              <Text style={styles.emptyContainerText}>No Bin/Pallet Scanned Yet</Text>
              <Text style={styles.emptyContainerSubtext}>Please scan a location tag first.</Text>
            </View>
          )}
        </View>

        {/* SCAN HISTORY */}
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Scanned Items ({scanHistory.length})</Text>
            {(scanHistory.length > 0 || activeContainer) && (
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {isResolving && (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color="#3fbf75" />
              <Text style={styles.loaderText}>Resolving tag...</Text>
            </View>
          )}

          <View style={styles.historyList}>
            {scanHistory.map((item, idx) => {
              const isCorrect = item.isCorrect;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.historyRow, isCorrect ? styles.rowCorrect : styles.rowIncorrect]}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowIconContainer}>
                    {isCorrect ? (
                      <Icon name="check-circle" size={32} color="#3fbf75" />
                    ) : (
                      <Icon name="x-circle" size={32} color="#e0654f" />
                    )}
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemRfid}>Tag: {item.rfid}</Text>

                    {!isCorrect ? (
                      <View style={styles.locationMismatchContainer}>
                        <Text style={styles.locationMismatchText}>
                          Expected: <Text style={styles.boldText}>{item.expectedLocation}</Text>
                        </Text>
                        <Text style={styles.locationMismatchText}>
                          Scanned In: <Text style={styles.boldText}>{item.scannedContainerName || 'None'}</Text>
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.locationMatchText}>
                        Location: <Text style={styles.boldText}>{item.expectedLocation}</Text>
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {scanHistory.length === 0 && !isResolving && (
              <Text style={styles.emptyHistoryText}>Scan items to see them here...</Text>
            )}
          </View>
        </View>

        {/* PENDING TASKS QUEUE */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="list" size={20} color="#3fbf75" />
            <Text style={styles.cardTitle}>Pending Count Tasks ({pendingTasks.length})</Text>
          </View>
          {fetchingTasks ? (
            <ActivityIndicator color="#3fbf75" style={{ marginVertical: 10 }} />
          ) : pendingTasks.length > 0 ? (
            pendingTasks.map((task) => (
              <TouchableOpacity
                key={task.name}
                style={styles.taskItem}
                onPress={() => {
                  setActiveTaskId(task.name);
                  if (task.source_pallet) handleScanRFID(task.source_pallet);
                }}
              >
                <View style={styles.taskHeader}>
                  <Text style={styles.taskName}>{task.name}</Text>
                  <Text style={styles.taskDate}>{new Date(task.creation).toLocaleDateString()}</Text>
                </View>
                <View style={styles.taskBody}>
                  <Text style={styles.taskDetail}>Location to Count: {task.source_pallet}</Text>
                  {task.notes && <Text style={styles.taskNotes}>Notes: {task.notes}</Text>}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyTasksText}>No pending tasks found.</Text>
          )}
        </View>

        {activeTaskId && (
          <TouchableOpacity 
            onPress={handleCompleteTask} 
            style={{
              backgroundColor: '#3fbf75',
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              marginTop: 20,
              marginBottom: 10,
              shadowColor: '#3fbf75',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Archivo' }}>Complete Stock Count</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Item Details Modal */}
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Item Details</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeModalButton}>
                <Icon name="x" size={28} color="#ecf1f4" />
              </TouchableOpacity>
            </View>

            {selectedItemDetail && (
              <View style={styles.modalBody}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Item Name</Text>
                  <Text style={styles.detailValue}>{selectedItemDetail.item_name}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>RFID Tag</Text>
                  <Text style={styles.detailValue} selectable={true}>{selectedItemDetail.rfid_tag}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Expected Location</Text>
                  <Text style={styles.detailValue}>{selectedItemDetail.location}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Scanned In (Bin/Pallet)</Text>
                  <Text style={styles.detailValue}>{selectedItemDetail.scanned_in}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: hp(10),
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: hp(2),
    justifyContent: 'flex-end',
  },
  connectionBadge: {
    backgroundColor: '#121b26',
    borderRadius: 50,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  connectionText: {
    fontFamily: 'Archivo', fontSize: wp(3.5),
    color: '#ecf1f4',
    fontWeight: '700',
  },
  instructionCard: {
    backgroundColor: '#18242f',
    borderLeftWidth: 5,
    borderLeftColor: '#3fbf75',
    borderRadius: wp(3),
    padding: wp(5),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2.5),
    elevation: 2,
  },
  instructionText: {
    color: '#3fbf75',
    fontFamily: 'Archivo', fontSize: wp(4.5),
    fontWeight: '600',
    lineHeight: hp(3),
    flex: 1,
  },
  activeContainerCard: {
    backgroundColor: '#121b26',
    borderRadius: wp(4),
    padding: wp(5),
    marginBottom: hp(3),
    elevation: 4,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderTopWidth: 6,
    borderTopColor: '#3fbf75',
  },
  activeContainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  activeContainerTitle: {
    fontFamily: 'Archivo', fontSize: wp(5),
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: wp(3),
  },
  activeContainerDetails: {
    backgroundColor: '#3fbf75',
    padding: wp(4),
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: '#3fbf75',
  },
  activeContainerName: {
    fontFamily: 'Archivo', fontSize: wp(6),
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: hp(0.5),
  },
  activeContainerRfid: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    color: '#ffffff',
    fontWeight: '600',
  },
  activeContainerLocation: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    color: '#ffffff',
    fontWeight: '500',
    marginTop: hp(0.5),
  },
  emptyContainerState: {
    alignItems: 'center',
    paddingVertical: hp(2),
    backgroundColor: '#121b26',
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyContainerText: {
    fontFamily: 'Archivo', fontSize: wp(4.5),
    fontWeight: '700',
    color: '#9db0bd',
    marginBottom: hp(0.5),
  },
  emptyContainerSubtext: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    color: '#ecf1f4',
  },
  historyCard: {
    backgroundColor: '#121b26',
    borderRadius: wp(4),
    padding: wp(5),
    elevation: 4,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
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
    color: '#ecf1f4',
    fontSize: wp(3),
  },
  taskBody: {
    flexDirection: 'column',
  },
  taskDetail: {
    color: '#ecf1f4',
    fontSize: wp(3.5),
  },
  taskNotes: {
    color: '#e0654f',
    fontSize: wp(3.2),
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyTasksText: {
    color: '#ecf1f4',
    fontSize: wp(3.5),
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#EDF2F7',
    paddingBottom: hp(1.5),
    marginBottom: hp(2),
  },
  historyTitle: {
    fontFamily: 'Archivo', fontSize: wp(5.5),
    fontWeight: '800',
    color: '#ffffff',
  },
  clearButton: {
    backgroundColor: '#FED7D7',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1),
    borderRadius: wp(2),
  },
  clearText: {
    color: '#C53030',
    fontWeight: '800',
    fontFamily: 'Archivo', fontSize: wp(3.8),
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(2),
  },
  loaderText: {
    marginLeft: wp(3),
    fontFamily: 'Archivo', fontSize: wp(4),
    color: '#ecf1f4',
    fontWeight: '600',
  },
  historyList: {
    marginTop: hp(0.5),
  },
  historyRow: {
    flexDirection: 'row',
    borderRadius: wp(3),
    padding: wp(4),
    marginBottom: hp(1.5),
    borderWidth: 1.5,
    alignItems: 'center',
  },
  rowCorrect: {
    backgroundColor: '#3fbf75',
    borderColor: '#3fbf75',
  },
  rowIncorrect: {
    backgroundColor: '#e0654f',
    borderColor: '#EF9A9A',
  },
  rowIconContainer: {
    marginRight: wp(4),
  },
  rowContent: {
    flex: 1,
  },
  itemName: {
    fontFamily: 'Archivo', fontSize: wp(5),
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: hp(0.3),
  },
  itemRfid: {
    fontFamily: 'Archivo', fontSize: wp(3.5),
    color: '#ecf1f4',
    fontWeight: '600',
    marginBottom: hp(0.5),
  },
  locationMismatchContainer: {
    backgroundColor: '#e0654f',
    padding: wp(2),
    borderRadius: wp(1.5),
    marginTop: hp(0.5),
  },
  locationMismatchText: {
    fontFamily: 'Archivo', fontSize: wp(3.5),
    color: '#ffffff',
  },
  locationMatchText: {
    fontFamily: 'Archivo', fontSize: wp(3.8),
    color: '#ffffff',
  },
  boldText: {
    fontWeight: '800',
  },
  emptyHistoryText: {
    textAlign: 'center',
    paddingVertical: hp(4),
    fontFamily: 'Archivo', fontSize: wp(4.5),
    color: '#ecf1f4',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 32, 44, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(5),
  },
  modalContent: {
    backgroundColor: '#121b26',
    borderRadius: wp(5),
    width: wp(90),
    padding: wp(6),
    elevation: 10,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#EDF2F7',
    paddingBottom: hp(2),
    marginBottom: hp(2),
  },
  modalTitle: {
    fontFamily: 'Archivo', fontSize: wp(6),
    fontWeight: '900',
    color: '#ffffff',
  },
  closeModalButton: {
    padding: wp(1),
  },
  modalBody: {
    marginTop: hp(1),
  },
  detailItem: {
    marginBottom: hp(2.5),
  },
  detailLabel: {
    fontFamily: 'Archivo', fontSize: wp(3.5),
    fontWeight: '800',
    color: '#ecf1f4',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: hp(0.5),
  },
  detailValue: {
    fontFamily: 'Archivo', fontSize: wp(5),
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default StockCountScreen;
