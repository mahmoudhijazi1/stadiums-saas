import type { Config } from "jest";
import nextJest from "next/jest.js";

// Official Next.js + Jest setup
// https://nextjs.org/docs/app/building-your-application/testing/jest
const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "node",
  // All unit tests under /test. Integration suites are *.integration.test.ts
  // and run only via `npm run test:integration`.
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "\\.integration\\.test\\.ts$",
  ],
};

export default createJestConfig(config);
