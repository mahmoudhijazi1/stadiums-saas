import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const custom: Config = {
  coverageProvider: "v8",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.integration.test.ts"],
  maxWorkers: 1,
  setupFiles: ["<rootDir>/test/integration/setup-env.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/integration/setup-mocks.ts"],
  testTimeout: 30_000,
  // pg pool on prismaBase stays open; integration suites disconnect in afterAll
  // but Jest still waits — forceExit keeps CI/local runs from hanging.
  forceExit: true,
};

/**
 * Prisma 7 ships ESM query-compiler `.mjs` files. next/jest defaults to CJS
 * and skips transforming node_modules — that throws ERR_REQUIRE_ESM.
 * Allow transforming Prisma packages; keep Next's other defaults.
 */
export default async () => {
  const config = await createJestConfig(custom)();
  return {
    ...config,
    // next/jest maps styles/fonts but not tsconfig paths; @/ is required for jest.mock.
    moduleNameMapper: {
      ...config.moduleNameMapper,
      "^@/(.*)$": "<rootDir>/src/$1",
    },
    transformIgnorePatterns: [
      "/node_modules/(?!(@prisma|prisma)/)",
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  };
};
