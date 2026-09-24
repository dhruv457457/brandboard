import "server-only";

// Simple per-key daily limit to protect paid AI credit. In-memory: resets on redeploy, which is fine
// for a hackathon budget guard (not a security control).
const buckets = new Map<string, { day: string; count: number }>();

export function allow(key: string, perDay: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const b = buckets.get(key);
  if (!b || b.day !== day) {
    buckets.set(key, { day, count: 1 });
    return true;
  }
  if (b.count >= perDay) return false;
  b.count += 1;
  return true;
}

const windows = new Map<string, number[]>();

/** Sliding-window limit: at most `max` calls per `windowMs` for `key` (e.g. per IP). In-memory, per instance. */
export function allowRate(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    windows.set(key, recent);
    return false;
  }
  recent.push(now);
  windows.set(key, recent);
  if (windows.size > 5000) windows.clear();
  return true;
}
