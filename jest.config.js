module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'applications/tools/**/*.js',
    '!**/node_modules/**',
    '!**/dist/**'
  ]
};