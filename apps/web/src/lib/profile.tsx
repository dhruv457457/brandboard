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
  is_admin: boolean;
}

interface ProfileContext {
  profile: Profile | null;
  save: (patch: Record<string, string | null>) => Promise<string | null>;
  reload: () => void;
}

const Ctx = createContext<ProfileContext>({ profile: null, save: async () => "Not signed in", reload: () => {} });
export const useProfile = () => useContext(Ctx);

/** Loads (and on first sign-in creates) the signed-in user's profile. */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!authenticated) return setProfile(null);
    let alive = true;
    authedFetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => alive && setProfile(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, walletAddress, tick]);

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
      return null;
    },
    [authedFetch],
  );

  return <Ctx.Provider value={{ profile, save, reload: () => setTick((t) => t + 1) }}>{children}</Ctx.Provider>;
}
