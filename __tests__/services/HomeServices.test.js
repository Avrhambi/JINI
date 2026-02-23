import { jest } from '@jest/globals';

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
} from '../../services/HomeServices';
import { apiFetch } from '../../utils/api';
import * as RecordUtils from '../../utils/RecordManager';

jest.mock('../../utils/api');

describe('Home Services', () => {
  const audioDir = FileSystem.documentDirectory + 'PhoneRecords/';

  beforeEach(() => {
    jest.clearAllMocks();
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
    it('should search records and return matching results', async () => {
      const mockRecords = [
        {
          phoneNumber: '1234567890',
          recording: { name: 'rec_001.wav' },
        },
      ];

      apiFetch.mockResolvedValue({
        ok: true,
        data: [
          {
            file_name: 'rec_001.wav',
            time_stamps: [10, 20, 30],
          },
        ],
      });

      const result = await searchRecords('search query', mockRecords);

      expect(result).toBeDefined();
      expect(apiFetch).toHaveBeenCalledWith('/calls/search', expect.any(Object));
    });

    it('should return empty array if no matches found', async () => {
      const mockRecords = [
        {
          phoneNumber: '1234567890',
          recording: { name: 'rec_001.wav' },
        },
      ];

      apiFetch.mockResolvedValue({
        ok: true,
        data: [],
      });

      const result = await searchRecords('search query', mockRecords);

      expect(result).toEqual([]);
    });

    it('should throw error if search fails', async () => {
      const mockRecords = [];

      apiFetch.mockResolvedValue({
        ok: false,
      });

      await expect(searchRecords('query', mockRecords)).rejects.toThrow(
        'Search failed'
      );
    });
  });

  describe('updateFavoriteStatus', () => {
    it('should add record to favorites', async () => {
      apiFetch.mockResolvedValue({ ok: true });
      AsyncStorage.setItem.mockResolvedValue(undefined);

      const result = await updateFavoriteStatus('rec_001.wav', false, []);

      expect(result).toContain('rec_001.wav');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should remove record from favorites', async () => {
      apiFetch.mockResolvedValue({ ok: true });
      AsyncStorage.setItem.mockResolvedValue(undefined);

      const result = await updateFavoriteStatus('rec_001.wav', true, ['rec_001.wav']);

      expect(result).not.toContain('rec_001.wav');
    });

    it('should throw error if update fails', async () => {
      apiFetch.mockResolvedValue({ ok: false });

      await expect(
        updateFavoriteStatus('rec_001.wav', false, [])
      ).rejects.toThrow('Favorite update failed');
    });
  });

  describe('renameRecord', () => {
    it('should rename record successfully', async () => {
      apiFetch.mockResolvedValue({ ok: true });
      AsyncStorage.getItem.mockResolvedValue(null);
      AsyncStorage.setItem.mockResolvedValue(undefined);

      const result = await renameRecord('old_name.wav', 'new_name.wav');

      expect(result).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should throw error if rename fails', async () => {
        apiFetch.mockResolvedValue({ ok: false });

        const result = await renameRecord('old_name.wav', 'new_name.wav');
        
        expect(result).toBe(false); 
        });
  });

  describe('deleteRecord', () => {
    it('should delete record successfully', async () => {
      const mockRecord = {
        recording: {
          name: 'rec_001.wav',
          uri: audioDir + 'rec_001.wav',
        },
      };

      apiFetch.mockResolvedValue({ ok: true });
      FileSystem.deleteAsync.mockResolvedValue(undefined);

      const result = await deleteRecord(mockRecord);

      expect(result).toBe(true);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(mockRecord.recording.uri);
    });

    it('should throw error if delete fails', async () => {
      const mockRecord = {
        recording: {
          name: 'rec_001.wav',
          uri: audioDir + 'rec_001.wav',
        },
      };

      apiFetch.mockResolvedValue({ ok: false });

      const result = await deleteRecord(mockRecord);
      expect(result).toBe(false);
    });
  });
});
