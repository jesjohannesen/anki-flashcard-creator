module.exports = {
  testEnvironment: "node",
  setupFiles: ["./__tests__/setup.js"],
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: [
    "background.js",
    "content.js",
    "options.js",
    "welcome.js",
  ],
  coverageDirectory: "coverage",
};
