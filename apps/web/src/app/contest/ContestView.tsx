"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, Camera, Check, ExternalLink, Gavel, MessageCircle, Send, Trophy } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { Avatar } from "@/components/ui/Avatar";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { DEADLINE, HASHTAG, TELEGRAM_URL, TRACKS, X_URL, type ContestData } from "@/lib/contest";
import { cn } from "@/lib/utils";
import { Countdown, Floaters, Heading, Patch, SpinBadge, ThreadUnderline, hand } from "@/components/contest/Decor";
import { DrawStage, type DrawResult } from "@/components/contest/DrawStage";
import { EntryForm } from "@/components/contest/EntryForm";
import { ContestAdmin } from "@/components/contest/ContestAdmin";
import "./contest.css";

const EMPTY: ContestData = {
  open: true, deadline: DEADLINE, event: null, entries: [], winners: [], me: null,
  stats: { entries: 0, listings: 0, bids: 0, creators: 0, spots: 0 },
};

/** The Get Patched Week page: hero, how to enter, the three tracks, the lucky draw, timeline, entry form. */
export function ContestView({ cover }: { cover: string | null }) {
  const authedFetch = useAuthedFetch();
  const { ready, authenticated, login } = usePatchedAuth();
  const [data, setData] = useState<ContestData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [draw, setDraw] = useState<DrawResult | null>(null);

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([
      authedFetch("/api/contest", { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<ContestData>) : null)).catch(() => null),
      fetch("/api/contest/draw", { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<DrawResult>) : null)).catch(() => null),
    ]);
    if (d) setData(d);
    if (r) setDraw(r);
    setLoaded(true);
  }, [authedFetch]);
  // Load once sign-in has settled (so "my entry" and the step checks are right), then keep the counters fresh.
  useEffect(() => {
    if (!ready) return;
    void load();
    const t = setInterval(() => !document.hidden && void load(), 30_000);
    return () => clearInterval(t);
  }, [ready, authenticated, load]);

  const eventHref = data.event ? `/e/${data.event.slug}` : "/events";
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  return (
    <div className="ct pb-28">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6 grid gap-16 sm:gap-28 pt-4 sm:pt-8">
        <Hero data={data} cover={cover} loaded={loaded} onEnter={() => go("enter")} />
        <Ticker entries={data.entries} />
        {data.winners.length > 0 && <Winners data={data} />}
        <Steps data={data} eventHref={eventHref} signedIn={authenticated} onSignIn={login} onForm={() => go("enter")} />
        <Tracks />
        <section id="draw" className="grid gap-7 scroll-mt-24">
          <Heading eyebrow="Lucky draw" title={<>Every entry is a <span className="ct-mark">ticket</span></>} note="the block hash picks, not us" />
          <DrawStage entries={data.entries} draw={draw} />
        </section>
        <Timeline />
        <section id="enter" className="grid gap-7 scroll-mt-24">
          <Heading eyebrow="Your turn" title={<>Get in before <span className="whitespace-nowrap">Oct 11</span></>} note="takes two minutes" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
            <EntryForm data={data} onSaved={() => void load()} />
            <div className="hidden lg:grid gap-4 sticky top-6">
              <Patch tone={2} rotate={3} className="p-5 gap-2 justify-items-start text-left" style={{ borderRadius: 22 }}>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Closes in</span>
                <Countdown to={DEADLINE} />
              </Patch>
              <Patch tone={4} rotate={-2} className="p-5 gap-1 justify-items-start text-left" style={{ borderRadius: 22 }}>
                <span className="font-display font-extrabold text-xl leading-tight">Stuck?</span>
                <span className="text-sm">Ask in the Telegram. A human answers.</span>
                <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0b0b0c]"><Send size={14} /> t.me/patchedworld</a>
              </Patch>
            </div>
          </div>
        </section>
        <Faq />
        <ContestAdmin />
        <footer className="grid gap-2 text-[13px] text-[var(--muted)] max-w-[70ch]">
          <p className="m-0">Bidding on Patched during this contest uses test USDC from the faucet. The three prizes are real USDC, paid on Monad mainnet, with the transaction links posted here and on X.</p>
          <p className="m-0">Get Patched Week is a practice round before ETHGlobal Mumbai (Nov 5-7). It is not affiliated with ETHGlobal. Emails are only used to contact winners and are never shown.</p>
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────────── hero ───────────────────────── */

function Hero({ data, cover, loaded, onEnter }: { data: ContestData; cover: string | null; loaded: boolean; onEnter: () => void }) {
  const stats: [string, number][] = [["Entries", data.stats.entries], ["Listings", data.stats.listings], ["Bids", data.stats.bids], ["Creators", data.stats.creators]];
  return (
    <section className="relative rounded-[28px] sm:rounded-[36px] border-[3px] border-[var(--ink)] bg-[var(--card)] shadow-[5px_5px_0_var(--shadow)] sm:shadow-[8px_8px_0_var(--shadow)] overflow-hidden">
      <Floaters
        className="max-sm:hidden"
        items={[
          { x: "46%", y: "5%", size: 54, tone: 4, rotate: 12, dur: 8 },
          { x: "90%", y: "56%", size: 46, tone: 5, rotate: -14, dur: 9 },
          { x: "3%", y: "84%", size: 50, tone: 1, rotate: 9, dur: 7.5 },
          { x: "52%", y: "88%", size: 40, tone: 3, rotate: -8, dur: 10 },
        ]}
      />
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 sm:gap-10 p-5 sm:p-10 lg:p-14">
        <div className="grid gap-5 sm:gap-6 content-start">
          <span className="inline-flex w-fit items-center gap-2.5 rounded-full border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap">
            <span className="ct-dot" /> <span className="sm:hidden">Contest · Oct 8 to 11</span><span className="hidden sm:inline">Community contest · Oct 8 to 11</span>
          </span>
          <h1 className="m-0 font-display font-extrabold leading-[0.94] tracking-[-0.04em] text-[clamp(50px,13vw,92px)]">
            Get <span className="ct-mark">Patched</span>
            <br />
            Week
          </h1>
          <div className="w-[min(340px,70%)] -mt-3"><ThreadUnderline /></div>
          <p className="m-0 text-[clamp(17px,2.2vw,21px)] leading-snug max-w-[34ch]">
            Use Patched. Post about it. <b>Get paid on Monad.</b> Even with 12 followers.
          </p>
          <ul className="m-0 p-0 list-none flex flex-wrap gap-2.5">
            {["$30 USDC", "3 winners", "Ends Oct 11, 9 AM IST"].map((t, i) => (
              <li key={t}><Patch tone={[2, 3, 1][i]!} rotate={[-2, 2, -1][i]!} className="px-3.5 py-2 font-display font-extrabold text-[15px]" style={{ borderRadius: 14 }}>{t}</Patch></li>
            ))}
          </ul>
          <div className="grid gap-2">
            <span className={cn(hand.className, "text-[24px] leading-none text-[var(--muted)] -rotate-1")}>time left</span>
            <Countdown to={DEADLINE} />
          </div>
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 pt-1">
            <button type="button" onClick={onEnter} className="btn-base btn-primary text-base h-12 px-6 justify-center"><ArrowDown size={18} /> Enter now</button>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-base h-12 px-6 text-base justify-center"><Send size={17} /> Join the Telegram</a>
          </div>
        </div>

        <div className="relative grid place-items-center lg:min-h-[420px] pb-6 sm:pb-0">
          <div className="relative w-[92%] sm:w-full max-w-[470px] rotate-[2.5deg]">
            <div className="rounded-[26px] border-[3px] border-[var(--ink)] bg-[var(--stage)] p-2.5 shadow-[7px_7px_0_var(--shadow)]">
              <div className="relative aspect-[3/2] overflow-hidden rounded-[18px] border-2 border-[var(--ink)] bg-[var(--accent)]">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="Get Patched Week" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center font-display font-extrabold text-6xl text-white">p</div>
                )}
                <div className="absolute inset-2 rounded-[12px] border-2 border-dashed border-white/80 pointer-events-none" />
              </div>
              <div className="flex items-center justify-between px-2 pt-2.5 pb-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                <span>Mumbai · Online</span><span>Event #{data.event?.id ?? "-"}</span>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-10 sm:-right-9 sm:-bottom-12 scale-[0.72] sm:scale-100 origin-bottom-right">
              <SpinBadge text="WIN $10 USDC · 3 WINNERS · ON MONAD · " size={150}>
                <span className="block text-[34px]">$10</span>
                <span className="block text-[11px] tracking-widest mt-0.5">x3</span>
              </SpinBadge>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t-[3px] border-[var(--ink)] grid grid-cols-2 sm:grid-cols-4 gap-[2px] bg-[color-mix(in_srgb,var(--ink)_14%,transparent)]">
        {stats.map(([k, v], i) => (
          <div key={k} className="px-5 py-3.5 sm:py-4 grid gap-0.5 bg-[var(--paper)]">
            <span className="font-display font-extrabold text-[34px] leading-none tabular-nums"><NumberFlow value={loaded ? v : 0} /></span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] inline-flex items-center gap-1.5">{i === 0 && <span className="ct-dot" />}{k}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ticker({ entries }: { entries: ContestData["entries"] }) {
  const items = entries.slice(-30).reverse();
  if (!items.length) {
    return (
      <div className="-mt-8 sm:-mt-14 text-center">
        <span className={cn(hand.className, "text-[22px] sm:text-[28px] text-[var(--muted)] inline-block -rotate-2 px-4")}>nobody is on the board yet. be the first one.</span>
      </div>
    );
  }
  const row = [...items, ...items];
  return (
    <div className="-mt-10 sm:-mt-14 overflow-hidden border-y-[2.5px] border-[var(--ink)] bg-[var(--accent)] py-3 -mx-4 sm:-mx-6 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]" aria-label="People who entered">
      <div className="ct-marquee" style={{ "--dur": `${Math.max(24, items.length * 3)}s` } as React.CSSProperties}>
        {row.map((e, i) => (
          <span key={i} className="mx-2 inline-flex items-center gap-2 rounded-full border-2 border-[#0b0b0c] bg-[var(--card)] py-1 pl-1 pr-3 text-[14px] font-bold text-[#0b0b0c] whitespace-nowrap">
            <Avatar src={e.avatar} name={e.handle} wallet={null} size={26} /> @{e.handle}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── winners ───────────────────────── */

function Winners({ data }: { data: ContestData }) {
  return (
    <section className="grid gap-7">
      <Heading eyebrow="Paid on Monad" title={<>The <span className="ct-mark">winners</span></>} note="every prize has a transaction" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {data.winners.map((w, i) => {
          const t = TRACKS.find((x) => x.id === w.track)!;
          return (
            <Patch key={w.track} tone={[2, 3, 1][i % 3]!} rotate={[-2, 1.5, -1][i % 3]!} hover className="p-6 gap-2 justify-items-start text-left" style={{ borderRadius: 26 }}>
              <span className="ct-stamp">{t.name}</span>
              <span className="font-display font-extrabold text-3xl leading-none mt-2">@{w.handle}</span>
              {w.note && <span className="text-sm">{w.note}</span>}
              <span className="font-mono font-semibold">${t.prize} USDC</span>
              {w.tx && <a href={`https://monadvision.com/tx/${w.tx}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-[#0b0b0c]">See the payment <ExternalLink size={13} /></a>}
            </Patch>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── how to enter ───────────────────────── */

function Steps({ data, eventHref, signedIn, onSignIn, onForm }: { data: ContestData; eventHref: string; signedIn: boolean; onSignIn: () => void; onForm: () => void }) {
  const me = data.me;
  const steps = [
    { n: 1, tone: 3, icon: Send, title: "Join the Telegram", body: "Say hi in t.me/patchedworld. It is where we answer questions and post the form.", status: me?.entry?.joinedTelegram ? "ok" : "todo", hint: me?.entry?.joinedTelegram ? "Ticked in your entry" : "You tick this in the form", cta: <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-base btn-small">Open Telegram</a> },
    { n: 2, tone: 1, icon: Check, title: "Sign in with X", body: "Your X handle is your entry. A wallet is made for you, no seed phrase.", status: me?.steps.x ? "ok" : "todo", hint: me?.steps.x ? `Signed in as @${me.xHandle}` : "Not yet", cta: !signedIn || !me?.steps.x ? <button type="button" onClick={onSignIn} className="btn-base btn-small btn-primary">Sign in with X</button> : null },
    { n: 3, tone: 4, icon: Gavel, title: "Do one real thing", body: "List your fit, bid on someone's, or post a Spotted photo on the event. Bids use test USDC.", status: me?.steps.action.done ? "ok" : "todo", hint: me?.steps.action.done ? `You ${me.steps.action.what}` : signedIn ? "Not yet" : "Sign in to check", cta: !me?.steps.action.done ? <Link href={eventHref} className="btn-base btn-small">Go to the event</Link> : null },
    { n: 4, tone: 5, icon: Camera, title: "Post about it", body: <>Tag <b>@Patched_world</b> and add <b>{HASHTAG}</b> on X, then paste the link in the form.</>, status: me?.entry?.postUrl ? "ok" : "todo", hint: me?.entry?.postUrl ? "Link saved" : "You paste the link in the form", cta: <button type="button" onClick={onForm} className="btn-base btn-small">Open the form</button> },
  ] as const;
  return (
    <section className="grid gap-8 relative">
      <Heading eyebrow="How to enter" title={<>Four steps. <span className="ct-mark">All four.</span></>} note="miss one and it doesn't count" />
      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-6">
        <svg className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0" width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="60" r="52" stroke="var(--ink)" strokeOpacity=".35" strokeWidth="3" strokeDasharray="3 9" strokeLinecap="round" />
        </svg>
        {steps.map((s) => {
          const ok = s.status === "ok";
          return (
            <div key={s.n} className="relative z-10">
              <Patch tone={s.tone} rotate={s.n % 2 ? -1.2 : 1.2} hover className="w-full p-6 sm:p-7 gap-0 justify-items-start text-left min-h-[210px] grid-rows-[auto_1fr_auto]" style={{ borderRadius: 28 }}>
                <span aria-hidden="true" className="absolute right-5 top-1 font-display font-extrabold text-[110px] leading-none text-transparent select-none" style={{ WebkitTextStroke: "3px #0b0b0c", opacity: 0.18 }}>{s.n}</span>
                <span className="flex items-center gap-2.5 relative">
                  <span className="grid place-items-center w-11 h-11 rounded-2xl bg-[#0b0b0c] text-[var(--p3)]"><s.icon size={21} /></span>
                  <span className={cn("ct-stamp", ok && "is-done")}>{ok ? "Done" : "Mandatory"}</span>
                </span>
                <span className="relative mt-4">
                  <span className="block font-display font-extrabold text-[26px] leading-tight">{s.title}</span>
                  <span className="block mt-1.5 text-[15px] leading-snug max-w-[34ch]">{s.body}</span>
                </span>
                <span className="relative mt-4 flex items-center gap-3 flex-wrap">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border-2 border-[#0b0b0c] px-3 py-1 text-[13px] font-bold", ok ? "bg-[var(--green-soft)] text-[#0b0b0c]" : "bg-white/70 text-[#0b0b0c]")}>
                    {ok ? <Check size={14} strokeWidth={3.4} className="text-[var(--green)]" /> : <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />}{s.hint}
                  </span>
                  {!ok && s.cta}
                </span>
              </Patch>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── the three tracks ───────────────────────── */

function Tracks() {
  const icons = [MessageCircle, Gavel, Trophy];
  return (
    <section className="grid gap-8">
      <Heading eyebrow="Three prizes" title={<>$10 each. <span className="ct-mark">Pick any.</span></>} note="you can enter all three" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
        {TRACKS.map((t, i) => {
          const Icon = icons[i]!;
          return (
            <Patch key={t.id} tone={[2, 1, 3][i]!} rotate={[-2.5, 1.5, -1.2][i]!} hover className="p-7 gap-0 justify-items-start text-left min-h-[330px] grid-rows-[auto_auto_1fr_auto]" style={{ borderRadius: 30 }}>
              <span className="flex items-center justify-between w-full relative">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-[#0b0b0c] text-white"><Icon size={23} /></span>
                <span className="font-display font-extrabold text-[58px] leading-none tracking-tight">${t.prize}</span>
              </span>
              <span className="relative mt-5 font-display font-extrabold text-[28px] leading-tight">{t.name}</span>
              <span className="relative mt-2 text-[15px] leading-snug">{t.blurb}</span>
              <span className="relative mt-5 w-full border-t-2 border-dashed border-[#0b0b0c]/40 pt-3 grid gap-0.5">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-70">Judged on</span>
                <span className="text-[13.5px] font-semibold leading-snug">{t.judged}</span>
              </span>
            </Patch>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── timeline ───────────────────────── */

const DAYS = [
  { at: Date.parse("2026-10-07T18:30:00Z"), date: "Oct 8", title: "Contest opens", body: "Join the Telegram, sign in with X and look around the event." },
  { at: Date.parse("2026-10-08T18:30:00Z"), date: "Oct 9", title: "List and bid", body: "List your fit, bid on someone's. Set bidding to 12 to 24 hours so payouts land in time." },
  { at: Date.parse("2026-10-09T18:30:00Z"), date: "Oct 10", title: "Proofs and payouts", body: "Show you showed up, get paid. The entry form is posted in the Telegram that evening." },
  { at: DEADLINE, date: "Oct 11 · 9 AM IST", title: "Entries close, the draw runs", body: "The first Monad block after the deadline picks the lucky-draw winner. Anyone can check it." },
  { at: DEADLINE + 6 * 3_600_000, date: "Oct 11", title: "Winners paid on Monad", body: "Three payments, three transaction links, posted here and on X." },
];

function Timeline() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const current = useMemo(() => (now === null ? -1 : DAYS.reduce((c, d, i) => (now >= d.at ? i : c), -1)), [now]);
  return (
    <section className="grid gap-8">
      <Heading eyebrow="Timeline" title={<>Three days. <span className="ct-mark">That&apos;s it.</span></>} />
      <ol className="relative m-0 p-0 list-none grid gap-6 max-w-[760px]">
        <span className="ct-thread" aria-hidden="true" />
        {DAYS.map((d, i) => {
          const past = i < current;
          const live = i === current;
          return (
            <li key={d.title} className="relative grid grid-cols-[40px_1fr] gap-4 items-start">
              <span className={cn("relative z-10 grid place-items-center w-10 h-10 rounded-full border-[2.5px] border-[var(--ink)] font-display font-extrabold text-[15px] shadow-[3px_3px_0_var(--shadow)]", past ? "bg-[var(--green-soft)]" : live ? "bg-[var(--accent)]" : "bg-[var(--card)]")}>
                {past ? <Check size={18} strokeWidth={3.2} /> : i + 1}
              </span>
              <div className={cn("rounded-[20px] border-2 p-4 sm:px-5", live ? "border-[var(--ink)] bg-[var(--accent-soft)] shadow-[4px_4px_0_var(--shadow)]" : "border-[var(--soft)] bg-[var(--card)]")}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--accent-text)]">{d.date}</span>
                  {live && <span className="ct-stamp">Now</span>}
                </div>
                <h3 className="m-0 mt-1 font-display font-extrabold text-xl leading-tight">{d.title}</h3>
                <p className="m-0 mt-1 text-[14.5px] leading-snug text-[var(--muted)]">{d.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ───────────────────────── faq ───────────────────────── */

const FAQ: [string, React.ReactNode][] = [
  ["Is it real money?", "Bidding on Patched during the contest uses test USDC from the faucet, so nobody risks anything. The three prizes are real USDC, paid on Monad mainnet with the transaction links posted publicly."],
  ["Can I enter more than one track?", "Yes. Tick as many tracks as you like in the form. Lucky draw needs nothing more than the four steps."],
  ["How many entries can I have?", "One per person. Sending the form again before the deadline updates your entry."],
  ["Do I need followers?", "No. Best post is judged on creativity and honesty, not views, so a small account can win."],
  ["What does the listing tip mean?", "Set bidding to 12 to 24 hours and turn on the quick-proof setting (testnet). That way bids close and payouts land before the contest ends."],
  ["How is the lucky draw fair?", "At the deadline the entry list is fixed. The hash of the first Monad testnet block after 9 AM IST on Oct 11 picks the index. The block number and hash are shown on this page so you can check it yourself."],
  ["What do you do with my email?", "Only contact winners. It is never shown on the page and the database refuses to hand it out to the public."],
  ["Who runs this?", <>The Patched team: <a href={X_URL} target="_blank" rel="noopener noreferrer">@Patched_world</a> and <a href="https://x.com/dhruvpanch0li" target="_blank" rel="noopener noreferrer">@dhruvpanch0li</a>. It is a practice round before ETHGlobal Mumbai and is not affiliated with ETHGlobal.</>],
];

function Faq() {
  return (
    <section className="grid gap-7">
      <Heading eyebrow="Questions" title={<>Quick <span className="ct-mark">answers</span></>} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {FAQ.map(([q, a], i) => (
          <details key={i} className="group rounded-[20px] border-2 border-[var(--ink)] bg-[var(--card)] shadow-[3px_3px_0_var(--shadow)] open:shadow-[5px_5px_0_var(--accent)] transition-shadow">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none p-4 sm:p-5 font-display font-extrabold text-[18px] leading-tight [&::-webkit-details-marker]:hidden">
              {q}
              <span className="flex-none grid place-items-center w-7 h-7 rounded-lg border-2 border-[var(--ink)] bg-[var(--p3)] text-[#0b0b0c] font-bold transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="m-0 px-4 sm:px-5 pb-4 sm:pb-5 text-[15px] leading-relaxed text-[var(--muted)]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
