import { test, expect, type Page } from "@playwright/test";
import { watchErrors } from "./helpers";

/**
 * Signed-in flows. They need a Privy test account (Privy dashboard → User management → Authentication →
 * Test accounts): put its email and fixed code in E2E_TEST_EMAIL and E2E_TEST_CODE. Without them these tests skip.
 */
const EMAIL = process.env.E2E_TEST_EMAIL;
const CODE = process.env.E2E_TEST_CODE;
test.skip(!EMAIL || !CODE, "set E2E_TEST_EMAIL and E2E_TEST_CODE (a Privy test account) to run signed-in tests");

async function signIn(page: Page) {
  await page.goto("/welcome?next=/explore");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByPlaceholder("123456").fill(CODE!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // First time: the profile step. Later: straight back to where we were.
  const profile = page.getByRole("heading", { name: "Set up your profile" });
  const back = page.waitForURL(/\/explore/, { timeout: 30_000 }).then(() => "back" as const);
  const first = profile.waitFor({ timeout: 30_000 }).then(() => "profile" as const);
  if ((await Promise.race([back, first])) === "profile") {
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Start" }).click();
    await page.waitForURL(/\/explore/);
  }
}

test.describe("signed in", () => {
  test("sign in with an email code, then the shell shows you and your wallet", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    if (test.info().project.name === "desktop") {
      await page.getByRole("button", { name: "Your account and wallet" }).click();
    } else {
      await page.getByRole("button", { name: "Your wallet and account" }).click();
    }
    await expect(page.getByText("Balance", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add money" }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a stale remembered profile without a handle doesn't send a finished person back to onboarding", async ({ page }) => {
    await signIn(page);
    await page.waitForFunction(() => !!localStorage.getItem("patched.profile"), undefined, { timeout: 30_000 }); // the profile landed and is remembered on this device
    await page.waitForTimeout(5000); // let the sign-in redirect finish before reloading
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("patched.profile") ?? "null");
      if (raw) {
        raw.profile.handle = null;
        localStorage.setItem("patched.profile", JSON.stringify(raw));
      }
      for (const k of Object.keys(localStorage)) if (k.startsWith("patched.role.")) localStorage.removeItem(k);
    });
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Set up your profile" })).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/explore/);
  });

  test("home is the feed, and the profile has your private tabs", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await page.goto("/");
    await expect(page.getByText("What are you patching next?")).toBeVisible();
    const nav = test.info().project.name === "desktop" ? page.getByRole("complementary", { name: "Main" }) : page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("link", { name: "Profile", exact: true }).click();
    for (const tab of ["Campaigns", "Earnings", "Bids"]) {
      await page.getByRole("tab", { name: new RegExp(tab) }).click();
      await expect(page).toHaveURL(new RegExp(`tab=${tab.toLowerCase()}`));
    }
    expect(errors).toEqual([]);
  });

  test("settings opens every tab", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await page.goto("/settings");
    for (const tab of ["Profile", "Brand", "Security", "Network"]) {
      await page.getByRole("button", { name: tab, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`tab=${tab.toLowerCase()}`));
    }
    expect(errors).toEqual([]);
  });
});
