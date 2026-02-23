module.exports = {
  // Use jest-expo for better compatibility with Expo projects
  preset: 'jest-expo', 
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // This expanded regex ensures @react-native polyfills are transformed
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],

  collectCoverageFrom: [
    'utils/**/*.{js,jsx}',
    'services/**/*.{js,jsx}',
    'Navigation/**/*.{js,jsx}',
    '!**/*.test.{js,jsx}',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo/src/async-require/messageSocket$': '<rootDir>/node_modules/expo/build/launch/MessageSocket.js',
  },
  testTimeout: 10000,
  verbose: true,
  bail: false,
  maxWorkers: '50%',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};