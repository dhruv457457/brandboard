// Browser-safe IPFS helpers: turn ipfs:// links into gateway URLs the page can load.

const GATEWAY = (process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io").replace(/\/+$/, "").replace(/\/ipfs$/, "");

/** ipfs://<cid>[/path] -> https://<gateway>/ipfs/<cid>[/path]. Other links come back unchanged. */
export function ipfsUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return `${GATEWAY}/ipfs/${uri.slice("ipfs://".length)}`;
  return /^https?:\/\//.test(uri) ? uri : null;
}

export const isIpfs = (uri: string | null | undefined) => !!uri && uri.startsWith("ipfs://");
