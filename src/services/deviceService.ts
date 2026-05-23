import DeviceInfo from 'react-native-device-info';
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export const deviceService = {
  async getDeviceId(): Promise<string> {
    return DeviceInfo.getUniqueId();
  },

  async getDeviceName(): Promise<string> {
    try {
      return await DeviceInfo.getDeviceName();
    } catch {
      return `${DeviceInfo.getBrand()} ${DeviceInfo.getModel()}`;
    }
  },

  async getDeviceInfo() {
    return {
      deviceId: await DeviceInfo.getUniqueId(),
      model: DeviceInfo.getModel(),
      os: Platform.OS,
      osVersion: DeviceInfo.getSystemVersion(),
      appVersion: DeviceInfo.getVersion(),
    };
  },

  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message: 'ChaistoOps needs location access to verify report location.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  },

  async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'ChaistoOps needs camera access for report photos.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  },

  async getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => reject(new Error('Could not get location: ' + error.message)),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  },

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula — returns distance in meters
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
};
