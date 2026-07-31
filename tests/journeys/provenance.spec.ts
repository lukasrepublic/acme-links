/* The provenance pin is a claim about other files, so it gets checked like any
   other claim. This asserts the file's internal shape and that every merged
   atom is present; recomputing the hashes themselves requires the workspace
   repo, which the tutorial's step-7 walk does by hand. */
import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

const raw = readFileSync(
  join(process.cwd(), ".foundry", "build-provenance.yaml"),
  "utf-8",
);

test("PROVENANCE: every merged atom is pinned to a frozen spec + contract", () => {
  for (const atom of ["auth", "create-link", "resolve-redirect", "dashboard"]) {
    expect(raw, `${atom} must be pinned`).toContain(`atom: ${atom}`);
  }
  // Four atoms × (spec + contract), each a full sha256 — no truncation, no
  // placeholder. A pin you cannot recompute is decoration.
  const hashes = raw.match(/[0-9a-f]{64}/g) ?? [];
  expect(hashes.length).toBeGreaterThanOrEqual(8);
  expect(raw).not.toContain("0000000000000000");
  // The workspace commit the freeze happened at.
  expect(raw).toMatch(/foundry_authorized_against: agentic-handbook@[0-9a-f]{40}/);
});
