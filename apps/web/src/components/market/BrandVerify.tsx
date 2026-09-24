"use client";

import { useState } from "react";
import { BadgeCheck, Mail } from "lucide-react";
import { useLinkAccount } from "@privy-io/react-auth";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { useProfile } from "@/lib/profile";
import { useAuthedFetch } from "@/lib/authedFetch";
import { websiteDomain } from "@/lib/brandDomain";

/**
 * "Verified brand" through Privy: link a work email (Privy sends a one-time code), and if its domain matches
 * the saved brand website the server marks the brand verified. The badge always names the domain.
 */
export function BrandVerify() {
  const { profile, reload } = useProfile();
  const authedFetch = useAuthedFetch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const site = websiteDomain(profile?.brand_website);

  async function verify(): Promise<{ needsEmail?: boolean }> {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch("/api/profile/verify-brand", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; domain?: string; error?: string; needsEmail?: boolean };
      if (!res.ok) {
        setError(body.error ?? "Couldn't verify right now.");
        return { needsEmail: body.needsEmail };
      }
      toast(`Verified. Your patches now show a badge for ${body.domain}.`);
      reload();
      return {};
    } catch {
      setError("Couldn't verify right now.");
      return {};
    } finally {
      setBusy(false);
    }
  }

  const { linkEmail } = useLinkAccount({ onSuccess: () => void verify() });

  if (!profile) return null;
  if (profile.brand_verified_domain) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--green)] bg-[var(--green-soft)] rounded-xl px-3 py-2">
        <BadgeCheck size={16} /> Verified · {profile.brand_verified_domain}
      </p>
    );
  }

  return (
    <div className="grid gap-2 rounded-xl border-[1.5px] border-[var(--soft)] p-3">
      <p className="text-sm">
        <b>Get a Verified badge.</b>{" "}
        {site ? `Confirm an email on ${site} so brands can't be impersonated.` : "Save your website first, then confirm a work email on it."}
      </p>
      {error && <p className="text-xs text-[var(--red)]" role="alert">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button size="small" disabled={!site || busy} onClick={async () => { const r = await verify(); if (r.needsEmail) linkEmail(); }}>
          <BadgeCheck size={14} /> {busy ? "Checking…" : "Verify brand"}
        </Button>
        <Button size="small" variant="ghost" disabled={!site || busy} onClick={() => linkEmail()}>
          <Mail size={14} /> Link a work email
        </Button>
      </div>
    </div>
  );
}
