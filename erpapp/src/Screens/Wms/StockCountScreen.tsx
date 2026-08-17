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

const StockCountScreen = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const { rfid, connectedDevice } = useBLE();

  const [scannedTags, setScannedTags] = useState<string[]>([]);
  const [resolvedTags, setResolvedTags] = useState<Record<string, any>>({});
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (isFocused && rfid) {
      addTagIfUnique(rfid);
    }
  }, [rfid, isFocused]);

  const fetchWarehouses = async () => {
    try {
      setLoadingWarehouses(true);
      const response = await fetch('http://192.168.29.113:8000/warehouses');
      if (response.ok) {
        const json = await response.json();
        setWarehouses(json.sort());
      }
    } catch (error) {
      console.log('Error fetching warehouses:', error);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const fetchWarehouseItems = async (warehouse: string) => {
    try {
      setLoadingItems(true);
      const response = await fetch(`http://192.168.29.113:8000/warehouse-items?warehouse=${encodeURIComponent(warehouse)}`);
      if (response.ok) {
        const json = await response.json();
        setWarehouseItems(json);
      } else {
        setWarehouseItems([]);
      }
    } catch (error) {
      console.log('Error fetching warehouse items:', error);
      setWarehouseItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const resolveTagInfo = async (tag: string) => {
    try {
      const response = await fetch(`http://192.168.29.113:8000/wms/resolve-tag-info?rfid=${encodeURIComponent(tag)}`);
      if (response.ok) {
        const json = await response.json();
        setResolvedTags(prev => ({
          ...prev,
          [tag]: json
        }));
      }
    } catch (err) {
      console.log('Error resolving tag info:', err);
    }
  };

  const addTagIfUnique = (tag: string) => {
    setScannedTags(prev => {
      if (prev.includes(tag)) return prev;
      resolveTagInfo(tag);
      return [...prev, tag];
    });
  };

  const handleClear = () => {
    setScannedTags([]);
    setResolvedTags({});
  };

  const handleItemPress = (item: any) => {
    setSelectedItemDetail(item);
    setShowDetailModal(true);
  };

  const handleTagPress = (tag: string) => {
    const resolved = resolvedTags[tag];
    if (resolved) {
      setSelectedItemDetail({
        item_code: resolved.name,
        item_name: resolved.name,
        rfid_tag: resolved.rfid,
        qty: resolved.type === 'Item' ? '1.0' : 'N/A',
        location: resolved.location,
        type: resolved.type
      });
      setShowDetailModal(true);
    } else {
      setSelectedItemDetail({
        item_code: 'Resolving details...',
        item_name: 'Resolving details...',
        rfid_tag: tag,
        qty: 'Unknown',
        location: 'N/A'
      });
      setShowDetailModal(true);
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
        <Text style={styles.headerText}>Stock Count</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* INSTRUCTIONS */}
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#5A80FD" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            Select a warehouse to audit. Sweep scan items in that warehouse to verify present and missing items.
          </Text>
        </View>

        {/* CONNECTION BADGE */}
        <View style={styles.statusRow}>
          <View style={styles.connectionBadge}>
            <View style={[styles.dot, { backgroundColor: connectedDevice ? '#4CAF50' : '#E53935' }]} />
            <Text style={styles.connectionText}>
              {connectedDevice ? 'Scanner Connected' : 'Scanner Disconnected'}
            </Text>
          </View>
        </View>

        {/* SCANNED RFIDs */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.scannedCountText}>Scanned RFIDs ({scannedTags.length})</Text>
            {scannedTags.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <Text style={styles.clearText}>Clear List</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.scannedList}>
            {scannedTags.map((tag, idx) => {
              const resolved = resolvedTags[tag];
              const name = resolved ? resolved.name : 'Resolving...';
              const location = resolved ? resolved.location : '...';
              const type = resolved ? resolved.type : 'Tag';
              
              let badgeBg = '#EBF0FF';
              let badgeColor = '#5A80FD';
              if (type === 'Warehouse') {
                badgeBg = '#E8F5E9';
                badgeColor = '#2E7D32';
              } else if (type === 'Item') {
                badgeBg = '#FFF3E0';
                badgeColor = '#EF6C00';
              }

              return (
                <TouchableOpacity key={idx} style={styles.scannedRow} onPress={() => handleTagPress(tag)}>
                  <View style={styles.scannedRowTop}>
                    <View style={[styles.typeTag, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.typeTagText, { color: badgeColor }]}>{type}</Text>
                    </View>
                    <Text style={styles.scannedTagName} numberOfLines={1}>{name}</Text>
                  </View>
                  <View style={styles.scannedRowBottom}>
                    <Text style={styles.scannedTagRfid}>Tag: {tag.substring(0, 12)}...</Text>
                    <Text style={styles.scannedTagLoc}>
                      Loc: <Text style={{fontWeight: '700', color: '#333'}}>{location}</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {scannedTags.length === 0 && (
              <Text style={styles.emptyText}>No tags scanned yet...</Text>
            )}
          </View>
        </View>

        {/* WAREHOUSE SELECT FILTER */}
        <View style={[styles.card, { zIndex: 2000 }]}>
          <Text style={styles.label}>Select Warehouse to Audit</Text>
          <View style={{ zIndex: 1000 }}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowDropdown(!showDropdown)}
            >
              <Text style={{ color: selectedWarehouse ? '#333' : '#999', fontSize: wp(4) }}>
                {selectedWarehouse || 'Select Warehouse'}
              </Text>
              <Icon name={showDropdown ? "chevron-up" : "chevron-down"} size={20} color="#555" />
            </TouchableOpacity>

            {showDropdown && (
              <View style={styles.dropdownListInline}>
                {loadingWarehouses ? (
                  <ActivityIndicator style={{ padding: wp(3) }} size="small" color="#5A80FD" />
                ) : (
                  warehouses.map((w, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedWarehouse(w);
                        setShowDropdown(false);
                        fetchWarehouseItems(w);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{w}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        </View>

        {/* EXPECTED ITEMS VERIFICATION LIST */}
        {selectedWarehouse ? (
          <View style={styles.tableContainer}>
            <Text style={styles.tableTitle}>Items in {selectedWarehouse}</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Item</Text>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>RFID Tag</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Present</Text>
            </View>
            {loadingItems ? (
              <ActivityIndicator style={{ marginTop: hp(2), marginBottom: hp(2) }} size="small" color="#5A80FD" />
            ) : warehouseItems.length > 0 ? (
              warehouseItems.map((item, idx) => {
                const isPresent = scannedTags.includes(item.rfid_tag);

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.tableRowContainer, isPresent && { backgroundColor: '#F4FFF4' }]}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tableRowText, { flex: 2, fontWeight: '600', color: isPresent ? '#2E7D32' : '#333' }]} numberOfLines={1}>{item.item_name}</Text>
                    <Text style={[styles.tableRowText, { flex: 2, color: '#666', fontSize: wp(3.5) }]} numberOfLines={1}>{item.rfid_tag}</Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      {isPresent ? (
                        <Icon name="check-circle" size={22} color="#4CAF50" />
                      ) : (
                        <Icon name="x-circle" size={22} color="#E53935" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.noItemsText}>No items found.</Text>
            )}
          </View>
        ) : null}
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
              <Text style={styles.modalTitle}>Item Stock Details</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} style={{ padding: 4 }}>
                <Icon name="x" size={22} color="#555" />
              </TouchableOpacity>
            </View>
            
            {selectedItemDetail && (
              <View style={styles.modalBody}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Item Code / Name</Text>
                  <Text style={styles.detailValue}>{selectedItemDetail.item_name || selectedItemDetail.item_code}</Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>RFID Tag</Text>
                  <Text style={styles.detailValue} selectable={true}>{selectedItemDetail.rfid_tag || selectedItemDetail.rfid || 'N/A'}</Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>ERPNext Quantity</Text>
                  <Text style={styles.detailValue}>
                    {selectedItemDetail.qty !== undefined ? selectedItemDetail.qty : '0'} Nos
                  </Text>
                </View>
                
                {selectedItemDetail.location ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Database Location</Text>
                    <Text style={styles.detailValue}>{selectedItemDetail.location}</Text>
                  </View>
                ) : null}

                {selectedItemDetail.type ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Tag Registry Type</Text>
                    <Text style={styles.detailValue}>{selectedItemDetail.type}</Text>
                  </View>
                ) : null}
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
    marginRight: wp(3),
  },
  headerText: {
    fontSize: wp(5.5),
    fontWeight: '600',
    color: '#fff',
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
    marginBottom: hp(2),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: hp(1.2),
    marginBottom: hp(2),
  },
  scannedCountText: {
    fontSize: wp(4.2),
    fontWeight: '700',
    color: '#333',
  },
  clearButton: {
    backgroundColor: '#FFEBEE',
    borderRadius: wp(1.5),
    paddingHorizontal: wp(0.3),
    paddingVertical: hp(0.6),
  },
  clearText: {
    color: '#C62828',
    fontWeight: '700',
    fontSize: wp(3.2),
    paddingHorizontal: wp(2),
  },
  tagBadgeCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF0FF',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    borderRadius: wp(5),
  },
  tagBadgeText: {
    color: '#5A80FD',
    fontWeight: '600',
    fontSize: wp(3.5),
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: wp(3.8),
  },
  label: {
    fontSize: wp(3.8),
    fontWeight: '700',
    color: '#555',
    marginBottom: hp(1),
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.6),
    backgroundColor: '#F9FAFB',
  },
  dropdownListInline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: wp(3),
    marginTop: hp(1),
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.8),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: wp(4.2),
    color: '#374151',
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    paddingVertical: wp(4),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginBottom: hp(2.5),
  },
  tableTitle: {
    fontSize: wp(4.8),
    fontWeight: '800',
    color: '#1F2937',
    paddingHorizontal: wp(4),
    marginBottom: hp(1),
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(4),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: wp(3.8),
    fontWeight: '700',
    color: '#4B5563',
  },
  tableRowContainer: {
    flexDirection: 'row',
    paddingVertical: hp(1.6),
    paddingHorizontal: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableRowText: {
    fontSize: wp(4),
    color: '#374151',
  },
  noItemsText: {
    textAlign: 'center',
    paddingVertical: hp(3),
    color: '#9CA3AF',
    fontStyle: 'italic',
    fontSize: wp(4),
  },
  scannedList: {
    marginTop: hp(1),
  },
  scannedRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: hp(1.2),
  },
  scannedRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(0.5),
  },
  typeTag: {
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    borderRadius: 4,
    marginRight: wp(2.5),
  },
  typeTagText: {
    fontSize: wp(3),
    fontWeight: '700',
  },
  scannedTagName: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  scannedRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scannedTagRfid: {
    fontSize: wp(3.2),
    color: '#999',
    fontFamily: 'monospace',
  },
  scannedTagLoc: {
    fontSize: wp(3.4),
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(4),
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    width: wp(85),
    padding: wp(5),
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: hp(1.2),
    marginBottom: hp(1.5),
  },
  modalTitle: {
    fontSize: wp(4.5),
    fontWeight: '800',
    color: '#333',
  },
  modalBody: {
    marginTop: hp(0.5),
  },
  detailItem: {
    marginBottom: hp(1.8),
  },
  detailLabel: {
    fontSize: wp(3.2),
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: hp(0.4),
  },
  detailValue: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#374151',
  },
});

export default StockCountScreen;
