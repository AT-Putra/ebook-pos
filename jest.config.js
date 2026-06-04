/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  cacheDirectory: './jest-cache',
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  watchPathIgnorePatterns: ['/node_modules/', '/.next/'],
  modulePathIgnorePatterns: ['/.next/'],
};

module.exports = config;
