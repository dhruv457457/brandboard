"use client";

/**
 * Phone photos are often 5 to 12 MB, but the host refuses a request body over 4.5 MB before our code runs (a "413
 * Request Entity Too Large" that isn't even JSON). So a photo is scaled down in the browser first: the long side to at
 * most 2400 px and the quality lowered until it fits. 2400 px is more than the canvas, the poster or the card ever
 * shows. A file that already fits, an SVG or a PDF is left as it is.
 */
const LIMITS: Record<string, number> = { canvases: 3.6, proofs: 3.6, logos: 1.8, avatars: 1.8 };

export async function shrinkImage(file: File, bucket: string): Promise<File> {
  const limit = (LIMITS[bucket] ?? 3.6) * 1024 * 1024;
  if (file.size <= limit || !/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 5; attempt++) {
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      // WebP keeps transparency and is small; older Safari falls back to PNG, which we then step down in size.
      for (const quality of [0.88, 0.78, 0.68]) {
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
        if (blob && blob.type === "image/webp" && blob.size <= limit) {
          bitmap.close();
          return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
        }
      }
      scale *= 0.75;
    }
    bitmap.close();
  } catch {
    /* can't decode here: send the original and let the server's message explain */
  }
  return file;
}
