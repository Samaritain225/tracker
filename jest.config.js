/**
 * Jest config scoped to the pure logic in src/utils.
 *
 * Deliberately NOT using the jest-expo preset: these modules have zero
 * React Native / Expo imports (see the "no side effects" header comment
 * in each), and pulling in jest-expo's native module mocks drags in
 * expo-modules-core, which currently hits a react-native-worklets peer
 * dependency conflict unrelated to these tests. Plain babel-jest with
 * the project's own babel.config.js is enough. If tests ever need to
 * cover React components or hooks, re-evaluate the preset then.
 */

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
