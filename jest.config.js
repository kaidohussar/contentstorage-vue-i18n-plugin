module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Transform vue-i18n ESM modules
  transformIgnorePatterns: [
    '/node_modules/(?!(vue-i18n|@intlify)/)',
  ],
  // Map vue-i18n to its CJS build for Jest
  moduleNameMapper: {
    '^vue-i18n$': '<rootDir>/node_modules/vue-i18n/dist/vue-i18n.cjs.js',
    '^vue$': '<rootDir>/node_modules/vue/dist/vue.cjs.js',
  },
};
