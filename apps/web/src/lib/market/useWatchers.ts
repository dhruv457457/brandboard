"use client";

import { useEffect, useState } from "react";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * How many people have this listing open right now, through Supabase Realtime presence. Each tab joins
 * the listing's channel with a random key, so the count is open tabs, not wallets. 0 until connected.
 */
export function useWatchers(listingId: number): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const key = Math.random().toString(36).slice(2);
    const channel = supabase().channel(`watch:${CHAIN_ID}:${listingId}`, { config: { presence: { key } } });
    channel
      .on("presence", { event: "sync" }, () => setCount(Object.keys(channel.presenceState()).length))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [listingId]);

  return count;
}
