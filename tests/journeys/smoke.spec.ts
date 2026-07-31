import { test, expect } from "@playwright/test";

test("SMOKE: the scaffold serves the design-system landing page", async ({
  request,
}) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("Acme Links");
  // The landing page is composed from the design system, not ad-hoc markup.
  expect(body).toContain('class="shell-nav"');
  expect(body).toContain("btn-primary");
});
