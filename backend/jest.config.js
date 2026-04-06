'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // setupFilesAfterEnv runs after the Jest test framework is installed, so
  // beforeAll/afterAll hooks in setup.js work correctly.
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // clearMocks resets call counts/instances between tests without removing
  // mock implementations – exactly what we want for per-test mock control.
  clearMocks: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/migrations/**',
    '!src/config/env.js',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};
