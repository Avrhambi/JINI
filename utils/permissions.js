import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Requests all necessary permissions for the app functionality:
 * 1. Call Logs (To match records)
 * 2. Phone State (To get accurate numbers)
 * 3. Storage (To read audio files on older Android versions)
 */
export const requestAppPermissions = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    // List of permissions to request
    const permissions = [
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ];

    // Handle Storage Permissions based on Android Version
    if (Platform.Version >= 33) {
      // Android 13+ (API 33) requires granular media permissions
      permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
    } else {
      // Android 12 and below use standard external storage permissions
      permissions.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      permissions.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    }

    // Request all at once
    const granted = await PermissionsAndroid.requestMultiple(permissions);

    // Check Call Log (Crucial for your Home Screen)
    const callLogGranted = 
      granted[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] === PermissionsAndroid.RESULTS.GRANTED;

    // Check Phone State
    const phoneGranted = 
      granted[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED;

    // Check Storage (Helper for older phones, though Picker usually handles this)
    const storageGranted = Platform.Version >= 33 
      ? granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
      : granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;

    // Return true only if the core permissions (Log & Phone) are granted
    return callLogGranted && phoneGranted;

  } catch (err) {
    console.warn('Permission Request Error:', err);
    return false;
  }
};