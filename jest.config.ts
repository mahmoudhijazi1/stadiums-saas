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
  // All tests live under /test, mirroring src/ (e.g. src/lib/x.ts → test/lib/x.test.ts)
  testMatch: ["<rootDir>/test/**/*.test.ts"],
};

export default createJestConfig(config);
