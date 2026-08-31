import React from 'react';
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BLEProvider } from './src/Screens/Blecontext';

import Scan from './src/Screens/scan';
import ItemDetailScreen from './src/Screens/ItemDetailScreen';
import WmsDashboard from './src/Screens/WmsDashboard';
import ReceivePalletScreen from './src/Screens/Wms/ReceivePalletScreen';
import PutAwayScreen from './src/Screens/Wms/PutAwayScreen';
import RetrieveScreen from './src/Screens/Wms/RetrieveScreen';
import MovePalletScreen from './src/Screens/Wms/MovePalletScreen';
import RepackScreen from './src/Screens/Wms/RepackScreen';
import MergePalletsScreen from './src/Screens/Wms/MergePalletsScreen';
import StockCountScreen from './src/Screens/Wms/StockCountScreen';
import FindPalletScreen from './src/Screens/Wms/FindPalletScreen';
import DispatchScreen from './src/Screens/Wms/DispatchScreen';
import ExceptionReportScreen from './src/Screens/Wms/ExceptionReportScreen';
import FlagPallet from './src/Screens/FlagPallet';

import LoginScreen from './src/Screens/LoginScreen';
import DoorMonitor from './src/common/DoorMonitor';
import { getItem } from './src/Storage/Storage';
import { navigationRef } from "./src/lib/navigation";

enableScreens(true);

const Stack = createStackNavigator();

function App() {
  const hasToken = getItem('authToken');
  const initialRoute = hasToken ? "Scan" : "Login";

  return (
    <SafeAreaProvider>
      <BLEProvider>
        <DoorMonitor>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Scan" component={Scan} />
              <Stack.Screen name="ItemDetailScreen" component={ItemDetailScreen} />
              <Stack.Screen name="WmsDashboard" component={WmsDashboard} />
              <Stack.Screen name="ReceivePallet" component={ReceivePalletScreen} />
              <Stack.Screen name="PutAway" component={PutAwayScreen} />
              <Stack.Screen name="Retrieve" component={RetrieveScreen} />
              <Stack.Screen name="MovePallet" component={MovePalletScreen} />
              <Stack.Screen name="Repack" component={RepackScreen} />
              <Stack.Screen name="MergePallets" component={MergePalletsScreen} />
              <Stack.Screen name="StockCount" component={StockCountScreen} />
              <Stack.Screen name="FindPallet" component={FindPalletScreen} />
              <Stack.Screen name="Dispatch" component={DispatchScreen} />
              <Stack.Screen name="ExceptionReport" component={ExceptionReportScreen} />
              <Stack.Screen name="FlagPallet" component={FlagPallet} />
            </Stack.Navigator>
          </NavigationContainer>
        </DoorMonitor>
      </BLEProvider>
    </SafeAreaProvider>
  );
}

export default App;
