"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Camera, Download, Users, ChevronDown, Crosshair, ExternalLink, Gavel, List, Network, Pause, Play, Receipt, Share2, Square, Undo2, X, Zap, Stamp, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ExplorerLink } from "@/components/ui/ExplorerLink";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { CHAIN_ID } from "@/lib/config";
import { formatShortAddress, formatUsdc } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EventGraph, GraphEventRow } from "@/lib/graph/types";
import { PatchworkEngine, type Described, type Layer, type Row, type ToastIcon } from "./engine";

const usd = (v: number) => formatUsdc(v);
const LAYERS: { id: Layer; label: string }[] = [
  { id: "leads", label: "Bids" },
  { id: "flow", label: "Money flow" },
  { id: "spotted", label: "Spots" },
  { id: "outbid", label: "Bid history" },
];
const ROW_ICON = { zap: Zap, undo: Undo2, camera: Camera, square: Square, receipt: Receipt, users: Users } as const;
const TOAST_ICON = { zap: Zap, camera: Camera, stamp: Stamp, node: UserPlus } as const;
const ROLE_LABEL = { creator: "Creator", teammate: "Teammate", brand: "Brand", holder: "Holder", spotter: "Spotter", spot: "Spot", event: "Event" } as const;

interface ToastItem { id: number; title: string; sub: string; icon: ToastIcon }

/** The Patchwork view: one event as a living graph, a details panel, replay and live updates. */
export function Patchwork({ eventId, onEvent, lead }: { eventId: number | null; onEvent: (id: number) => void; lead?: React.ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PatchworkEngine | null>(null);
  const [events, setEvents] = useState<GraphEventRow[] | null>(null);
  const [graph, setGraph] = useState<EventGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [, setVersion] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [replay, setReplay] = useState({ playing: false, p: 1, label: "Now" });
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ leads: true, flow: true, spotted: true, outbid: false });
  const [list, setList] = useState(false);
  const [picker, setPicker] = useState(false);
  const [notIn, setNotIn] = useState(false);
  const toastId = useRef(0);

  const { profile } = useProfile();
  const { walletAddress, authenticated, login } = usePatchedAuth();
  const viewer = (profile?.wallet ?? walletAddress ?? null)?.toLowerCase() ?? null;

  const toast = useCallback((title: string, sub: string, icon: ToastIcon) => {
    const id = ++toastId.current;
    setToasts((t) => [{ id, title, sub, icon }, ...t].slice(0, 3));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // The engine lives as long as the canvas does.
  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) return;
    const engine = new PatchworkEngine(canvasRef.current, stageRef.current, {
      select: (id) => {
        setSelected(id);
        setNotIn(false);
      },
      changed: () => setVersion((v) => v + 1),
      toast,
      replay: (s) => setReplay(s),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [toast]);

  // Which events have a graph.
  useEffect(() => {
    let alive = true;
    fetch("/api/graph/events")
      .then((r) => r.json())
      .then((j: { events: GraphEventRow[] }) => {
        if (!alive) return;
        setEvents(j.events);
        if (eventId === null && j.events[0]) onEvent(j.events[0].id);
      })
      .catch(() => alive && setError("Couldn't load events."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One event's graph: load it, then keep it fresh (Realtime on new bids, plus a slow poll as the safety net).
  const fetchGraph = useCallback(async (id: number, live: boolean) => {
    try {
      const r = await fetch(`/api/graph/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error("no graph");
      const g = (await r.json()) as EventGraph;
      setGraph(g);
      setError(null);
      const engine = engineRef.current;
      if (!engine) return;
      if (live && !engine.replaying) engine.update(g);
      else if (!live) engine.load(g);
    } catch {
      if (!live) setError("Couldn't load this event's graph.");
    }
  }, []);

  useEffect(() => {
    if (eventId === null) return;
    setGraph(null);
    setSelected(null);
    void fetchGraph(eventId, false);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void fetchGraph(eventId, true);
      }, 1200);
    };
    const channel = supabase()
      .channel(`patchwork:${CHAIN_ID}:${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `chain_id=eq.${CHAIN_ID}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `chain_id=eq.${CHAIN_ID}` }, refresh)
      .subscribe();
    const poll = setInterval(() => !document.hidden && void fetchGraph(eventId, true), 20_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      void supabase().removeChannel(channel);
    };
  }, [eventId, fetchGraph]);

  useEffect(() => engineRef.current?.setViewer(viewer), [viewer, graph]);
  useEffect(() => {
    for (const l of LAYERS) engineRef.current?.setLayer(l.id, layers[l.id]);
  }, [layers]);

  const engine = engineRef.current;
  const described: Described | null = engine && selected ? engine.describe(selected) : null;
  const overview = engine && graph && !selected ? engine.overview() : null;
  const me = engine?.viewerNode ?? null;
  const event = events?.find((e) => e.id === eventId);
  const eventName = graph?.event.name ?? event?.name ?? "Patchwork";

  const findMe = () => {
    if (!authenticated) return login();
    if (!engine?.findMe()) {
      setNotIn(true);
      engine?.select(null);
    }
  };

  // "Post my spot": an X post whose link previews as the share card (see app/share/patchwork).
  const shareHref = useMemo(() => {
    if (!graph || !me?.wallet || typeof window === "undefined") return null;
    const link = `${window.location.origin}/share/patchwork/${graph.event.id}/${me.wallet}`;
    const text = `I'm in the ${graph.event.name} patchwork on Patched: #${engine?.rankOf(me)} most connected with ${engine?.degree(me)} threads, all on Monad.`;
    return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, me, selected]);
  const cardHref = graph && me?.wallet ? `/share/patchwork/${graph.event.id}/${me.wallet}/card.png?download=1` : null;

  return (
    <div className="flex flex-col md:h-dvh md:min-h-[480px]">
      <header className="flex flex-col md:flex-row md:items-center gap-2 px-4 pt-3 pb-2.5 md:py-2.5 border-b-[1.5px] border-[var(--soft)]">
        {lead && <div className="w-full md:w-auto">{lead}</div>}
        <div className="flex items-center gap-2 min-w-0 md:flex-1">
        <div className="relative min-w-0 flex-1 md:flex-none">
          <button
            onClick={() => setPicker((v) => !v)}
            className="w-full md:w-auto inline-flex items-center gap-2 h-10 md:h-9 pl-1.5 pr-3 rounded-full border-2 border-[var(--ink)] bg-[var(--card)] font-bold text-sm shadow-[2px_2px_0_var(--shadow)]"
            aria-haspopup="listbox"
            aria-expanded={picker}
          >
            <span className="w-7 h-7 md:w-6 md:h-6 rounded-full bg-[var(--accent)] border-[1.5px] border-[var(--ink)] grid place-items-center overflow-hidden flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {graph?.event.banner ? <img src={graph.event.banner} alt="" className="w-full h-full object-cover" /> : null}
            </span>
            <span className="flex-1 min-w-0 text-left truncate md:max-w-[220px]">{eventName}</span>
            <ChevronDown size={15} className="flex-none" />
          </button>
          {picker && events && (
            <ul role="listbox" className="absolute z-30 top-12 left-0 w-full md:w-[280px] max-h-[320px] overflow-y-auto p-1.5 rounded-2xl border-2 border-[var(--ink)] bg-[var(--card)] shadow-[4px_4px_0_var(--shadow)] list-none m-0">
              {events.map((e) => (
                <li key={e.id} role="option" aria-selected={e.id === eventId}>
                  <button
                    onClick={() => {
                      setPicker(false);
                      onEvent(e.id);
                    }}
                    className={cn("w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-[var(--soft)]", e.id === eventId && "bg-[var(--soft)]")}
                  >
                    <span className="w-9 h-9 rounded-lg border-[1.5px] border-[var(--ink)] bg-[var(--accent-soft)] overflow-hidden flex-none grid place-items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {e.banner ? <img src={e.banner} alt="" className="w-full h-full object-cover" /> : <Network size={15} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm truncate">{e.name}</span>
                      <span className="block text-xs text-[var(--muted)]">{e.listings} listing{e.listings === 1 ? "" : "s"} · {usd(e.escrowUsd)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border-[1.5px] border-[var(--soft)] text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] motion-safe:animate-pulse" /> Live on {CHAIN_ID === 143 ? "Monad" : "Monad testnet"}
        </span>
        <div className="hidden md:block flex-1" />
        <button onClick={() => setList((v) => !v)} className="btn-base btn-small flex-none max-md:w-10 max-md:h-10 max-md:p-0 max-md:justify-center" aria-pressed={list} aria-label={list ? "Back to graph" : "View as list"}>
          {list ? <Network size={16} /> : <List size={16} />} <span className="hidden md:inline">{list ? "Back to graph" : "View as list"}</span>
        </button>
        </div>
      </header>

      <div className="md:flex-1 md:min-h-0 grid md:grid-cols-[1fr_340px]">
        <div ref={stageRef} className="relative h-[calc(100svh-238px)] min-h-[360px] md:min-h-0 md:h-auto overflow-hidden bg-[var(--stage)]">
          <canvas
            ref={canvasRef}
            className="block w-full h-full touch-none cursor-grab"
            role="img"
            aria-label={`Patchwork of ${eventName}: creators, their spots, the brands bidding on them and the people who spotted them. Use View as list for the same data as a table.`}
          />

          <div className="absolute top-2.5 left-2.5 right-2.5 md:top-3 md:left-3 md:right-3 flex gap-1.5 md:gap-2 overflow-x-auto [scrollbar-width:none] pointer-events-none">
            {LAYERS.map((l) => (
              <button
                key={l.id}
                aria-pressed={layers[l.id]}
                onClick={() => setLayers((s) => ({ ...s, [l.id]: !s[l.id] }))}
                className={cn("pointer-events-auto flex-none h-7 md:h-8 px-2.5 md:px-3 rounded-full text-[11px] md:text-xs font-bold border-[1.5px] transition-colors", layers[l.id] ? "bg-[var(--card)] border-[var(--ink)] shadow-[2px_2px_0_var(--shadow)]" : "bg-[var(--stage)] border-[var(--ink)]/20 text-[var(--muted)]")}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="absolute right-2.5 bottom-[66px] md:right-auto md:bottom-auto md:top-14 md:left-3">
            <button onClick={findMe} aria-label="Find me" className="btn-base btn-primary btn-small max-md:w-11 max-md:h-11 max-md:p-0 max-md:justify-center max-md:!rounded-full"><Crosshair size={17} /> <span className="hidden md:inline">Find me</span></button>
          </div>

          <div className="absolute left-2.5 bottom-[66px] md:left-3 md:bottom-[76px] max-w-[calc(100%-76px)] flex flex-col-reverse gap-2 items-start pointer-events-none" aria-live="polite">
            {toasts.map((t) => {
              const Icon = TOAST_ICON[t.icon];
              return (
                <div key={t.id} className="pointer-events-auto flex items-center gap-2 max-w-[340px] px-3.5 py-2 rounded-2xl bg-[var(--ink)] text-[var(--paper)] text-[13px] font-semibold motion-safe:animate-[toastIn_0.35s_cubic-bezier(0.2,1.3,0.4,1)]">
                  <Icon size={15} className="flex-none" />
                  <span>{t.title} <span className="text-[var(--accent)]">{t.sub}</span></span>
                </div>
              );
            })}
          </div>

          <div className="absolute left-2.5 right-2.5 bottom-2.5 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-4 md:w-[min(560px,calc(100%-24px))] flex items-center gap-2 md:gap-3 pl-1.5 pr-3 md:pl-2 md:pr-4 py-1.5 md:py-2 rounded-2xl border-2 border-[var(--ink)] bg-[var(--card)] shadow-[3px_3px_0_var(--shadow)] md:shadow-[4px_4px_0_var(--shadow)]">
            <button
              onClick={() => (replay.playing ? engine?.stopReplay(true) : engine?.startReplay(0))}
              disabled={!graph}
              className="btn-base btn-small flex-none max-md:w-9 max-md:h-9 max-md:p-0 max-md:justify-center"
              aria-label={replay.playing ? "Pause replay" : "Replay the event"}
            >
              {replay.playing ? <Pause size={15} /> : <Play size={15} />} <span className="hidden md:inline">{replay.playing ? "Pause" : "Replay"}</span>
            </button>
            <input
              type="range" min={0} max={1000} value={Math.round(replay.p * 1000)} aria-label="Replay position"
              onChange={(e) => engine?.seek(Number(e.target.value) / 1000)}
              className="flex-1 min-w-0 accent-[var(--accent)]"
            />
            <span className="font-mono text-[11px] md:text-xs text-[var(--muted)] w-[78px] md:w-[92px] text-right tabular-nums whitespace-nowrap">{replay.label}</span>
          </div>

          {!graph && !error && <Overlay>Loading the graph…</Overlay>}
          {error && <Overlay>{error}</Overlay>}
          {graph && graph.nodes.length <= 1 && <Overlay>No listings in this event yet. Be the first to list a spot.</Overlay>}

          {list && engine && (
            <div className="absolute inset-0 overflow-auto bg-[var(--paper)] p-4 pt-14">
              <table className="w-full max-w-[760px] mx-auto text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                    <th className="p-2">Who</th><th className="p-2">Role</th><th className="p-2">Threads</th><th className="p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {engine.table().map(({ n, d }) => (
                    <tr key={n.id} className="border-t border-[var(--soft)]">
                      <td className="p-2 font-semibold">{n.name}</td>
                      <td className="p-2">{n.roles.map((r) => ROLE_LABEL[r]).join(", ")}</td>
                      <td className="p-2 font-mono tabular-nums">{d}</td>
                      <td className="p-2 font-mono tabular-nums">{n.total ? usd(n.total) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="border-t-[1.5px] md:border-t-0 md:border-l-[1.5px] border-[var(--soft)] overflow-y-auto overflow-x-hidden p-4 grid gap-4 content-start min-w-0 bg-[var(--paper)]">
          {described ? (
            <NodePanel d={described} explorer={graph?.explorer ?? ""} onPick={(id) => engine?.select(id, true)} onClose={() => engine?.select(null)} />
          ) : (
            <>
              {graph && overview && <EventPanel graph={graph} o={overview} onPick={(id) => engine?.select(id, true)} />}
              {authenticated && notIn && (
                <Card>
                  <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold m-0 mb-2">Not in this patchwork yet</h3>
                  <p className="m-0 text-sm text-[var(--muted)]">You show up once you bid on a spot, list one, or spot a creator at this event.</p>
                  <div className="flex gap-2 mt-3 flex-wrap"><Link href="/explore" className="btn-base btn-primary btn-small">Browse spots</Link></div>
                </Card>
              )}
            </>
          )}
          {me && engine && !described && (
            <Card accent>
              <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold m-0 mb-2">You in {eventName}</h3>
              <div className="flex items-center gap-3">
                <span className="font-display font-extrabold text-4xl tracking-tight text-[var(--accent-text)]">#{engine.rankOf(me)}</span>
                <span className="text-sm font-semibold">most connected</span>
              </div>
              <Stats items={[{ v: String(engine.degree(me)), k: "threads" }, { v: usd(me.total), k: "locked" }, { v: String(engine.degree(me, "spotted")), k: "spotted" }]} />
              <div className="flex gap-2 mt-3 flex-wrap">
                {shareHref && <a href={shareHref} target="_blank" rel="noopener noreferrer" className="btn-base btn-primary btn-small"><Share2 size={15} /> Post my spot</a>}
                {cardHref && <a href={cardHref} download className="btn-base btn-small"><Download size={15} /> Image</a>}
                <button onClick={findMe} className="btn-base btn-small"><Crosshair size={15} /> Find me</button>
              </div>
            </Card>
          )}
          {!described && <Legend />}
        </aside>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 grid place-items-center text-center px-6 text-[var(--muted)] font-semibold pointer-events-none">{children}</div>;
}
function Card({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <section className={cn("border-2 rounded-[18px] bg-[var(--card)] p-3.5 shadow-[4px_4px_0_var(--shadow)]", accent ? "border-[var(--accent-text)]" : "border-[var(--ink)]")}>{children}</section>;
}
function Stats({ items }: { items: { v: string; k: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {items.map((s) => (
        <div key={s.k} className="rounded-xl bg-[var(--soft)] p-2">
          <div className="font-mono font-semibold text-[15px] tabular-nums truncate">{s.v}</div>
          <div className="text-[11px] text-[var(--muted)]">{s.k}</div>
        </div>
      ))}
    </div>
  );
}

function EventPanel({ graph, o, onPick }: { graph: EventGraph; o: NonNullable<ReturnType<PatchworkEngine["overview"]>>; onPick: (id: string) => void }) {
  const e = graph.event;
  return (
    <>
      <Card>
        <div className="flex items-center gap-3">
          <span className="w-[52px] h-[52px] flex-none rounded-[14px] border-2 border-[var(--ink)] bg-[var(--accent)] overflow-hidden shadow-[3px_3px_0_var(--shadow)] -rotate-6 grid place-items-center font-display font-extrabold text-2xl text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {e.banner ? <img src={e.banner} alt="" className="w-full h-full object-cover" /> : "p"}
          </span>
          <div className="min-w-0">
            <h2 className="font-display font-extrabold text-xl leading-tight tracking-tight m-0">{e.name}</h2>
            <div className="text-xs text-[var(--muted)]">{[e.city, e.startsAt ? new Date(e.startsAt).toLocaleDateString("en", { month: "short", day: "numeric" }) : null].filter(Boolean).join(" · ") || "Cars on the road"}</div>
          </div>
        </div>
        <Stats items={[{ v: String(o.creators), k: "creators" }, { v: String(o.spots), k: "spots" }, { v: String(o.brands), k: "brands" }]} />
        <Stats items={[{ v: usd(o.escrow), k: "in escrow" }, { v: String(o.bids), k: "bids" }, { v: String(o.spotters), k: "spotters" }]} />
        {e.id !== 0 && <Link href={`/e/${e.slug ?? e.id}`} className="btn-base btn-small mt-3 inline-flex"><ExternalLink size={14} /> Open event page</Link>}
      </Card>
      {o.top.length > 0 && (
        <Card>
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold m-0 mb-2">Most connected</h3>
          <ol className="list-none m-0 p-0">
            {o.top.map(({ n, d }, i) => (
              <li key={n.id}>
                <button onClick={() => onPick(n.id)} className="w-full grid grid-cols-[18px_28px_1fr_auto] items-center gap-2 py-1.5 text-left text-sm hover:bg-[var(--soft)] rounded-lg px-1">
                  <span className="font-mono text-[var(--muted)]">{i + 1}</span>
                  {n.kind === "brand" || n.kind === "holder" ? <Logo src={n.image} name={n.label} size={28} /> : <Avatar src={n.image} name={n.name} wallet={n.wallet} size={28} />}
                  <span className="truncate font-semibold">{n.name} <span className="font-normal text-[var(--muted)]">{ROLE_LABEL[n.kind]}</span></span>
                  <span className="font-mono tabular-nums">{d}</span>
                </button>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}

function Logo({ src, name, size }: { src: string | null; name: string; size: number }) {
  return (
    <span className="inline-grid place-items-center flex-none rounded-[9px] border-2 border-[var(--ink)] bg-[var(--card)] overflow-hidden shadow-[2px_2px_0_var(--shadow)] font-display font-extrabold text-[#0B0B0C]" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="w-full h-full object-contain p-0.5" /> : (name.replace(/^@/, "")[0] ?? "?").toUpperCase()}
    </span>
  );
}

function NodePanel({ d, explorer, onPick, onClose }: { d: Described; explorer: string; onPick: (id: string) => void; onClose: () => void }) {
  const n = d.node;
  const isBrand = n.kind === "brand" || n.kind === "holder";
  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          {n.kind === "event" ? null : n.kind === "spot" ? (
            <Logo src={d.leader?.image ?? null} name={d.leader?.label ?? n.label} size={46} />
          ) : isBrand ? (
            <Logo src={n.image} name={n.label} size={46} />
          ) : (
            <Avatar src={n.image} name={n.name} wallet={n.wallet} size={46} className="!border-2 !border-[var(--ink)] shadow-[3px_3px_0_var(--shadow)]" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-extrabold text-xl leading-tight tracking-tight m-0 flex items-center gap-1.5">
              <span className="truncate">{n.kind === "spot" ? n.label : n.name}</span>
              {n.verified && <BadgeCheck size={16} className="text-[var(--green)] flex-none" aria-label="Verified brand" />}
            </h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {n.kind === "spot" ? (
                <Pill>on {n.name.split(" on ").slice(1).join(" on ")}</Pill>
              ) : (
                n.roles.map((r) => <Pill key={r} you={false}>{ROLE_LABEL[r]}</Pill>)
              )}
              {n.wallet && <Pill mono>{formatShortAddress(n.wallet)}</Pill>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Back to the event" className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[var(--soft)] flex-none"><X size={16} /></button>
        </div>
        <Stats items={d.stats} />
        <div className="flex gap-2 mt-3 flex-wrap">
          {n.kind === "spot" && n.href && (
            <>
              <Link href={n.href} className="btn-base btn-primary btn-small"><Gavel size={15} /> {d.leader ? "Bid on this spot" : "Place a bid"}</Link>
            </>
          )}
          {n.kind !== "spot" && n.href && <Link href={n.href} className="btn-base btn-small"><ExternalLink size={14} /> {n.kind === "event" ? "Open event" : "View profile"}</Link>}
        </div>
      </Card>

      {n.kind === "spot" && n.tokenId && (
        <Card>
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold m-0 mb-2">The NFT</h3>
          <Link href={`/patch/${n.tokenId}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/patch/${n.tokenId}/card.png`} alt={`Patch NFT for ${n.label}`} loading="lazy" className="w-full aspect-square rounded-xl border-[1.5px] border-[var(--soft)] bg-[var(--soft)]" />
          </Link>
        </Card>
      )}

      {d.photos.length > 0 && (
        <Card>
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold m-0 mb-2">Spotted</h3>
          <div className="grid grid-cols-3 gap-2">
            {d.photos.slice(0, 6).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" loading="lazy" className="w-full aspect-square object-cover rounded-xl border-[1.5px] border-[var(--ink)]" />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold m-0 mb-2">Threads</h3>
        {d.rows.length ? (
          <div className="grid">
            {d.rows.map((r, i) => <ThreadRow key={i} r={r} onPick={onPick} />)}
          </div>
        ) : (
          <p className="m-0 text-sm text-[var(--muted)]">No threads yet.</p>
        )}
        {explorer && <p className="m-0 mt-2.5 text-xs text-[var(--muted)]">Every bid is a Monad transaction: tap the link to see it.</p>}
      </Card>
    </>
  );
}

function ThreadRow({ r, onPick }: { r: Row; onPick: (id: string) => void }) {
  const Icon = ROW_ICON[r.icon];
  return (
    <div className="grid grid-cols-[22px_1fr_auto] gap-2 items-center py-1.5 border-b border-[var(--soft)] last:border-0 text-[13px]">
      <Icon size={15} className="text-[var(--muted)]" />
      <button onClick={() => r.node && onPick(r.node)} className="text-left hover:underline min-w-0">{r.text}</button>
      <span className="flex items-center gap-1 font-mono font-semibold text-[13px]">{r.amount}<ExplorerLink tx={r.tx} /></span>
    </div>
  );
}

function Pill({ children, mono, you }: { children: React.ReactNode; mono?: boolean; you?: boolean }) {
  return <span className={cn("text-[11px] font-bold border-[1.5px] rounded-full px-2 py-px", you ? "border-[var(--accent-text)] text-[var(--accent-text)]" : "border-[var(--soft)]", mono && "font-mono font-medium")}>{children}</span>;
}

function Legend() {
  const sw = (svg: React.ReactNode) => <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden="true">{svg}</svg>;
  const items: [React.ReactNode, string][] = [
    [sw(<><path d="M2 7h30" stroke="var(--ink)" strokeWidth="2.5" /><circle cx="20" cy="7" r="2.4" fill="var(--accent)" /></>), "Brand leads a spot, USDC flowing to escrow"],
    [sw(<path d="M2 7h30" stroke="var(--accent-text)" strokeWidth="1.6" strokeDasharray="5 4" />), "Someone spotted a creator (on-chain)"],
    [sw(<path d="M2 5h30M2 9h30" stroke="var(--ink)" strokeWidth="1" />), "Team hoodie: paid together"],
    [sw(<path d="M2 7h30" stroke="var(--green)" strokeWidth="1.8" />), "Receipt held by a buyer from resale"],
    [sw(<rect x="10" y="1" width="12" height="12" rx="3" fill="var(--accent-soft)" stroke="var(--accent-text)" strokeDasharray="3 2" strokeWidth="1.5" />), "Open spot, nobody leads yet"],
  ];
  return (
    <Card>
      <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold m-0 mb-2">How to read it</h3>
      <div className="grid gap-2 text-[13px]">
        {items.map(([icon, text], i) => <div key={i} className="flex items-center gap-2.5">{icon}<span>{text}</span></div>)}
      </div>
    </Card>
  );
}
