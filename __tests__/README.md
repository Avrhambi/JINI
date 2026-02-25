# JINI Test Suite

This folder contains unit, integration, and live-backend tests for the app.

- `__tests__/services/LoginServices.test.js` (real credential login cases)
- `__tests__/services/SignupServices.test.js` (real signup cases)
- `__tests__/services/HomeServices.test.js` (full lifecycle: signup → upload → record actions → delete account)
- `__tests__/integration/authentication.e2e.test.js` (live backend login response test)

## Required environment

These tests depend on values from `.env`:

- `EXPO_PUBLIC_BASE_URL`
- optional: `TEST_USER_EMAIL` (default fallback is used if absent)
- optional: `TEST_USER_PASSWORD` (default fallback is used if absent)

Jest setup loads `.env` and maps `BASE_URL` automatically.

## Run commands

```bash
# all tests
npm test

# live backend lifecycle test
npm test -- __tests__/services/HomeServices.test.js

# auth integration test
npm test -- __tests__/integration/authentication.e2e.test.js

# service tests only
npm test -- __tests__/services/

# utils tests only
npm test -- __tests__/utils/
```

## Notes on live tests

- Live tests can take longer (especially upload/transcription paths).
- They create temporary backend data and clean up in test flow.
- If backend is down or slow, live tests can fail even when code is correct.

## Structure

- `services/` → service-level tests
- `utils/` → utility-level tests
- `integration/` → integration and e2e-style flows

For more detail and maintenance conventions, see `__tests__/TEST_GUIDE.md`.

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

1. **Check TEST_GUIDE.md** for detailed instructions
2. **Run `npm test`** to verify setup
3. **Review specific test files** based on your needs
4. **Use npm run test:watch** during development

---

