# JINI

A React Native application built with Expo for managing calls and audio recording with Google authentication and real-time listening capabilities.

## Project Overview

JINI is a mobile application that provides:
- User authentication (Login/Signup with Google Sign-In support)
- Call management and logging
- Audio recording and playback
- Real-time listening services
- Secure token management

## Technology Stack

- **Framework**: React Native 0.79.6 with Expo 53.0.27
- **Navigation**: React Navigation (Native Stack)
- **Authentication**: Google Sign-In, Expo Auth Session
- **State Management**: React Context API
- **Storage**: AsyncStorage, Secure Store, SQLite
- **Audio**: Expo AV
- **UI Components**: React Native, Expo Vector Icons, Linear Gradient
- **Build Tools**: Expo EAS, Gradle (Android)

## Project Structure

### Core Files
- **App.js** - Main application entry point
- **index.js** - Application bootstrap
- **app.json** - Expo configuration
- **package.json** - Dependencies and scripts
- **eas.json** - EAS Build configuration
- **react-native.config.js** - React Native configuration

### Directories

#### `/Navigation`
Navigation configuration and screen definitions
- **Main.js** - Main navigation setup
- **screens/** - Application screens
  - `Home.js` - Home screen
  - `Listen.js` - Listening features
  - `Login.js` - User login
  - `Signup.js` - User registration

#### `/services`
Business logic and API communication
- **HomeServices.js** - Home screen services
- **ListenServices.js** - Listening services
- **LoginServices.js** - Authentication services
- **SignupServices.js** - Registration services

#### `/utils`
Utility functions and helpers
- **api.js** - API client configuration
- **auth.js** - Authentication utilities
- **AuthContext.js** - React Context for authentication state
- **permissions.js** - Permission handling
- **RecordManager.js** - Audio recording management

#### `/assets`
Static resources
- **audio/** - Audio files
- **fonts/** - Custom fonts

#### `/android`
Android-specific configuration and native code
- **app/src/main/java/com/anonymous/JINI/** - Native modules
  - `MainActivity.kt` - Android main activity
  - `MainApplication.kt` - Android application class
  - `CallLogModule.java` - Call log native module
  - Corresponding package files for each module
- **res/** - Android resources (drawables, layouts, values)

## Getting Started

### Prerequisites
- Node.js and npm
- Expo CLI
- Android SDK (for Android development)
- A Google Sign-In project configured

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file with your API configuration and Google Sign-In credentials.

### Development

Start the development server:
```bash
npm start
```

For specific platforms:
```bash
npm run android       # Run on Android emulator
npm run ios          # Run on iOS simulator
npm run web          # Run on web
```

Development mode with live reloading:
```bash
npm run dev
```

## Build and Deployment

### Android Build
```bash
eas build --platform android
```

### Update Distribution
```bash
eas update --branch preview --message "Your message"
```

## Features

- **Authentication**: Secure user login and registration with Google Sign-In
- **Call Management**: Track and log calls with native integration
- **Audio Recording**: Record and playback audio files
- **Real-time Listening**: Live listening capabilities with progress tracking
- **Secure Storage**: Encrypted token storage with Secure Store
- **Cross-platform**: Support for Android and iOS

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| expo | ~53.0.27 | React Native framework |
| react-native | 0.79.6 | Core React Native |
| @react-navigation/native | ^7.1.6 | Navigation |
| expo-av | ~15.1.7 | Audio/Video |
| @react-native-google-signin/google-signin | ^16.1.1 | Google authentication |
| expo-sqlite | ~15.2.14 | Local database |
| react-native-fs | ^2.20.0 | File system access |

## Android Native Modules

The project includes custom native module for extended functionality:

**CallLogModule/CallLogPackage** - Manages call logging

## Permissions

The application requires:
- Camera access
- Microphone access
- Call log access (Android)
- File system access

Permissions are managed through `utils/permissions.js`

## Configuration

- **app.json** - Expo app configuration including splash screens, icons, and platform-specific settings
- **android/** - Android build configuration
- **eas.json** - Build and update configuration

## Notes

- The project uses Expo's managed workflow for simplified development
- Android build artifacts are generated in `android/build/`
- Sensitive files (keystores, certificates) are excluded via .gitignore
- EAS auto-fingerprint is skipped in build scripts

## Version

- **App Version**: 1.0.0
- **Package**: com.anonymous.JINI
- **Android Version Code**: 1

## Support

For issues and questions, refer to:
- [React Native Documentation](https://reactnative.dev)
- [Expo Documentation](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
