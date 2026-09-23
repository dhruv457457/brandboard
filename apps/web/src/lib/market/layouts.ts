// Default patch positions per surface (from the approved prototype). Used when a listing's metadata
// has no positions, and as the "AI suggest layout" starting point in the studio.
import type { SurfaceKind } from "./types";

export interface Slot {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

export const DEFAULT_LAYOUTS: Record<SurfaceKind, Slot[]> = {
  outfit: [
    { name: "Neckline", x: 38, y: 24.5, w: 24, h: 7, r: -2 },
    { name: "Waist belt", x: 39, y: 37.6, w: 22, h: 4.6, r: 1.5 },
    { name: "Skirt center", x: 40, y: 57, w: 20, h: 11, r: -1.5 },
    { name: "Left hip", x: 36, y: 44, w: 13, h: 8, r: -3 },
    { name: "Right hip", x: 51, y: 44, w: 13, h: 8, r: 2 },
    { name: "Hem left", x: 27, y: 78, w: 19, h: 9, r: -2.5 },
    { name: "Hem right", x: 54, y: 78, w: 19, h: 9, r: 3 },
  ],
  car: [
    { name: "Front door", x: 34, y: 53, w: 19, h: 19, r: -1 },
    { name: "Rear door", x: 55.5, y: 53, w: 11.5, h: 19, r: 1 },
    { name: "Front fender", x: 11, y: 56, w: 12, h: 5.5 },
    { name: "Rear quarter", x: 71, y: 52.5, w: 18, h: 6 },
    { name: "Rear window", x: 58, y: 37, w: 14, h: 9 },
  ],
  hoodie: [
    { name: "Chest", x: 36, y: 36, w: 28, h: 13, r: -1 },
    { name: "Pocket", x: 35, y: 70, w: 30, h: 13, r: 1 },
    { name: "Left sleeve", x: 9, y: 44, w: 11, h: 12, r: -10 },
    { name: "Right sleeve", x: 80, y: 44, w: 11, h: 12, r: 10 },
    { name: "Waistband", x: 30, y: 87.6, w: 40, h: 5 },
  ],
};

/** Position for patch `i`: metadata first, then a same-named default slot, then the i-th default slot. */
export function slotFor(surface: SurfaceKind, i: number, label: string, meta?: Slot | null): Slot {
  if (meta) return meta;
  const defaults = DEFAULT_LAYOUTS[surface];
  return defaults.find((s) => s.name.toLowerCase() === label.toLowerCase()) ?? defaults[i % defaults.length];
}

/**
 * Patch spots for AI model shots (full body, centered, 2:3 portrait), which always share the same
 * framing. Used when the vision model can't suggest spots.
 */
export const MODEL_SHOT_LAYOUTS: Record<"front" | "back", Slot[]> = {
  front: [
    { name: "Chest", x: 38, y: 25, w: 24, h: 9 },
    { name: "Left sleeve", x: 27, y: 30, w: 8, h: 8, r: -6 },
    { name: "Right sleeve", x: 65, y: 30, w: 8, h: 8, r: 6 },
    { name: "Left thigh", x: 38, y: 57, w: 10, h: 9 },
    { name: "Right thigh", x: 52, y: 57, w: 10, h: 9 },
  ],
  back: [
    { name: "Upper back", x: 36, y: 23, w: 28, h: 12 },
    { name: "Lower back", x: 40, y: 39, w: 20, h: 6 },
  ],
};
