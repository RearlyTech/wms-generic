import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

interface CustomNumpadProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  initialValue?: string;
}

const CustomNumpad: React.FC<CustomNumpadProps> = ({ visible, onClose, onConfirm, initialValue = '' }) => {
  const [value, setValue] = useState(initialValue);

  const handlePress = (char: string) => {
    // Prevent multiple dots
    if (char === '.' && value.includes('.')) return;
    // Limit length if necessary, here we just append
    setValue(prev => prev + char);
  };

  const handleBackspace = () => {
    setValue(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setValue('');
  };

  const handleConfirm = () => {
    onConfirm(value);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.numpadContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Enter Quantity</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={24} color="#62788a" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.displayContainer}>
            <Text style={styles.displayText}>{value || '0'}</Text>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('1')}><Text style={styles.keyText}>1</Text></TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('2')}><Text style={styles.keyText}>2</Text></TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('3')}><Text style={styles.keyText}>3</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('4')}><Text style={styles.keyText}>4</Text></TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('5')}><Text style={styles.keyText}>5</Text></TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('6')}><Text style={styles.keyText}>6</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('7')}><Text style={styles.keyText}>7</Text></TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('8')}><Text style={styles.keyText}>8</Text></TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('9')}><Text style={styles.keyText}>9</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('.')}><Text style={styles.keyText}>.</Text></TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={() => handlePress('0')}><Text style={styles.keyText}>0</Text></TouchableOpacity>
            <TouchableOpacity style={styles.keyAction} onPress={handleBackspace}>
              <Icon name="delete" size={24} color="#ecf1f4" />
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  numpadContainer: {
    backgroundColor: '#121b26',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#ecf1f4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 5,
  },
  displayContainer: {
    backgroundColor: '#18242f',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#253441',
  },
  displayText: {
    color: '#3fbf75',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  key: {
    backgroundColor: '#18242f',
    borderRadius: 10,
    width: '30%',
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#253441',
  },
  keyText: {
    color: '#ecf1f4',
    fontSize: 24,
    fontWeight: 'bold',
  },
  keyAction: {
    backgroundColor: '#62788a',
    borderRadius: 10,
    width: '30%',
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  clearBtn: {
    backgroundColor: '#253441',
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  clearText: {
    color: '#ecf1f4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  confirmBtn: {
    backgroundColor: '#3fbf75',
    borderRadius: 10,
    flex: 1,
    marginLeft: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmText: {
    color: '#0a0f16',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CustomNumpad;
