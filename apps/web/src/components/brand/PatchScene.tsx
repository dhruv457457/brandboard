"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, Line, RoundedBox } from "@react-three/drei";

/**
 * The landing page's 3D hero: an outfit, a vehicle and a team hoodie take turns in the middle, and pastel patches
 * with brand logos and prices fly in and stick to each one. The objects are drawn in code as soft, inflated shapes
 * (no models to download). Logos are real: sponsors' own logos from Patched, plus Monad and Privy. Prices are
 * examples.
 */

export type SceneKind = "outfit" | "car" | "hoodie";

/** A logo to print on patches; `mark` is a square version for small or tall patches, where a wordmark gets tiny. */
export interface SceneLogo {
  src: string;
  mark?: string;
}

const INK = "#0B0B0C";
const FABRIC = "#F7F5EF";
const RIB = "#ECE8DE";
const PASTEL = { p1: "#BDEBD3", p2: "#D9CCFF", p3: "#FFE58F", p4: "#BFE3FF", p5: "#FFC9DA" } as const;

interface SpotDef {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  color: keyof typeof PASTEL;
  price: string;
  /** Carries a brand logo (the rest say "your logo"). */
  logo?: boolean;
}

interface SurfaceDef {
  shape: () => THREE.Shape;
  spots: SpotDef[];
  scale: number;
}

// A puffy extrusion: a thin core with a deep, round bevel, pulled in so the outline stays where it's drawn.
const DEPTH = 0.12;
const BEVEL = 0.24;
const FRONT = DEPTH + BEVEL;
const EXTRUDE: THREE.ExtrudeGeometryOptions = {
  depth: DEPTH,
  bevelEnabled: true,
  bevelThickness: BEVEL,
  bevelSize: 0.16,
  bevelOffset: -0.12,
  bevelSegments: 12,
  // Not 48 (or 32-49): at those counts three.js drops part of the tee's front face on one sleeve, and the sleeve
  // looks see-through. 64 leaves every shape whole; check the tee again if this or the shapes change.
  curveSegments: 64,
};

function teeShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.42, 1.52);
  s.quadraticCurveTo(0, 1.1, 0.42, 1.52);
  s.lineTo(1.08, 1.36);
  s.lineTo(1.96, 0.8);
  s.quadraticCurveTo(2.06, 0.7, 1.98, 0.6);
  s.lineTo(1.64, 0.14);
  s.quadraticCurveTo(1.56, 0.05, 1.47, 0.11);
  s.lineTo(1.14, 0.4);
  s.quadraticCurveTo(1.08, -0.5, 1.14, -1.5);
  s.quadraticCurveTo(1.14, -1.64, 1.0, -1.64);
  s.lineTo(-1.0, -1.64);
  s.quadraticCurveTo(-1.14, -1.64, -1.14, -1.5);
  s.quadraticCurveTo(-1.08, -0.5, -1.14, 0.4);
  s.lineTo(-1.47, 0.11);
  s.quadraticCurveTo(-1.56, 0.05, -1.64, 0.14);
  s.lineTo(-1.98, 0.6);
  s.quadraticCurveTo(-2.06, 0.7, -1.96, 0.8);
  s.lineTo(-1.08, 1.36);
  s.lineTo(-0.42, 1.52);
  return s;
}

function hoodieShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.62, 1.4);
  s.bezierCurveTo(-0.74, 2.3, 0.74, 2.3, 0.62, 1.4);
  s.lineTo(1.12, 1.28);
  s.quadraticCurveTo(1.56, 1.16, 1.72, 0.68);
  s.lineTo(2.02, -0.9);
  s.quadraticCurveTo(2.05, -1.06, 1.9, -1.08);
  s.lineTo(1.6, -1.1);
  s.quadraticCurveTo(1.46, -1.1, 1.44, -0.96);
  s.lineTo(1.2, 0.18);
  s.lineTo(1.2, -1.45);
  s.quadraticCurveTo(1.2, -1.62, 1.03, -1.62);
  s.lineTo(-1.03, -1.62);
  s.quadraticCurveTo(-1.2, -1.62, -1.2, -1.45);
  s.lineTo(-1.2, 0.18);
  s.lineTo(-1.44, -0.96);
  s.quadraticCurveTo(-1.46, -1.1, -1.6, -1.1);
  s.lineTo(-1.9, -1.08);
  s.quadraticCurveTo(-2.05, -1.06, -2.02, -0.9);
  s.lineTo(-1.72, 0.68);
  s.quadraticCurveTo(-1.56, 1.16, -1.12, 1.28);
  s.lineTo(-0.62, 1.4);
  return s;
}

function carShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.3, -0.35);
  s.lineTo(-2.3, 0.14);
  s.quadraticCurveTo(-2.3, 0.42, -2.0, 0.45);
  s.lineTo(-1.55, 0.5);
  s.quadraticCurveTo(-1.18, 1.06, -0.7, 1.1);
  s.lineTo(0.52, 1.1);
  s.quadraticCurveTo(0.95, 1.06, 1.36, 0.56);
  s.lineTo(2.05, 0.42);
  s.quadraticCurveTo(2.36, 0.36, 2.36, 0.05);
  s.lineTo(2.36, -0.35);
  s.quadraticCurveTo(2.36, -0.5, 2.2, -0.5);
  s.lineTo(1.86, -0.5);
  s.absarc(1.36, -0.5, 0.5, 0, Math.PI, false);
  s.lineTo(-0.86, -0.5);
  s.absarc(-1.36, -0.5, 0.5, 0, Math.PI, false);
  s.lineTo(-2.15, -0.5);
  s.quadraticCurveTo(-2.3, -0.5, -2.3, -0.35);
  return s;
}

const SURFACES: Record<SceneKind, SurfaceDef> = {
  outfit: {
    shape: teeShape,
    scale: 1,
    spots: [
      { x: -0.5, y: 0.76, w: 0.58, h: 0.42, color: "p2", price: "$120", logo: true },
      { x: 0.52, y: 0.76, w: 0.5, h: 0.36, color: "p3", price: "$80", logo: true },
      { x: 0, y: -0.42, w: 1.12, h: 0.68, color: "p1", price: "$240", logo: true },
      { x: 1.6, y: 0.48, w: 0.34, h: 0.26, r: -0.92, color: "p5", price: "$45" },
    ],
  },
  car: {
    shape: carShape,
    scale: 0.84,
    spots: [
      { x: 0.08, y: -0.06, w: 1.36, h: 0.5, color: "p2", price: "$300", logo: true },
      { x: -1.72, y: 0.0, w: 0.62, h: 0.34, color: "p3", price: "$90", logo: true },
      { x: 1.8, y: 0.06, w: 0.54, h: 0.3, color: "p4", price: "$110" },
    ],
  },
  hoodie: {
    shape: hoodieShape,
    scale: 0.96,
    spots: [
      { x: 0, y: 0.58, w: 0.98, h: 0.52, color: "p2", price: "$150", logo: true },
      { x: -1.66, y: -0.28, w: 0.3, h: 0.5, r: 0.2, color: "p3", price: "$60", logo: true },
      { x: 1.66, y: -0.28, w: 0.3, h: 0.5, r: -0.2, color: "p5", price: "$60", logo: true },
      { x: 0, y: -0.26, w: 0.62, h: 0.26, color: "p4", price: "$95" },
    ],
  },
};
const ORDER: SceneKind[] = ["outfit", "car", "hoodie"];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Where the pointer is on the whole page, from -1 to 1, so the object turns even when the cursor is over the text. */
function usePagePointer() {
  const p = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      p.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return p;
}

function monoFont(px: number) {
  const family = getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim() || "ui-monospace, monospace";
  return `700 ${px}px ${family}`;
}

function canvasTexture(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** A price tag drawn on a canvas and used as a texture, so it lives inside the scene. */
function useTag(text: string) {
  const tag = useMemo(() => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const font = monoFont(60);
    ctx.font = font;
    const h = 100;
    c.width = Math.ceil(ctx.measureText(text).width + 64);
    c.height = h;
    ctx.font = font;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(0, 0, c.width, h, h / 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, h / 2 + 3);
    return { tex: canvasTexture(c), aspect: c.width / h };
  }, [text]);
  useEffect(() => () => tag?.tex.dispose(), [tag]);
  return tag;
}

/**
 * What's printed on a patch: a logo fitted inside the patch, or "YOUR LOGO" in faint type when there isn't one.
 * Logos load as images (brand logos from Supabase storage, partner marks as SVG data URLs).
 */
function usePrint(src: string | null, w: number, h: number) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let alive = true;
    const W = 512;
    const H = Math.round((W * h) / w);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const done = () => alive && setTex(canvasTexture(c));
    if (!src) {
      ctx.fillStyle = "rgba(11,11,12,0.55)";
      ctx.font = monoFont(Math.min(84, H * 0.36));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("YOUR LOGO", W / 2, H / 2 + 2, W * 0.86);
      done();
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const pad = 0.16;
        const scale = Math.min((W * (1 - pad * 2)) / img.width, (H * (1 - pad * 2)) / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        done();
      };
      img.src = src;
    }
    return () => {
      alive = false;
    };
  }, [src, w, h]);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

/** One patch: an ink-edged, slightly puffy pastel plate with a stitched edge, its print, and a price tag. */
function Spot({ spot, index, logo, reduced }: { spot: SpotDef; index: number; logo: string | null; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const from = useMemo(() => {
    const a = index * 2.3 + 0.7;
    return new THREE.Vector3(Math.cos(a) * 3.4, Math.sin(a) * 2.6, 3.2);
  }, [index]);
  const stitch = useMemo(() => {
    const w = spot.w / 2 - 0.05;
    const h = spot.h / 2 - 0.05;
    return [[-w, -h, 0.046], [w, -h, 0.046], [w, h, 0.046], [-w, h, 0.046], [-w, -h, 0.046]] as [number, number, number][];
  }, [spot.w, spot.h]);
  const tag = useTag(spot.price);
  const print = usePrint(logo, spot.w - 0.12, spot.h - 0.12);

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    if (born.current === null) born.current = state.clock.elapsedTime;
    const t = reduced ? 1 : clamp01((state.clock.elapsedTime - born.current - 0.45 - index * 0.17) / 0.6);
    const e = easeOutCubic(t);
    g.position.set(spot.x + from.x * (1 - e), spot.y + from.y * (1 - e), FRONT + 0.02 + from.z * (1 - e));
    g.rotation.z = (spot.r ?? 0) + (1 - e) * (index % 2 ? 1.1 : -1.1);
    g.scale.setScalar(Math.max(0.001, 0.3 + 0.7 * easeOutBack(t)));
  });

  return (
    <group ref={ref} position={[spot.x, spot.y, FRONT + 0.02]} rotation={[0, 0, spot.r ?? 0]}>
      <RoundedBox args={[spot.w + 0.06, spot.h + 0.06, 0.05]} radius={0.05} smoothness={4} position={[0, 0, -0.012]}>
        <meshStandardMaterial color={INK} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[spot.w, spot.h, 0.08]} radius={0.05} smoothness={5}>
        <meshPhysicalMaterial color={PASTEL[spot.color]} roughness={0.55} sheen={0.6} sheenRoughness={0.6} sheenColor="#FFFFFF" />
      </RoundedBox>
      {print && (
        <mesh position={[0, 0, 0.042]}>
          <planeGeometry args={[spot.w - 0.12, spot.h - 0.12]} />
          <meshBasicMaterial map={print} transparent toneMapped={false} />
        </mesh>
      )}
      <Line points={stitch} color={INK} lineWidth={1} dashed dashSize={0.04} gapSize={0.03} transparent opacity={0.4} />
      {tag && (
        // Counter-rotated so the tag stays level on tilted patches.
        <mesh position={[spot.w / 2 - 0.04, spot.h / 2 + 0.02, 0.07]} rotation={[0, 0, -(spot.r ?? 0)]}>
          <planeGeometry args={[0.2 * tag.aspect, 0.2]} />
          <meshBasicMaterial map={tag.tex} transparent toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

const pts = (list: number[][], z: number) => list.map(([x, y]) => [x, y, z] as [number, number, number]);

function Rib() {
  return <meshPhysicalMaterial color={RIB} roughness={0.9} sheen={1} sheenRoughness={0.7} sheenColor="#FFFFFF" />;
}

/** The tee's ribbed collar, and stitching along the hem and both cuffs. */
function TeeDetails() {
  const collar = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.44, 1.5, 0), new THREE.Vector3(0, 1.08, 0), new THREE.Vector3(0.44, 1.5, 0));
    return new THREE.TubeGeometry(curve, 40, 0.07, 16, false);
  }, []);
  useEffect(() => () => collar.dispose(), [collar]);
  const z = FRONT + 0.004;
  return (
    <>
      <mesh geometry={collar} position={[0, 0, FRONT - 0.06]}>
        <Rib />
      </mesh>
      <Line points={pts([[-0.94, -1.42], [0.94, -1.42]], z)} color={INK} lineWidth={1} dashed dashSize={0.07} gapSize={0.05} transparent opacity={0.25} />
      <Line points={pts([[-1.86, 0.66], [-1.54, 0.24]], z)} color={INK} lineWidth={1} dashed dashSize={0.06} gapSize={0.045} transparent opacity={0.25} />
      <Line points={pts([[1.86, 0.66], [1.54, 0.24]], z)} color={INK} lineWidth={1} dashed dashSize={0.06} gapSize={0.045} transparent opacity={0.25} />
    </>
  );
}

/** The hood's rim and opening, drawstrings with metal tips, a raised kangaroo pocket, ribbed cuffs and waistband. */
function HoodieDetails() {
  const pocket = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.66, -1.3);
    s.lineTo(0.66, -1.3);
    s.quadraticCurveTo(0.72, -1.3, 0.68, -1.22);
    s.lineTo(0.46, -0.66);
    s.lineTo(-0.46, -0.66);
    s.lineTo(-0.68, -1.22);
    s.quadraticCurveTo(-0.72, -1.3, -0.66, -1.3);
    return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 4, curveSegments: 12 });
  }, []);
  useEffect(() => () => pocket.dispose(), [pocket]);
  const mid = (FRONT - BEVEL) / 2;
  return (
    <>
      <mesh position={[0, 1.66, FRONT - 0.01]} scale={[1, 0.82, 1]}>
        <circleGeometry args={[0.36, 48]} />
        <meshStandardMaterial color="#D8D3C7" roughness={1} />
      </mesh>
      <mesh position={[0, 1.66, FRONT - 0.02]} scale={[1, 0.82, 1]}>
        <torusGeometry args={[0.38, 0.06, 16, 60]} />
        <Rib />
      </mesh>
      {[-0.18, 0.18].map((x) => (
        <group key={x} position={[x, 1.14, FRONT + 0.03]} rotation={[0, 0, x > 0 ? -0.05 : 0.05]}>
          <mesh>
            <cylinderGeometry args={[0.018, 0.018, 0.5, 10]} />
            <meshStandardMaterial color="#CFC9BB" />
          </mesh>
          <mesh position={[0, -0.28, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.08, 10]} />
            <meshStandardMaterial color="#9A968D" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh geometry={pocket} position={[0, 0, FRONT - 0.02]}>
        <Rib />
      </mesh>
      <RoundedBox args={[2.3, 0.2, 0.58]} radius={0.09} smoothness={4} position={[0, -1.54, mid]}>
        <Rib />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <RoundedBox key={side} args={[0.5, 0.16, 0.56]} radius={0.07} smoothness={4} position={[side * 1.74, -1.04, mid]} rotation={[0, 0, side * -0.1]}>
          <Rib />
        </RoundedBox>
      ))}
    </>
  );
}

/** Windows, door seams and handles, lights, bumpers, a mirror, and wheels that turn. */
function CarDetails({ reduced }: { reduced: boolean }) {
  const wheels = useRef<THREE.Group[]>([]);
  const windows = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1.36, 0.56);
    s.quadraticCurveTo(-1.08, 0.98, -0.68, 1.0);
    s.lineTo(0.48, 1.0);
    s.quadraticCurveTo(0.86, 0.97, 1.16, 0.56);
    s.lineTo(-1.36, 0.56);
    return new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24 });
  }, []);
  useEffect(() => () => windows.dispose(), [windows]);
  useFrame((_, dt) => {
    if (reduced) return;
    for (const w of wheels.current) if (w) w.rotation.z -= dt * 2.2;
  });
  const z = FRONT + 0.004;
  const half = (DEPTH + BEVEL * 2) / 2;
  const center = (DEPTH) / 2;
  return (
    <>
      <mesh geometry={windows} position={[0, 0, FRONT - 0.02]}>
        <meshPhysicalMaterial color="#CFDDE9" roughness={0.12} metalness={0.2} clearcoat={1} />
      </mesh>
      <mesh position={[-0.12, 0.78, FRONT + 0.02]}>
        <boxGeometry args={[0.08, 0.46, 0.02]} />
        <meshPhysicalMaterial color={FABRIC} clearcoat={0.8} />
      </mesh>
      {[[-0.12, -0.4, 0.52], [1.12, -0.36, 0.5], [-1.34, -0.3, 0.5]].map(([x, y0, y1]) => (
        <Line key={x} points={pts([[x, y0], [x, y1]], z)} color={INK} lineWidth={1} transparent opacity={0.22} />
      ))}
      {[-0.5, 0.62].map((x) => (
        <RoundedBox key={x} args={[0.2, 0.05, 0.04]} radius={0.02} smoothness={3} position={[x, 0.3, FRONT + 0.01]}>
          <meshStandardMaterial color="#B9B5AB" metalness={0.5} roughness={0.35} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.2, 0.12, 0.34]} radius={0.05} smoothness={3} position={[2.24, 0.2, center]}>
        <meshStandardMaterial color="#FFF3C4" emissive="#FFD76A" emissiveIntensity={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.14, 0.16, 0.34]} radius={0.05} smoothness={3} position={[-2.24, 0.24, center]}>
        <meshStandardMaterial color="#FF6B5B" emissive="#FF3B2B" emissiveIntensity={0.5} />
      </RoundedBox>
      {[2.28, -2.24].map((x) => (
        <RoundedBox key={x} args={[0.3, 0.16, 0.66]} radius={0.07} smoothness={4} position={[x, -0.4, center]}>
          <meshStandardMaterial color="#3A3935" roughness={0.6} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.14, 0.1, 0.12]} radius={0.04} smoothness={3} position={[1.2, 0.62, FRONT + 0.03]}>
        <meshPhysicalMaterial color={FABRIC} clearcoat={0.8} />
      </RoundedBox>
      {[-1.36, 1.36].map((x, i) => (
        <group key={x} position={[x, -0.5, center]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, half * 2 + 0.06, 48]} />
            <meshStandardMaterial color="#1A1A1C" roughness={0.75} />
          </mesh>
          <group
            ref={(g) => {
              if (g) wheels.current[i] = g;
            }}
            position={[0, 0, half + 0.035]}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.24, 0.24, 0.03, 40]} />
              <meshStandardMaterial color="#D9D6CE" metalness={0.55} roughness={0.3} />
            </mesh>
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} rotation={[0, 0, (k * Math.PI * 2) / 5]} position={[0, 0, 0.02]}>
                <boxGeometry args={[0.05, 0.4, 0.02]} />
                <meshStandardMaterial color="#8E8A81" metalness={0.6} roughness={0.35} />
              </mesh>
            ))}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.03]}>
              <cylinderGeometry args={[0.06, 0.06, 0.03, 20]} />
              <meshStandardMaterial color="#5E5B55" metalness={0.6} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

/** The fabric (or car body): a puffy extrusion, a sewn line just inside the edge, its details and patches. */
function Body({ kind, logos, reduced }: { kind: SceneKind; logos: SceneLogo[]; reduced: boolean }) {
  const def = SURFACES[kind];
  const { geometry, stitch, center } = useMemo(() => {
    const shape = def.shape();
    const geo = new THREE.ExtrudeGeometry(shape, EXTRUDE);
    const outline = shape.getPoints(96);
    const box = new THREE.Box2().setFromPoints(outline);
    const c = box.getCenter(new THREE.Vector2());
    const sewn = outline.map((p) => [c.x + (p.x - c.x) * 0.9, c.y + (p.y - c.y) * 0.9, FRONT + 0.004] as [number, number, number]);
    return { geometry: geo, stitch: sewn, center: c };
  }, [def]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Hand out the logos in turn, starting at a different one for each object so the same logo moves around.
  const offset = ORDER.indexOf(kind);
  let next = 0;
  const logoFor = (s: SpotDef) => {
    if (!s.logo || !logos.length) return null;
    const l = logos[(offset + next++) % logos.length];
    return l.mark && s.w / s.h < 1.7 ? l.mark : l.src;
  };
  const car = kind === "car";

  return (
    <group scale={def.scale} position={[-center.x * def.scale, -center.y * def.scale, 0]}>
      <mesh geometry={geometry}>
        {car ? (
          <meshPhysicalMaterial color="#F4F2EC" roughness={0.32} clearcoat={0.9} clearcoatRoughness={0.18} />
        ) : (
          <meshPhysicalMaterial color={FABRIC} roughness={0.85} sheen={1} sheenRoughness={0.65} sheenColor="#FFFFFF" />
        )}
      </mesh>
      {!car && <Line points={stitch} color={INK} lineWidth={1} dashed dashSize={0.07} gapSize={0.05} transparent opacity={0.22} />}
      {kind === "outfit" && <TeeDetails />}
      {kind === "hoodie" && <HoodieDetails />}
      {car && <CarDetails reduced={reduced} />}
      {def.spots.map((s, i) => (
        <Spot key={`${kind}-${i}`} spot={s} index={i} logo={logoFor(s)} reduced={reduced} />
      ))}
    </group>
  );
}

/** Swaps objects with a quick spin-and-shrink, and turns the object toward the pointer. */
function Stage({ kind, logos, reduced }: { kind: SceneKind; logos: SceneLogo[]; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const [shown, setShown] = useState(kind);
  const phase = useRef<"in" | "out" | "idle">(reduced ? "idle" : "in");
  const grow = useRef(reduced ? 1 : 0);
  const pointer = usePagePointer();

  useEffect(() => {
    if (kind === shown) return;
    if (reduced) setShown(kind);
    else phase.current = "out";
  }, [kind, shown, reduced]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (phase.current === "out") {
      grow.current = Math.max(0, grow.current - dt * 3.4);
      if (grow.current === 0) {
        phase.current = "in";
        setShown(kind);
      }
    } else if (phase.current === "in") {
      grow.current = Math.min(1, grow.current + dt * 2.1);
      if (grow.current === 1) phase.current = "idle";
    }
    const k = reduced ? 1 : easeOutBack(grow.current);
    g.scale.setScalar(Math.max(0.001, k));
    const time = state.clock.elapsedTime;
    const targetY = reduced ? -0.22 : pointer.current.x * 0.5 + Math.sin(time * 0.45) * 0.14 - 0.18 + (1 - grow.current) * 1.6;
    const targetX = reduced ? 0.06 : -pointer.current.y * 0.18 + 0.05;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 4, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 4, dt);
    g.position.y = reduced ? 0 : Math.sin(time * 0.8) * 0.06;
  });

  return (
    <group ref={group}>
      <Body key={shown} kind={shown} logos={logos} reduced={reduced} />
    </group>
  );
}

function Tile({ position, color, size, rotation = 0 }: { position: [number, number, number]; color: keyof typeof PASTEL; size: [number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0.25, -0.3, rotation]}>
      <RoundedBox args={[size[0] + 0.06, size[1] + 0.06, 0.05]} radius={0.06} smoothness={4} position={[0, 0, -0.015]}>
        <meshStandardMaterial color={INK} />
      </RoundedBox>
      <RoundedBox args={[size[0], size[1], 0.08]} radius={0.05} smoothness={5}>
        <meshPhysicalMaterial color={PASTEL[color]} roughness={0.5} sheen={0.6} sheenColor="#FFFFFF" />
      </RoundedBox>
    </group>
  );
}

function Coin({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[Math.PI / 2 - 0.35, 0, 0.3]}>
      <mesh>
        <cylinderGeometry args={[0.26, 0.26, 0.07, 48]} />
        <meshPhysicalMaterial color="#2775CA" metalness={0.4} roughness={0.25} clearcoat={1} />
      </mesh>
      <mesh position={[0, 0.037, 0]}>
        <torusGeometry args={[0.17, 0.018, 12, 40]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

/** Loose patches and USDC coins drifting around the object. */
function Drift({ reduced }: { reduced: boolean }) {
  const speed = reduced ? 0 : 1.3;
  const items: { key: string; node: ReactNode }[] = [
    { key: "t1", node: <Tile position={[-1.95, 1.75, -1.2]} color="p3" size={[0.5, 0.34]} rotation={-0.3} /> },
    { key: "t2", node: <Tile position={[1.95, 1.6, -1.4]} color="p2" size={[0.4, 0.4]} rotation={0.2} /> },
    { key: "t3", node: <Tile position={[-1.95, -1.55, -0.4]} color="p1" size={[0.56, 0.32]} rotation={0.15} /> },
    { key: "c1", node: <Coin position={[1.9, -1.35, 0.2]} /> },
    { key: "c2", node: <Coin position={[-1.7, 0.25, -1.8]} /> },
  ];
  return (
    <>
      {items.map((it) => (
        <Float key={it.key} speed={speed} rotationIntensity={0.7} floatIntensity={0.9} floatingRange={[-0.12, 0.12]}>
          {it.node}
        </Float>
      ))}
    </>
  );
}

export default function PatchScene({ kind, logos, reduced, active }: { kind: SceneKind; logos: SceneLogo[]; reduced: boolean; active: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.1, 8.6], fov: 32 }}
      gl={{ antialias: true, alpha: true }}
      frameloop={active ? "always" : "never"}
      style={{ touchAction: "pan-y" }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 5]} intensity={1.5} />
      <directionalLight position={[-5, 1, 2]} intensity={0.45} color="#FFC9B0" />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.6} position={[0, 4, 6]} scale={[12, 5, 1]} />
        <Lightformer intensity={0.9} color="#FF5A1F" position={[-6, 0, 3]} rotation={[0, Math.PI / 2, 0]} scale={[4, 8, 1]} />
        <Lightformer intensity={0.6} color="#D9CCFF" position={[6, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 8, 1]} />
      </Environment>
      <Stage kind={kind} logos={logos} reduced={reduced} />
      <Drift reduced={reduced} />
      <ContactShadows position={[0, -2.15, 0]} opacity={0.32} scale={9} blur={2.8} far={4} resolution={512} />
    </Canvas>
  );
}
