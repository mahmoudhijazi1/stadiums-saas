import type { Config } from "jest";
import nextJest from "next/jest.js";

/**
 * End-to-end suites (*.e2e.test.ts): start `next start` in production mode
 * against stadiums_test. Needs `npm run build` first.
 */
const createJestConfig = nextJest({ dir: "./" });

const custom: Config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/e2e/**/*.e2e.test.ts"],
  maxWorkers: 1,
  setupFiles: ["<rootDir>/test/integration/setup-env.ts"],
  testTimeout: 60_000,
};

export default async () => {
  const config = await createJestConfig(custom)();
  return {
    ...config,
    moduleNameMapper: { ...config.moduleNameMapper, "^@/(.*)$": "<rootDir>/src/$1" },
    transformIgnorePatterns: ["/node_modules/(?!(@prisma|prisma)/)", "^.+\\.module\\.(css|sass|scss)$"],
  };
};
