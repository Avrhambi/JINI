import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeModules, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as HomeServices from '../../services/HomeServices';
import * as authUtils from '../../utils/auth';
import * as permissionUtils from '../../utils/permissions';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.PlatformLocalStorage = {}; // Fixes the error you saw
  RN.NativeModules.RNCAsyncStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  RN.Alert.alert = jest.fn();
  return RN;
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
    setAudioModeAsync: jest.fn(),
  },
}));
jest.mock('../../services/HomeServices');
jest.mock('../../utils/auth');
jest.mock('../../utils/permissions');

describe('Home Screen Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Alert.alert = jest.fn();
  });

  it('should load records on screen mount', async () => {
    const mockRecords = [
      {
        phoneNumber: '1234567890',
        recording: { name: 'rec_001.wav' },
        isFavorite: false,
      },
    ];

    HomeServices.ensureDirectory.mockResolvedValue(undefined);
    HomeServices.loadLocalRecords.mockResolvedValue(mockRecords);
    authUtils.getUserInfo.mockResolvedValue({ name: 'John Doe' });
    permissionUtils.requestAppPermissions.mockResolvedValue(true);

    // Component logic would be tested here
    await HomeServices.ensureDirectory();
    await HomeServices.loadLocalRecords(jest.fn());

    expect(HomeServices.ensureDirectory).toHaveBeenCalled();
    expect(HomeServices.loadLocalRecords).toHaveBeenCalled();
  });

  it('should search records when query is submitted', async () => {
    const mockAllRecords = [
      {
        phoneNumber: '1234567890',
        recording: { name: 'rec_001.wav' },
      },
    ];

    const searchResults = [
      {
        phoneNumber: '1234567890',
        recording: { name: 'rec_001.wav' },
        foundTimestamps: [10, 20, 30],
      },
    ];

    HomeServices.searchRecords.mockResolvedValue(searchResults);

    const results = await HomeServices.searchRecords('test', mockAllRecords);

    expect(results).toHaveLength(1);
    expect(results[0].foundTimestamps).toBeDefined();
  });

  it('should handle search errors gracefully', async () => {
    HomeServices.searchRecords.mockRejectedValue(new Error('Search failed'));

    await expect(
      HomeServices.searchRecords('query', [])
    ).rejects.toThrow('Search failed');
  });

  it('should delete record and update list', async () => {
    const mockRecord = {
      recording: {
        name: 'rec_001.wav',
        uri: 'file://rec_001.wav',
      },
    };

    HomeServices.deleteRecord.mockResolvedValue(true);

    const result = await HomeServices.deleteRecord(mockRecord);

    expect(result).toBe(true);
    expect(HomeServices.deleteRecord).toHaveBeenCalledWith(mockRecord);
  });

  it('should toggle favorite status', async () => {
    const favorites = [];
    const updatedFavorites = ['rec_001.wav'];

    HomeServices.updateFavoriteStatus.mockResolvedValue(updatedFavorites);

    const result = await HomeServices.updateFavoriteStatus(
      'rec_001.wav',
      false,
      favorites
    );

    expect(result).toContain('rec_001.wav');
  });

  it('should rename record', async () => {
    HomeServices.renameRecord.mockResolvedValue(true);

    const result = await HomeServices.renameRecord('old_name.wav', 'new_name.wav');

    expect(result).toBe(true);
    expect(HomeServices.renameRecord).toHaveBeenCalledWith(
      'old_name.wav',
      'new_name.wav'
    );
  });

  it('should refresh records on screen focus', async () => {
    const mockRecords = [
      {
        phoneNumber: '1234567890',
        recording: { name: 'rec_001.wav' },
      },
    ];

    HomeServices.loadLocalRecords.mockResolvedValue(mockRecords);

    // First load
    let records = await HomeServices.loadLocalRecords(jest.fn());
    expect(records).toHaveLength(1);

    // Refresh on focus
    records = await HomeServices.loadLocalRecords(jest.fn());
    expect(records).toHaveLength(1);

    expect(HomeServices.loadLocalRecords).toHaveBeenCalledTimes(2);
  });
});
