"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import { Patch, PatchData, PatchHandle } from "./Patch";

export type SurfaceType = "outfit" | "car" | "hoodie";

interface SurfaceFigureProps {
  surface: SurfaceType;
  patches: PatchData[];
  mode?: "static" | "interactive" | "editable";
  selectedId?: string | number | null;
  onSelect?: (id: string | number) => void;
  onUpdatePatches?: (patches: PatchData[]) => void;
  patchRefs?: React.MutableRefObject<Record<string | number, PatchHandle | null>>;
  previewId?: string | number | null;
  showPrices?: boolean;
  animateDrop?: boolean;
  className?: string;
}

const STROKE_INK = "rgba(20,20,20,.55)";

function Wheel({ cx, cy }: { cx: number; cy: number }) {
  const spokes = [];
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    spokes.push(
      <path
        key={i}
        d={`M${cx} ${cy}L${(cx + 23 * Math.cos(a)).toFixed(1)} ${(cy + 23 * Math.sin(a)).toFixed(1)}`}
        stroke="#8a8a8a"
        strokeWidth="6"
        strokeLinecap="round"
      />
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r="40" fill="#161616" />
      <circle cx={cx} cy={cy} r="33" fill="#222222" />
      <circle cx={cx} cy={cy} r="26" fill="url(#gRim)" stroke="#6b6b6b" />
      {spokes}
      <circle cx={cx} cy={cy} r="7" fill="#4a4a4a" />
    </g>
  );
}

function OutfitSVG() {
  return (
    <svg viewBox="0 0 300 520" className="w-full h-full select-none" aria-hidden="true">
      <ellipse cx="150" cy="502" rx="100" ry="8" fill="rgba(0,0,0,.25)" filter="url(#fBlur)" />
      <path d="M122 50C110 72 108 112 114 146L186 146C192 112 190 72 178 50Z" fill="url(#gHair)" />
      <path d="M103 110C92 116 87 138 85 170C83 202 83 232 85 258C86 270 97 270 99 258C101 230 103 200 107 172C110 150 113 132 115 122Z" fill="url(#gSkin)" />
      <path d="M197 110C208 116 213 138 215 170C217 202 217 232 215 258C214 270 203 270 201 258C199 230 197 200 193 172C190 150 187 132 185 122Z" fill="url(#gSkin)" />
      <ellipse cx="92" cy="266" rx="7" ry="10" fill="#D29C76" />
      <ellipse cx="208" cy="266" rx="7" ry="10" fill="#C98F68" />
      <path d="M139 74L161 74L163 106L137 106Z" fill="url(#gSkin)" />
      <path d="M100 114C112 102 130 99 150 99C170 99 188 102 200 114L203 128L97 128Z" fill="url(#gSkin)" />
      <path d="M138 101Q150 109 162 101" stroke="rgba(90,50,30,.25)" strokeWidth="3" fill="none" />
      <ellipse cx="150" cy="50" rx="22" ry="27" fill="url(#gSkin)" />
      <ellipse cx="160" cy="56" rx="9" ry="15" fill="rgba(120,70,40,.12)" />
      <path d="M127 55C121 25 146 15 166 21C182 27 182 47 176 61C172 43 152 35 134 45C131 49 129 52 127 55Z" fill="url(#gHair)" />
      <path d="M128 48C120 76 118 104 124 128L132 122C128 100 129 76 134 54Z" fill="url(#gHair)" />
      <path
        d="M105 120C124 111 176 111 195 120L189 200C205 282 232 402 246 496C200 508 100 508 54 496C68 402 95 282 111 200Z"
        fill="url(#gDress)"
        stroke={STROKE_INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M108 121C126 113 174 113 192 121" stroke="#FFFFFF" strokeWidth="2" fill="none" />
      <path d="M132 124C134 150 136 176 138 202M168 124C166 150 164 176 162 202" stroke="rgba(0,0,0,.07)" strokeWidth="1.2" fill="none" />
      <path d="M111 200C135 208 165 208 189 200" stroke="rgba(0,0,0,.2)" strokeWidth="1.4" fill="none" />
      <g filter="url(#fSoft)" stroke="rgba(0,0,0,.1)" strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M150 214C148 310 144 410 142 494" />
        <path d="M126 222C114 320 98 420 82 492" />
        <path d="M174 222C186 320 202 420 218 492" />
        <path d="M112 300C100 380 86 440 72 490" />
        <path d="M188 300C200 380 214 440 228 490" />
      </g>
      <g stroke="rgba(255,255,255,.95)" strokeWidth="2" fill="none">
        <path d="M138 220C132 320 124 420 116 496" />
        <path d="M162 220C168 320 176 420 184 496" />
      </g>
      <path d="M54 496C80 490 100 502 126 496C150 490 170 502 196 496C220 490 236 500 246 496" stroke="rgba(0,0,0,.25)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function CarSVG() {
  return (
    <svg viewBox="0 0 520 260" className="w-full h-full select-none" aria-hidden="true">
      <ellipse cx="262" cy="244" rx="236" ry="9" fill="rgba(0,0,0,.28)" filter="url(#fBlur)" />
      <path
        d="M34 190C30 172 34 158 48 150C70 140 110 134 140 132L186 94C200 82 214 78 236 77L330 77C356 78 374 86 392 100L428 128C462 132 484 140 492 156C498 168 498 182 494 192C492 200 486 204 476 204L448 204C446 176 426 156 400 156C374 156 354 176 352 204L178 204C176 176 154 156 128 156C102 156 80 176 78 204L46 204C38 204 35 198 34 190Z"
        fill="url(#gCar)"
        stroke={STROKE_INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M194 98C204 90 216 86 234 86L278 86L278 128L154 130Z" fill="url(#gGlass)" />
      <path d="M288 86L328 86C350 87 364 94 378 106L398 126L288 128Z" fill="url(#gGlass)" />
      <path d="M200 96L236 90L230 104Z" fill="rgba(255,255,255,.18)" />
      <path d="M300 90L330 90L318 104Z" fill="rgba(255,255,255,.14)" />
      <path d="M150 134L420 132" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M150 134L148 198M283 130L283 204M352 132L354 168" stroke="rgba(0,0,0,.22)" strokeWidth="1.4" />
      <rect x="236" y="144" width="20" height="5" rx="2.5" fill="#CFCAC0" stroke="rgba(0,0,0,.3)" />
      <rect x="318" y="144" width="20" height="5" rx="2.5" fill="#CFCAC0" stroke="rgba(0,0,0,.3)" />
      <path d="M160 118C168 112 178 112 182 118L180 128L162 128Z" fill="#E8E5DD" stroke={STROKE_INK} />
      <path d="M40 158C48 152 64 150 78 152L74 163C60 163 48 165 40 167Z" fill="#F7F4EA" stroke={STROKE_INK} />
      <path d="M486 148L495 156L495 172L484 168Z" fill="#D64545" stroke={STROKE_INK} />
      <path d="M80 196L176 196M180 196L350 196M450 196L490 194" stroke="rgba(0,0,0,.14)" strokeWidth="3" />
      <Wheel cx={128} cy={204} />
      <Wheel cx={400} cy={204} />
    </svg>
  );
}

function HoodieSVG() {
  const ribs = [];
  for (let x = 110; x <= 310; x += 8) {
    ribs.push(`M${x} 398V424`);
  }
  return (
    <svg viewBox="0 0 420 460" className="w-full h-full select-none" aria-hidden="true">
      <ellipse cx="210" cy="440" rx="170" ry="8" fill="rgba(0,0,0,.22)" filter="url(#fBlur)" />
      <path
        d="M128 70C150 60 170 56 210 56C250 56 270 60 292 70L352 104C366 112 374 124 378 140L406 300C408 312 402 320 390 322L360 326C350 327 344 322 342 312L318 200L318 408C318 420 310 426 298 426L122 426C110 426 102 420 102 408L102 200L78 312C76 322 70 327 60 326L30 322C18 320 12 312 14 300L42 140C46 124 54 112 68 104Z"
        fill="url(#gFab)"
        stroke={STROKE_INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <g filter="url(#fSoft)" stroke="rgba(0,0,0,.08)" strokeWidth="6" fill="none">
        <path d="M160 200C156 260 158 320 162 390" />
        <path d="M262 200C266 260 264 320 258 390" />
        <path d="M60 170C52 220 46 260 40 300" />
        <path d="M360 170C368 220 374 260 380 300" />
      </g>
      <path d="M150 66L102 200M270 66L318 200" stroke="rgba(0,0,0,.14)" strokeWidth="1.3" strokeDasharray="3 3" />
      <path d="M16 290L80 300L78 312C76 322 70 327 60 326L30 322C18 320 12 312 14 300Z" fill="#E4E1D9" stroke={STROKE_INK} />
      <path d="M404 290L340 300L342 312C344 322 350 327 360 326L390 322C402 320 408 312 406 300Z" fill="#E4E1D9" stroke={STROKE_INK} />
      <path d="M102 396L318 396L318 408C318 420 310 426 298 426L122 426C110 426 102 420 102 408Z" fill="#E4E1D9" stroke={STROKE_INK} />
      <path d={ribs.join(" ")} stroke="rgba(0,0,0,.07)" />
      <path d="M140 302L280 302L298 388L122 388Z" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="1.3" strokeDasharray="4 3" />
      <path d="M150 66C150 24 180 8 210 8C240 8 270 24 270 66C258 90 236 100 210 100C184 100 162 90 150 66Z" fill="url(#gFab)" stroke={STROKE_INK} strokeWidth="1.2" />
      <path d="M168 70C170 40 188 28 210 28C232 28 250 40 252 70C240 84 226 90 210 90C194 90 180 84 168 70Z" fill="#CFCBC2" />
      <path d="M196 92C194 118 193 140 192 160M224 92C226 118 227 140 228 160" stroke="#D2CEC5" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="189" y="158" width="6" height="12" rx="2" fill="#9A958B" />
      <rect x="225" y="158" width="6" height="12" rx="2" fill="#9A958B" />
    </svg>
  );
}

export function SurfaceFigure({
  surface,
  patches,
  mode = "static",
  selectedId,
  onSelect,
  onUpdatePatches,
  patchRefs,
  previewId,
  showPrices = true,
  animateDrop = false,
  className,
}: SurfaceFigureProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const aspectRatioClass =
    surface === "outfit"
      ? "aspect-[300/520]"
      : surface === "car"
      ? "aspect-[520/260]"
      : "aspect-[420/460]";

  const handlePointerDown = (
    e: React.PointerEvent<HTMLElement>,
    targetPatch: PatchData,
    resize: boolean
  ) => {
    if (mode !== "editable" || !onUpdatePatches) return;
    e.preventDefault();
    onSelect?.(targetPatch.id);

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = targetPatch.x;
    const origY = targetPatch.y;
    const origW = targetPatch.w;
    const origH = targetPatch.h;

    const handlePointerMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;

      const updated = patches.map((p) => {
        if (p.id !== targetPatch.id) return p;
        if (resize) {
          const w = Math.max(6, Math.min(100 - origX, origW + dx));
          const h = Math.max(3, Math.min(100 - origY, origH + dy));
          return { ...p, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
        } else {
          const x = Math.max(0, Math.min(100 - origW, origX + dx));
          const y = Math.max(0, Math.min(100 - origH, origY + dy));
          return { ...p, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        }
      });

      onUpdatePatches(updated);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full max-w-full overflow-hidden select-none", aspectRatioClass, className)}
    >
      {surface === "outfit" && <OutfitSVG />}
      {surface === "car" && <CarSVG />}
      {surface === "hoodie" && <HoodieSVG />}

      {/* Absolutely positioned patch layer */}
      <div className="absolute inset-0">
        {patches.map((p, idx) => (
          <Patch
            key={p.id}
            ref={(el) => {
              if (patchRefs) {
                patchRefs.current[p.id] = el;
              }
            }}
            patch={p}
            mode={mode}
            selected={selectedId === p.id}
            preview={previewId === p.id}
            animDelay={animateDrop ? 0.15 + idx * 0.08 : undefined}
            showPrices={showPrices}
            onClick={() => onSelect?.(p.id)}
            onPointerDown={(e) => handlePointerDown(e, p, false)}
            onResizePointerDown={(e) => handlePointerDown(e, p, true)}
          />
        ))}
      </div>
    </div>
  );
}
