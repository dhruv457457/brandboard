/**
 * Utilities for formatting currency, time, addresses, and countdowns.
 * USDC uses 6 decimals on Monad (1 USDC = 1_000_000 units).
 */

export function formatUsdc(amount: bigint | number | undefined | null): string {
  if (amount === undefined || amount === null) return "$0";
  const num = typeof amount === "bigint" ? Number(amount) / 1e6 : Number(amount);
  if (isNaN(num)) return "$0";
  if (num % 1 === 0) {
    return "$" + Math.round(num).toLocaleString("en-US");
  }
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseUsdc(input: string | number): bigint {
  if (typeof input === "number") {
    return BigInt(Math.round(input * 1e6));
  }
  const clean = input.replace(/[^0-9.]/g, "");
  const num = parseFloat(clean);
  if (isNaN(num) || num <= 0) return 0n;
  return BigInt(Math.round(num * 1e6));
}

export function toBigIntUsdc(val: number | bigint): bigint {
  return typeof val === "bigint" ? val : BigInt(Math.round(val * 1e6));
}

export function toNumericUsdc(val: bigint | number): number {
  return typeof val === "bigint" ? Number(val) / 1e6 : val;
}

export function formatCountdown(target: number | Date | undefined | null): {
  text: string;
  isUrgent: boolean; // less than 1 hour left
  hasEnded: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  if (!target) {
    return { text: "—", isUrgent: false, hasEnded: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const targetMs = typeof target === "number" ? (target < 1e11 ? target * 1000 : target) : target.getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((targetMs - now) / 1000));

  if (diffSec <= 0) {
    return { text: "Ended", isUrgent: false, hasEnded: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  let s = diffSec;
  const days = Math.floor(s / 86400);
  s %= 86400;
  const hours = Math.floor(s / 3600);
  s %= 3600;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const isUrgent = diffSec < 3600; // less than 1 hour

  let text: string;
  if (days > 0) {
    text = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  } else {
    text = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return { text, isUrgent, hasEnded: false, days, hours, minutes, seconds };
}

export function formatShortAddress(address: string | undefined | null): string {
  if (!address) return "0x0000...0000";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimeAgo(time: number | Date | string): string {
  if (typeof time === "string" && !isNaN(Number(time))) {
    time = Number(time);
  }
  const timestamp = typeof time === "string" ? new Date(time).getTime() : typeof time === "number" ? (time < 1e11 ? time * 1000 : time) : time.getTime();
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
