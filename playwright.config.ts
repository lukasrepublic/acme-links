import { defineConfig } from "@playwright/test";

/* The contract journeys drive the RUNNING app at the seams the acceptance
   contracts name (HTTP requests — no browser binaries needed). One worker:
   journeys share a database and some assert exact counts. */
export default defineConfig({
  testDir: "./tests/journeys",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
