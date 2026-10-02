// The browser half of the on-chain test cycle (docs/final-plan.md, M1): drives the app on localhost:3000 as the Privy
// test account (the "Use the demo account" link), so every Privy step runs exactly as a person would do it.
//   ACTION=bid LISTING=5 SPOT="Chest pocket" [AMOUNT=6] node scripts/browser-steps.mjs
// Actions: bid, autobid (MAX=), sweep (SPOTS="A,B"), shot (PATH=/url, just a screenshot). Screenshots go to OUT.
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? ".";
const ACTION = process.env.ACTION ?? "shot";
const LISTING = process.env.LISTING ?? "5";
const HANDLE = process.env.HANDLE ?? "teampatched";

const browser = await chromium.launch({ channel: "chrome", headless: process.env.HEADED ? false : true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error" && !/analytics_events|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 600)); });
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

async function signIn() {
  await page.goto(`${BASE}/welcome?next=/explore`);
  await page.getByRole("button", { name: "Use the demo account" }).click({ timeout: 60_000 });
  await page.waitForURL(/\/explore/, { timeout: 60_000 });
  await page.waitForTimeout(3000);
}

async function openSpot(label) {
  await page.goto(`${BASE}/${HANDLE}/${LISTING}`);
  await page.getByText(label, { exact: true }).first().click({ timeout: 60_000 });
  await page.waitForTimeout(1500);
}

await signIn();

if (ACTION === "bid") {
  await openSpot(process.env.SPOT);
  const input = page.getByLabel(`Your bid for ${process.env.SPOT}`);
  if (process.env.AMOUNT) await input.fill(process.env.AMOUNT);
  // The bid button in the same panel as the amount field (not the phone bar at the bottom).
  const panel = input.locator("xpath=ancestor::div[.//button[starts-with(normalize-space(.),'Bid $') or starts-with(normalize-space(.),'Buy it for')]][1]");
  await panel.getByRole("button", { name: /^(Bid \$|Buy it for)/ }).first().click();
  await page.waitForFunction(() => /You lead|didn't go through|cancelled|Not enough|passkey/i.test(document.body.innerText), null, { timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(`bid-${LISTING}`);
  const alert = await page.getByRole("alert").first().textContent().catch(() => null);
  const toast = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
  // Only the app's own "You lead" counts as success; no error on screen isn't proof the bid landed.
  console.log(JSON.stringify({ ok: toast.some((t) => /You lead/.test(t)), toast, alert, errors }, null, 2));
}

if (ACTION === "autobid" || ACTION === "autobid-off") {
  await openSpot(process.env.SPOT);
  await page.getByText("Auto-bid: stay on top up to your limit").first().click();
  if (ACTION === "autobid") {
    await page.getByLabel("Auto-bid maximum").fill(process.env.MAX ?? "10");
    await page.getByRole("button", { name: /Turn on auto-bid|Update maximum/ }).click();
  } else {
    await page.getByRole("button", { name: "Turn off" }).click();
  }
  // Privy may show its own signer consent window the first time.
  for (let i = 0; i < 60; i++) {
    const text = await page.locator("body").innerText();
    if (/Auto-bid (on|off) for|didn't go through|couldn't|Try again/i.test(text)) break;
    const allow = page.getByRole("button", { name: /^(Allow|Approve|Confirm|Continue)$/ });
    if (await allow.count()) await allow.first().click().catch(() => {});
    await page.waitForTimeout(2000);
  }
  await shot(`${ACTION}-${LISTING}`);
  const alert = await page.getByRole("alert").allTextContents().catch(() => []);
  const toast = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
  console.log(JSON.stringify({ alert, toast, errors }, null, 2));
}

if (ACTION === "sweep") {
  await page.goto(`${BASE}/${HANDLE}/${LISTING}`);
  await page.getByRole("button", { name: /Sweep/ }).first().click({ timeout: 60_000 });
  for (const label of process.env.SPOTS.split(",")) await page.getByRole("checkbox", { name: label }).check();
  await page.getByRole("button", { name: /^Bid on \d+ patches/ }).click();
  for (let i = 0; i < 60; i++) {
    const text = await page.locator("body").innerText();
    if (/You lead \d+ patches|didn't go through|Try again/i.test(text)) break;
    await page.waitForTimeout(2000);
  }
  await shot(`sweep-${LISTING}`);
  const toast = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
  const alert = await page.getByRole("alert").allTextContents().catch(() => []);
  console.log(JSON.stringify({ toast, alert, errors }, null, 2));
}

// A $10 campaign at EVENT, never more than $5 a spot: Privy makes the campaign wallet and its policy, the brand funds it.
if (ACTION === "campaign") {
  await page.goto(`${BASE}/campaigns/new?event=${process.env.EVENT}`);
  const range = page.getByLabel("Budget in dollars");
  await range.focus();
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "$10", exact: true, pressed: false }).click();
  await page.getByRole("button", { name: "Lower" }).click();
  await page.getByRole("button", { name: /^Fund \$10 and start/ }).click();
  await page.waitForURL(/\/campaigns\/[0-9a-f-]{8,}/, { timeout: 180_000 }).catch(() => {});
  await page.waitForTimeout(20_000);
  await shot(`campaign`);
  console.log(JSON.stringify({ url: page.url(), errors }, null, 2));
}

// Settings → Security → "Revoke Patched's access": takes the Privy signer off the wallet.
if (ACTION === "revoke") {
  await page.goto(`${BASE}/settings?tab=security`);
  await page.getByRole("button", { name: "Revoke Patched's access" }).click({ timeout: 60_000 });
  for (let i = 0; i < 40; i++) {
    if (!(await page.getByRole("button", { name: /Revoke Patched's access|Revoking/ }).count())) break;
    await page.waitForTimeout(2000);
  }
  await shot("revoke");
  const toast = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
  console.log(JSON.stringify({ revoked: !(await page.getByRole("button", { name: "Revoke Patched's access" }).count()), toast, errors }, null, 2));
}

// "Patch anyone on X": offer AMOUNT to X handle XHANDLE at the event named EVENT_NAME.
if (ACTION === "offer") {
  await page.goto(`${BASE}/offers/new`);
  await page.getByPlaceholder("@dhruv").fill(process.env.XHANDLE);
  await page.getByText(/On Patched|Not on Patched yet/).first().waitFor({ timeout: 60_000 }).catch(async (err) => {
    await shot("offer-lookup");
    console.log(await page.locator("#x-preview").innerText().catch(() => ""));
    throw err;
  });
  await page.getByLabel("Offer in dollars").fill(process.env.AMOUNT ?? "5");
  await page.locator("select").selectOption({ label: process.env.EVENT_NAME });
  await page.getByRole("button", { name: /^Offer \$/ }).click();
  await page.waitForURL(/\/offers\/[0-9a-f-]{8,}/, { timeout: 180_000 }).catch(() => {});
  await page.waitForTimeout(8000);
  await shot("offer");
  const toast = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
  console.log(JSON.stringify({ url: page.url(), toast, errors }, null, 2));
}

// The holder's review of a proof: approve APPROVE (a spot label) and dispute DISPUTE, while the review window is open.
if (ACTION === "review") {
  await page.goto(`${BASE}/${HANDLE}/${LISTING}`);
  if (process.env.APPROVE) {
    await page.getByRole("button", { name: `Approve ${process.env.APPROVE}` }).click({ timeout: 60_000 });
    await page.getByText(`You approved ${process.env.APPROVE}`).waitFor({ timeout: 120_000 }).catch(() => {});
  }
  if (process.env.DISPUTE) {
    await page.getByRole("button", { name: `Dispute ${process.env.DISPUTE}` }).click({ timeout: 60_000 });
    await page.getByRole("radio").first().check();
    await page.getByPlaceholder("What did you expect, and what does the proof show instead?").fill(
      "Test dispute from the on-chain cycle: the proof shows the listing's own photos, not the patch at the event.");
    await page.getByRole("button", { name: "Open dispute" }).click();
    await page.getByText(`You disputed ${process.env.DISPUTE}`).waitFor({ timeout: 120_000 }).catch(() => {});
  }
  await shot("review");
  const pills = await page.getByText(/You (approved|disputed)/).allTextContents();
  console.log(JSON.stringify({ pills, errors }, null, 2));
}

if (ACTION === "shot") {
  await page.goto(`${BASE}${process.env.PATH_ ?? "/"}`);
  await page.waitForTimeout(5000);
  await shot("page");
  console.log(JSON.stringify({ errors }, null, 2));
}

await browser.close();
