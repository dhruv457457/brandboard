"use client";

import { EyeOff, ExternalLink, Flag, Pencil, Plus, RotateCcw, ShieldHalf } from "lucide-react";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import PageLoading from "@/app/loading";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { encodeFunctionData, keccak256, parseEventLogs, stringToHex, toBytes } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/components/ui/Toast";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { MARKET, OPEN_ADMIN, publicClient } from "@/lib/config";
import type { AdminReviewItem } from "@/lib/market/server";
import type { ModItem } from "@/lib/server/moderationView";
import { formatCountdown, formatShortAddress } from "@/lib/format";
import { friendlyError } from "@/lib/market/useBid";
import { useTx } from "@/lib/market/useTx";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useIndexerSync } from "@/lib/market/useIndexerSync";
import { DISPUTE_CATEGORIES } from "@/lib/market/dispute";
import { EventCover } from "@/components/events/EventCover";
import { EMPTY_EVENT, EventForm, type EventFormValues, type EventProgress } from "./EventForm";
import { TimingPanel } from "./TimingPanel";

export interface AdminEvent {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  slug: string | null;
  city: string | null;
  venue: string | null;
  description: string | null;
  bannerUrl: string | null;
  website: string | null;
  x: string | null;
}

const ADMIN_ROLE = keccak256(toBytes("ADMIN_ROLE"));
const IDLE: EventProgress = { step: null, createdId: null, error: null };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AdminConsole({ moderation, review, events }: { moderation: { reported: ModItem[]; hidden: ModItem[] }; review: AdminReviewItem[]; events: AdminEvent[] }) {
  const router = useRouter();
  const { walletAddress, authenticated, ready } = usePatchedAuth();
  const send = useTx();
  const authedFetch = useAuthedFetch();
  useIndexerSync();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | { mode: "create" } | { mode: "edit"; id: number }>(null);
  const [progress, setProgress] = useState<EventProgress>(IDLE);
  const eventsTop = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!walletAddress) return setIsAdmin(null);
    publicClient
      .readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "hasRole", args: [ADMIN_ROLE, walletAddress] })
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, [walletAddress]);

  /** Send a market call as the admin wallet, or through the open-admin server wallet, and wait until it is mined. */
  async function exec(data: `0x${string}`) {
    if (isAdmin) return send(MARKET, data);
    const res = await authedFetch("/api/admin/act", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) });
    const json = (await res.json().catch(() => ({}))) as { hash?: `0x${string}`; error?: string };
    if (!res.ok) throw new Error(json.error ?? "That didn't go through.");
    return json.hash ? publicClient.waitForTransactionReceipt({ hash: json.hash }) : null;
  }

  async function run(key: string, label: string, data: `0x${string}`) {
    setBusy(key);
    try {
      await exec(data);
      await fetch("/api/indexer/sync", { method: "POST" });
      toast(label);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast(!isAdmin && msg ? msg : friendlyError(err).replace("The bid didn't", "That didn't"));
    } finally {
      setBusy(null);
    }
  }

  /** Hide, restore or dismiss reports on one listing or photo. Nothing is sent on-chain: the app just stops showing it. */
  async function moderate(item: ModItem, action: "hide" | "restore" | "dismiss", done: string) {
    const key = `m${item.kind}${item.id}${action}`;
    setBusy(key);
    try {
      const res = await authedFetch("/api/admin/moderate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: item.kind, id: item.id, action }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "That didn't go through.");
      toast(done);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That didn't go through.");
    } finally {
      setBusy(null);
    }
  }

  /** The event page's details. The row exists once the indexer has seen the new event, so a 404 means "not yet". */
  async function saveDetails(id: number, v: EventFormValues) {
    const body = JSON.stringify({ slug: v.slug, city: v.city, venue: v.venue, description: v.description, bannerUrl: v.bannerUrl, website: v.website, x: v.x });
    for (let attempt = 0; ; attempt++) {
      const res = await authedFetch(`/api/events/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body });
      if (res.ok) return;
      if (res.status === 404 && attempt < 7) {
        await fetch("/api/indexer/sync", { method: "POST" }).catch(() => {});
        await sleep(1500);
        continue;
      }
      throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save the page.");
    }
  }

  /** Create (on-chain, then the page) or edit (the page only). If the page fails after the event exists, the form stays open to retry it. */
  async function submitEvent(v: EventFormValues) {
    const editing = panel?.mode === "edit";
    let id: number | null = panel?.mode === "edit" ? panel.id : progress.createdId;
    try {
      if (id === null) {
        setProgress({ step: "chain", createdId: null, error: null });
        const expected = Number(await publicClient.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "nextEventId" }));
        const start = Math.floor(Date.parse(v.start) / 1000);
        const end = Math.floor(Date.parse(v.end) / 1000) + 86_399;
        const receipt = await exec(encodeFunctionData({
          abi: patchedMarketAbi, functionName: "createEvent", args: [stringToHex(v.name.trim(), { size: 32 }), start, end],
        }));
        const made = receipt ? parseEventLogs({ abi: patchedMarketAbi, logs: receipt.logs, eventName: "EventCreated" })[0]?.args.eventId : undefined;
        id = made !== undefined ? Number(made) : expected;
      }
      setProgress({ step: "save", createdId: editing ? null : id, error: null });
      await saveDetails(id, v);
      closePanel();
      toast(editing ? `${v.name} saved.` : `${v.name.trim()} is live.`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const why = id === null ? (!isAdmin && msg ? msg : friendlyError(err).replace("The bid didn't", "That didn't")) : msg || "Couldn't save the page.";
      setProgress({
        step: null, createdId: editing ? null : id,
        error: id !== null && !editing ? `${v.name.trim()} is on Monad as event #${id}, but its page didn't save: ${why} Your details are kept. Try again.` : why,
      });
    }
  }

  function openPanel(next: NonNullable<typeof panel>) {
    setProgress(IDLE);
    setPanel(next);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => eventsTop.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }));
  }
  function closePanel() {
    setPanel(null);
    setProgress(IDLE);
  }

  if (!ready) return <PageLoading />;
  if (!authenticated) {
    return (
      <SignInPrompt icon={ShieldHalf} title="Admin console" text={OPEN_ADMIN ? "Sign in to review listings, proofs and events." : "Sign in with an admin wallet to review listings, proofs and events."} />
    );
  }
  if (isAdmin === false && !OPEN_ADMIN) {
    return (
      <main className="wrap pt-10 pb-24"><Card className="p-8 text-center">
        <h1 className="text-3xl font-extrabold">Admins only</h1>
        <p className="muted mt-2">This wallet doesn&apos;t have the admin role on the Patched contract.</p>
      </Card></main>
    );
  }

  return (
    <main className="wrap pt-8 pb-24 grid gap-10">
      {isAdmin === false && OPEN_ADMIN && (
        <p className="rounded-2xl bg-[var(--accent-soft)] p-4 text-sm" role="status">
          <b>Open admin for the hackathon demo.</b> Anyone signed in can hide reported posts, fast-track proofs, settle disputes and
          manage events. Your actions are sent by a Patched Privy server wallet whose policy allows only these calls: it can&apos;t
          pause the market, change fees or upgrade the contract.
        </p>
      )}
      <section>
        <span className="eyebrow">Admin console</span>
        <h1 className="font-extrabold text-4xl tracking-tight mt-1 mb-2">Reported posts</h1>
        <p className="muted max-w-[62ch] mb-5">
          Listings go live on their own, with no approval. When someone reports a listing or a spotted photo it shows up here:
          hide it, or dismiss the report. Three different people reporting the same thing hides it automatically.
        </p>
        {moderation.reported.length === 0 ? (
          <Card className="p-6"><p className="muted">Nothing has been reported.</p></Card>
        ) : (
          <div className="grid gap-3">
            {moderation.reported.map((m) => <ModRow key={`${m.kind}:${m.id}`} item={m} busy={busy} onAct={moderate} />)}
          </div>
        )}
        {moderation.hidden.length > 0 && (
          <div className="grid gap-3 mt-8">
            <h2 className="font-extrabold text-2xl tracking-tight flex items-center gap-2"><EyeOff size={20} /> Hidden</h2>
            {moderation.hidden.map((m) => <ModRow key={`h:${m.kind}:${m.id}`} item={m} busy={busy} onAct={moderate} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-extrabold text-3xl tracking-tight mb-4">Proofs and disputes</h2>
        {review.length === 0 ? (
          <Card className="p-6"><p className="muted">No proofs are under review and no disputes are open.</p></Card>
        ) : (
          <div className="grid gap-4">
            {review.map((r) => {
              const window = r.reviewEndsAt ? formatCountdown(r.reviewEndsAt) : null;
              return (
                <Card key={`${r.listingId}:${r.milestone}`} className="p-5 grid gap-3">
                  <div className="flex justify-between gap-3 flex-wrap items-start">
                    <div>
                      <b className="text-lg">{r.title} · {r.milestoneName}</b>
                      <p className="text-sm muted">
                        Listing #{r.listingId}
                        {window ? (window.hasEnded ? " · review window over" : ` · review ends in ${window.text}`) : ""}
                      </p>
                    </div>
                    {window && !window.hasEnded && (
                      <Button size="small" disabled={!!busy}
                        onClick={() => run(`ft${r.listingId}:${r.milestone}`, "Review window closed early. The payment can be released now.",
                          encodeFunctionData({ abi: patchedMarketAbi, functionName: "fastTrack", args: [BigInt(r.listingId), r.milestone] }))}>
                        {busy === `ft${r.listingId}:${r.milestone}` ? "Approving…" : "Proof looks good, skip the wait"}
                      </Button>
                    )}
                  </div>
                  {r.proof ? (
                    <div className="flex gap-2 flex-wrap">
                      {r.proof.files.map((f) => (
                        <a key={f} href={f} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-xl overflow-hidden border-2 border-[var(--line)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f} alt="Proof" className="w-full h-full object-cover" />
                        </a>
                      ))}
                      {r.proof.note && <p className="text-sm muted basis-full">Creator: &ldquo;{r.proof.note}&rdquo;</p>}
                    </div>
                  ) : <p className="text-sm muted">No proof files stored.</p>}
                  {r.disputes.map((d) => (
                    <div key={d.patchId} className="rounded-xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-3 grid gap-2">
                      <p className="text-sm">
                        <b>{d.label}</b> disputed by {formatShortAddress(d.holder)}
                        {d.reason.category && <> · <b>{DISPUTE_CATEGORIES[d.reason.category]}</b></>}
                      </p>
                      {d.reason.text && <p className="text-sm">&ldquo;{d.reason.text}&rdquo;</p>}
                      {d.reason.files.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {d.reason.files.map((f) => (
                            <a key={f} href={f} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-xl overflow-hidden border-2 border-[var(--line)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={f} alt="Dispute evidence" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { share: 10_000, label: "Pay creator" },
                          { share: 5_000, label: "Split 50/50" },
                          { share: 0, label: "Refund brand" },
                        ].map((o) => (
                          <Button key={o.share} size="small" variant={o.share === 10_000 ? "primary" : "default"} disabled={!!busy}
                            onClick={() => run(`d${r.listingId}:${r.milestone}:${d.patchId}`, `Dispute on ${d.label} resolved.`,
                              encodeFunctionData({ abi: patchedMarketAbi, functionName: "resolveDispute", args: [BigInt(r.listingId), r.milestone, d.patchId, o.share] }))}>
                            {o.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {isAdmin && <TimingPanel />}

      <section ref={eventsTop} className="scroll-mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-extrabold text-3xl tracking-tight">Events</h2>
          {!panel && <Button variant="primary" onClick={() => openPanel({ mode: "create" })}><Plus size={16} /> New event</Button>}
        </div>
        {panel && (
          <Card className="p-5 sm:p-6 mb-6">
            <h3 className="text-2xl font-extrabold mb-5">{panel.mode === "create" ? "New event" : `Edit ${events.find((e) => e.id === panel.id)?.name ?? "event"}`}</h3>
            <EventForm
              key={panel.mode === "create" ? "new" : panel.id}
              mode={panel.mode}
              previewId={panel.mode === "edit" ? panel.id : Math.max(0, ...events.map((e) => e.id)) + 1}
              initial={panel.mode === "edit" ? toValues(events.find((e) => e.id === panel.id)) : EMPTY_EVENT}
              progress={progress}
              onSubmit={submitEvent}
              onCancel={closePanel}
            />
          </Card>
        )}
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-left font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <th className="p-3 border-b-2 border-[var(--line)]">Cover</th><th className="p-3 border-b-2 border-[var(--line)]">#</th>
              <th className="p-3 border-b-2 border-[var(--line)]">Event</th><th className="p-3 border-b-2 border-[var(--line)]">Dates</th>
              <th className="p-3 border-b-2 border-[var(--line)]">Status</th><th className="p-3 border-b-2 border-[var(--line)]">Page</th>
            </tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-[var(--soft)]">
                  <td className="p-3"><EventCover name={e.name} banner={e.bannerUrl} seed={e.id} variant="thumb" /></td>
                  <td className="p-3 font-mono">{e.id}</td>
                  <td className="p-3 font-semibold">{e.name}</td>
                  <td className="p-3 font-mono text-xs">{e.startsAt.slice(0, 10)} → {e.endsAt.slice(0, 10)}</td>
                  <td className="p-3">{e.active ? <Pill variant="top">Accepting listings</Pill> : <Pill variant="wait">Closed</Pill>}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button size="small" variant="ghost" onClick={() => openPanel({ mode: "edit", id: e.id })}><Pencil size={13} /> {e.bannerUrl || e.description ? "Edit" : "Add cover"}</Button>
                      <a href={`/e/${e.slug ?? e.id}`} target="_blank" rel="noopener noreferrer" className="btn-base btn-small btn-ghost" aria-label={`Open ${e.name}`}><ExternalLink size={13} /> View</a>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 && <tr><td className="p-3 muted" colSpan={6}>No events yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>
    </main>
  );
}

/** An existing event as form values; the dates are the on-chain days (UTC). */
function toValues(e: AdminEvent | undefined): EventFormValues {
  if (!e) return EMPTY_EVENT;
  return {
    name: e.name, slug: e.slug ?? "", start: e.startsAt.slice(0, 10), end: e.endsAt.slice(0, 10), city: e.city ?? "", venue: e.venue ?? "",
    description: e.description ?? "", website: e.website ?? "", x: e.x ?? "", bannerUrl: e.bannerUrl ?? "",
  };
}


const REASON_LABEL: Record<string, string> = { spam: "Spam", scam: "Scam", inappropriate: "Inappropriate", copyright: "Copyright", other: "Other" };

/** One reported (or hidden) listing or photo, with what people said and the buttons to act on it. */
function ModRow({ item, busy, onAct }: { item: ModItem; busy: string | null; onAct: (item: ModItem, action: "hide" | "restore" | "dismiss", done: string) => void }) {
  const key = (a: string) => `m${item.kind}${item.id}${a}`;
  return (
    <Card className="p-4 flex gap-4 items-start flex-wrap">
      {item.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photo} alt="" width={72} height={72} className="w-[72px] h-[72px] rounded-xl object-cover flex-none border-2 border-[var(--line)]" />
      )}
      <div className="grid gap-1 min-w-0 flex-1 basis-[220px]">
        <b className="truncate">{item.title}</b>
        <span className="text-sm muted">{item.subtitle}</span>
        {item.reports > 0 && (
          <span className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent-text)]"><Flag size={13} /> {item.reports} report{item.reports === 1 ? "" : "s"}</span>
            <span className="muted">{item.reasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}</span>
          </span>
        )}
        {item.notes.map((n, i) => <p key={i} className="text-sm muted italic m-0">&ldquo;{n}&rdquo;</p>)}
        {item.href && <Link href={item.href} className="text-sm underline w-fit" target="_blank">Open it</Link>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {item.hidden ? (
          <Button size="small" variant="ghost" disabled={!!busy} onClick={() => onAct(item, "restore", "Back in the app.")}>
            <RotateCcw size={14} /> {busy === key("restore") ? "Restoring…" : "Restore"}
          </Button>
        ) : (
          <>
            <Button size="small" variant="primary" disabled={!!busy} onClick={() => onAct(item, "hide", "Hidden from the app.")}>
              <EyeOff size={14} /> {busy === key("hide") ? "Hiding…" : "Hide"}
            </Button>
            <Button size="small" variant="ghost" disabled={!!busy} onClick={() => onAct(item, "dismiss", "Reports dismissed.")}>
              {busy === key("dismiss") ? "Dismissing…" : "Dismiss"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
