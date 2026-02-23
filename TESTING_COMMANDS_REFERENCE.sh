#!/bin/bash
# JINI Project - Test Commands Reference

# ============================================
# BASIC TEST COMMANDS
# ============================================

# Run all tests
npm test

# Run tests in watch mode (live updates as you edit)
npm run test:watch

# Generate coverage report (see coverage metrics)
npm run test:coverage

# ============================================
# SPECIFIC TEST RUNS
# ============================================

# Run only service tests
npm test -- __tests__/services/

# Run only utility tests
npm test -- __tests__/utils/

# Run only integration tests
npm test -- __tests__/integration/

# Run specific test file
npm test -- LoginServices.test.js
npm test -- HomeServices.test.js
npm test -- authentication.e2e.test.js
npm test -- audioPlayback.e2e.test.js

# ============================================
# TEST FILTERING
# ============================================

# Run tests matching pattern
npm test -- --testNamePattern="login"
npm test -- --testNamePattern="auth"
npm test -- --testNamePattern="search"
npm test -- --testNamePattern="favorite"

# Run only failed tests (from previous run)
npm test -- --onlyChanged

# ============================================
# DEBUGGING & VERBOSE OUTPUT
# ============================================

# Run tests with verbose output
npm test -- --verbose

# Run tests and show each individual test
npm test -- --listTests

# Run single test with debugging
npm test -- --testNamePattern="should load records" --verbose

# ============================================
# COVERAGE REPORTS
# ============================================

# Generate full coverage report
npm run test:coverage

# Coverage report with threshold warnings
npm run test:coverage -- --coverage

# Coverage for specific file
npm test -- --coverage auth.test.js

# ============================================
# WATCH MODE VARIANTS
# ============================================

# Watch mode - all tests
npm run test:watch

# Watch mode - specific file
npm test -- --watch LoginServices.test.js

# Watch mode - matching pattern
npm test -- --watch --testNamePattern="auth"

# Watch with coverage
npm test -- --watch --coverage

# ============================================
# ADVANCED OPTIONS
# ============================================

# Run tests in parallel (faster)
npm test -- --maxWorkers=4

# Run tests sequentially (slower but easier to debug)
npm test -- --runInBand

# Bail after first test failure
npm test -- --bail

# Update snapshots (if using snapshot testing)
npm test -- -u

# Show which tests are slow
npm test -- --detectOpenHandles

# ============================================
# CONTINUOUS INTEGRATION
# ============================================

# Run tests once (for CI/CD pipelines)
npm test -- --ci

# Run with coverage for CI
npm test -- --coverage --ci

# Run specific tests for pull requests
npm test -- __tests__/services/LoginServices.test.js --ci

# ============================================
# TEST FILE ORGANIZATION
# ============================================

# View all test files
ls -la __tests__/**/*.test.js

# Count total tests
npm test -- --listTests | wc -l

# List test names without running
npm test -- --listTests

# ============================================
# TROUBLESHOOTING
# ============================================

# Clear Jest cache
npm test -- --clearCache

# Reset modules between tests
npm test -- --resetModules

# Show test summary
npm test -- --silent=false

# ============================================
# DEVELOPMENT WORKFLOW
# ============================================

# 1. Start watch mode in one terminal
npm run test:watch

# 2. In another terminal, develop and watch tests update

# 3. When done, generate coverage
npm run test:coverage

# 4. Commit with all tests passing
npm test

# ============================================
# EXAMPLE WORKFLOWS
# ============================================

# Workflow 1: Developing a new feature
npm run test:watch -- --testNamePattern="myFeature"

# Workflow 2: Fixing a failing test
npm test -- LoginServices.test.js --watch

# Workflow 3: Pre-commit check
npm test && npm run test:coverage

# Workflow 4: Debug a specific test
npm test -- --testNamePattern="exact test name" --verbose --runInBand

# ============================================
# COVERAGE VIEWING
# ============================================

# After running: npm run test:coverage

# Open coverage report in browser (macOS)
open coverage/lcov-report/index.html

# Open coverage report in browser (Windows)
start coverage/lcov-report/index.html

# Open coverage report in browser (Linux)
xdg-open coverage/lcov-report/index.html

# ============================================
# TEST STATISTICS
# ============================================

# Count tests by file
for file in __tests__/**/*.test.js; do
  count=$(grep -c "it(" "$file")
  echo "$file: $count tests"
done

# Get total test count
grep -r "it(" __tests__/ | wc -l

# ============================================
# USEFUL ALIASES (add to ~/.bashrc or ~/.zshrc)
# ============================================

# alias t='npm test'
# alias tw='npm run test:watch'
# alias tc='npm run test:coverage'
# alias ts='npm test -- --listTests'

# ============================================
# PACKAGE.JSON SCRIPTS
# ============================================

# Located in package.json:
# "test": "jest"
# "test:watch": "jest --watch"
# "test:coverage": "jest --coverage"

# ============================================
# FILES REFERENCE
# ============================================

# Configuration:
#   jest.config.js          - Jest configuration
#   jest.setup.js           - Jest setup and mocks

# Documentation:
#   TESTING_COMPLETE.md     - Project completion summary
#   __tests__/README.md     - Navigation and index
#   __tests__/TEST_GUIDE.md - Detailed testing guide
#   __tests__/TESTING_SUMMARY.md - Executive summary

# Test Files:
#   __tests__/services/     - Service tests (4 files, 48 tests)
#   __tests__/utils/        - Utility tests (4 files, 32 tests)
#   __tests__/integration/  - Integration & E2E (4 files, 33 tests)

# ============================================
# TIPS & BEST PRACTICES
# ============================================

# 1. Use watch mode during development
#    npm run test:watch

# 2. Run full suite before committing
#    npm test

# 3. Check coverage before deploying
#    npm run test:coverage

# 4. Run specific failing tests
#    npm test -- -t "test name"

# 5. Keep tests organized by feature
#    See __tests__ directory structure

# ============================================
# QUICK START
# ============================================

# 1. npm install           (if not already done)
# 2. npm test              (run all tests)
# 3. npm run test:coverage (view coverage)
# 4. npm run test:watch    (start development)

# ============================================

# Last Updated: 2026-02-22
# Total Tests: 103+
# Total Test Files: 12
