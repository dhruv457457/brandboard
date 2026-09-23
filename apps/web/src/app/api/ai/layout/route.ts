import { NextResponse } from "next/server";

const LAYOUTS = {
  outfit: [
    { id: "neck", name: "Neckline", x: 38, y: 24.5, w: 24, h: 7, floor: 150, buyNow: 600, r: -2 },
    { id: "belt", name: "Waist belt", x: 39, y: 37.6, w: 22, h: 4.6, floor: 120, buyNow: 450, r: 1.5 },
    { id: "hipL", name: "Left hip", x: 36, y: 44, w: 13, h: 8, floor: 60, buyNow: 300, r: -3 },
    { id: "hipR", name: "Right hip", x: 51, y: 44, w: 13, h: 8, floor: 60, buyNow: 300, r: 2 },
    { id: "skirt", name: "Skirt center", x: 40, y: 57, w: 20, h: 11, floor: 200, buyNow: 540, r: -1.5 },
    { id: "hemL", name: "Hem left", x: 27, y: 78, w: 19, h: 9, floor: 80, buyNow: 320, r: -2.5 },
    { id: "hemR", name: "Hem right", x: 54, y: 78, w: 19, h: 9, floor: 80, buyNow: 320, r: 3 },
  ],
  car: [
    { id: "fend", name: "Front fender", x: 11, y: 56, w: 12, h: 5.5, floor: 60, buyNow: 220 },
    { id: "fdoor", name: "Front door", x: 34, y: 53, w: 19, h: 19, floor: 250, buyNow: 900, r: -1 },
    { id: "rdoor", name: "Rear door", x: 55.5, y: 53, w: 11.5, h: 19, floor: 150, buyNow: 500, r: 1 },
    { id: "rq", name: "Rear quarter", x: 71, y: 52.5, w: 18, h: 6, floor: 80, buyNow: 260 },
    { id: "rwin", name: "Rear window", x: 58, y: 37, w: 14, h: 9, floor: 50, buyNow: 180 },
  ],
  hoodie: [
    { id: "chest", name: "Chest", x: 36, y: 36, w: 28, h: 13, floor: 150, buyNow: 500, r: -1 },
    { id: "sl", name: "Left sleeve", x: 9, y: 44, w: 11, h: 12, floor: 50, buyNow: 180, r: -10 },
    { id: "sr", name: "Right sleeve", x: 80, y: 44, w: 11, h: 12, floor: 50, buyNow: 180, r: 10 },
    { id: "pocket", name: "Pocket", x: 35, y: 70, w: 30, h: 13, floor: 90, buyNow: 300, r: 1 },
    { id: "band", name: "Waistband", x: 30, y: 87.6, w: 40, h: 5, floor: 40, buyNow: 150 },
  ],
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const surface = (body.surface || "outfit") as keyof typeof LAYOUTS;
    const patches = LAYOUTS[surface] || LAYOUTS.outfit;

    // Simulate AI reasoning delay
    await new Promise((res) => setTimeout(res, 600));

    return NextResponse.json({
      success: true,
      patches,
      message: `AI suggested ${patches.length} high-attention spots`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to generate layout" },
      { status: 500 }
    );
  }
}
