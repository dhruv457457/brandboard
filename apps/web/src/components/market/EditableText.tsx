"use client";

import { cn } from "@/lib/utils";

interface Props {
  editing: boolean;
  /** The creator's text, or undefined to show the default. */
  value: string | undefined;
  /** What shows when the creator hasn't written anything (also the input placeholder). */
  fallback: string;
  onChange: (v: string) => void;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  multiline?: boolean;
  maxLength?: number;
  className?: string;
}

/**
 * Text on the sponsor page that its creator can rewrite in place. Reading: the creator's text or the default.
 * Editing: the same typography as an input with a dashed outline; clearing it brings the default back.
 */
export function EditableText({ editing, value, fallback, onChange, as: Tag = "p", multiline, maxLength = 200, className }: Props) {
  if (!editing) return <Tag className={cn(multiline && "whitespace-pre-line", className)}>{value || fallback}</Tag>;
  const shared = cn(
    "w-full bg-transparent rounded-lg outline-2 outline-dashed outline-[var(--accent)]/70 outline-offset-4 focus:outline-solid focus:outline-[var(--accent)] placeholder:text-[var(--muted)]/60",
    className,
  );
  return multiline ? (
    <textarea
      className={cn(shared, "resize-y min-h-[4.5em] font-[inherit]")}
      value={value ?? ""}
      placeholder={fallback}
      maxLength={maxLength}
      rows={Math.min(8, Math.max(2, Math.ceil((value || fallback).length / 70)))}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <input className={shared} value={value ?? ""} placeholder={fallback} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
  );
}
