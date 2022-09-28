module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/build'],
  verbose: true,
  coveragePathIgnorePatterns: ['<rootDir>/src/lib/drivers/s3-driver.ts'],
};