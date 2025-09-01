/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  displayName: 'yaft',
  setupFilesAfterEnv: [
    '<rootDir>/src/test/test-setup.ts'
  ],
  globals: {},
  coverageDirectory: 'coverage/yaft',
  testEnvironment: "node",
  testMatch: [
    '<rootDir>/src/**/*.spec.ts'
  ],
  transform: {
    "^.+\.tsx?$": ["ts-jest",{}],
  },
};
