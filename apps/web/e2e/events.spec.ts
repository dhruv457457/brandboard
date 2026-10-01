import { test, expect } from "@playwright/test";
import { eventDates, eventInitials, eventNameBytes, slugProblem, slugify } from "../src/lib/events";
import { isListingPage } from "../src/lib/routes";

/**
 * The event page pieces: the rules the admin form checks, and that an event opened by its number
 * (/e/12, which is what an event with no slug yet links to) still gets the app frame instead of the bare
 * creator-listing frame.
 */

test.describe("event rules", () => {
  test("a name becomes a page address", () => {
    expect(slugify("Token2049 Singapore!")).toBe("token2049-singapore");
    expect(slugify("  Café  Night — Day 2 ")).toBe("cafe-night-day-2");
    expect(slugify("---")).toBe("");
    expect(slugify("a".repeat(80))).toHaveLength(48);
  });

  test("page addresses: letters, numbers and dashes, never a number alone", () => {
    expect(slugProblem("")).toBeNull();
    expect(slugProblem("token2049-singapore")).toBeNull();
    expect(slugProblem("a")).not.toBeNull();
    expect(slugProblem("-token")).not.toBeNull();
    expect(slugProblem("Token 2049")).not.toBeNull();
    // /e/2049 already means event number 2049.
    expect(slugProblem("2049")).not.toBeNull();
  });

  test("on-chain names count bytes, not letters", () => {
    expect(eventNameBytes("Token2049")).toBe(9);
    expect(eventNameBytes("Café")).toBe(5);
    expect(eventNameBytes("é".repeat(16))).toBe(32);
  });

  test("initials and dates", () => {
    expect(eventInitials("Token2049 Demo")).toBe("TD");
    expect(eventInitials("Devcon")).toBe("DE");
    expect(eventInitials("")).toBe("P");
    expect(eventDates("2026-10-03T00:00:00Z", "2026-10-05T23:59:59Z")).toBe("Oct 3 – Oct 5, 2026");
    expect(eventDates("2026-10-03T00:00:00Z", "2026-10-03T23:59:59Z")).toBe("Oct 3, 2026");
  });

  test("/e/<number> is an event page, not a creator's listing", () => {
    expect(isListingPage("/e/12")).toBe(false);
    expect(isListingPage("/dhruv/12")).toBe(true);
    expect(isListingPage("/12")).toBe(true);
    expect(isListingPage("/studio/12")).toBe(false);
  });
});

test("an event opened by its number keeps the app frame", async ({ page, request }) => {
  test.skip(test.info().project.name !== "desktop", "the sidebar is a laptop thing");
  const html = await (await request.get("/events")).text();
  const numbered = html.match(/href="(\/e\/\d+)"/)?.[1];
  test.skip(!numbered, "needs an event that has no page address yet");
  await page.goto(numbered!);
  await expect(page.getByRole("complementary", { name: "Main" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
