"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";

export interface Profile {
  id: string;
  wallet: string | null;
  handle: string | null;
  display_name: string | null;
  x_handle: string | null;
  x_verified: boolean;
  avatar_url: string | null;
  banner_color: string | null;
  bio: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_website: string | null;
  brand_verified_domain: string | null;
  is_admin: boolean;
}

interface ProfileContext {
  profile: Profile | null;
  /** True once the profile came from the server this visit. Before that it may be the copy remembered on this device. */
  fresh: boolean;
  save: (patch: Record<string, string | null>) => Promise<string | null>;
  reload: () => void;
}

const Ctx = createContext<ProfileContext>({ profile: null, fresh: false, save: async () => "Not signed in", reload: () => {} });
export const useProfile = () => useContext(Ctx);

const KEY = "patched.profile";
const remembered = (wallet?: string | null): Profile | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { wallet: string; profile: Profile } | null;
    return raw && wallet && raw.wallet === wallet.toLowerCase() ? raw.profile : null;
  } catch {
    return null;
  }
};
const remember = (wallet: string | null | undefined, profile: Profile) => {
  try {
    if (wallet) localStorage.setItem(KEY, JSON.stringify({ wallet: wallet.toLowerCase(), profile }));
  } catch {
    /* storage blocked: the profile just loads the normal way */
  }
};
const forget = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

/** Loads (and on first sign-in creates) the signed-in user's profile. */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, walletAddress, ready } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fresh, setFresh] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!authenticated) {
      // Only a real sign-out forgets the profile: while Privy restores the session it also says "not signed in".
      if (ready) forget();
      setFresh(false);
      return setProfile(null);
    }
    // Show the last profile we saw for this wallet straight away (the call below takes a second or more, and the
    // sidebar and avatars wait on it), then replace it with the fresh one.
    const cached = remembered(walletAddress);
    if (cached) setProfile((cur) => cur ?? cached);
    let alive = true;
    authedFetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!alive || !p) return;
        setProfile(p);
        setFresh(true);
        remember(walletAddress, p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, walletAddress, tick, ready]);

  const save = useCallback(
    async (patch: Record<string, string | null>) => {
      const res = await authedFetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) return (json.error as string) ?? "Couldn't save.";
      setProfile(json);
      setFresh(true);
      remember(walletAddress, json);
      return null;
    },
    [authedFetch, walletAddress],
  );

  return <Ctx.Provider value={{ profile, fresh, save, reload: () => setTick((t) => t + 1) }}>{children}</Ctx.Provider>;
}
