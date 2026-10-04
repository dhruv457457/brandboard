import { test, expect, type APIRequestContext } from "@playwright/test";
import { expectClean, openAndMeasure, snap, watchErrors } from "./helpers";

/**
 * Every page, signed out, on a laptop and on a phone: it loads, nothing scrolls sideways, no broken images,
 * every button and link has a name, and nothing crashes or logs an error. Dynamic pages (a profile, a
 * listing, an event, a share kit) are found from the live data.
 */

const STATIC = ["/", "/welcome", "/explore", "/events", "/studio", "/campaigns/new", "/automate", "/notifications", "/settings", "/dashboard", "/bids", "/admin"];

async function discover(request: APIRequestContext) {
  const html = await (await request.get("/explore")).text();
  const listing = html.match(/href="(\/[^"/]+\/\d+)"/)?.[1] ?? null;
  const events = await (await request.get("/events")).text();
  const event = events.match(/href="(\/e\/[^"]+)"/)?.[1] ?? null;
  const profile = listing ? listing.split("/").slice(0, 2).join("/") : null;
  const id = listing?.split("/")[2];
  return { listing, event, profile, share: id ? `/share/${id}` : null };
}

test.describe("every page", () => {
  for (const path of STATIC) {
    test(`page ${path}`, async ({ page }, info) => {
      const errors = watchErrors(page);
      const report = await openAndMeasure(page, path);
      await snap(page, info, path === "/" ? "home" : path.slice(1).replace(/\//g, "_"));
      expectClean(report, errors, path);
    });
  }

  test("pages from live data: a listing, a profile, an event and a share kit", async ({ page, request }, info) => {
    const found = await discover(request);
    const paths = [found.listing, found.profile, found.event, found.share].filter((p): p is string => !!p);
    expect(paths.length, "needs at least one live listing and one event").toBeGreaterThan(0);
    for (const path of paths) {
      const errors = watchErrors(page);
      const report = await openAndMeasure(page, path);
      await snap(page, info, path.slice(1).replace(/\//g, "_").slice(0, 60));
      expectClean(report, errors, path);
      page.removeAllListeners("console");
      page.removeAllListeners("pageerror");
    }
  });

  test("a missing page shows the 404 screen", async ({ page }) => {
    await page.goto("/this-handle-does-not-exist/999999");
    await expect(page.getByText(/not found|doesn.t exist|can.t find/i).first()).toBeVisible();
  });
});

test("every internal link on the main pages opens", async ({ page, request }) => {
  test.skip(test.info().project.name !== "desktop", "links are the same on phones");
  test.setTimeout(420_000);
  const found = await discover(request);
  const pages = [...STATIC, found.listing, found.profile, found.event].filter((p): p is string => !!p);
  const links = new Set<string>();
  for (const path of pages) {
    const report = await openAndMeasure(page, path);
    report.links.forEach((l) => links.add(l.split("#")[0] || "/"));
  }
  const broken: string[] = [];
  for (const href of links) {
    const res = await request.get(href, { maxRedirects: 3 });
    if (res.status() >= 400) broken.push(`${href} → ${res.status()}`);
  }
  expect(broken, `links that don't open (found on ${pages.length} pages, ${links.size} links)`).toEqual([]);
});
