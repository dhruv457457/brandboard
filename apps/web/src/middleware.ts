import { NextResponse, type NextRequest } from "next/server";
import { addressHandle, RESERVED_HANDLES } from "@/lib/handles";

/**
 * Creator subdomains: `dhruv.monad.patched.world` shows Dhruv's page and `dhruv.monad.patched.world/6` his listing 6,
 * and the address stays that way. The base domain comes from HANDLE_DOMAIN (e.g. "monad.patched.world"); without it
 * this does nothing.
 * - Links inside the page carry the handle (/dhruv/6): they go to the short form (/6).
 * - Another creator's page (/maya, /maya/3) goes to their own subdomain.
 * - Everything else (sign-in, Studio, Explore) lives on the main site.
 * One sign-in across all of these needs Privy's HttpOnly cookies on the parent domain (Privy dashboard).
 */
export function middleware(req: NextRequest) {
  const res = resolve(req);
  const origin = process.env.MAINNET_ORIGIN?.replace(/\/$/, "");
  if (!origin || req.cookies.get("patched-chain")?.value !== "143") return res;

  // One site, two chains: a visitor who switched to mainnet is served by the mainnet build, behind this same address.
  // Redirects (creator subdomains) stay as they are; a rewrite to a creator's page keeps its inner path.
  if (res.headers.get("location")) return res;
  const inner = res.headers.get("x-middleware-rewrite");
  const target = new URL(inner ? new URL(inner).pathname + new URL(inner).search : req.nextUrl.pathname + req.nextUrl.search, origin);
  const out = NextResponse.rewrite(target);
  // The same address now shows two different sites; keep shared caches from mixing them up. Built files are
  // content-hashed, so those can stay cached.
  if (!target.pathname.startsWith("/_next/static/")) out.headers.set("cache-control", "private, no-cache");
  return out;
}

function resolve(req: NextRequest): NextResponse {
  // Assets and API calls follow the visitor's chain too (see the matcher), but the creator-page rules are for pages.
  if (/^\/(_next|api)\//.test(req.nextUrl.pathname) || /\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml|js|css|woff2?)$/.test(req.nextUrl.pathname)) return NextResponse.next();
  const base = process.env.HANDLE_DOMAIN?.toLowerCase();
  if (!base) return NextResponse.next();

  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (!host.endsWith(`.${base}`)) return NextResponse.next();
  const handle = host.slice(0, -(base.length + 1));
  const { pathname, search } = req.nextUrl;
  if (!handle || handle.includes(".") || handle === "www") return to(`https://${base}${pathname}${search}`);

  // The creator's own pages, served right here.
  if (pathname === "/" || /^\/\d+(\/.*)?$/.test(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${handle}` : `/${handle}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Sign-in lives on the main domain; preserve this creator's subdomain in `next` so sign-in returns right back here.
  if (pathname === "/welcome") {
    const targetUrl = new URL(`https://${base}/welcome`);
    const nextParam = req.nextUrl.searchParams.get("next");
    if (nextParam && /^https?:\/\//i.test(nextParam)) {
      targetUrl.searchParams.set("next", nextParam);
    } else {
      const destPath = nextParam && nextParam.startsWith("/") ? nextParam : "/";
      targetUrl.searchParams.set("next", `https://${host}${destPath}`);
    }
    req.nextUrl.searchParams.forEach((val, key) => {
      if (key !== "next") targetUrl.searchParams.set(key, val);
    });
    return to(targetUrl.toString());
  }

  const m = pathname.match(/^\/([^/]+)(?:\/(\d+))?\/?$/);
  if (m && !RESERVED_HANDLES.has(m[1].toLowerCase())) {
    const who = m[1].toLowerCase();
    const listing = m[2] ? `/${m[2]}` : "/";
    // Handles with dots or underscores can't be subdomains; those stay on the main site.
    // /patched_world on patched-world.<domain> is this very page: the short form.
    if (who === handle || addressHandle(who) === handle) return to(`https://${host}${listing}${search}`);
    if (/^[a-z0-9-]+$/.test(who)) return to(`https://${who}.${base}${listing}${search}`);
  }
  return to(`https://${base}${pathname}${search}`);
}

const to = (url: string) => NextResponse.redirect(url, 307);

export const config = {
  // Pages: creator subdomains. Everything, but only for a visitor on mainnet: their files and API calls go to the
  // mainnet build too (see middleware above).
  matcher: [
    "/((?!_next/|api/|favicon\\.ico|icon\\.svg|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)",
    { source: "/(.*)", has: [{ type: "cookie", key: "patched-chain", value: "143" }] },
  ],
};
