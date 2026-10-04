import "server-only";

// Draws a Living Patch card (the SVG from lib/patchCard.ts) as a PNG: the share image and the Open Graph picture.
// resvg understands patterns, text on a path and filters, which next/og's Satori does not; it needs the fonts as files.

import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fonts: Promise<string[]> | null = null;

/** Bricolage Grotesque 800, Geist 600, Geist Mono 500 and 600 as TTF files, fetched once per server instance (resvg reads fonts from disk). */
function cardFonts(): Promise<string[]> {
  fonts ??= Promise.all(
    [
      ["Bricolage+Grotesque", 800],
      ["Geist", 600],
      ["Geist+Mono", 500],
      ["Geist+Mono", 600],
    ].map(async ([family, weight]) => {
      // Without a browser user agent Google Fonts serves TrueType, which resvg can read.
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)).text();
      const src = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
      if (!src) throw new Error(`no TTF for ${family} ${weight}`);
      const dir = join(tmpdir(), "patched-card-fonts");
      await mkdir(dir, { recursive: true });
      const file = join(dir, `${family}-${weight}.ttf`);
      await writeFile(file, new Uint8Array(await (await fetch(src)).arrayBuffer()));
      return file;
    }),
  ).catch((err) => {
    fonts = null;
    throw err;
  });
  return fonts;
}

/** Turn the card SVG into a PNG. Fonts that cannot be fetched fall back to resvg's defaults rather than failing. */
export async function cardPng(svg: string, size = 1000): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");
  const fontFiles = await cardFonts().catch(() => [] as string[]);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { fontFiles, loadSystemFonts: fontFiles.length === 0, defaultFontFamily: "Arial" },
  });
  return Buffer.from(resvg.render().asPng());
}

/** A photo as a data URL the SVG can embed (resvg does not fetch links). Null if it cannot be read in time. */
export async function photoDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: 1000, height: 1000, fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}
