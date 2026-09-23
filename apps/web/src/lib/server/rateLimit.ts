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
