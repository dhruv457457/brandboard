"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn, formatUsdc } from "@/lib/utils";

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
  animDelay?: number;
  showPrices?: boolean;
  onClick?: () => void;
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
    animDelay,
    showPrices = true,
    onClick,
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
        onPointerDown={onPointerDown}
        className={cn(
          "patch",
          isFilled ? "filled" : "open",
          isLocked && "locked",
          mode === "interactive" && !isLocked && "interactive",
          mode === "editable" && "cursor-grab touch-none",
          selected && "focus",
          preview && "preview",
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
          } as React.CSSProperties
        }
      >
        {isFilled ? (
          <>
            {patch.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={patch.logo}
                alt={patch.brand || "Brand logo"}
                className="max-w-[80%] max-h-[58%] object-contain select-none pointer-events-none"
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
            {showPrices && topVal > 0 && (
              <span
                className="pr font-semibold mt-0.5 leading-none"
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

        {isLocked && <span className="stamp-sold">SOLD</span>}

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
