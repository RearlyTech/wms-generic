import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
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
}

const StockCountScreen = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [activeContainer, setActiveContainer] = useState<{name: string, rfid: string} | null>(null);
  const [scanHistory, setScanHistory] = useState<ScannedItem[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (isFocused && rfid) {
      handleScanRFID(rfid);
    }
  }, [rfid, isFocused]);

  const handleScanRFID = async (tag: string) => {
    setIsResolving(true);
    try {
      const response = await fetch(`http://192.168.29.113:8000/wms/resolve-tag-info?rfid=${encodeURIComponent(tag)}`);
      if (response.ok) {
        const json = await response.json();
        
        if (json.type === 'Warehouse') {
          // It's a bin/pallet
          setActiveContainer({
            name: json.name,
            rfid: json.rfid,
          });
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
            type: json.type
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
      <SafeAreaView style={{ backgroundColor: '#5A80FD' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#5A80FD'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Stock Count</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        {/* CONNECTION BADGE */}
        <View style={styles.statusRow}>
          <View style={styles.connectionBadge}>
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#4CAF50' : '#E53935' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Active' : 'Scanner Disconnected'}
            </Text>
          </View>
        </View>

        {/* INSTRUCTIONS */}
        <View style={styles.instructionCard}>
          <Icon name="info" size={24} color="#5A80FD" style={{ marginRight: 12 }} />
          <Text style={styles.instructionText}>
            Step 1: Scan a Bin or Pallet RFID.{'\n'}
            Step 2: Scan Item RFIDs to verify location.
          </Text>
        </View>

        {/* ACTIVE CONTAINER CARD */}
        <View style={styles.activeContainerCard}>
          <View style={styles.activeContainerHeader}>
            <Icon name="box" size={24} color={activeContainer ? '#5A80FD' : '#A0AEC0'} />
            <Text style={styles.activeContainerTitle}>Active Location (Bin/Pallet)</Text>
          </View>
          {activeContainer ? (
            <View style={styles.activeContainerDetails}>
              <Text style={styles.activeContainerName}>{activeContainer.name}</Text>
              <Text style={styles.activeContainerRfid}>RFID: {activeContainer.rfid}</Text>
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
              <ActivityIndicator size="small" color="#5A80FD" />
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
                      <Icon name="check-circle" size={32} color="#4CAF50" />
                    ) : (
                      <Icon name="x-circle" size={32} color="#E53935" />
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
                <Icon name="x" size={28} color="#4A5568" />
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
    paddingBottom: hp(10),
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: hp(2),
    justifyContent: 'flex-end',
  },
  connectionBadge: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
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
    fontSize: wp(3.5),
    color: '#4A5568',
    fontWeight: '700',
  },
  instructionCard: {
    backgroundColor: '#EBF0FF',
    borderLeftWidth: 5,
    borderLeftColor: '#5A80FD',
    borderRadius: wp(3),
    padding: wp(5),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2.5),
    elevation: 2,
  },
  instructionText: {
    color: '#3F51B5',
    fontSize: wp(4.5),
    fontWeight: '600',
    lineHeight: hp(3),
    flex: 1,
  },
  activeContainerCard: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(5),
    marginBottom: hp(3),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderTopWidth: 6,
    borderTopColor: '#5A80FD',
  },
  activeContainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  activeContainerTitle: {
    fontSize: wp(5),
    fontWeight: '800',
    color: '#2D3748',
    marginLeft: wp(3),
  },
  activeContainerDetails: {
    backgroundColor: '#E8F5E9',
    padding: wp(4),
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  activeContainerName: {
    fontSize: wp(6),
    fontWeight: '800',
    color: '#1B5E20',
    marginBottom: hp(0.5),
  },
  activeContainerRfid: {
    fontSize: wp(3.8),
    color: '#388E3C',
    fontWeight: '600',
  },
  emptyContainerState: {
    alignItems: 'center',
    paddingVertical: hp(2),
    backgroundColor: '#F7FAFC',
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyContainerText: {
    fontSize: wp(4.5),
    fontWeight: '700',
    color: '#718096',
    marginBottom: hp(0.5),
  },
  emptyContainerSubtext: {
    fontSize: wp(3.8),
    color: '#A0AEC0',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(5),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
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
    fontSize: wp(5.5),
    fontWeight: '800',
    color: '#2D3748',
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
    fontSize: wp(3.8),
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(2),
  },
  loaderText: {
    marginLeft: wp(3),
    fontSize: wp(4),
    color: '#4A5568',
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
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  rowIncorrect: {
    backgroundColor: '#FFEBEE',
    borderColor: '#EF9A9A',
  },
  rowIconContainer: {
    marginRight: wp(4),
  },
  rowContent: {
    flex: 1,
  },
  itemName: {
    fontSize: wp(5),
    fontWeight: '800',
    color: '#2D3748',
    marginBottom: hp(0.3),
  },
  itemRfid: {
    fontSize: wp(3.5),
    color: '#718096',
    fontWeight: '600',
    marginBottom: hp(0.5),
  },
  locationMismatchContainer: {
    backgroundColor: '#FFEBEE',
    padding: wp(2),
    borderRadius: wp(1.5),
    marginTop: hp(0.5),
  },
  locationMismatchText: {
    fontSize: wp(3.5),
    color: '#C62828',
  },
  locationMatchText: {
    fontSize: wp(3.8),
    color: '#2E7D32',
  },
  boldText: {
    fontWeight: '800',
  },
  emptyHistoryText: {
    textAlign: 'center',
    paddingVertical: hp(4),
    fontSize: wp(4.5),
    color: '#A0AEC0',
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
    backgroundColor: '#fff',
    borderRadius: wp(5),
    width: wp(90),
    padding: wp(6),
    elevation: 10,
    shadowColor: '#000',
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
    fontSize: wp(6),
    fontWeight: '900',
    color: '#2D3748',
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
    fontSize: wp(3.5),
    fontWeight: '800',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: hp(0.5),
  },
  detailValue: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#2D3748',
  },
});

export default StockCountScreen;
