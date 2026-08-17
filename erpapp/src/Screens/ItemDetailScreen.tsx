import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/Feather';
import CustomStatusBar from '../common/customstatusbar';

import { SafeAreaView } from 'react-native-safe-area-context';

const ItemDetailScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { item } = route.params;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ backgroundColor: '#5A80FD' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#5A80FD'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Item Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: wp(4), paddingBottom: hp(5) }}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="package" size={24} color="#5A80FD" />
            <Text style={styles.itemName}>{item.item_name}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Item Code</Text>
            <Text style={styles.detailValue}>{item.item_code}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Item Group</Text>
            <Text style={styles.detailValue}>{item.item_group}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>RFID Tag</Text>
            <Text style={styles.detailValue}>{item.rfid_tag}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Quantity</Text>
            <Text style={styles.detailValue}>{item.qty}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Valuation Rate</Text>
            <Text style={styles.detailValue}>
              {item.rate !== undefined && item.rate !== "N/A"
                ? `₹${parseFloat(item.rate).toFixed(2)}`
                : 'N/A'}
            </Text>
          </View>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(5),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginTop: hp(2),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  itemName: {
    fontSize: wp(5.5),
    fontWeight: '800',
    color: '#333',
    marginLeft: wp(3),
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: hp(2),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: wp(4),
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: wp(4.2),
    color: '#333',
    fontWeight: '700',
  },
});

export default ItemDetailScreen;
