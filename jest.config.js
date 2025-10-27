// jest.config.mjs
export default {
  testEnvironment: "node",
  transform: {},
  //   extensionsToTreatAsEsm: [".js", ".mjs"],
  moduleFileExtensions: ["js", "mjs", "json"],
  // If you use path aliases via "imports" in package.json, Jest respects them in ESM mode.
  // If not, add "moduleNameMapper" here.
  // Only run setup for integration tests
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
  testMatch: ["**/*.test.js"],
  // Unit tests don't need the MongoDB setup
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/tests/units/**/*.test.js"],
      testEnvironment: "node",
      transform: {},
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integrations/**/*.test.js"],
      testEnvironment: "node",
      transform: {},
      setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
    },
  ],
};
