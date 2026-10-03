import type { CSSProperties, ReactNode } from "react";
import { eventInitials, eventPastels } from "@/lib/events";
import { cn } from "@/lib/utils";

type Variant = "header" | "card" | "thumb";

/**
 * Same crop everywhere: the event page, the Events list and the admin preview all use these classes, so what an
 * admin sees while uploading is what the page shows. Header is 3:1 (2:1 on phones), card and thumb are 3:1.
 */
const BOX: Record<Variant, string> = {
  header: "aspect-[2/1] sm:aspect-[3/1] border-b-2 border-[var(--line)]",
  card: "aspect-[3/1] border-b-2 border-[var(--line)]",
  thumb: "aspect-[3/1] w-[72px] flex-none rounded-lg border-[1.5px] border-[var(--line)]",
};

/** Cover image, or a patch pattern in the event's own pastels when there isn't one yet. Children sit on top (badges). */
export function EventCover({
  name, banner, seed, variant, className, children,
}: { name: string; banner: string | null; seed: number; variant: Variant; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("relative w-full overflow-hidden bg-[var(--soft)]", BOX[variant], className)}>
      {banner ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          {variant === "header" && <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/10 to-transparent" aria-hidden="true" />}
        </>
      ) : (
        <PatchPattern name={name} seed={seed} small={variant === "thumb"} />
      )}
      {children}
    </div>
  );
}

const TILES: { right: string; top: string; rotate: number; pastel: 0 | 1 | 2 }[] = [
  { right: "6%", top: "14%", rotate: -8, pastel: 0 },
  { right: "21%", top: "36%", rotate: 6, pastel: 1 },
  { right: "35%", top: "10%", rotate: -3, pastel: 2 },
];

/** No cover yet: stitched patches on a pastel wash. Patches are decoration, so there is no text to repeat the title. */
function PatchPattern({ name, seed, small }: { name: string; seed: number; small: boolean }) {
  const [a, b, c] = eventPastels(seed);
  const pastels = [a, b, c];
  return (
    <div className="absolute inset-0 [container-type:size]" style={{ background: `linear-gradient(135deg, var(${a}), var(${b}) 70%, var(${c}))` }} aria-hidden="true">
      {(small ? TILES.slice(0, 2) : TILES).map((t, i) => (
        <span
          key={i}
          className="absolute aspect-square rounded-[14%] border-[1.5px] border-black/85 shadow-[0_3px_6px_-2px_rgba(0,0,0,.35)]"
          style={{
            right: t.right, top: t.top, height: "52%", transform: `rotate(${t.rotate}deg)`,
            background: `radial-gradient(130% 100% at 28% 18%, rgba(255,255,255,.55), transparent 55%), var(${pastels[(t.pastel + 1) % 3]})`,
          } as CSSProperties}
        >
          <span className="absolute inset-[7%] rounded-[10%] border-[1.5px] border-dashed border-black/50" />
          {i === 0 && !small && (
            <span className="absolute inset-0 grid place-items-center font-display font-extrabold leading-none tracking-[-.04em] text-[var(--on-patch)] text-[clamp(14px,17cqh,44px)]">
              {eventInitials(name)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** The event's own patch: a pastel tile with its initials, stitched like a real patch. Overlaps the cover edge. */
export function EventMark({ name, seed, size = 84, className }: { name: string; seed: number; size?: number; className?: string }) {
  const [a, b] = eventPastels(seed);
  return (
    <span
      className={cn("relative grid flex-none place-items-center rounded-[22%] border-2 border-black/90 shadow-[3px_3px_0_var(--shadow)] -rotate-3", className)}
      style={{ width: size, height: size, background: `radial-gradient(130% 100% at 28% 18%, rgba(255,255,255,.55), transparent 55%), linear-gradient(135deg, var(${a}), var(${b}))` }}
      aria-hidden="true"
    >
      <span className="absolute inset-[6%] rounded-[16%] border-[1.5px] border-dashed border-black/50" />
      <span className="font-display font-extrabold leading-none tracking-[-.04em] text-[var(--on-patch)]" style={{ fontSize: size * 0.38 }}>
        {eventInitials(name)}
      </span>
    </span>
  );
}
