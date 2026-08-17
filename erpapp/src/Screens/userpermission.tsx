import { useState } from 'react';
import {
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const usePermissions = () => {
  const [permissionStatus1, setPermissionStatus] = useState({
    location: false,
    backgroundLocation: false,
    notification: false,
  });

  const requestPermissions1 = async () => {
    try {
      let permissionResult = {};

      if (Platform.OS === 'android') {
        console.log('Requesting Android permissions...');

        // Request Fine Location Permission
        const fineLocationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'We need access to your location for background services.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        // Request Background Location Permission (Android 10+)
        let backgroundLocationGranted = false;
        // if (Platform.Version >= 29) {
        //   backgroundLocationGranted = await PermissionsAndroid.request(
        //     PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        //     {
        //       title: 'Background Location Permission',
        //       message: 'Allow continuous location access in the background?',
        //       buttonNeutral: 'Ask Me Later',
        //       buttonNegative: 'Cancel',
        //       buttonPositive: 'OK',
        //     }
        //   );
        // }

        // Request Notification Permission (Android 13+)
        let notificationGranted = true;
        if (Platform.Version >= 33) {
          const notificationPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'Notification Permission',
              message: 'We need permission to send notifications.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          notificationGranted = notificationPermission === PermissionsAndroid.RESULTS.GRANTED;
        }

        permissionResult = {
          location: fineLocationGranted === PermissionsAndroid.RESULTS.GRANTED,
          // backgroundLocation: backgroundLocationGranted === PermissionsAndroid.RESULTS.GRANTED,
          notification: notificationGranted 
        };

      } else if (Platform.OS === 'ios') {
        console.log('Requesting iOS permissions...');

        // Request Location Permissions
        const locationStatus = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
        const backgroundLocationStatus = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);

        // Request Notification Permission
        // const notificationStatus = await request(PERMISSIONS.IOS.NOTIFICATIONS);

        permissionResult = {
          location: locationStatus === RESULTS.GRANTED || backgroundLocationStatus === RESULTS.GRANTED,
          // notification: notificationStatus === RESULTS.GRANTED,
        };
      }

      // Update state with new permissions
      setPermissionStatus(prev => ({
        ...prev,
        ...permissionResult,
      }));

      console.log('Updated Permission Status:', permissionResult);
      return permissionResult;
      
    } catch (error) {
      console.error('Permission request error:', error);
      Alert.alert('Error', 'An error occurred while requesting permissions.');
      return null;
    }
  };

  return { permissionStatus1, requestPermissions1 };
};

export default usePermissions;