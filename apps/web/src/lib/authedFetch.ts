"use client";

import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

/** fetch() that sends the Privy access token so server routes can verify who is calling. */
export function useAuthedFetch() {
  const { getAccessToken } = usePatchedAuth();
  return async (input: string, init: RequestInit = {}) => {
    const token = await getAccessToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
}
