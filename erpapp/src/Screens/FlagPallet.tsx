import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useBLE } from './Blecontext';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomStatusBar from '../common/customstatusbar';

export default function FlagPallet({ navigation }: { navigation: any }) {
  const isFocused = useIsFocused();
  const { rfid, setRfid } = useBLE();
  const [scannedTag, setScannedTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    if (isFocused && rfid) {
      setScannedTag(rfid);
    }
  }, [rfid, isFocused]);

  useEffect(() => {
    if (isFocused) {
      fetchRequests();
    }
  }, [isFocused]);

  const fetchRequests = async () => {
    try {
      const res = await fetch('http://192.168.29.113:8000/wms/approval-requests');
      const data = await res.json();
      if (data && data.requests) {
        // Sort newest first
        setRequests(data.requests.reverse());
      }
    } catch (err) {
      console.log('Error fetching requests', err);
    }
  };

  const submitFlag = async (type: string) => {
    if (!scannedTag) {
      Alert.alert('Error', 'Please scan a pallet RFID tag first.');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('http://192.168.29.113:8000/wms/approval-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_id: scannedTag,
          type: type,
          requested_by: 'Mobile App User'
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `Permission requested for ${type} pallet.`);
        setScannedTag('');
        setRfid('');
        fetchRequests();
      } else {
        Alert.alert('Error', 'Failed to submit request.');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: '#3fbf75' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#3fbf75'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#ecf1f4" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Flag Pallet</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scan Pallet RFID</Text>
          <View style={styles.rfidContainer}>
            <Icon name="radio" size={24} color={scannedTag ? '#3fbf75' : '#757575'} />
            <Text style={[styles.rfidText, scannedTag && styles.rfidTextActive]}>
              {scannedTag || 'Waiting for scan...'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Select Flag Type</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.flagButton, { backgroundColor: '#e0654f' }]} 
            onPress={() => submitFlag('Damaged')}
            disabled={loading}
          >
            <Icon name="alert-triangle" size={24} color="#0a0f16" />
            <Text style={styles.flagButtonText}>Damaged</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.flagButton, { backgroundColor: '#d9933f' }]} 
            onPress={() => submitFlag('Expired')}
            disabled={loading}
          >
            <Icon name="clock" size={24} color="#0a0f16" />
            <Text style={styles.flagButtonText}>Expired</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color="#3fbf75" style={{ marginTop: 20 }} />}

        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Request History</Text>
            <TouchableOpacity onPress={fetchRequests}>
              <Icon name="refresh-cw" size={20} color="#3fbf75" />
            </TouchableOpacity>
          </View>
          
          {requests.map(req => (
            <View key={req.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <Text style={styles.historyRfid}>{req.pallet_id}</Text>
                <View style={[styles.badge, req.status === 'Approved' ? styles.badgeGreen : req.status === 'Rejected' ? styles.badgeRed : styles.badgeYellow]}>
                  <Text style={styles.badgeText}>{req.status}</Text>
                </View>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyType}>{req.type}</Text>
                <Text style={styles.historyDate}>{new Date(req.timestamp).toLocaleTimeString()}</Text>
              </View>
            </View>
          ))}
          {requests.length === 0 && (
            <Text style={styles.emptyText}>No requests found.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  headerTitle: {
    color: '#ecf1f4',
    fontFamily: 'Archivo', fontSize: wp(5.5),
    fontWeight: '600',
    marginLeft: wp(4),
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#121b26',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontFamily: 'Archivo', fontSize: 14,
    fontWeight: '600',
    color: '#9db0bd',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  rfidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121b26',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#283845',
  },
  rfidText: {
    marginLeft: 15,
    fontFamily: 'Archivo', fontSize: 16,
    color: '#757575',
    fontFamily: 'monospace',
  },
  rfidTextActive: {
    color: '#ecf1f4',
    fontWeight: '700',
  },
  sectionTitle: {
    fontFamily: 'Archivo', fontSize: 16,
    fontWeight: '700',
    color: '#ecf1f4',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  flagButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#ecf1f4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  flagButtonText: {
    color: '#ecf1f4',
    fontWeight: '700',
    fontFamily: 'Archivo', fontSize: 16,
    marginLeft: 10,
  },
  historySection: {
    marginTop: 30,
    paddingBottom: 40,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  historyCard: {
    backgroundColor: '#121b26',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3fbf75',
    elevation: 1,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  historyRfid: {
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#ecf1f4',
  },
  historyType: {
    color: '#9db0bd',
    fontWeight: '600',
  },
  historyDate: {
    fontFamily: 'Archivo', fontSize: 12,
    color: '#62788a',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeGreen: { backgroundColor: '#3fbf75' },
  badgeRed: { backgroundColor: '#e0654f' },
  badgeYellow: { backgroundColor: '#0a0f163E0' },
  badgeText: {
    fontFamily: 'Archivo', fontSize: 11,
    fontWeight: 'bold',
    color: '#ecf1f4',
  },
  emptyText: {
    textAlign: 'center',
    color: '#62788a',
    fontStyle: 'italic',
    marginTop: 20,
  },
});
