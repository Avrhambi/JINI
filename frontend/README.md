# JINI — Frontend (Mobile App)

React Native (Expo) mobile client for JINI. Part of the
[JINI final project](../README.md) — B.Sc. Computer Science, Bar-Ilan University.

The app handles authentication, call recording/upload, playback, and live "listen"
sessions. It talks only to the [backend API](../backend/README.md).

## Tech stack

- **React Native 0.79.6** with **Expo 53**
- **React Navigation** (native stack)
- **Google Sign-In** + Expo Auth Session
- **Expo AV** for audio record/playback
- **AsyncStorage / Secure Store / SQLite** for local state and tokens
- **EAS Build** + Gradle for Android
- Custom Android native module `CallLogModule` for call-log access

## Project structure

```
frontend/
├── App.js                  # app entry
├── index.js                # bootstrap
├── app.json                # Expo config
├── eas.json                # EAS build/update config
├── Navigation/
│   ├── Main.js             # navigator
│   └── screens/            # Home, Listen, Login, Signup
├── services/               # per-screen API logic (Home/Listen/Login/Signup)
├── utils/
│   ├── api.js              # API client
│   ├── auth.js / AuthContext.js
│   ├── permissions.js
│   └── RecordManager.js    # recording lifecycle
├── assets/                 # audio, fonts
├── android/                # native project + CallLogModule
└── __tests__/
```

## Getting started

### Prerequisites

- Node.js + npm
- Expo CLI
- Android SDK (for Android builds)
- A configured Google Sign-In project

### Install & run

```bash
npm install
# create .env.local with API base URL + Google Sign-In credentials
npm start            # Expo dev server
npm run android      # run on Android emulator/device
```

### Build & distribute

```bash
eas build --platform android
eas update --branch preview --message "…"
```

## Permissions

Camera, microphone, call-log (Android), and file-system access — requested through
`utils/permissions.js`.

## Tests

```bash
npm test
```

## Docs

- [React Native](https://reactnative.dev) · [Expo](https://docs.expo.dev) · [React Navigation](https://reactnavigation.org)
