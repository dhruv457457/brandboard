"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { shrinkImage } from "@/lib/shrinkImage";

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
    if (input !== "/api/uploads" || !(init.body instanceof FormData)) return fetch(input, { ...init, headers });

    // Uploads: shrink a big photo first, and turn the host's non-JSON refusals into the { error } the callers read.
    const form = init.body;
    const file = form.get("file");
    if (file instanceof File) form.set("file", await shrinkImage(file, String(form.get("bucket") ?? "")));
    const res = await fetch(input, { ...init, headers, body: form });
    if (res.status === 413) return Response.json({ error: "That file is too big. Try a smaller photo." }, { status: 413 });
    if (!res.ok && !(res.headers.get("content-type") ?? "").includes("json")) return Response.json({ error: "Upload failed. Try again." }, { status: res.status });
    return res;
  }, []);
}
