# JINI Test Guide

This guide describes how to run the real-backend flows safely.

## Test types

- **Unit-style tests**: mostly mocked dependencies, fast feedback.
- **Integration/E2E tests**: cross-service flows.
- **Live-backend tests**: make real HTTP requests and validate real responses.

## Files with live backend requests

- `__tests__/services/LoginServices.test.js`
- `__tests__/services/SignupServices.test.js`
- `__tests__/services/HomeServices.test.js`
- `__tests__/integration/authentication.e2e.test.js`

`__tests__/services/HomeServices.test.js` includes full lifecycle verification:

1. signup new user
2. upload `assets/audio/record-1761512646339.wav`
3. run record operations (favorite, rename, delete)
4. delete account

## Environment requirements

Set in `.env`:

```env
EXPO_PUBLIC_BASE_URL=http://<backend-host>:<port>
```

Optional test credentials:

```env
TEST_USER_EMAIL=<email>
TEST_USER_PASSWORD=<password>
```

Jest setup loads `.env` and maps `BASE_URL` automatically.

## Commands

```bash
# full suite
npm test

# focused live-backend runs
npm test -- __tests__/integration/authentication.e2e.test.js
npm test -- __tests__/services/HomeServices.test.js

# fast local checks (mostly mocked)
npm test -- __tests__/utils/
npm test -- __tests__/services/ListenServices.test.js
```

## Troubleshooting live tests

- **401 / refresh errors**: verify test user exists and backend token refresh endpoint is healthy.
- **Upload 422**: confirm backend expects multipart file field `audio_file`.
- **Long runtime**: upload/transcription tests can take >60s depending on backend load.
- **Open handles warning**: run with `--detectOpenHandles` for investigation.

## Maintenance rules

- Prefer real backend assertions only for flows that require API truth.
- Keep pure business-logic tests mocked and deterministic.
- For live tests, always include cleanup (delete record/account) in `finally` when possible.
- Update this guide and `__tests__/README.md` whenever test behavior changes.
