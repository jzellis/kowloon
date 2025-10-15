// jest.config.mjs
export default {
  testEnvironment: "node",
  transform: {},
  //   extensionsToTreatAsEsm: [".js", ".mjs"],
  moduleFileExtensions: ["js", "mjs", "json"],
  // If you use path aliases via "imports" in package.json, Jest respects them in ESM mode.
  // If not, add "moduleNameMapper" here.
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
};
