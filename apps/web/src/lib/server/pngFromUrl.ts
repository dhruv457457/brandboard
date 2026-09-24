import "server-only";

/** next/og can't draw WebP (our transparent cutouts), so fetch an image and hand back a PNG data URL. */
export async function pngDataUrl(url: string | null | undefined, height = 900): Promise<string | null> {
  return (await pngImage(url, height))?.src ?? null;
}

/** Like pngDataUrl, plus the image's size (to lay patches over it by percent). */
export async function pngImage(url: string | null | undefined, height = 900): Promise<{ src: string; width: number; height: number } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ height, withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { src: `data:image/png;base64,${data.toString("base64")}`, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 500 | 800 }[]> | null = null;

/** Bricolage Grotesque 800 (headlines) and Geist 500 (body) as TTF for next/og, fetched once per server. */
export function posterFonts() {
  fonts ??= Promise.all(
    [
      { name: "Bricolage", family: "Bricolage+Grotesque", weight: 800 as const },
      { name: "Geist", family: "Geist", weight: 500 as const },
    ].map(async (f) => {
      // Without a browser user agent Google Fonts serves TrueType, which next/og can read.
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${f.family}:wght@${f.weight}`)).text();
      const src = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
      if (!src) throw new Error(`no TTF for ${f.name}`);
      return { name: f.name, data: await (await fetch(src)).arrayBuffer(), weight: f.weight };
    }),
  ).catch((err) => {
    fonts = null;
    throw err;
  });
  return fonts;
}
