import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ListenServices from '../../services/ListenServices';
import * as HomeServices from '../../services/HomeServices';

jest.mock('expo-av', () => {
  const mockSoundInstance = {
    loadAsync: jest.fn().mockResolvedValue({ isLoaded: true }),
    unloadAsync: jest.fn().mockResolvedValue(true),
    playAsync: jest.fn().mockResolvedValue(true),
    pauseAsync: jest.fn().mockResolvedValue(true),
    setOnPlaybackStatusUpdate: jest.fn(),
    setStatusAsync: jest.fn().mockResolvedValue(true),
    stopAsync: jest.fn().mockResolvedValue(true),
  };

  return {
    Audio: {
      Sound: {
        // This is the missing piece!
        createAsync: jest.fn(), 
        // If you also use 'new Audio.Sound()'
        prototype: mockSoundInstance,
      },
      setAudioModeAsync: jest.fn().mockResolvedValue(true),
      InterruptionModeIOS: { DoNotMix: 1 },
      InterruptionModeAndroid: { DoNotMix: 1 },
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-av');
jest.mock('../../services/HomeServices');

describe('Audio Listening Flow End-to-End Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Audio Playback Flow', () => {
    it('should setup, play, and navigate audio recording', async () => {
      const mockSound = {
        playAsync: jest.fn().mockResolvedValue(undefined),
        pauseAsync: jest.fn().mockResolvedValue(undefined),
        setPositionAsync: jest.fn().mockResolvedValue(undefined),
        getStatusAsync: jest.fn().mockResolvedValue({
          isPlaying: true,
          positionMillis: 5000,
          durationMillis: 60000,
        }),
        setOnPlaybackStatusUpdate: jest.fn(),
      };

      Audio.Sound.createAsync.mockResolvedValue({ sound: mockSound });

      const recordingUri = 'file://recording.wav';
      const onStatusUpdate = jest.fn();

      // Setup audio
      const sound = await ListenServices.setupAudio(recordingUri, onStatusUpdate);

      expect(sound).toBe(mockSound);
      expect(mockSound.setOnPlaybackStatusUpdate).toHaveBeenCalledWith(onStatusUpdate);

      // Play audio
      await sound.playAsync();
      expect(mockSound.playAsync).toHaveBeenCalled();

      // Check status
      const status = await sound.getStatusAsync();
      expect(status.isPlaying).toBe(true);

      // Pause audio
      await sound.pauseAsync();
      expect(mockSound.pauseAsync).toHaveBeenCalled();
    });

    it('should format time correctly during playback', () => {
      const timings = [
        { seconds: 0, expected: '0:00' },
        { seconds: 5, expected: '0:05' },
        { seconds: 60, expected: '1:00' },
        { seconds: 125, expected: '2:05' },
        { seconds: 3661, expected: '61:01' },
      ];

      timings.forEach(({ seconds, expected }) => {
        const formatted = ListenServices.formatTime(seconds);
        expect(formatted).toBe(expected);
      });
    });

    it('should navigate between markers during playback', () => {
      const markers = [10, 25, 40, 55];
      const currentPos = 30;

      // Go to next marker
      const nextMarker = ListenServices.getMarkerTarget('next', currentPos, markers);
      expect(nextMarker).toBe(40);

      // Go to previous marker
      const prevMarker = ListenServices.getMarkerTarget('prev', currentPos, markers);
      expect(prevMarker).toBe(25);
    });

    it('should skip to beginning if at end and go next', () => {
      const markers = [10, 25, 40, 55];
      const currentPos = 56;

      const nextMarker = ListenServices.getMarkerTarget('next', currentPos, markers);
      expect(nextMarker).toBe(55); // Wraps to end
    });
  });

  describe('Transcription Loading', () => {
    it('should load transcription for recording', async () => {
      const mockTranscription = {
        text: 'This is a transcribed conversation',
        timestamps: [0, 5, 10, 15],
      };

      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTranscription));

      const result = await ListenServices.getLocalTranscription('recording_001');

      expect(result).toEqual(mockTranscription);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('transcription_recording_001');
    });

    it('should handle missing transcription', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      const result = await ListenServices.getLocalTranscription('recording_001');

      expect(result).toBeNull();
    });
  });

  describe('Full Recording Playback Session', () => {
    it('should complete a full recording playback session', async () => {
      // Step 1: Load recording from favorites
      const mockRecordings = [
        {
          phoneNumber: '1234567890',
          recording: {
            name: 'call_001.wav',
            uri: 'file://call_001.wav',
            duration: 300,
            size: 1024000,
          },
          isFavorite: true,
        },
      ];

      HomeServices.loadLocalRecords.mockResolvedValue(mockRecordings);

      const recordings = await HomeServices.loadLocalRecords(jest.fn());
      expect(recordings).toHaveLength(1);
      expect(recordings[0].isFavorite).toBe(true);

      const selectedRecording = recordings[0];

      // Step 2: Setup audio playback
      const mockSound = {
        playAsync: jest.fn().mockResolvedValue(undefined),
        pauseAsync: jest.fn().mockResolvedValue(undefined),
        stopAsync: jest.fn().mockResolvedValue(undefined),
        getStatusAsync: jest.fn().mockResolvedValue({
          isPlaying: true,
          positionMillis: 0,
          durationMillis: 300000,
        }),
        setOnPlaybackStatusUpdate: jest.fn(),
      };

      Audio.Sound.createAsync.mockResolvedValue({ sound: mockSound });

      const sound = await ListenServices.setupAudio(
        selectedRecording.recording.uri,
        jest.fn()
      );
      expect(sound).toBeDefined();

      // Step 3: Play recording
      await sound.playAsync();
      expect(mockSound.playAsync).toHaveBeenCalled();

      // Step 4: Load and display transcription
      const mockTranscription = {
        text: 'Call transcription content',
        timestamps: [10, 20, 30],
      };

      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTranscription));

      const transcription = await ListenServices.getLocalTranscription(
        selectedRecording.recording.name
      );
      expect(transcription).toEqual(mockTranscription);

      // Step 5: Navigate markers
      const markers = mockTranscription.timestamps;
      const nextMarker = ListenServices.getMarkerTarget('next', 15, markers);
      expect(nextMarker).toBe(20);

      // Step 6: Format time during playback
      const formattedTime = ListenServices.formatTime(45);
      expect(formattedTime).toBe('0:45');

      // Step 7: Stop playback
      await sound.stopAsync();
      expect(mockSound.stopAsync).toHaveBeenCalled();
    });
  });

  describe('Error Handling in Playback', () => {
    it('should handle audio setup errors', async () => {
      Audio.Sound.createAsync.mockRejectedValue(new Error('Audio setup failed'));

      await expect(
        ListenServices.setupAudio('file://bad.wav', jest.fn())
      ).rejects.toThrow('Audio setup failed');
    });

    it('should handle playback errors gracefully', async () => {
      const mockSound = {
        playAsync: jest.fn().mockRejectedValue(new Error('Playback failed')),
        setOnPlaybackStatusUpdate: jest.fn(),
      };

      Audio.Sound.createAsync.mockResolvedValue({ sound: mockSound });

      const sound = await ListenServices.setupAudio('file://audio.wav', jest.fn());

      await expect(sound.playAsync()).rejects.toThrow('Playback failed');
    });
  });

  describe('Marker Navigation Edge Cases', () => {
    it('should handle navigation with single marker', () => {
      const markers = [30];

      const next = ListenServices.getMarkerTarget('next', 20, markers);
      expect(next).toBe(30);

      const prev = ListenServices.getMarkerTarget('prev', 40, markers);
      expect(prev).toBe(30);
    });

    it('should handle navigation with no markers', () => {
      const markers = [];

      const next = ListenServices.getMarkerTarget('next', 20, markers);
      expect(next).toBeNull();

      const prev = ListenServices.getMarkerTarget('prev', 20, markers);
      expect(prev).toBeNull();
    });

    it('should handle marker navigation at exact position', () => {
      const markers = [10, 20, 30, 40];

      // At 20, next should be 30 (skip 20 due to 0.5s threshold)
      const next = ListenServices.getMarkerTarget('next', 20, markers);
      expect(next).toBe(30);

      // At 20, prev should be 10
      const prev = ListenServices.getMarkerTarget('prev', 20, markers);
      expect(prev).toBe(10);
    });
  });
});
