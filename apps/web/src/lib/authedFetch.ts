"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

/**
 * fetch() that sends the Privy access token so server routes can verify who is calling. The returned function never
 * changes, so it is safe in effect and callback dependencies. (Privy hands out a new getAccessToken on most renders;
 * depending on it directly made every effect that used this hook re-fire, which showed up as the same API call being
 * made three or four times per page.) The latest getAccessToken is read from a ref when the request is made.
 */
export function useAuthedFetch() {
  const { getAccessToken } = usePatchedAuth();
  const latest = useRef(getAccessToken);
  useEffect(() => {
    latest.current = getAccessToken;
  }, [getAccessToken]);
  return useCallback(async (input: string, init: RequestInit = {}) => {
    const token = await latest.current();
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, []);
}
