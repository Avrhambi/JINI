// jest.setup.js
import 'react-native/jest/setup';
import { config as loadEnv } from 'dotenv';

loadEnv();
process.env.BASE_URL = process.env.BASE_URL || process.env.EXPO_PUBLIC_BASE_URL;

const mockPlatform = {
  OS: 'android',
  Version: 30,
  select: jest.fn((dict) => dict.android || dict.default),
};

// Mock the deep internal path
jest.mock('react-native/Libraries/Utilities/Platform', () => mockPlatform);

// Mock the main module manually without requireActual
jest.mock('react-native', () => {
  return {
    Platform: mockPlatform,
    PermissionsAndroid: {
      requestMultiple: jest.fn(),
      RESULTS: {
        GRANTED: 'granted',
        DENIED: 'denied',
        NEVER_ASK_AGAIN: 'never_ask_again',
      },
      PERMISSIONS: {
        READ_CALL_LOG: 'android.permission.READ_CALL_LOG',
        READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
        READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
        READ_MEDIA_AUDIO: 'android.permission.READ_MEDIA_AUDIO',
      },
    },
    // Add other RN components your app uses here as simple mocks if needed
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
  };
});

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    signOut: jest.fn(),
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
  },
}));

if (typeof global.fetch === 'function') {
  global.realFetch = global.fetch.bind(global);
}

global.fetch = jest.fn();