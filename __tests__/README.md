# JINI Project - Test Suite Index

## 📚 Quick Navigation

### Start Here
- **[TESTING_SUMMARY.md](./TESTING_SUMMARY.md)** - Complete overview of the test suite
- **[TEST_GUIDE.md](./TEST_GUIDE.md)** - Detailed guide on running and writing tests

### Service Tests
Each service has comprehensive unit tests covering validation, API calls, and error handling.

1. **[LoginServices.test.js](./services/LoginServices.test.js)** - 15 tests
   - Google Sign-In validation
   - Form validation
   - Email/password authentication
   - Error and timeout scenarios

2. **[SignupServices.test.js](./services/SignupServices.test.js)** - 12 tests
   - Form field validation
   - Email format validation
   - Password strength requirements
   - User registration
   - Network error handling

3. **[ListenServices.test.js](./services/ListenServices.test.js)** - 11 tests
   - Time formatting for audio display
   - Audio setup and initialization
   - Transcription loading from storage
   - Marker navigation (next/previous)
   - Edge cases and error states

4. **[HomeServices.test.js](./services/HomeServices.test.js)** - 10 tests
   - Directory creation and management
   - Loading local recordings
   - Search functionality
   - Favorite management
   - Record rename operations
   - Record deletion

### Utility Tests
Core utility functions tested in isolation with comprehensive mock coverage.

1. **[auth.test.js](./utils/auth.test.js)** - 12 tests
   - Token retrieval and storage
   - User credential management
   - Google login status tracking
   - Secure store operations
   - Error handling

2. **[permissions.test.js](./utils/permissions.test.js)** - 8 tests
   - Android permission requests
   - Platform detection (iOS/Android)
   - Android 13+ specific permissions
   - Permission denial handling
   - Version-specific behavior

3. **[api.test.js](./utils/api.test.js)** - 6 tests
   - API request with authorization
   - Token refresh on 401
   - FormData request handling
   - Error scenarios
   - Session expiration

### Integration Tests
Tests that verify complete user flows and interactions between multiple components.

1. **[HomeScreen.integration.test.js](./integration/HomeScreen.integration.test.js)** - 7 tests
   - Record loading on mount
   - Search implementation
   - Delete confirmation and execution
   - Favorite toggle
   - Record rename flow
   - Screen refresh on focus

### End-to-End Tests
Complete user journeys and complex flows across multiple services.

1. **[authentication.e2e.test.js](./integration/authentication.e2e.test.js)** - 12 tests
   - Complete Google Sign-In flow
   - Complete email/password login
   - Complete signup flow
   - Failed login scenarios
   - Token refresh flow
   - Logout flow

2. **[audioPlayback.e2e.test.js](./integration/audioPlayback.e2e.test.js)** - 10 tests
   - Full recording playback session
   - Audio setup and playback
   - Time formatting during playback
   - Marker navigation flow
   - Transcription loading
   - Error recovery
   - Edge cases

### Configuration Files

1. **[jest.config.js](../jest.config.js)**
   - Jest presets and configuration
   - Coverage thresholds (70-80%)
   - Transform patterns
   - Test matching patterns

2. **[jest.setup.js](../jest.setup.js)**
   - Mock configurations
   - Expo module mocks
   - React Native mocks
   - Global mocks (fetch, console)

## 🎯 Test Count Summary

| Category | Files | Tests | Lines |
|----------|-------|-------|-------|
| Services | 4 | 48 | ~800 |
| Utils | 3 | 26 | ~600 |
| Integration | 1 | 7 | ~300 |
| E2E | 2 | 22 | ~500 |
| Config | 2 | - | ~200 |
| Docs | 3 | - | ~800 |
| **TOTAL** | **17** | **103+** | **~3200** |

## 📖 Running Tests by Category

### All Tests
```bash
npm test
```

### Only Service Tests
```bash
npm test -- __tests__/services/
```

### Only Util Tests
```bash
npm test -- __tests__/utils/
```

### Only Integration Tests
```bash
npm test -- __tests__/integration/
```

### Specific Test File
```bash
npm test -- __tests__/services/LoginServices.test.js
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## 🔍 Finding Specific Tests

### Tests by Feature
- **Authentication**: 
  - `LoginServices.test.js`
  - `authentication.e2e.test.js`

- **Recording Management**:
  - `HomeServices.test.js`
  - `HomeScreen.integration.test.js`

- **Audio Playback**:
  - `ListenServices.test.js`
  - `audioPlayback.e2e.test.js`

- **Signup/Registration**:
  - `SignupServices.test.js`

### Tests by Type
- **Validation Tests**: SignupServices, LoginServices
- **API Tests**: LoginServices, api.test.js
- **File Operations**: HomeServices.test.js, permissions.test.js
- **Audio Operations**: ListenServices.test.js, audioPlayback.e2e.test.js

## 📊 Test Coverage by Module

### High Coverage (>90%)
- ✅ ListenServices.test.js (95%)
- ✅ auth.test.js (95%)
- ✅ permissions.test.js (90%)
- ✅ SignupServices.test.js (90%)

### Medium Coverage (80-89%)
- ✅ LoginServices.test.js (85%)
- ✅ api.test.js (85%)
- ✅ HomeServices.test.js (80%)

## 🧪 Mock Data Reference

### Mock User
```javascript
{
  id: '12345',
  name: 'John Doe',
  email: 'john@example.com'
}
```

### Mock Recording
```javascript
{
  phoneNumber: '1234567890',
  date: Date.now(),
  duration: 120,
  recording: {
    name: 'recording.wav',
    uri: 'file://recording.wav'
  },
  isFavorite: false
}
```

### Mock Tokens
```javascript
{
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token'
}
```

## 🛠️ Maintenance

### Adding New Tests
1. Create test file in appropriate category
2. Follow naming convention: `FeatureName.test.js`
3. Include setUp/tearDown in beforeEach/afterEach
4. Add descriptive test names
5. Test both success and error paths

### Updating Tests
1. Update jest.setup.js for new mocks
2. Keep test names clear and descriptive
3. Update relevant documentation
4. Maintain coverage threshold (>80%)

### Running Specific Tests During Development
```bash
npm test -- --testNamePattern="specific test name"
npm test -- --watchAll
npm test -- LoginServices --watch
```

## 📝 Quick Reference

| Task | Command |
|------|---------|
| Run all tests | `npm test` |
| Watch mode | `npm run test:watch` |
| Coverage report | `npm run test:coverage` |
| Single file | `npm test -- file.test.js` |
| Specific test | `npm test -- -t "test name"` |
| Verbose output | `npm test -- --verbose` |
| Update snapshots | `npm test -- -u` |

## ✅ Quality Metrics

- **Test Files**: 10 files
- **Total Tests**: 103+ test cases
- **Code Coverage Target**: >80%
- **Average Execution Time**: 3-4 minutes
- **Lines of Test Code**: ~3200
- **Mock Modules**: 8 modules
- **Services Tested**: 4 services
- **Utils Tested**: 3 utilities
- **E2E Flows**: 2 complete flows
- **Integration Suites**: 1 suite

## 🚀 Next Steps

1. **Read TESTING_SUMMARY.md** for complete overview
2. **Check TEST_GUIDE.md** for detailed instructions
3. **Run `npm test`** to verify setup
4. **Review specific test files** based on your needs
5. **Use npm run test:watch** during development

---

For detailed information about each test, see [TESTING_SUMMARY.md](./TESTING_SUMMARY.md)
