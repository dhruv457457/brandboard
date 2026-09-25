"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Gavel, Shirt } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/Toast";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { isListingPage } from "./BottomNav";

type Role = "creator" | "brand" | "browse";

/**
 * After someone's first sign-in, one question: creator or brand? It sends each to the right place. The answer
 * is a convenience kept in this browser only; either path stays open from the navigation.
 */
export function RoleWelcome() {
  const { authenticated, walletAddress } = usePatchedAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const key = walletAddress ? `patched.role.${walletAddress.toLowerCase()}` : null;

  useEffect(() => {
    if (!authenticated || !key) return;
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      /* storage blocked: skip the question */
    }
  }, [authenticated, key]);

  function pick(role: Role) {
    try {
      if (key) localStorage.setItem(key, role);
    } catch {
      /* storage blocked */
    }
    setOpen(false);
    if (role === "creator") router.push("/studio");
    if (role === "brand") {
      // Someone who signed in to bid on a listing stays on it.
      if (!isListingPage(pathname)) router.push("/explore");
      toast("Add your brand name and logo on My bids, so they show on the spots you win.", {
        action: { label: "Set up brand", onClick: () => router.push("/bids") },
      });
    }
  }

  const card = "w-full text-left rounded-2xl border-2 border-[var(--line)] bg-[var(--card)] p-4 flex gap-3 items-start shadow-[3px_3px_0_var(--shadow)] hover:bg-[var(--soft)]";
  return (
    <Sheet open={open} onClose={() => pick("browse")} title="What brings you to Patched?" description="Pick one to get started. You can do both any time.">
      <div className="grid gap-3">
        <button className={card} onClick={() => pick("creator")}>
          <span className="w-10 h-10 rounded-xl grid place-items-center bg-[var(--accent)] text-[var(--on-accent)] border-2 border-[var(--line)] flex-none"><Shirt size={20} /></span>
          <span>
            <b className="block text-lg">I&apos;m a creator</b>
            <span className="text-sm text-[var(--muted)]">Sell logo spots on my outfit, car or team hoodie, and get paid when I show up.</span>
          </span>
        </button>
        <button className={card} onClick={() => pick("brand")}>
          <span className="w-10 h-10 rounded-xl grid place-items-center bg-[var(--p3)] text-[#0B0B0C] border-2 border-[var(--line)] flex-none"><Gavel size={20} /></span>
          <span>
            <b className="block text-lg">I&apos;m a brand</b>
            <span className="text-sm text-[var(--muted)]">Bid on spots in USDC. Money waits in escrow until the creator delivers.</span>
          </span>
        </button>
        <button className="btn-base btn-ghost btn-small justify-self-center" onClick={() => pick("browse")}>Just looking</button>
      </div>
    </Sheet>
  );
}
