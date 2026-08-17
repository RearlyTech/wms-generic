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

const ExceptionReportScreen = ({ navigation }: { navigation: any }) => {
  const isFocused = useIsFocused();
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchActivityLogs = async () => {
    try {
      setLoadingLogs(true);
      const response = await fetch('http://192.168.29.113:8000/wms/activity-log');
      if (response.ok) {
        const json = await response.json();
        setActivityLogs(json);
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchActivityLogs();
    }
  }, [isFocused]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ backgroundColor: '#5A80FD' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#5A80FD'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Exception & Activity Log</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.instructionCard}>
          <Icon name="info" size={20} color="#5A80FD" style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>
            This is a real-time list of all physical dispatches, tag re-mappings, stock count discrepancies, and manual exceptions recorded by operators.
          </Text>
        </View>

        {/* Dynamic Activity Feed List */}
        <View style={styles.logCard}>
          <View style={styles.logHeaderRow}>
            <Icon name="activity" size={20} color="#5A80FD" style={{ marginRight: 8 }} />
            <Text style={styles.logTitle}>WMS Activity Feed</Text>
            <TouchableOpacity onPress={fetchActivityLogs} style={{ padding: 4 }}>
              <Icon name="refresh-cw" size={16} color="#5A80FD" />
            </TouchableOpacity>
          </View>
          
          {loadingLogs ? (
            <ActivityIndicator color="#5A80FD" style={{ marginVertical: hp(2) }} />
          ) : activityLogs.length > 0 ? (
            activityLogs.map((log: any) => {
              let badgeColor = '#5A80FD';
              let badgeBg = '#EBF0FF';
              if (log.activity_type === 'Dispatch') {
                badgeColor = '#2E7D32';
                badgeBg = '#E8F5E9';
              } else if (log.activity_type === 'Stock Discrepancy') {
                badgeColor = '#C62828';
                badgeBg = '#FFEBEE';
              } else if (log.activity_type === 'Manual Exception') {
                badgeColor = '#EF6C00';
                badgeBg = '#FFF3E0';
              } else if (log.activity_type === 'RFID Change') {
                badgeColor = '#6A1B9A';
                badgeBg = '#F3E5F5';
              } else if (log.activity_type === 'Location Move') {
                badgeColor = '#455A64';
                badgeBg = '#ECEFF1';
              }
              
              const formattedTime = log.creation ? log.creation.substring(11, 16) : '';
              const formattedDate = log.creation ? log.creation.substring(5, 10).replace('-', '/') : '';
              
              return (
                <View key={log.name} style={styles.logItem}>
                  <View style={styles.logItemTopRow}>
                    <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.badgeText, { color: badgeColor }]}>{log.activity_type}</Text>
                    </View>
                    <Text style={styles.logTimeText}>{formattedDate} {formattedTime}</Text>
                  </View>
                  <Text style={styles.logLocText}>
                    Location/Target: <Text style={{fontWeight: '700', color: '#333'}}>{log.target_location || 'N/A'}</Text>
                  </Text>
                  <Text style={styles.logDetailsText}>{log.details}</Text>
                  {log.old_tag && log.new_tag ? (
                    <View style={styles.tagChangeBlock}>
                      <Text style={styles.tagChangeText}>Old Tag: {log.old_tag.substring(0, 12)}...</Text>
                      <Icon name="arrow-right" size={12} color="#999" style={{ marginHorizontal: 6 }} />
                      <Text style={styles.tagChangeText}>New: {log.new_tag.substring(0, 12)}...</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={styles.noLogsText}>No recent activities recorded.</Text>
          )}
        </View>
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
    marginBottom: hp(1.2),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp(3),
    paddingHorizontal: wp(3.5),
    marginBottom: hp(2.5),
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
  dropdownListInline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: wp(3),
    marginBottom: hp(2),
    overflow: 'hidden',
  },
  dropdownListItem: {
    paddingVertical: hp(1.4),
    paddingHorizontal: wp(4),
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  dropdownListItemText: {
    fontSize: wp(4),
    color: '#333',
    fontWeight: '500',
  },
  itemsListContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: wp(3),
    padding: wp(3),
    marginTop: hp(1),
    marginBottom: hp(2.5),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemsTitle: {
    fontSize: wp(4),
    fontWeight: '700',
    color: '#374151',
    marginBottom: hp(1.2),
  },
  itemsTable: {
    backgroundColor: '#fff',
    borderRadius: wp(2),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: hp(1),
    paddingHorizontal: wp(3),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: wp(3.5),
    fontWeight: '700',
    color: '#4B5563',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(3),
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  tableRowText: {
    fontSize: wp(3.8),
    color: '#1F2937',
  },
  noItemsText: {
    textAlign: 'center',
    paddingVertical: hp(1.5),
    color: '#9CA3AF',
    fontStyle: 'italic',
    fontSize: wp(3.8),
  },
  typeScroll: {
    flexDirection: 'row',
    marginBottom: hp(2.5),
  },
  typeBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: wp(2),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    marginRight: wp(2),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typeBadgeActive: {
    backgroundColor: '#5A80FD',
    borderColor: '#5A80FD',
  },
  typeText: {
    color: '#666',
    fontWeight: '600',
    fontSize: wp(3.5),
  },
  typeTextActive: {
    color: '#fff',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
  },
  textArea: {
    textAlignVertical: 'top',
    height: hp(12),
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
  logCard: {
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
  logHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: hp(1.2),
    marginBottom: hp(1.5),
  },
  logTitle: {
    flex: 1,
    fontSize: wp(4.2),
    fontWeight: '700',
    color: '#333',
  },
  logItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: hp(1.5),
  },
  logItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(0.8),
  },
  badge: {
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.4),
    borderRadius: 6,
  },
  badgeText: {
    fontSize: wp(3.2),
    fontWeight: '700',
  },
  logTimeText: {
    fontSize: wp(3.2),
    color: '#999',
    fontWeight: '500',
  },
  logLocText: {
    fontSize: wp(3.6),
    color: '#666',
    marginBottom: hp(0.5),
  },
  logDetailsText: {
    fontSize: wp(3.6),
    color: '#444',
    lineHeight: wp(4.8),
  },
  tagChangeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: wp(2),
    borderRadius: 6,
    marginTop: hp(0.8),
  },
  tagChangeText: {
    fontSize: wp(3.2),
    color: '#555',
    fontFamily: 'monospace',
  },
  noLogsText: {
    textAlign: 'center',
    color: '#999',
    fontSize: wp(3.8),
    marginVertical: hp(2),
  },
});

export default ExceptionReportScreen;
