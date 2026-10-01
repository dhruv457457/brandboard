# Task for Sonnet: full app audit + fix admin event creation

Date written: 2026-10-02. Deadline for the hackathon: Oct 14 2026, 09:29 IST.

You are auditing **Patched** ("Get patched. Get paid."). Read these first, in order, before touching anything:

1. `AGENTS.md` (rules, stack, conventions)
2. `docs/SPEC-v2.md` (the current product spec; `docs/SPEC.md` is V1)
3. `docs/design-system.md` + open `docs/prototype/patched-prototype.html` in the browser (visual source of truth)
4. `docs/privy-winners-research.md` → "Where Patched stands" and "Features to add"
5. `docs/TESTING.md` (manual test checklist, what is already proven)
6. `docs/data-model.md`, `docs/contracts.md`, `docs/requests.md` (open known issues)

The work has two parts. **Part A is read-only.** Part B is the only code change you make.

---

## Part A — audit (no code changes)

Go through the whole app: every route, every API, every module, every button, link and nav item. Check it against the docs above. Write all findings to **`docs/audit/2026-10-02-audit.md`** (see "Report format" at the end).

Use the code **and** the running app. Start the dev server with the preview tool, config name `web` (port 3100, testnet). Do not start servers with Bash. Use the browser pane to click through pages at desktop width (1440) and at mobile width (375), in both light and dark mode.

### A1. Route and navigation inventory

Pages (`apps/web/src/app/**/page.tsx`):

```
/                     /welcome              /explore             /events
/e/[slug]             /[handle]             /[handle]/[listingId] /share/[listingId]
/studio               /studio/[listingId]   /dashboard           /bids
/campaigns/new        /campaigns/[id]       /offers/new          /offers/[id]
/notifications        /settings             /admin
```

For each page, record:
- Does it render signed out, signed in as a creator, and signed in as a brand? Is it redirected where it should be? Compare with `lib/routes.ts` (`isPublicPage`, `isListingPage`) and `src/middleware.ts`.
- Every link and button on it: where it goes or what it does. Flag dead links, buttons with no handler, 404s, links to routes that don't exist, and things that do nothing.
- Sidebar, Navbar, TabBar (mobile), RoleWelcome, WalletPanel, NetworkSwitch: does every item go to the right place for each role? Is anything reachable on desktop but not on mobile, or the other way round?
- Loading, empty, and error states: are they designed, or bare/blank?
- Console errors and failed network requests (`read_console_messages`, `read_network_requests`). Note the known hydration #418 issue in `docs/requests.md`. Don't re-report it unless you see something new.

Creator subdomains: read `src/middleware.ts` and check the rules it documents (`<handle>.monad.patched.world`, `/<id>` on a subdomain, other creators redirect to their own subdomain, handles with dots or underscores stay on the main site). Look for edge cases: reserved handles, digit-only paths, `/index`, `/api`, and `/_next` on a subdomain. Test this by reading the code; you can't hit real subdomains locally.

### A2. API inventory

APIs live in `apps/web/src/app/api/**/route.ts` (27 routes). For each one, record:
- Method(s), who may call it, and how that is enforced: `lib/server/auth.ts`, the admin check, the keeper/indexer secret, `lib/server/rateLimit.ts`.
- Input validation: what happens with missing, malformed or huge input? Can a user act on someone else's profile, listing, campaign, offer or proof?
- Is it actually called from the UI? List APIs that nothing calls, and UI calls to APIs that don't exist.
- AI routes (`/api/ai/*`) must go through `@patched/ai` (OpenRouter only), run server-side only, and be rate limited.
- **Money logic must not live in the frontend** (AGENTS.md). Flag any place where the UI computes a price, increment, refund, payout or winner itself instead of reading it from the contract or indexer. The +5% / min +$5 increment and anti-snipe rules are in the contract; the UI may preview them but must not be the authority.

### A3. Function and module check

Go through `apps/web/src/lib/**`, `packages/shared/src`, `packages/ai/src`, and the components:
- Dead code: exports nothing imports.
- Duplicated helpers, for example two different USDC formatters. The rule is `bigint` with 6 decimals and `formatUsdc` only at the edge.
- Anything that hard-codes chain values (addresses, chain id, RPC, USDC address) instead of reading them from `@patched/shared` or config. This matters for the Arc mirror.
- Imports from `contracts/out` (not allowed; `@patched/shared` is the only bridge).
- Secrets or server-only modules (`lib/server/*`, `@privy-io/node`, service-role Supabase) imported into client components.
- Every env var the code reads should be listed in `.env.example` with a comment.

### A4. Privy bounty check (main sponsor target, must be visible in the demo)

Privy must be used **beyond login**. For each feature below, find the code, say whether it **works**, is **partial**, is **broken**, or is **missing**, and say **where a judge would see it in the UI**. A feature that works but has no visible place in the UI counts as a finding.

| Feature | Where to look |
|---|---|
| Embedded wallets on login (email, X), no popup | `components/providers/PrivyAuthProvider.tsx`, `PrivyRuntime.tsx`, `lib/auth/useAuth.ts` |
| External wallet ("I have a wallet") → keep mine / fresh Patched wallet | `lib/injectedWallets.ts`, welcome flow |
| Gas sponsorship (testnet on, mainnet off via env) | `NEXT_PUBLIC_GAS_SPONSORED`, `lib/market/useTx.ts` |
| One-signature permit bids | `lib/market/permit.ts`, `lib/market/useBid.ts` |
| Server wallet + policies for the keeper | `lib/server/privy.ts`, `lib/server/keeper.ts`, `/api/keeper/run` |
| Auto-bid via `PatchAutoBidder` and/or signers | `lib/server/autoBidSigner.ts`, `lib/market/useAutoBid.ts`, `autoBidPolicy.ts`, `components/market/AutoBidPanel.tsx`, migration `0015_signer_auto_bids.sql` |
| Campaign wallets with policies (calldata rules, expiry, aggregation cap) | `lib/server/campaigns.ts`, `lib/market/campaignPolicy.ts`, `/campaigns/*`, migration `0016` |
| "Patch anyone on X" (pregenerated wallets) | `lib/server/xOffers.ts`, `/offers/*`, migration `0017` |
| Sweep | `components/market/SweepPanel.tsx`, `PatchSweeper` |
| Passkey MFA step-up for large bids | `lib/market/stepUp.ts` (`NEXT_PUBLIC_STEP_UP_USD`) |
| Verified brands (work email domain) | `components/market/BrandVerify.tsx`, `/api/profile/verify-brand`, `lib/brandDomain.ts` |
| Wallet export | `useExportWallet`, Settings / WalletPanel |
| Idempotency keys on keeper and server-wallet sends | keeper and campaign senders |
| Test accounts for judges | `docs/TESTING.md` §0 |
| "How Patched uses Privy" table in the README | root README |

Also check for **doc drift**:
- AGENTS.md says session signers are not enabled and auto-bid doesn't use them. The code has `0015_signer_auto_bids`, `PRIVY_SIGNER_QUORUM_ID` and `NEXT_PUBLIC_PRIVY_SIGNER_ID`. Which is true now?
- AGENTS.md lists wallet export as "planned". Is it built?

Any signer added without `policyIds` is a **high** finding (see the research doc).

### A5. Design system check

Compare the app with `docs/design-system.md` and the prototype:
- **Colors:** hard-coded hex or rgb values in components instead of the CSS tokens (`--paper`, `--card`, `--ink`, `--accent`, `--p1..--p5`, …). Grep `#[0-9a-fA-F]{3,6}` and `rgb(` under `apps/web/src`, and ignore the surface SVG drawings and the logo. Check that dark mode works on every page (patch text stays `#0B0B0C` on pastel; surfaces stay white).
- **Type:** Bricolage Grotesque 800 for headings, Geist for UI, Geist Mono + `tabular-nums` for prices, timers, addresses and counts. Flag prices or timers that aren't mono or tabular.
- **Shape:** cards (2px ink border, radius 18, 4px hard shadow), buttons (2px, radius 14, 3px shadow, hover/active motion), chips (1.5px, fully rounded). Flag one-off styles that bypass `components/ui/*`.
- **Icons:** lucide-react only. **No emojis anywhere** in UI or copy (grep for emoji code points in `.tsx` and in copy strings).
- **Motion:** every animation must respect `prefers-reduced-motion`. Grep `motion.`, `animate`, `@keyframes`, `transition` and check each one.
- **Copy:** short, active and specific ("Place bid", "You lead Neckline · $420 locked in escrow"). Flag vague, long, or wrong copy, any mention of Hunyuan or Kimi, and anything implying banks, cards, fiat, KYC or cash-out (not allowed).
- **Mobile:** at 375px, no horizontal scroll, tap targets at least 40px, no text overflow.

### A6. Creator side and brand side UX review

Walk both journeys end to end as a real user. Use `docs/TESTING.md` §1–3 as the script.

**Creator:** sign in → welcome/role → profile `/[handle]` → Studio (4 steps: what, spots, deal, page) → listing page `/[handle]/[listingId]` → share/poster → dashboard → proofs/milestones → payout → settings.

**Brand:** sign in → explore/events → listing → bid / buy-now / auto-bid / sweep → outbid → bids page → campaigns → offers ("patch anyone on X") → verify brand → settings/wallet.

For the **creator profile page** (`/[handle]`) and the **listing page**, compare them with the benchmark `https://token2049.vanshu.fun` (open it in the browser pane). Note what the benchmark does better in hierarchy, imagery, social proof and the call to action.

For each screen, give at most 3 concrete UX issues. Each issue says what is wrong, why it hurts the user, and the specific fix. No vague "improve spacing".

### Rules for Part A

- **Don't edit code in Part A.** Only write the report.
- Don't send real transactions on **mainnet**. On testnet, don't spend more than a few test USDC, and only if a flow can't be checked any other way.
- Don't change Privy dashboard, Supabase, or Vercel settings.
- Don't touch `contracts/`, and don't redeploy anything.

---

## Part B — fix admin event creation (the one build item)

### The problem

Admin → "Create event" (`apps/web/src/app/admin/AdminConsole.tsx`, around line 233) only takes a name plus start and end, then calls `createEvent` on-chain. The cover image, city, venue, description and links are a **separate, later step**: a small "Add cover and details" link in the events table opens `EventDetailsForm.tsx` inline in a table row. As a result:
- New events go live with no image. The event page (`/e/[slug]`, `EventView.tsx` around line 74) and the `/events` grid then fall back to a plain pastel gradient.
- The cover upload is a tiny button over a background-image div, with no crop, no aspect guidance, no size check and no preview of how it will look.
- The top of the event page has no proper image/profile treatment. It is not a page an organizer would be proud to share.

### What to build

1. **One "New event" flow** in the admin console (a `Sheet` or a dedicated panel, not a table row) that collects everything in one place:
   - cover image, name, slug, start/end, city, venue, description, website, X
   - It runs the on-chain `createEvent`, waits for the event to be indexed (check how `patched_events` rows get created: indexer sync / `useIndexerSync`), then saves the details through `/api/events/[id]`. To the admin it looks like **one** action, with clear progress ("Creating on Monad…", "Saving page…") and a recoverable state if step 2 fails (the details are kept and can be retried).
2. **A proper cover image field:**
   - drag-and-drop plus click to upload, through the existing `/api/uploads`
   - a fixed cover aspect ratio, matching what `EventView` renders (pick one, e.g. 3:1, and use it everywhere)
   - live preview cropped exactly as the event page will show it
   - validation for type (png/jpeg/webp), size, and minimum dimensions, with clear error copy
   - replace and remove actions
3. **A live preview** next to the form, showing both the `/events` card and the `/e/[slug]` header as they will look.
4. **A better event page header** (`EventView.tsx`) and `/events` cards:
   - the cover image fills the header well, with a readable title overlay (scrim or ink panel per the design system)
   - name, dates, city/venue chips, links, and a patch-count/live stat
   - when there is no cover, a **designed** fallback (stitched patch pattern with the event name, using the design tokens), not a flat gradient
   - correct at 375px, in dark mode, and under reduced motion
5. **Editing** existing events uses the same form and preview: one component for create and edit, and `EventDetailsForm` is replaced, not duplicated.
6. Optional, only if it's cheap: a square event logo/avatar. That needs a new migration (`supabase/migrations/0019_event_logo.sql`) and a column on `patched_events`. Put it in the report as a suggestion if you don't do it.

Follow AGENTS.md: design tokens, `components/ui/*` primitives, lucide icons, no emojis, short copy, reduced motion.

### Verify Part B

- Type-check and build: `pnpm --filter web verify` (it uses its own dist dir, so it won't break the running dev server).
- In the browser pane (preview `web`, port 3100): create a test event on **testnet** end to end with a cover image. Check `/admin`, `/events` and `/e/<slug>` at 1440 and 375, light and dark. Take screenshots.
- Run the existing Playwright UI tests that cover these pages (`apps/web/e2e/pages.spec.ts`, one worker), and add a test for the new event form if it fits the existing helpers.
- If anything fails, say so in the report with the output. Don't hide it.

### Commit

Commit directly to `main` (this repo doesn't use branches). Stage **only the files you changed**: the working tree already has unrelated changes (`contracts/broadcast/**`, `docs/arc-plan.md`, `.claude/launch.json`, `marketing/`, `apps/web/.next-hd/`). Don't stage or revert those. Use imperative commit messages, one topic per commit, for example:
- "Add the audit report for Oct 2"
- "Create events in one step with a cover image and live preview"

Don't push unless the user asks.

---

## Report format (`docs/audit/2026-10-02-audit.md`)

```markdown
# Patched audit — 2026-10-02

## Summary
- 5–10 bullets: the most important things to fix before Oct 14, in order.

## Privy bounty scorecard
| Feature | Status (works / partial / broken / missing) | Visible where in UI | Evidence (file:line) | Fix |

## Findings
### [SEVERITY] Short title
- Area: route / api / module / privy / design-system / ux / subdomain / docs
- Where: `path/to/file.tsx:123` (and/or the URL)
- What happens: concrete steps → actual result → expected result
- Fix: the specific change, and its size (S / M / L)

## Route inventory
| Route | Signed out | Creator | Brand | Dead links / buttons | Notes |

## API inventory
| Route | Methods | Auth | Validation | Called from | Issues |

## Doc drift
- Places where AGENTS.md, SPEC-v2, TESTING.md, contracts.md or data-model.md disagree with the code.

## Part B result
- What changed, screenshots, test/build output, anything left undone.
```

Severity:
- **critical**: loses or locks money, a security hole, or breaks the demo
- **high**: a core flow is broken, or a Privy feature is invisible or broken
- **medium**: a UX or design-system issue a judge would notice
- **low**: polish

Every finding needs evidence: a file:line, a screenshot, or console or network output. Don't report guesses as findings; put them in a "To confirm" list instead.
