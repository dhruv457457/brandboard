"use client";

import { useState } from "react";
import { keccak256 } from "viem";
import { CheckCircle2, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ipfsUrl, isIpfs } from "@/lib/ipfs";

export interface ProofRow {
  milestone: number;
  uri: string;
  cover: string;
  /** Unix seconds the proof was posted. */
  at: number;
  /** What the market stored on-chain: keccak256 of the exact proof record. */
  hash: string;
  /** The transaction that posted it, when known. */
  tx?: string;
}

type Check = { state: "idle" } | { state: "busy" } | { state: "match"; photos: string[]; note: string | null } | { state: "mismatch" } | { state: "error"; message: string };

/** Where a record's photo can be opened: an IPFS link through the gateway, or the https address older proofs stored. */
const photoSrc = (f: string) => (f.startsWith("ipfs://") ? ipfsUrl(f) : /^https:\/\//.test(f) ? f : null);

/** Proofs posted before IPFS pinning carry patched://proof/<chain>/<listing>/<milestone> instead of an ipfs:// link. */
function legacyKey(uri: string): { listingId: number; milestone: number } | null {
  const m = uri.match(/^patched:\/\/proof\/\d+\/(\d+)\/(\d+)$/);
  return m ? { listingId: Number(m[1]), milestone: Number(m[2]) } : null;
}

const day = (unix: number) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(unix * 1000));

/**
 * The check anyone can run: fetch the proof record from IPFS, hash its bytes in the browser, and compare with the hash
 * the market holds on-chain. A match means the photos shown are exactly what the creator committed to.
 */
export function VerifyProof({ proofs, explorer }: { proofs: ProofRow[]; explorer: string }) {
  const [checks, setChecks] = useState<Record<number, Check>>({});
  const set = (m: number, c: Check) => setChecks((x) => ({ ...x, [m]: c }));

  async function verify(p: ProofRow) {
    set(p.milestone, { state: "busy" });
    try {
      const legacy = legacyKey(p.uri);
      const url = legacy ? `/api/proofs/record?listingId=${legacy.listingId}&milestone=${legacy.milestone}` : ipfsUrl(p.uri);
      if (!url) throw new Error("This proof has no record to check.");
      const res = await fetch(url);
      if (!res.ok) throw new Error(legacy ? `Patched answered ${res.status}.` : `IPFS gateway answered ${res.status}.`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (keccak256(bytes).toLowerCase() !== p.hash.toLowerCase()) return set(p.milestone, { state: "mismatch" });
      const record = JSON.parse(new TextDecoder().decode(bytes)) as { files?: string[]; note?: string | null };
      set(p.milestone, { state: "match", photos: (record.files ?? []).map(photoSrc).filter(Boolean) as string[], note: record.note ?? null });
    } catch (err) {
      set(p.milestone, { state: "error", message: err instanceof Error ? err.message : "Couldn't check this proof." });
    }
  }

  if (proofs.length === 0) {
    return <p className="text-sm muted">No proof yet. When the creator posts photos, they are pinned to IPFS and their hash is written on-chain, and you can check them here.</p>;
  }

  return (
    <ul className="grid gap-3 list-none m-0 p-0">
      {proofs.map((p) => {
        const c = checks[p.milestone] ?? { state: "idle" };
        const onIpfs = isIpfs(p.uri);
        const checkable = onIpfs || !!legacyKey(p.uri);
        return (
          <li key={p.milestone} className="grid gap-2 rounded-2xl border-[1.5px] border-[var(--soft)] p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <b>Proof {p.milestone + 1}{p.at ? <span className="font-normal muted"> · {day(p.at)}</span> : null}</b>
              <span className="flex gap-3 text-sm">
                {onIpfs && <a className="underline inline-flex items-center gap-1" href={ipfsUrl(p.uri)!} target="_blank" rel="noreferrer">Record <ExternalLink size={12} /></a>}
                {p.tx && <a className="underline inline-flex items-center gap-1" href={`${explorer}/tx/${p.tx}`} target="_blank" rel="noreferrer">Transaction <ExternalLink size={12} /></a>}
              </span>
            </div>
            <p className="font-mono text-xs muted break-all">On-chain hash {p.hash}</p>

            {!onIpfs && <p className="text-sm muted">Posted before we pinned proofs to IPFS, so Patched holds this record. You can still check it: your browser hashes it and compares with the on-chain hash. Newer proofs are pinned to IPFS.</p>}
            {checkable && c.state === "idle" && (
              <Button size="small" onClick={() => verify(p)} className="justify-self-start"><ShieldCheck size={14} /> Check against the chain</Button>
            )}
            {c.state === "busy" && <p className="text-sm muted">Fetching the record and hashing it…</p>}
            {c.state === "match" && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-[var(--green)] inline-flex items-center gap-1.5"><CheckCircle2 size={16} /> Matches the on-chain proof{onIpfs ? "" : " (record held by Patched)"}</p>
                {c.note && <p className="text-sm">{c.note}</p>}
                <div className="flex gap-2 flex-wrap">
                  {c.photos.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" className="w-24 h-24 rounded-xl overflow-hidden border-2 border-[var(--line)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="Proof" className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {c.state === "mismatch" && <p className="text-sm font-semibold text-[#B42318] inline-flex items-center gap-1.5"><TriangleAlert size={16} /> The record does not match the hash on-chain.</p>}
            {c.state === "error" && (
              <p className="text-sm inline-flex items-center gap-2 flex-wrap"><TriangleAlert size={16} /> {c.message} <button className="underline" onClick={() => verify(p)}>Try again</button></p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
