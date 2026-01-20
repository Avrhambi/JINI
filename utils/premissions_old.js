import { PermissionsAndroid ,Linking, Platform } from 'react-native';

async function requestPermission(permission, name) {
  const granted = await PermissionsAndroid.request(permission);
  console.log(`${name} permission:`, granted);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestStoragePermissions() {
  try {
    const audio = await requestPermission(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, 'Audio');
    const phone = await requestPermission(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE, 'Phone');
    const callLog = await requestPermission(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, 'Call Log');
    const allGranted = audio && phone && callLog;
    console.log('All permissions granted:', allGranted);
    return allGranted;
  } catch (err) {
    console.warn(err);
    return false;
  }
}

async function requestAllFilesPermission() {
  if (Platform.OS !== 'android')
    return true;

  try {
    if (Platform.Version >= 30) {
      const hasPermission = await PermissionsAndroid.check(
        'android.permission.MANAGE_EXTERNAL_STORAGE'
      );

      if (hasPermission) {
        console.log('All files permission already granted');
        return true;
      }
      // Ask user via system dialog
      // NOTE: On Android 11+, the system dialog won't appear, user must grant manually
      console.log('Redirecting user to All Files Access settings...');
      Linking.openSettings(); // Opens app settings page first
      // Better: use the special intent for Android 11+ (optional)
      Linking.openURL('android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION');

      return true; // Assume user will grant manually
    } else {
      
      // Android < 11 fallback
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      const readGranted =
        granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
        PermissionsAndroid.RESULTS.GRANTED;
      const writeGranted =
        granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] ===
        PermissionsAndroid.RESULTS.GRANTED;

      if (readGranted && writeGranted) {
        console.log('READ and WRITE permissions granted');
        return true;
      } else {
        console.log('READ/WRITE permissions denied');
        return false;
      }
    }
  } catch (err) {
    console.warn('Permission error:', err);
    return false;
  }
}

export { requestStoragePermissions, requestAllFilesPermission };