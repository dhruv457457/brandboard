"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn, formatUsdc } from "@/lib/utils";
import { useKnockout } from "@/lib/useKnockout";

export interface PatchData {
  id: string | number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  rotation?: number;
  floor?: number | bigint;
  buy?: number | bigint;
  buyNow?: number | bigint;
  top?: number | bigint;
  topBid?: number | bigint;
  brand?: string | null;
  logo?: string | null;
  c?: "p1" | "p2" | "p3" | "p4" | "p5" | string;
  color?: "p1" | "p2" | "p3" | "p4" | "p5" | string;
  locked?: boolean;
  bought?: boolean;
  mine?: boolean;
  /** Spot number shown in the corner ("01"), matching the numbered list on the sponsor page. */
  number?: number;
}

export interface PatchHandle {
  ping: () => void;
  bump: () => void;
  shake: () => void;
  stamp: () => void;
  element: HTMLDivElement | null;
}

export interface PatchProps {
  patch: PatchData;
  mode?: "static" | "interactive" | "editable";
  selected?: boolean;
  preview?: boolean;
  /** Bidding is over: show the brand as ink printed on the fabric instead of a box on top of it, and hide unsold spots. */
  printed?: boolean;
  animDelay?: number;
  showPrices?: boolean;
  onClick?: () => void;
  /** Called with true when the pointer enters the patch and false when it leaves (mouse and pen only). */
  onHover?: (over: boolean) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown?: (e: React.PointerEvent<HTMLSpanElement>) => void;
  className?: string;
}

export const Patch = forwardRef<PatchHandle, PatchProps>(function Patch(
  {
    patch,
    mode = "static",
    selected = false,
    preview = false,
    printed = false,
    animDelay,
    showPrices = true,
    onClick,
    onHover,
    onPointerDown,
    onResizePointerDown,
    className,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [animClass, setAnimClass] = useState<string>("");
  const [showPing, setShowPing] = useState(false);
  const [stamped, setStamped] = useState(patch.locked || patch.bought || false);

  useImperativeHandle(ref, () => ({
    element: containerRef.current,
    ping: () => {
      setShowPing(true);
      setTimeout(() => setShowPing(false), 1200);
    },
    bump: () => {
      setAnimClass("");
      requestAnimationFrame(() => {
        setAnimClass("bump");
        setTimeout(() => setAnimClass(""), 600);
      });
    },
    shake: () => {
      setAnimClass("");
      requestAnimationFrame(() => {
        setAnimClass("shake");
        setTimeout(() => setAnimClass(""), 600);
      });
    },
    stamp: () => {
      setStamped(true);
    },
  }));

  // Printed: only the mark, without its flat background box (falls back to the original image if it can't be read).
  const knocked = useKnockout(printed ? patch.logo : null);
  const isFilled = Boolean(
    patch.brand ||
    (patch.top && Number(patch.top) > 0) ||
    (patch.topBid && Number(patch.topBid) > 0)
  );
  const isLocked = Boolean(patch.locked || patch.bought || stamped);
  const rot = patch.r ?? patch.rotation ?? 0;
  const pastelColor = patch.c || patch.color || "p1";
  const topVal = patch.top ? Number(patch.top) : patch.topBid ? Number(patch.topBid) : 0;
  const floorVal = patch.floor ? Number(patch.floor) : 0;

  if (printed && !isFilled) return null;
  // On a body the fabric curves away, so a print near a side is squeezed a little.
  const ry = Math.max(-26, Math.min(26, ((50 - (patch.x + patch.w / 2)) / 50) * 26));

  return (
    <>
      {showPing && (
        <div
          className="ping-ring"
          style={{
            left: `${patch.x}%`,
            top: `${patch.y}%`,
            width: `${patch.w}%`,
            height: `${patch.h}%`,
            transform: `rotate(${rot}deg)`,
          }}
          aria-hidden="true"
        />
      )}
      <div
        ref={containerRef}
        data-id={patch.id}
        onClick={onClick}
        onPointerEnter={onHover ? (e) => e.pointerType !== "touch" && onHover(true) : undefined}
        onPointerLeave={onHover ? () => onHover(false) : undefined}
        onPointerDown={onPointerDown}
        className={cn(
          "patch",
          isFilled ? "filled" : "open",
          isLocked && "locked",
          mode === "interactive" && !isLocked && "interactive",
          mode === "editable" && "cursor-grab touch-none",
          selected && !printed && "focus",
          preview && "preview",
          printed && "printed",
          animDelay != null && "drop",
          animDelay != null && isFilled && "sewn",
          animClass,
          className
        )}
        style={
          {
            left: `${patch.x}%`,
            top: `${patch.y}%`,
            width: `${patch.w}%`,
            height: `${patch.h}%`,
            "--r": `${rot}deg`,
            "--d": animDelay != null ? `${animDelay}s` : undefined,
            "--pc": `var(--${pastelColor})`,
            "--ry": `${ry.toFixed(1)}deg`,
          } as React.CSSProperties
        }
      >
        {!printed && patch.number != null && (
          <span
            aria-hidden="true"
            className={cn("absolute top-[2px] left-[4px] font-bold leading-none opacity-80", patch.logo && isFilled && "z-10 rounded bg-[var(--paper)]/80 px-0.5 text-[var(--ink)] opacity-100")}
            style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: "min(20cqh, 9cqw)" }}
          >
            {String(patch.number).padStart(2, "0")}
          </span>
        )}
        {isFilled ? (
          <>
            {patch.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={(printed && knocked) || patch.logo}
                alt={patch.brand || "Brand logo"}
                className={cn("absolute select-none pointer-events-none", printed ? "inset-0 w-full h-full object-contain" : "inset-[2px] w-[calc(100%-4px)] h-[calc(100%-4px)] rounded-[6px] object-cover")}
              />
            ) : (
              <span
                className="bn font-extrabold tracking-tight truncate max-w-[94%] leading-tight"
                style={{
                  fontFamily: "var(--font-bricolage), sans-serif",
                  fontSize: "min(34cqh, 15cqw)",
                }}
              >
                {patch.brand}
              </span>
            )}
            {showPrices && !printed && topVal > 0 && (
              <span
                className={cn(
                  "pr font-semibold mt-0.5 leading-none",
                  // On a logo the price sits on top of it, in a small pill, so the logo gets the whole patch.
                  patch.logo && "absolute bottom-[3px] left-1/2 -translate-x-1/2 z-10 mt-0 rounded-full bg-[var(--paper)]/90 px-1.5 py-[2px] text-[var(--ink)]",
                )}
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "min(24cqh, 11cqw)",
                }}
              >
                {formatUsdc(topVal)}
              </span>
            )}
          </>
        ) : (
          <>
            <span
              className="lab font-bold uppercase tracking-wider leading-tight"
              style={{ fontSize: "min(22cqh, 9cqw)" }}
            >
              {patch.name || "OPEN"}
            </span>
            {showPrices && (
              <span
                className="pr font-semibold mt-0.5 leading-none"
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "min(24cqh, 11cqw)",
                }}
              >
                {formatUsdc(floorVal)}+
              </span>
            )}
          </>
        )}

        {isLocked && !printed && <span className="stamp-sold">SOLD</span>}

        {mode === "editable" && (
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizePointerDown?.(e);
            }}
            className="absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 bg-[var(--accent)] border-2 border-[var(--ink)] rounded-sm cursor-nwse-resize z-20"
            aria-label="Resize handle"
          />
        )}
      </div>
    </>
  );
});
