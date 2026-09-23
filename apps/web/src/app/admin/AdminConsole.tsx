"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { encodeFunctionData, keccak256, stringToHex, toBytes } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/components/ui/Toast";
import { ListingCardView } from "@/components/market/ListingCardView";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { MARKET, publicClient } from "@/lib/config";
import { fromWire, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";
import { friendlyError } from "@/lib/market/useBid";
import { useTx } from "@/lib/market/useTx";

export interface AdminEvent {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

const ADMIN_ROLE = keccak256(toBytes("ADMIN_ROLE"));

export function AdminConsole({ pending: wire, events }: { pending: Wire<ListingCard[]>; events: AdminEvent[] }) {
  const pending = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const router = useRouter();
  const { walletAddress, authenticated, login, ready } = usePatchedAuth();
  const send = useTx();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({ name: "", start: "", end: "" });

  useEffect(() => {
    if (!walletAddress) return setIsAdmin(null);
    publicClient
      .readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "hasRole", args: [ADMIN_ROLE, walletAddress] })
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, [walletAddress]);

  async function run(key: string, label: string, data: `0x${string}`) {
    setBusy(key);
    try {
      await send(MARKET, data);
      await fetch("/api/indexer/sync", { method: "POST" });
      toast(label);
      router.refresh();
    } catch (err) {
      toast(friendlyError(err).replace("The bid didn't", "That didn't"));
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;
  if (!authenticated) {
    return (
      <main className="wrap pt-10 pb-24"><Card className="p-8 text-center grid gap-3 justify-items-center">
        <h1 className="text-3xl font-extrabold">Admin console</h1>
        <p className="muted">Sign in with an admin wallet to review listings.</p>
        <Button variant="primary" onClick={login}>Sign in</Button>
      </Card></main>
    );
  }
  if (isAdmin === false) {
    return (
      <main className="wrap pt-10 pb-24"><Card className="p-8 text-center">
        <h1 className="text-3xl font-extrabold">Admins only</h1>
        <p className="muted mt-2">This wallet doesn&apos;t have the admin role on the Patched contract.</p>
      </Card></main>
    );
  }

  return (
    <main className="wrap pt-8 pb-24 grid gap-10">
      <section>
        <span className="eyebrow">Admin console</span>
        <h1 className="font-extrabold text-4xl tracking-tight mt-1 mb-5">Waiting for approval</h1>
        {pending.length === 0 ? (
          <Card className="p-6"><p className="muted">No listings are waiting. New listings show up here within a few seconds of being published.</p></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pending.map((c) => (
              <div key={c.id} className="grid gap-2.5">
                <ListingCardView card={c} mounted />
                <div className="flex gap-2">
                  <Button variant="primary" size="small" disabled={!!busy}
                    onClick={() => run(`a${c.id}`, `Listing #${c.id} is live.`, encodeFunctionData({ abi: patchedMarketAbi, functionName: "approveListing", args: [BigInt(c.id)] }))}>
                    {busy === `a${c.id}` ? "Approving…" : "Approve"}
                  </Button>
                  <Button variant="ghost" size="small" disabled={!!busy}
                    onClick={() => run(`r${c.id}`, `Listing #${c.id} rejected. The bond went back to the creator.`, encodeFunctionData({ abi: patchedMarketAbi, functionName: "rejectListing", args: [BigInt(c.id), 1] }))}>
                    {busy === `r${c.id}` ? "Rejecting…" : "Reject"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-extrabold text-3xl tracking-tight mb-4">Events</h2>
        <Card className="p-4 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] items-end mb-4">
          <label className="grid gap-1"><span className="field-label">Name (max 31 characters)</span>
            <input className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]" maxLength={31} value={eventForm.name}
              placeholder="Devcon 8" onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} /></label>
          <label className="grid gap-1"><span className="field-label">Starts</span>
            <input type="date" className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]" value={eventForm.start}
              onChange={(e) => setEventForm({ ...eventForm, start: e.target.value })} /></label>
          <label className="grid gap-1"><span className="field-label">Ends</span>
            <input type="date" className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]" value={eventForm.end}
              onChange={(e) => setEventForm({ ...eventForm, end: e.target.value })} /></label>
          <Button variant="primary" disabled={!!busy || !eventForm.name || !eventForm.start || !eventForm.end}
            onClick={() => {
              const s = Math.floor(new Date(eventForm.start).getTime() / 1000);
              const e = Math.floor(new Date(eventForm.end).getTime() / 1000) + 86_399;
              if (e <= s) return toast("The end date has to be after the start date.");
              run("event", `${eventForm.name} created.`, encodeFunctionData({
                abi: patchedMarketAbi, functionName: "createEvent", args: [stringToHex(eventForm.name, { size: 32 }), s, e],
              })).then(() => setEventForm({ name: "", start: "", end: "" }));
            }}>
            {busy === "event" ? "Creating…" : "Create event"}
          </Button>
        </Card>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <th className="p-3 border-b-2 border-[var(--line)]">#</th><th className="p-3 border-b-2 border-[var(--line)]">Event</th>
              <th className="p-3 border-b-2 border-[var(--line)]">Dates</th><th className="p-3 border-b-2 border-[var(--line)]">Status</th>
            </tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-[var(--soft)]">
                  <td className="p-3 font-mono">{e.id}</td>
                  <td className="p-3 font-semibold">{e.name}</td>
                  <td className="p-3 font-mono text-xs">{e.startsAt.slice(0, 10)} → {e.endsAt.slice(0, 10)}</td>
                  <td className="p-3">{e.active ? <Pill variant="top">Accepting listings</Pill> : <Pill variant="wait">Closed</Pill>}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td className="p-3 muted" colSpan={4}>No events yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>
    </main>
  );
}
