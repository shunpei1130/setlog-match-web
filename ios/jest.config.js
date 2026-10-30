/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // SDK 57's first native render can exceed five seconds on a cold Windows cache.
  testTimeout: 15_000,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};
