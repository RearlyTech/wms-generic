import { StatusBar, View, Platform } from 'react-native';

const CustomStatusBar = ({ backgroundColor}:{backgroundColor:any}) => {
  const isAndroid14Plus = Platform.OS === 'android' && Platform.Version >= 34;
  
  if (isAndroid14Plus) {
    return <View style={{height: StatusBar.currentHeight, backgroundColor}}></View>;
  }
  
  const RNStatusBar = StatusBar as any;
  return <RNStatusBar backgroundColor={backgroundColor} />;
};

export default CustomStatusBar