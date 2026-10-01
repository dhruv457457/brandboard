import { test, expect } from "@playwright/test";

/**
 * "Try the demo account" on the sign-in card: shown exactly when the site offers a demo account (a Privy test account,
 * play money only). Doesn't press it: signing in is covered by signed-in.spec.ts with the same account.
 */
test("the demo account button shows when the site offers one", async ({ page, request }) => {
  const offer = (await (await request.get("/api/demo-login")).json()) as { enabled: boolean; email?: string; code?: string };
  expect(typeof offer.enabled).toBe("boolean");
  if (!offer.enabled) expect(offer.email ?? offer.code).toBeUndefined();

  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: "Welcome to Patched" })).toBeVisible({ timeout: 30_000 });
  const button = page.getByRole("button", { name: "Try the demo account" });
  if (offer.enabled) await expect(button).toBeVisible();
  else await expect(button).toHaveCount(0);
});
