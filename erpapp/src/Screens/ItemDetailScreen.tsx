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
      <SafeAreaView style={{ backgroundColor: '#3fbf75' }} edges={['top']} />
      <CustomStatusBar backgroundColor={'#3fbf75'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#ecf1f4" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Item Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: wp(4), paddingBottom: hp(5) }}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="package" size={24} color="#3fbf75" />
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
  card: {
    backgroundColor: '#121b26',
    borderRadius: wp(4),
    padding: wp(5),
    elevation: 3,
    shadowColor: '#ecf1f4',
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
    fontFamily: 'Archivo', fontSize: wp(5.5),
    fontWeight: '800',
    color: '#ecf1f4',
    marginLeft: wp(3),
  },
  divider: {
    height: 1,
    backgroundColor: '#121b26',
    marginBottom: hp(2),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#0a0f16',
  },
  detailLabel: {
    fontFamily: 'Archivo', fontSize: wp(4),
    color: '#9db0bd',
    fontWeight: '500',
  },
  detailValue: {
    fontFamily: 'Archivo', fontSize: wp(4.2),
    color: '#ecf1f4',
    fontWeight: '700',
  },
});

export default ItemDetailScreen;
