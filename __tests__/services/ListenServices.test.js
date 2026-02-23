import { jest } from '@jest/globals';

jest.mock('react-native', () => {
  const ReactNative = jest.requireActual('react-native');
  return {
    ...ReactNative,
    TurboModuleRegistry: {
      getEnforcing: jest.fn((name) => {
        if (name === 'DevMenu') {
          return { show: jest.fn() };
        }
        return null;
      }),
    },
    NativeModules: {
      ...ReactNative.NativeModules,
      DevMenu: { show: jest.fn() },
    },
  };
});

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
    setAudioModeAsync: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  formatTime,
  setupAudio,
  getLocalTranscription,
  getMarkerTarget,
} from '../../services/ListenServices';

describe('Listen Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatTime', () => {
    it('should format time correctly', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(5)).toBe('0:05');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(125)).toBe('2:05');
      expect(formatTime(3665)).toBe('61:05');
    });

    it('should handle fractional seconds by flooring them', () => {
      expect(formatTime(5.7)).toBe('0:05');
      expect(formatTime(125.9)).toBe('2:05');
    });

    it('should always pad seconds with zero', () => {
      const result = formatTime(61);
      const parts = result.split(':');
      expect(parts[1].length).toBe(2);
    });
  });

  describe('setupAudio', () => {
    it('should create audio sound successfully', async () => {
      const mockSound = {
        setOnPlaybackStatusUpdate: jest.fn(),
      };

      Audio.Sound.createAsync = jest.fn().mockResolvedValue({
        sound: mockSound,
      });

      const onStatusUpdate = jest.fn();
      const result = await setupAudio('file://audio.mp3', onStatusUpdate);

      expect(result).toBe(mockSound);
      expect(mockSound.setOnPlaybackStatusUpdate).toHaveBeenCalledWith(onStatusUpdate);
      expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
        { uri: 'file://audio.mp3' },
        {
          shouldPlay: false,
          progressUpdateIntervalMillis: 100,
        }
      );
    });

    it('should return null if no URI provided', async () => {
      const onStatusUpdate = jest.fn();
      const result = await setupAudio(null, onStatusUpdate);

      expect(result).toBeNull();
      expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
    });

    it('should throw error if audio setup fails', async () => {
      Audio.Sound.createAsync = jest.fn().mockRejectedValue(
        new Error('Audio setup failed')
      );

      const onStatusUpdate = jest.fn();

      await expect(setupAudio('file://audio.mp3', onStatusUpdate)).rejects.toThrow(
        'Audio setup failed'
      );
    });
  });

  describe('getLocalTranscription', () => {
    it('should retrieve and parse transcription from storage', async () => {
      const mockTranscription = {
        text: 'Hello world',
        timestamps: [0, 1, 2],
      };

      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTranscription));

      const result = await getLocalTranscription('recording_001');

      expect(result).toEqual(mockTranscription);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('transcription_recording_001');
    });

    it('should return null if no transcription exists', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      const result = await getLocalTranscription('recording_001');

      expect(result).toBeNull();
    });

    it('should throw error if parsing fails', async () => {
      AsyncStorage.getItem.mockResolvedValue('invalid json');

      await expect(getLocalTranscription('recording_001')).rejects.toThrow(
        'Failed to load transcription'
      );
    });

    it('should throw error if storage read fails', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      await expect(getLocalTranscription('recording_001')).rejects.toThrow(
        'Failed to load transcription'
      );
    });
  });

  describe('getMarkerTarget', () => {
    it('should find next marker correctly', () => {
      const markers = [10, 20, 30, 40];
      const currentPos = 15;

      const result = getMarkerTarget('next', currentPos, markers);
      expect(result).toBe(20);
    });

    it('should wrap to end marker if no next marker exists', () => {
      const markers = [10, 20, 30, 40];
      const currentPos = 35;

      const result = getMarkerTarget('next', currentPos, markers);
      expect(result).toBe(40);
    });

    it('should find previous marker correctly', () => {
      const markers = [10, 20, 30, 40];
      const currentPos = 35;

      const result = getMarkerTarget('prev', currentPos, markers);
      expect(result).toBe(30);
    });

    it('should wrap to first marker if no previous marker exists', () => {
      const markers = [10, 20, 30, 40];
      const currentPos = 15;

      const result = getMarkerTarget('prev', currentPos, markers);
      expect(result).toBe(10);
    });

    it('should return null if markers array is empty', () => {
      const markers = [];
      const currentPos = 20;

      const result = getMarkerTarget('next', currentPos, markers);
      expect(result).toBeNull();
    });

    it('should skip markers within 0.5 seconds threshold', () => {
      const markers = [10, 10.3, 20, 20.2];
      const currentPos = 10.2;

      const result = getMarkerTarget('next', currentPos, markers);
      expect(result).toBe(20);
    });

    it('should handle single marker', () => {
      const markers = [20];
      const currentPos = 10;

      const nextResult = getMarkerTarget('next', currentPos, markers);
      expect(nextResult).toBe(20);

      const prevResult = getMarkerTarget('prev', currentPos, markers);
      expect(prevResult).toBe(20);
    });
  });
});
