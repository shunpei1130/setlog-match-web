/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};
