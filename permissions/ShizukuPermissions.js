import { Alert } from 'react-native';
import ShizukuModule from '../modules/shizuku/ShizukuModule';

class ShizukuPermissions {
  constructor() {
    this.permissionGranted = false;
  }

  /**
   * Check if Shizuku is available and running
   * @returns {Promise<boolean>}
   */
  async checkAvailability() {
    const available = await ShizukuModule.isAvailable();
    
    if (!available) {
      this.showShizukuNotAvailableAlert();
      return false;
    }
    
    return true;
  }

  /**
   * Request permission from user
   * @returns {Promise<boolean>}
   */
  async request() {
    try {
      const granted = await ShizukuModule.requestPermission();
      this.permissionGranted = granted;

      if (!granted) {
        this.showPermissionDeniedAlert();
      }
      const isAvailable = await this.checkAvailability();
      return granted && isAvailable;
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert(
        'Permission Error',
        'Failed to request Shizuku permission. Please try again.'
      );
      return false;
    }
  }

  /**
   * Check and request permission if needed
   * @returns {Promise<boolean>}
   */
  async ensurePermission() {
    if (this.permissionGranted) {
      return true;
    }
    
    return await this.request();
  }

  /**
   * Show alert when Shizuku is not available
   */
  showShizukuNotAvailableAlert() {
    Alert.alert(
      'Shizuku Not Running',
      'Please install and start Shizuku service:\n\n' +
      '1. Install Shizuku from Play Store\n' +
      '2. Connect phone via USB\n' +
      '3. Run: adb shell sh /storage/emulated/0/Android/data/moe.shizuku.privileged.api/start.sh\n' +
      '4. Restart this app',
      [{ text: 'OK' }]
    );
  }

  /**
   * Show alert when permission is denied
   */
  showPermissionDeniedAlert() {
    Alert.alert(
      'Permission Required',
      'Shizuku permission is required to access call recordings. Please grant permission and try again.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Reset permission state
   */
  reset() {
    this.permissionGranted = false;
  }
}

export default new ShizukuPermissions();
