import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// 1. Mock TurboModuleRegistry and internal NativeModules first
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  getEnforcing: jest.fn((name) => {
    if (name === 'DeviceInfo' || name === 'NativeDeviceInfo') {
      return { getConstants: () => ({ Dimensions: { window: { width: 360, height: 640 }, screen: { width: 360, height: 640 } } }) };
    }
    return { show: jest.fn(), hide: jest.fn(), addItem: jest.fn() };
  }),
  get: jest.fn(() => ({})),
}));

// 2. Simplified React Native Mock - Avoids loading real iOS/Android internal files
jest.mock('react-native', () => {
  return {
    NativeModules: {
      CallLogModule: {
        getCallLogs: jest.fn(),
      },
      DeviceInfo: {
        getConstants: () => ({}),
      },
      PlatformConstants: {
        forceTouchAvailable: false,
      },
    },
    Platform: {
      OS: 'android',
      select: (objs) => objs.android || objs.default,
      Version: 30,
    },
    // Mock the UI components your imports are accidentally pulling in
    TouchableOpacity: ({ children }) => children,
    Button: () => null,
    View: ({ children }) => children,
    Text: ({ children }) => children,
    StyleSheet: {
      create: (obj) => obj,
    },
    // Add any other RN exports you use in your code
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    mergeItem: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
    flushGetRequests: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    multiMerge: jest.fn(),
  },
}));

// Mock Expo FileSystem (since it's used in HomeServices)
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test-dir/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
}));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({ sound: {} }),
    },
    Recording: jest.fn(() => ({
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn(),
      getURI: jest.fn(),
    })),
    setAudioModeAsync: jest.fn(),
    InterruptionModeIOS: {},
    InterruptionModeAndroid: {},
  },
}));

// Mock expo-secure-store if it's being imported too
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../utils/RecordManager', () => ({
  getAudioFileInfo: jest.fn(),
  findMatchInLogs: jest.fn(),
  buildFullMetadata: jest.fn(),
}));

jest.mock('../../utils/auth', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  removeUserCredentials: jest.fn(),
  saveTokens: jest.fn(),
}));

import { NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ensureDirectory,
  loadLocalRecords,
  searchRecords,
  updateFavoriteStatus,
  renameRecord,
  deleteRecord,
  uploadAudioFile,
  deleteAccount,
} from '../../services/HomeServices';
import * as RecordUtils from '../../utils/RecordManager';
import * as authUtils from '../../utils/auth';
import { performSignup } from '../../services/SignupServices';

const BASE_URL = process.env.BASE_URL || process.env.EXPO_PUBLIC_BASE_URL;
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'asi@bla.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'a';
const MOCK_FETCH = global.fetch;
const REAL_FETCH = global.realFetch;
const NATIVE_FORM_DATA = global.FormData;
class ReactNativeFormDataMock {
  constructor() {
    this._parts = [];
  }

  append(key, value) {
    this._parts.push([key, value]);
  }
}
let liveAccessToken;
let liveRefreshToken;

const normalizeFilePathFromUri = (uri) => {
  const rawPath = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
  return path.normalize(rawPath);
};

const convertReactNativeFormData = (reactNativeFormData) => {
  const nativeFormData = new NATIVE_FORM_DATA();
  const parts = reactNativeFormData?._parts || [];

  for (const [field, value] of parts) {
    if (value && typeof value === 'object' && value.uri) {
      const filePath = normalizeFilePathFromUri(value.uri);
      const fileBuffer = fs.readFileSync(filePath);
      const fileBlob = new Blob([fileBuffer], {
        type: value.type || 'application/octet-stream',
      });
      nativeFormData.append(field, fileBlob, value.name || path.basename(filePath));
    } else {
      nativeFormData.append(field, value == null ? '' : String(value));
    }
  }

  return nativeFormData;
};

const backendFetchBridge = async (url, options = {}) => {
  const requestOptions = { ...options };
  if (requestOptions.body && requestOptions.body._parts) {
    requestOptions.body = convertReactNativeFormData(requestOptions.body);
  }
  return REAL_FETCH(url, requestOptions);
};

describe('Home Services', () => {
  const audioDir = FileSystem.documentDirectory + 'PhoneRecords/';

  beforeAll(async () => {
    expect(BASE_URL).toBeTruthy();
    expect(typeof REAL_FETCH).toBe('function');
    global.FormData = ReactNativeFormDataMock;
    global.fetch = backendFetchBridge;

    const loginResponse = await REAL_FETCH(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    const loginData = await loginResponse.json();
    expect(loginResponse.ok).toBe(true);

    liveAccessToken = loginData.access_token;
    liveRefreshToken = loginData.refresh_token;

    authUtils.getAccessToken.mockResolvedValue(liveAccessToken);
    authUtils.getRefreshToken.mockResolvedValue(liveRefreshToken);
  });

  afterAll(() => {
    global.fetch = MOCK_FETCH;
    global.FormData = NATIVE_FORM_DATA;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authUtils.getAccessToken.mockResolvedValue(liveAccessToken);
    authUtils.getRefreshToken.mockResolvedValue(liveRefreshToken);
    NativeModules.CallLogModule.getCallLogs.mockResolvedValue([]);
    FileSystem.readDirectoryAsync.mockResolvedValue([]);
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
      FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);

      await ensureDirectory();

      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(audioDir);
      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(audioDir, {
        intermediates: true,
      });
    });

    it('should not create directory if it already exists', async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

      await ensureDirectory();

      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(audioDir);
      expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  describe('loadLocalRecords', () => {
    const mockTimestamp = "1709067600000";

    beforeEach(() => {
      // Set default successful behaviors for our helpers
      RecordUtils.getAudioFileInfo.mockResolvedValue({
        size: 1024,
        duration: 60,
        modificationTime: 1709067600
      });
      RecordUtils.findMatchInLogs.mockReturnValue({
        date: mockTimestamp,
        phoneNumber: '1234567890'
      });
      RecordUtils.buildFullMetadata.mockResolvedValue({ artist: 'Test' });
    });

    it('should load and merge local records', async () => {
      FileSystem.readDirectoryAsync.mockResolvedValue([`rec_${mockTimestamp}.wav`]);
      NativeModules.CallLogModule.getCallLogs.mockResolvedValue([{ date: mockTimestamp }]);
      AsyncStorage.getItem.mockResolvedValue("[]");

      const result = await loadLocalRecords(jest.fn());

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(mockTimestamp);
    });

    it('should filter out invalid files (copies and incomplete recordings)', async () => {
      const mockFileNames = [
        '1709067600000_valid.wav',
        '1709067600000_copy.wav',  // Filtered by string check
        'empty.wav'                // Filtered by stats check
      ];

      FileSystem.readDirectoryAsync.mockResolvedValue(mockFileNames);

      // Customize the mock for the "empty" file case
      RecordUtils.getAudioFileInfo.mockImplementation((path) => {
        if (path.includes('empty')) {
          return Promise.resolve({ size: 0, duration: 0 });
        }
        return Promise.resolve({ size: 1024, duration: 60 });
      });

      const result = await loadLocalRecords(jest.fn());

      // 1. 'copy' is skipped by name.includes
      // 2. 'empty' is skipped by stats.size === 0
      // 3. Only the first one remains
      expect(result.length).toBe(1);
      expect(result[0].recording.name).toBe('1709067600000_valid.wav');
    });
  });

  describe('searchRecords', () => {
    it('should search records using real backend response', async () => {
      const mockRecords = [
        {
          phoneNumber: '1234567890',
          recording: { name: 'non_existing_record_for_search.wav' },
        },
      ];

      const result = await searchRecords('test', mockRecords);

      expect(Array.isArray(result)).toBe(true);
    }, 20000);
  });

  describe('Full Backend Lifecycle', () => {
    it('should create user, upload record, delete record, then delete account', async () => {
      const uniqueSuffix = Date.now();
      const fixtureName = 'record-1761512646339.wav';
      const uploadedName = `record-1761512646339.wav`;
      const renamedName = `record-1761512646339-renamed.wav`;
      const lifecycleUser = {
        UserName: `cycle_user_${uniqueSuffix}`,
        Email: `cycle_user_${uniqueSuffix}@example.com`,
        Password: 'ValidPassword123!',
        ConfirmPassword: 'ValidPassword123!',
        FirstName: 'Cycle',
        LastName: 'Tester',
      };

      let signupResult;
      try {
        signupResult = await performSignup(lifecycleUser);
        expect(signupResult.success).toBe(true);
        expect(signupResult.accessToken).toBeTruthy();
        expect(signupResult.refreshToken).toBeTruthy();

        authUtils.getAccessToken.mockResolvedValue(signupResult.accessToken);
        authUtils.getRefreshToken.mockResolvedValue(signupResult.refreshToken);

        const fixtureRelativePath = path.join(
          process.cwd(),
          'assets',
          'audio',
          fixtureName
        );
        expect(fs.existsSync(fixtureRelativePath)).toBe(true);

        FileSystem.copyAsync.mockResolvedValue(undefined);
        FileSystem.deleteAsync.mockResolvedValue(undefined);
        RecordUtils.getAudioFileInfo.mockResolvedValue({
          size: 1024,
          duration: 60,
          modificationTime: Math.floor(Date.now() / 1000),
        });
        RecordUtils.findMatchInLogs.mockReturnValue(null);

        const uploadResult = await uploadAudioFile({
          name: uploadedName,
          uri: `file://${fixtureRelativePath.replace(/\\/g, '/')}`,
          mimeType: 'audio/wav',
        });
        expect(uploadResult).toBe(true);

        const favoriteResult = await updateFavoriteStatus(uploadedName, false, []);
        expect(Array.isArray(favoriteResult)).toBe(true);
        expect(favoriteResult).toContain(uploadedName);

        const renameResult = await renameRecord(uploadedName, renamedName);
        expect(renameResult).toBe(true);

        const deleteResult = await deleteRecord({
          recording: {
            name: uploadedName,
            uri: `file://${fixtureRelativePath.replace(/\\/g, '/')}`,
          },
        });
        expect(deleteResult).toBe(true);
      } finally {
        if (signupResult?.accessToken && signupResult?.refreshToken) {
          authUtils.getAccessToken.mockResolvedValue(signupResult.accessToken);
          authUtils.getRefreshToken.mockResolvedValue(signupResult.refreshToken);
          const accountDeleted = await deleteAccount();
          expect(accountDeleted).toBe(true);
        }
      }
    }, 120000);
  });
});
