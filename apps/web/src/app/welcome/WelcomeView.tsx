"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Droplets, Fingerprint, Loader2, Lock, Mail, ShieldCheck, Smartphone, Sparkles, Wallet, Zap } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { StoryPanel } from "@/components/brand/StoryPanel";
import { PrivyLogo } from "@/components/brand/PartnerLogos";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { useSignedIn } from "@/lib/signedIn";
import { loadDemoLogin, useIsDemoAccount, type DemoLogin } from "@/lib/demoAccount";
import { useInjectedWallets, type InjectedWallet } from "@/lib/injectedWallets";
import { handleProblem } from "@/lib/handles";
import { STEP_UP_USD } from "@/lib/market/stepUp";
import { GAS_SPONSORED, PLAY_MONEY, TEST_TOKEN } from "@/lib/config";
import { useBalances } from "@/lib/useBalances";
import { openAddMoney } from "@/components/wallet/AddMoney";
import { cn } from "@/lib/utils";
import { HandNote } from "@/components/brand/HandNote";
import { toast } from "@/components/ui/Toast";

type Role = "creator" | "brand" | "both";
const X_PATH = "M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zM16.7 19.2h1.7L7.3 4.7H5.5z";

export const roleKey = (wallet: string) => `patched.role.${wallet.toLowerCase()}`;

/** Where to go once onboarding is done (or was never needed): the page they came from, else home. */
const leaveTo = () => safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/";

/** Same-site paths and creator subdomain URLs are allowed as the place to go after onboarding. */
function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/welcome")) {
    return next;
  }
  try {
    const u = new URL(next);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    const domain = process.env.NEXT_PUBLIC_HANDLE_DOMAIN?.toLowerCase();
    if (domain && (host === domain || host.endsWith(`.${domain}`))) {
      return u.toString();
    }
    if (typeof window !== "undefined" && (host === window.location.hostname.toLowerCase() || host === "localhost" || host === "127.0.0.1")) {
      return u.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * First visit: sign in (X, email code or a wallet, all through Privy but in our own design), then one profile
 * screen, then how bidding works. The story on the left sells the idea while this happens.
 */
export function WelcomeView() {
  const { ready, authenticated, walletAddress } = usePatchedAuth();
  // Before Privy has loaded: whether this browser was signed in last time (then there is nothing to show yet).
  const remembered = useSignedIn();
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);
  const [step, setStep] = useState<"profile" | "bidding">("profile");
  const [role, setRole] = useState<Role>("both");
  // True while a wallet sign-in is being finished (making or choosing the Patched wallet).
  const [setup, setSetup] = useState(false);

  useEffect(() => setNext(safeNext(new URLSearchParams(window.location.search).get("next"))), []);

  // Coming back from X: Privy needs a couple of seconds to finish the sign-in, during which it says "not signed in".
  // Say so (instead of showing the sign-in options again), unless it takes too long or fails.
  const [fromX, setFromX] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("privy_oauth_code") && !q.has("privy_oauth_state")) return;
    setFromX(true);
    const t = setTimeout(() => setFromX(false), 15_000);
    return () => clearTimeout(t);
  }, []);

  // Someone who already finished onboarding (a role saved in this browser, or a saved @handle from any device)
  // doesn't see it again. Decided once, when the profile first loads, so saving a handle in step one doesn't skip
  // step two.
  const { profile, fresh } = useProfile();
  // "checking": waiting for the profile. "skip": onboarding is done and we're leaving. "show": the profile form.
  // The form only appears once we know it is needed, so a finished person never sees it flash by (or sits on it while
  // the next page loads) and thinks they're being asked to sign up again.
  const [gate, setGate] = useState<"checking" | "skip" | "show">("checking");
  useEffect(() => {
    // A saved handle is enough to know onboarding is done: it must not wait for the wallet to be found.
    if (!authenticated || gate !== "checking") return;
    let done = false;
    try {
      done = !!walletAddress && !!localStorage.getItem(roleKey(walletAddress));
    } catch {
      /* storage blocked */
    }
    const skip = done || !!profile?.handle;
    // A handle on file means onboarding is done, even in the copy remembered on this device. "No handle" is only
    // believed once the server has answered: the remembered copy can be out of date, and trusting it sent people
    // who had finished back to this screen.
    if (!skip && !(profile && fresh)) return;
    console.info("[patched] onboarding", skip ? "skipped" : "shown", { handle: profile?.handle ?? null, fresh, wallet: !!walletAddress, done });
    if (!skip) return setGate("show");
    setGate("skip");
    const dest = leaveTo();
    if (/^https?:\/\//i.test(dest)) {
      window.location.replace(dest);
    } else {
      router.replace(dest);
    }
  }, [authenticated, walletAddress, profile, fresh, gate, router]);

  // If the soft navigation stalls (a slow or failed page request), do a full page load instead.
  useEffect(() => {
    if (gate !== "skip") return;
    const t = setTimeout(() => window.location.replace(leaveTo()), 4000);
    return () => clearTimeout(t);
  }, [gate]);

  // The profile never answered (offline, server error): show the form rather than a spinner forever.
  useEffect(() => {
    if (!authenticated || gate !== "checking") return;
    const t = setTimeout(() => setGate((g) => (g === "checking" ? "show" : g)), 8000);
    return () => clearTimeout(t);
  }, [authenticated, gate]);

  function finish() {
    try {
      if (walletAddress) localStorage.setItem(roleKey(walletAddress), role);
    } catch {
      /* storage blocked */
    }
    const dest = next ?? (role === "creator" ? "/studio" : "/");
    if (/^https?:\/\//i.test(dest)) {
      window.location.replace(dest);
    } else {
      router.push(dest);
    }
  }

  return (
    <main className="min-h-dvh lg:h-dvh grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-x-clip">
      <section className="relative bg-[#FF5A1F] text-[#0B0B0C] px-5 sm:px-10 lg:px-14 py-8 lg:py-[4vh] flex flex-col gap-6 lg:gap-[2.4vh] lg:min-h-0 overflow-hidden">
        <Link href="/" aria-label="Patched home" className="no-underline self-start [--ink:#0B0B0C]">
          <Logo size={32} />
        </Link>
        <h1 className="font-display font-extrabold text-[clamp(44px,6vw,76px)] lg:text-[clamp(36px,min(5.4vw,8.5vh),76px)] leading-[0.92] tracking-[-0.05em] flex-none">Get patched.<br />Get paid.</h1>
        <StoryPanel className="max-w-[600px] w-full lg:flex-1 lg:min-h-0" />
        <p className="flex items-center gap-2 text-sm flex-none">
          <Lock size={15} className="flex-none" /> <span className="inline-flex items-center gap-1.5 flex-wrap">Sign-in, wallets and one-tap bids powered by <PrivyLogo height={15} /></span>
        </p>
      </section>

      <section className="order-first lg:order-none grid place-items-center px-5 py-8 lg:py-6 bg-[var(--paper)] min-w-0 lg:min-h-0 lg:overflow-y-auto">
        {/* The sign-in card shows at once, even while Privy is still loading (a tap then waits for it); only someone
            this browser remembers as signed in, or who is coming back from X, waits on a spinner. */}
        {!ready && (remembered || fromX) ? (
          <Loader2 className="animate-spin text-[var(--muted)]" aria-label="Loading" />
        ) : !authenticated && fromX ? (
          <div className="grid justify-items-center gap-3 text-center">
            <Loader2 className="animate-spin text-[var(--muted)]" aria-hidden="true" />
            <b>Signing you in with X…</b>
          </div>
        ) : !authenticated ? (
          <SignInCard onSetup={setSetup} />
        ) : setup ? (
          <div className="grid justify-items-center gap-3 text-center">
            <Loader2 className="animate-spin text-[var(--muted)]" aria-hidden="true" />
            <b>Setting up your wallet…</b>
          </div>
        ) : gate !== "show" ? (
          <div className="grid justify-items-center gap-3 text-center">
            <Loader2 className="animate-spin text-[var(--muted)]" aria-hidden="true" />
            <b>{gate === "skip" ? "Signing you in…" : "Loading your profile…"}</b>
          </div>
        ) : step === "profile" ? (
          <ProfileStep role={role} setRole={setRole} onDone={() => setStep("bidding")} />
        ) : (
          <BiddingStep onDone={finish} />
        )}
      </section>
    </main>
  );
}

/** Privy sign-in in Patched's design: X first, then an email code, then "I have a wallet" (pick any wallet in this browser). */
function SignInCard({ onSetup }: { onSetup: (setting: boolean) => void }) {
  const auth = usePatchedAuth();
  const { openPrivyLogin } = auth;
  // The card shows before Privy has finished loading. A tap that early waits for it (the button shows its spinner),
  // then runs with the live functions rather than the not-ready ones this render captured.
  const latest = useRef(auth);
  latest.current = auth;
  const whenReady = useCallback(async () => {
    for (let i = 0; i < 300 && !latest.current.ready; i++) await new Promise((r) => setTimeout(r, 100));
    if (!latest.current.ready) throw new Error("Sign-in is still loading. Check your connection and try again.");
    return latest.current;
  }, []);
  const loginWithX = async () => (await whenReady()).loginWithX();
  const sendEmailCode = async (email: string) => (await whenReady()).sendEmailCode(email);
  const loginWithEmailCode = async (code: string) => (await whenReady()).loginWithEmailCode(code);
  const loginWithWallet = async (w: InjectedWallet) => (await whenReady()).loginWithWallet(w);
  const chooseWallet = async (kind: "own" | "fresh", address: string) => (await whenReady()).chooseWallet(kind, address);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<null | "x" | "send" | "code" | "wallet" | "demo">(null);
  const [error, setError] = useState<string | null>(null);
  const [showWallets, setShowWallets] = useState(false);
  const [signingWith, setSigningWith] = useState<string | null>(null);
  // The wallet you tapped, waiting for "use my own" or "create a fresh Patched wallet".
  const [picked, setPicked] = useState<InjectedWallet | null>(null);
  const [signingKind, setSigningKind] = useState<"own" | "fresh" | null>(null);
  const wallets = useInjectedWallets();
  // The shared demo account (a Privy test account), offered only where the site runs on play money.
  const [demo, setDemo] = useState<DemoLogin | null>(null);
  useEffect(() => {
    let live = true;
    void loadDemoLogin().then((d) => live && setDemo(d));
    return () => {
      live = false;
    };
  }, []);

  async function signInWithWallet(w: InjectedWallet, kind: "own" | "fresh") {
    setBusy("wallet");
    setSigningWith(w.id);
    setSigningKind(kind);
    setError(null);
    onSetup(true);
    let address: string | null = null;
    try {
      address = await loginWithWallet(w);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/reject|denied|cancel/i.test(msg) ? "You cancelled the signature." : `${w.name} didn't sign in. Try again.`);
    }
    if (address) {
      try {
        await chooseWallet(kind, address);
      } catch (e) {
        // Signed in fine; only the wallet choice failed, so they carry on with their own wallet.
        toast(kind === "fresh" ? "Couldn't make a fresh wallet, so you're using your own. You can try again in Settings." : "Couldn't save your wallet choice.");
        console.error(e);
      }
    }
    onSetup(false);
    setBusy(null);
    setSigningWith(null);
    setSigningKind(null);
  }

  async function run(kind: "x" | "send" | "code" | "demo", fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      if (kind === "send") setSent(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/still loading/.test(msg)) return setError(msg);
      setError(kind === "demo" ? "The demo account didn't sign in. Try again, or use X or email."
        : kind === "code" ? "That code didn't work. Check it, or send a new one." : /email/i.test(msg) ? "Check the email address." : "That didn't go through. Try again.");
    } finally {
      if (kind !== "x") setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-[420px] min-w-0 rounded-3xl bg-[var(--card)] border-[1.5px] border-[var(--soft)] shadow-[0_16px_48px_rgba(11,11,12,0.10)] p-6 sm:p-7 grid grid-cols-[minmax(0,1fr)] gap-4">
      <span className="justify-self-center inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[var(--soft)] text-xs font-semibold">
        <ShieldCheck size={13} /> Secured by <PrivyLogo height={13} />
      </span>
      <div className="text-center grid gap-1">
        <h2 className="text-2xl font-extrabold">Welcome to Patched</h2>
        <p className="text-sm text-[var(--muted)]">Sign in and your wallet is ready. No app, no seed phrase.</p>
      </div>

      <div className="relative mt-8">
        <button onClick={() => run("x", loginWithX)} disabled={!!busy}
          className="h-12 w-full rounded-full bg-[var(--ink)] text-[var(--paper)] font-bold flex items-center justify-center gap-2.5 hover:opacity-90 disabled:opacity-60">
          {busy === "x" ? <Loader2 size={16} className="animate-spin" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={X_PATH} /></svg>}
          Continue with X
        </button>
        <HandNote>Recommended</HandNote>
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--soft)]" />or<span className="h-px flex-1 bg-[var(--soft)]" /></div>

      {!sent ? (
        <form className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); if (email.trim()) void run("send", () => sendEmailCode(email.trim())); }}>
          <label htmlFor="welcome-email" className="text-sm font-semibold">Email</label>
          <div className="flex gap-2">
            <input id="welcome-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com"
              className="w-0 flex-1 min-w-0 h-11 px-3.5 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)]" />
            <button type="submit" disabled={!!busy || !email.trim()} className="btn-base btn-primary h-11 !rounded-xl !px-3.5 flex-none">
              {busy === "send" ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Send code
            </button>
          </div>
        </form>
      ) : (
        <form className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 6) void run("code", () => loginWithEmailCode(code.trim())); }}>
          <label htmlFor="welcome-code" className="text-sm font-semibold">Code sent to {email}</label>
          <div className="flex gap-2">
            <input id="welcome-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" autoFocus
              className="w-0 flex-1 min-w-0 h-11 px-3.5 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)] font-mono tracking-[0.3em]" />
            <button type="submit" disabled={!!busy || code.length < 6} className="btn-base btn-primary h-11 !rounded-xl !px-3.5 flex-none">
              {busy === "code" ? <Loader2 size={15} className="animate-spin" /> : null} Sign in
            </button>
          </div>
          <button type="button" className="text-xs font-semibold text-[var(--muted)] justify-self-start hover:text-[var(--ink)]" onClick={() => { setSent(false); setCode(""); }}>
            Use a different email
          </button>
        </form>
      )}

      {error && <p className="text-sm text-[var(--red)] font-semibold" role="alert">{error}</p>}

      <button onClick={() => setShowWallets((v) => !v)} aria-expanded={showWallets} aria-controls="welcome-wallets"
        className="h-11 rounded-full border-[1.5px] border-[var(--soft)] font-semibold hover:border-[var(--line)] hover:bg-[var(--soft)] inline-flex items-center justify-center gap-2">
        <Wallet size={15} /> I have a wallet <ChevronDown size={15} className={cn("transition-transform", showWallets && "rotate-180")} />
      </button>
      {showWallets && !picked && (
        <ul id="welcome-wallets" className="grid gap-1.5" aria-label="Pick a wallet">
          {wallets.map((w) => (
            <li key={w.id}>
              <button onClick={() => setPicked(w)} disabled={!!busy}
                className="w-full h-12 px-3 rounded-2xl border-[1.5px] border-[var(--soft)] hover:border-[var(--line)] hover:bg-[var(--soft)] flex items-center gap-3 text-left disabled:opacity-60">
                {w.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs from the extension
                  <img src={w.icon} alt="" width={26} height={26} className="size-[26px] rounded-lg flex-none" />
                ) : (
                  <span className="size-[26px] rounded-lg bg-[var(--soft)] grid place-items-center flex-none"><Wallet size={14} /></span>
                )}
                <span className="flex-1 min-w-0 truncate font-semibold">{w.name}</span>
                <span className="text-xs text-[var(--muted)]">Detected</span>
              </button>
            </li>
          ))}
          <li>
            <button onClick={openPrivyLogin} disabled={!!busy}
              className="w-full h-12 px-3 rounded-2xl border-[1.5px] border-[var(--soft)] hover:border-[var(--line)] hover:bg-[var(--soft)] flex items-center gap-3 text-left disabled:opacity-60">
              <span className="size-[26px] rounded-lg bg-[var(--soft)] grid place-items-center flex-none"><Smartphone size={14} /></span>
              <span className="flex-1 min-w-0 truncate font-semibold">{wallets.length ? "Other wallets" : "Phone or other wallet"}</span>
              <ChevronRight size={15} className="text-[var(--muted)]" />
            </button>
          </li>
          {wallets.length === 0 && (
            <li className="text-xs text-center text-[var(--muted)]" role="status">No wallet extension in this browser. Scan a QR code with your phone wallet, or use X or email.</li>
          )}
        </ul>
      )}
      {showWallets && picked && (
        <div id="welcome-wallets" className="grid gap-2" role="group" aria-label={`How to use ${picked.name}`}>
          <button type="button" onClick={() => setPicked(null)} disabled={!!busy} className="justify-self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-60">
            <ArrowLeft size={13} /> Back to wallets
          </button>
          <b className="text-sm">Which wallet should Patched use?</b>
          {([
            { kind: "own" as const, Icon: Wallet, title: `My ${picked.name}`, body: "Your money stays in it. Each bid asks you to approve in the wallet, and you pay the small network fee." },
            { kind: "fresh" as const, Icon: Sparkles, title: "A fresh Patched wallet", body: `One-tap bids and no network fee. It starts empty: add USDC from any wallet, ${picked.name} included.` },
          ]).map(({ kind, Icon, title, body }) => (
            <button key={kind} type="button" onClick={() => signInWithWallet(picked, kind)} disabled={!!busy}
              className="w-full p-3.5 rounded-2xl border-[1.5px] border-[var(--soft)] hover:border-[var(--line)] hover:bg-[var(--soft)] flex gap-3 items-start text-left disabled:opacity-60">
              <span className="size-9 rounded-xl bg-[var(--card)] border-[1.5px] border-[var(--soft)] grid place-items-center flex-none">
                {signingWith === picked.id && signingKind === kind ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
              </span>
              <span className="grid gap-0.5 min-w-0">
                <b className="text-[15px]">{title}</b>
                <span className="text-[13px] text-[var(--muted)] leading-snug">{body}</span>
              </span>
            </button>
          ))}
          <p className="text-xs text-center text-[var(--muted)]">{busy === "wallet" ? `Check ${picked.name} to sign in.` : `You sign in with ${picked.name} either way.`}</p>
        </div>
      )}
      <p className="text-xs text-center text-[var(--muted)] leading-relaxed">
        With X or email, Privy makes your wallet for you and bids are one tap{GAS_SPONSORED ? ", with no network fee" : ""}.
      </p>
      {/* Judges can skip sign-up with the shared test account; kept small so real visitors make their own. */}
      {demo && (
        <p className="text-xs text-center text-[var(--muted)] -mt-2">
          Judging?{" "}
          <button type="button" disabled={!!busy} className="font-semibold underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-60"
            onClick={() => run("demo", async () => { await sendEmailCode(demo.email); await loginWithEmailCode(demo.code); })}>
            {busy === "demo" ? "Signing in…" : "Use the demo account"}
          </button>
        </p>
      )}
    </div>
  );
}

/** Name, @handle (checked live) and what you're here for. Prefilled from X. */
function ProfileStep({ role, setRole, onDone }: { role: Role; setRole: (r: Role) => void; onDone: () => void }) {
  const { xHandle } = usePatchedAuth();
  const { profile, save } = useProfile();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [check, setCheck] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = useRef(false);

  useEffect(() => {
    if (!profile || filled.current) return;
    filled.current = true;
    setName(profile.display_name ?? xHandle ?? "");
    setHandle(profile.handle ?? xHandle?.toLowerCase() ?? "");
  }, [profile, xHandle]);

  // Live check, a moment after typing stops.
  useEffect(() => {
    const h = handle.trim().toLowerCase();
    if (!h) return setCheck(null);
    const problem = handleProblem(h);
    if (problem) return setCheck({ ok: false, text: problem });
    if (h === profile?.handle) return setCheck({ ok: true, text: `patched/${h} is yours` });
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/profile/handle?h=${encodeURIComponent(h)}`)
        .then((r) => r.json())
        .then((j: { available: boolean; reason: string | null }) => alive && setCheck(j.available ? { ok: true, text: `patched/${h} is yours` } : { ok: false, text: j.reason ?? "That handle is taken." }))
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [handle, profile?.handle]);

  async function submit() {
    setSaving(true);
    setError(null);
    const h = handle.trim().toLowerCase();
    const err = await save({ displayName: name.trim(), ...(h && h !== profile?.handle ? { handle: h } : {}) });
    setSaving(false);
    if (err) return setError(err);
    onDone();
  }

  const roles: { id: Role; label: string }[] = [{ id: "creator", label: "Sell spots" }, { id: "brand", label: "Sponsor" }, { id: "both", label: "Both" }];
  return (
    <form className="w-full max-w-[420px] grid gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="grid gap-1.5">
        <span className="font-mono text-xs text-[var(--muted)]">Step 1 of 2</span>
        <h2 className="text-4xl font-extrabold tracking-tight">Set up your profile</h2>
        <p className="text-[var(--muted)]">{xHandle ? "We filled this in from X. Change anything." : "This is what brands and creators see."}</p>
      </div>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">Name</span>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required
          className="h-12 px-4 rounded-2xl border-[1.5px] border-[var(--line)] bg-[var(--card)] text-base" />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">Handle</span>
        <span className="flex items-center h-12 px-4 rounded-2xl border-[1.5px] border-[var(--line)] bg-[var(--card)] focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]">
          <span className="text-[var(--muted)]">@</span>
          <input value={handle} maxLength={31} onChange={(e) => setHandle(e.target.value.toLowerCase())} aria-label="Handle" required
            className="flex-1 min-w-0 bg-transparent text-base" style={{ outline: "none" }} />
        </span>
        {check && <span className={cn("text-sm font-semibold", check.ok ? "text-[var(--green)]" : "text-[var(--red)]")} role="status">{check.text}</span>}
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold mb-2">I&apos;m here to</legend>
        <div className="flex p-1 rounded-full bg-[var(--soft)]" role="radiogroup">
          {roles.map((r) => (
            <button key={r.id} type="button" role="radio" aria-checked={role === r.id} onClick={() => setRole(r.id)}
              className={cn("flex-1 h-10 rounded-full text-sm font-bold transition-colors", role === r.id ? "bg-[var(--card)] shadow-[0_1px_4px_rgba(11,11,12,0.15)]" : "text-[var(--muted)]")}>
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-sm text-[var(--red)] font-semibold" role="alert">{error}</p>}
      <button type="submit" disabled={saving || !profile || !name.trim() || (check !== null && !check.ok)} className="btn-base btn-primary h-12 justify-center text-base">
        {saving ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

/** How bidding works, stated as promises the app actually keeps. */
function BiddingStep({ onDone }: { onDone: () => void }) {
  const { hasPasskey, enrollPasskey, isEmbeddedWallet, walletAddress } = usePatchedAuth();
  const { usdc } = useBalances(walletAddress);
  const funded = usdc !== null && Number(usdc.replace(/,/g, "")) > 0;
  const faucet = PLAY_MONEY && !TEST_TOKEN;
  // No passkey on the shared demo account: it would lock every judge after this one out of bidding.
  const demo = useIsDemoAccount();
  const points = [
    { icon: Zap, text: "No wallet pop-up on each bid: your Privy wallet signs it." },
    ...(GAS_SPONSORED ? [{ icon: Check, text: "Patched pays the network fee." }] : []),
    { icon: ShieldCheck, text: "Outbid? Your money comes straight back, in the same transaction." },
    { icon: Check, text: "Turn on auto-bid and Patched keeps you on top while you're away." },
  ];
  return (
    <div className="w-full max-w-[440px] grid gap-5">
      <div className="grid gap-1.5">
        <span className="font-mono text-xs text-[var(--muted)]">Step 2 of 2</span>
        <h2 className="text-4xl font-extrabold tracking-tight">Bid without pop-ups</h2>
        <p className="text-[var(--muted)]">{isEmbeddedWallet ? "Your wallet is ready, so a bid is one tap." : "Your wallet is loading. A bid will be one tap."}</p>
      </div>
      <ul className="grid gap-3 rounded-3xl border-2 border-[var(--line)] bg-[var(--card)] p-5 shadow-[4px_4px_0_var(--shadow)] list-none m-0">
        {points.map((p) => (
          <li key={p.text} className="flex gap-3 items-start text-[15px]">
            <span className="w-7 h-7 rounded-lg bg-[var(--green-soft)] text-[var(--green)] grid place-items-center flex-none"><p.icon size={15} strokeWidth={2.6} /></span>
            {p.text}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--accent-soft)] p-4">
        <Droplets size={26} className="flex-none" />
        <span className="flex-1 text-sm leading-snug">
          <b className="block text-[15px]">Fund your wallet</b>
          {funded ? `You have $${usdc} to bid with.` : faucet ? "Your wallet starts at $0. Get free test USDC from Circle's faucet in about a minute." : "Your wallet starts at $0. Add USDC to place your first bid."}
        </span>
        {funded ? (
          <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--green)] flex-none"><Check size={15} /> Funded</span>
        ) : (
          <button onClick={openAddMoney} className="btn-base btn-small btn-primary flex-none">{faucet ? "Get free USDC" : "Add money"}</button>
        )}
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--soft)] p-4">
        <Fingerprint size={26} className="flex-none" />
        <span className="flex-1 text-sm leading-snug">
          Moves of ${STEP_UP_USD.toLocaleString("en-US")} or more need a passkey (Face ID or fingerprint). Once it&apos;s on, Privy asks for it
          before your wallet signs, then remembers it for a short while.
          {demo && <span className="block mt-1 text-[var(--muted)]">Not on the shared demo account.</span>}
        </span>
        {hasPasskey ? (
          <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--green)] flex-none"><Check size={15} /> Passkey on</span>
        ) : demo === false ? (
          <button onClick={enrollPasskey} className="btn-base btn-small flex-none">Set up</button>
        ) : null}
      </div>
      <button onClick={onDone} className="btn-base btn-primary h-12 justify-center text-base">Start</button>
      <p className="text-xs text-center text-[var(--muted)]">{demo ? "Wallet by Privy." : "Wallet by Privy. You can export it any time in Settings."}</p>
    </div>
  );
}
