import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Formats seconds into a MM:SS string
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

/**
 * Loads and initializes the audio object
 * @returns {Promise<Audio.Sound>}
 */
export const setupAudio = async (uri, onStatusUpdate) => {
  if (!uri) return null;

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { 
        shouldPlay: false, 
        progressUpdateIntervalMillis: 100 
      }
    );
    sound.setOnPlaybackStatusUpdate(onStatusUpdate);
    return sound;
  } catch (error) {
    throw new Error("Audio setup failed: " + error.message);
  }
};

/**
 * Fetches transcription data from local storage
 */
export const getLocalTranscription = async (recordName) => {
  try {
    const key = `transcription_${recordName}`;
    const savedData = await AsyncStorage.getItem(key);
    if (savedData) {
      return JSON.parse(savedData);
    }
    return null;
  } catch (e) {
    throw new Error("Failed to load transcription");
  }
};

/**
 * Calculates the next or previous marker target
 */
export const getMarkerTarget = (direction, currentPos, markers) => {
  if (!markers.length) return null;

  if (direction === 'next') {
    const target = markers.find(m => m > currentPos + 0.5);
    return target !== undefined ? target : markers[markers.length - 1];
  } else {
    const target = [...markers].reverse().find(m => m < currentPos - 0.5);
    return target !== undefined ? target : markers[0];
  }
};