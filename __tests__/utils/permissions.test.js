import { PermissionsAndroid, Platform } from 'react-native';
import { requestAppPermissions } from '../../utils/permissions';

describe('Permissions Utilities (Android Only)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Force reset to Android defaults
    Platform.OS = 'android';
    Platform.Version = 30;
  });

  describe('requestAppPermissions', () => {
    it('should request storage permission on Android versions < 13', async () => {
      Platform.Version = 30;
      const grantedResponse = {
        'android.permission.READ_CALL_LOG': 'granted',
        'android.permission.READ_PHONE_STATE': 'granted',
        'android.permission.READ_EXTERNAL_STORAGE': 'granted',
      };

      PermissionsAndroid.requestMultiple.mockResolvedValue(grantedResponse);

      const result = await requestAppPermissions();

      expect(result).toBe(true);
      const requestedPermissions = PermissionsAndroid.requestMultiple.mock.calls[0][0];
      expect(requestedPermissions).toContain('android.permission.READ_EXTERNAL_STORAGE');
      expect(requestedPermissions).not.toContain('android.permission.READ_MEDIA_AUDIO');
    });

    it('should request media audio permission instead of storage on Android 13+ (API 33)', async () => {
      Platform.Version = 33;
      const grantedResponse = {
        'android.permission.READ_CALL_LOG': 'granted',
        'android.permission.READ_PHONE_STATE': 'granted',
        'android.permission.READ_MEDIA_AUDIO': 'granted',
      };

      PermissionsAndroid.requestMultiple.mockResolvedValue(grantedResponse);

      const result = await requestAppPermissions();

      expect(result).toBe(true);
      const requestedPermissions = PermissionsAndroid.requestMultiple.mock.calls[0][0];
      expect(requestedPermissions).toContain('android.permission.READ_MEDIA_AUDIO');
      expect(requestedPermissions).not.toContain('android.permission.READ_EXTERNAL_STORAGE');
    });

    it('should return false if essential permissions are denied', async () => {
      const deniedResponse = {
        'android.permission.READ_CALL_LOG': 'denied',
        'android.permission.READ_PHONE_STATE': 'granted',
      };

      PermissionsAndroid.requestMultiple.mockResolvedValue(deniedResponse);

      const result = await requestAppPermissions();
      expect(result).toBe(false);
    });

    it('should handle system errors and return false', async () => {
      PermissionsAndroid.requestMultiple.mockRejectedValue(new Error('Permission system crash'));
      const result = await requestAppPermissions();
      expect(result).toBe(false);
    });
  });
});